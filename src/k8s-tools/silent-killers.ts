import * as k8s from "@kubernetes/client-node";
import { X509Certificate } from "node:crypto";
import { K8sClient } from "../k8s-client.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { classifyError, ErrorContext } from "../error-handling.js";

/**
 * Registers the k8s_silent_killers SRE tool.
 *
 * Scheduled audit of slow-burning issues that quietly degrade clusters
 * until they cause an outage. Designed to run periodically (cron, scheduled
 * agent) and surface anything actionable before it bites.
 *
 * Checks:
 *   - TLS Secret expiry (kubernetes.io/tls)
 *   - Webhook caBundle expiry (Validating/Mutating)
 *   - APIService caBundle expiry
 *   - Webhook health (failurePolicy=Fail with missing service or no endpoints)
 *   - Stale APIServices (Available=False for >threshold)
 *   - Stuck finalizers (namespaces/resources terminating for >threshold)
 *   - Old bound PVCs with no pods (capped to avoid slowness on huge clusters)
 *
 * Read-only. Safe under all protection modes.
 */
export function registerSilentKillersTools(
  k8sClient: K8sClient,
): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_silent_killers",
        description:
          "Scheduled audit of slow-burning cluster issues: expiring TLS certs (Secrets, webhook caBundles, APIService caBundles), broken webhooks (failurePolicy=Fail with missing/empty backing service), stale APIServices, stuck finalizers, and orphaned bound PVCs. Returns prioritized findings with severity. Designed for periodic (cron) execution. Read-only and safe under all protection modes.",
        inputSchema: {
          type: "object",
          properties: {
            certExpiryDays: {
              type: "number",
              description:
                "Days threshold for cert expiry warnings. Defaults to 30.",
              default: 30,
            },
            stuckThresholdHours: {
              type: "number",
              description:
                "Hours threshold for stuck finalizers and stale APIServices. Defaults to 24.",
              default: 24,
            },
            orphanPvcDays: {
              type: "number",
              description:
                "Days threshold for orphan bound PVCs (no consumer pods). Defaults to 30.",
              default: 30,
            },
            includePvcAudit: {
              type: "boolean",
              description:
                "Whether to scan PVCs (slow on clusters with thousands of PVCs). Defaults to true.",
              default: true,
            },
            includeFinalizerAudit: {
              type: "boolean",
              description:
                "Whether to scan namespaces and pods for stuck finalizers. Defaults to true.",
              default: true,
            },
            maxPerSection: {
              type: "number",
              description:
                "Maximum findings returned per check. Defaults to 100.",
              default: 100,
            },
          },
        },
      },
      handler: async (args: {
        certExpiryDays?: number;
        stuckThresholdHours?: number;
        orphanPvcDays?: number;
        includePvcAudit?: boolean;
        includeFinalizerAudit?: boolean;
        maxPerSection?: number;
      }) => {
        const startedAt = Date.now();
        const opts = {
          certExpiryDays: args.certExpiryDays ?? 30,
          stuckThresholdHours: args.stuckThresholdHours ?? 24,
          orphanPvcDays: args.orphanPvcDays ?? 30,
          includePvcAudit: args.includePvcAudit ?? true,
          includeFinalizerAudit: args.includeFinalizerAudit ?? true,
          maxPerSection: args.maxPerSection ?? 100,
        };

        const [
          tlsCerts,
          webhookCerts,
          apiServiceCerts,
          webhookHealth,
          apiServiceHealth,
          finalizers,
          orphanPvcs,
        ] = await Promise.all([
          collectTlsCertExpiry(k8sClient, opts),
          collectWebhookCertExpiry(k8sClient, opts),
          collectApiServiceCertExpiry(k8sClient, opts),
          collectWebhookHealth(k8sClient, opts),
          collectStaleApiServices(k8sClient, opts),
          opts.includeFinalizerAudit
            ? collectStuckFinalizers(k8sClient, opts)
            : Promise.resolve<SectionResult<StuckResource[]>>({
                status: "ok",
                reason: "skipped (includeFinalizerAudit=false)",
                data: [],
              }),
          opts.includePvcAudit
            ? collectOrphanPvcs(k8sClient, opts)
            : Promise.resolve<SectionResult<OrphanPvc[]>>({
                status: "ok",
                reason: "skipped (includePvcAudit=false)",
                data: [],
              }),
        ]);

        const snapshot: SilentKillersResult = {
          meta: {
            generatedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
            options: opts,
          },
          summary: { severity: "green", headline: "", critical: 0, warning: 0 },
          tlsCerts,
          webhookCerts,
          apiServiceCerts,
          webhookHealth,
          apiServiceHealth,
          finalizers,
          orphanPvcs,
        };
        snapshot.summary = computeSummary(snapshot);
        return snapshot;
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Public types (exported for testing)
// ---------------------------------------------------------------------------

export type Severity = "info" | "warning" | "critical";
type SectionStatus = "ok" | "degraded" | "unavailable";

export interface SectionResult<T> {
  status: SectionStatus;
  reason?: string;
  data?: T;
}

export interface CertFinding {
  source:
    | "TLSSecret"
    | "ValidatingWebhook"
    | "MutatingWebhook"
    | "APIService";
  identifier: string;
  subject: string;
  notAfter: string;
  daysUntilExpiry: number;
  severity: Severity;
}

export interface BrokenWebhook {
  kind: "ValidatingWebhookConfiguration" | "MutatingWebhookConfiguration";
  configName: string;
  webhookName: string;
  failurePolicy: string;
  reason: string;
  severity: Severity;
}

export interface StaleApiService {
  name: string;
  conditionReason: string;
  conditionMessage: string;
  ageHours: number;
  severity: Severity;
}

export interface StuckResource {
  kind: "Namespace" | "Pod";
  name: string;
  namespace?: string;
  ageHours: number;
  finalizers: string[];
  severity: Severity;
}

export interface OrphanPvc {
  name: string;
  namespace: string;
  ageDays: number;
  capacity: string;
  storageClass?: string;
  severity: Severity;
}

export interface SilentKillersResult {
  meta: {
    generatedAt: string;
    durationMs: number;
    options: {
      certExpiryDays: number;
      stuckThresholdHours: number;
      orphanPvcDays: number;
      includePvcAudit: boolean;
      includeFinalizerAudit: boolean;
      maxPerSection: number;
    };
  };
  summary: {
    severity: "green" | "yellow" | "red";
    headline: string;
    critical: number;
    warning: number;
  };
  tlsCerts: SectionResult<CertFinding[]>;
  webhookCerts: SectionResult<CertFinding[]>;
  apiServiceCerts: SectionResult<CertFinding[]>;
  webhookHealth: SectionResult<BrokenWebhook[]>;
  apiServiceHealth: SectionResult<StaleApiService[]>;
  finalizers: SectionResult<StuckResource[]>;
  orphanPvcs: SectionResult<OrphanPvc[]>;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Severity order for escalation: info < warning < critical. */
export function escalateSeverity(a: Severity, b: Severity): Severity {
  const rank: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Decide cert severity from days-until-expiry.
 *  expired or <= 0 days       → critical
 *  <= 7 days remaining        → critical
 *  <= threshold/2 days        → critical
 *  <= threshold days          → warning
 *  > threshold days           → info (won't be reported normally)
 */
export function certSeverityFromDays(
  daysUntilExpiry: number,
  threshold: number,
): Severity {
  if (daysUntilExpiry <= 0) return "critical";
  if (daysUntilExpiry <= 7) return "critical";
  if (daysUntilExpiry <= threshold / 2) return "critical";
  if (daysUntilExpiry <= threshold) return "warning";
  return "info";
}

/**
 * Calculate days from now until a date string (ISO or Date).
 * Negative when in the past.
 */
export function daysUntil(notAfter: string | Date): number {
  const t = typeof notAfter === "string" ? new Date(notAfter) : notAfter;
  return Math.floor((t.getTime() - Date.now()) / 86400000);
}

/**
 * Hours since a given timestamp.
 */
export function hoursSince(ts: string | Date | undefined): number {
  if (!ts) return 0;
  const t = typeof ts === "string" ? new Date(ts) : ts;
  return Math.floor((Date.now() - t.getTime()) / 3600000);
}

/**
 * Parse a single PEM-encoded certificate (or the FIRST cert in a chain) and
 * return notAfter + subject. Returns null on parse failure.
 *
 * Accepts PEM bundles (will use the first cert), raw base64 (DER will fail
 * gracefully), or strings with leading/trailing whitespace.
 */
export function parseCertSafe(
  pemOrBase64: string,
): { subject: string; notAfter: Date } | null {
  if (!pemOrBase64 || typeof pemOrBase64 !== "string") return null;
  try {
    const trimmed = pemOrBase64.trim();
    let pem = trimmed;
    if (!trimmed.includes("-----BEGIN CERTIFICATE-----")) {
      // Not PEM — assume base64-encoded PEM (kubeconfig/secret style)
      try {
        pem = Buffer.from(trimmed, "base64").toString("utf-8");
      } catch {
        return null;
      }
    }
    if (!pem.includes("-----BEGIN CERTIFICATE-----")) return null;
    // Take the first cert in the bundle
    const match = pem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/,
    );
    if (!match) return null;
    const cert = new X509Certificate(match[0]);
    return { subject: cert.subject, notAfter: new Date(cert.validTo) };
  } catch {
    return null;
  }
}

/**
 * Decode a Kubernetes Secret's data field. Secret.data values are base64-
 * encoded; Secret.stringData values are not. This returns the decoded
 * UTF-8 string from data first, falling back to stringData.
 */
export function decodeSecretField(
  data: Record<string, string> | undefined,
  stringData: Record<string, string> | undefined,
  key: string,
): string | null {
  if (data && data[key]) {
    try {
      return Buffer.from(data[key], "base64").toString("utf-8");
    } catch {
      return null;
    }
  }
  if (stringData && stringData[key]) return stringData[key];
  return null;
}

// ---------------------------------------------------------------------------
// Section collectors
// ---------------------------------------------------------------------------

interface AuditOptions {
  certExpiryDays: number;
  stuckThresholdHours: number;
  orphanPvcDays: number;
  maxPerSection: number;
}

async function collectTlsCertExpiry(
  k8sClient: K8sClient,
  opts: AuditOptions,
): Promise<SectionResult<CertFinding[]>> {
  try {
    const core = k8sClient.getCoreV1Api();
    const list = await core.listSecretForAllNamespaces();
    const findings: CertFinding[] = [];
    for (const s of list.items) {
      if (s.type !== "kubernetes.io/tls") continue;
      const pem = decodeSecretField(s.data, s.stringData, "tls.crt");
      if (!pem) continue;
      const parsed = parseCertSafe(pem);
      if (!parsed) continue;
      const days = daysUntil(parsed.notAfter);
      const severity = certSeverityFromDays(days, opts.certExpiryDays);
      if (severity === "info") continue;
      findings.push({
        source: "TLSSecret",
        identifier: `${s.metadata?.namespace ?? "?"}/${s.metadata?.name ?? "?"}`,
        subject: parsed.subject,
        notAfter: parsed.notAfter.toISOString(),
        daysUntilExpiry: days,
        severity,
      });
      if (findings.length >= opts.maxPerSection) break;
    }
    findings.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    return { status: "ok", data: findings };
  } catch (err) {
    const ctx: ErrorContext = { operation: "k8s_silent_killers.tlsCerts" };
    return {
      status: "unavailable",
      reason: classifyError(err, ctx).message,
    };
  }
}

async function collectWebhookCertExpiry(
  k8sClient: K8sClient,
  opts: AuditOptions,
): Promise<SectionResult<CertFinding[]>> {
  try {
    const kc = (k8sClient as any).kc as k8s.KubeConfig | undefined;
    if (!kc)
      return {
        status: "degraded",
        reason: "AdmissionRegistration API client unavailable",
        data: [],
      };
    const adm = kc.makeApiClient(k8s.AdmissionregistrationV1Api);
    const findings: CertFinding[] = [];

    const [vw, mw] = await Promise.all([
      adm.listValidatingWebhookConfiguration().catch(() => null),
      adm.listMutatingWebhookConfiguration().catch(() => null),
    ]);

    const inspect = (
      configs:
        | { items: Array<{ metadata?: { name?: string }; webhooks?: any[] }> }
        | null,
      kind: "ValidatingWebhook" | "MutatingWebhook",
    ): void => {
      if (!configs) return;
      for (const cfg of configs.items) {
        for (const wh of cfg.webhooks ?? []) {
          const ca = wh.clientConfig?.caBundle;
          if (!ca) continue;
          const parsed = parseCertSafe(ca);
          if (!parsed) continue;
          const days = daysUntil(parsed.notAfter);
          const severity = certSeverityFromDays(days, opts.certExpiryDays);
          if (severity === "info") continue;
          findings.push({
            source: kind,
            identifier: `${cfg.metadata?.name ?? "?"}/${wh.name}`,
            subject: parsed.subject,
            notAfter: parsed.notAfter.toISOString(),
            daysUntilExpiry: days,
            severity,
          });
          if (findings.length >= opts.maxPerSection) return;
        }
      }
    };

    inspect(vw, "ValidatingWebhook");
    inspect(mw, "MutatingWebhook");
    findings.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    return { status: "ok", data: findings };
  } catch (err) {
    const ctx: ErrorContext = { operation: "k8s_silent_killers.webhookCerts" };
    return {
      status: "unavailable",
      reason: classifyError(err, ctx).message,
    };
  }
}

async function collectApiServiceCertExpiry(
  k8sClient: K8sClient,
  opts: AuditOptions,
): Promise<SectionResult<CertFinding[]>> {
  try {
    const kc = (k8sClient as any).kc as k8s.KubeConfig | undefined;
    if (!kc)
      return {
        status: "degraded",
        reason: "ApiRegistration API client unavailable",
        data: [],
      };
    const reg = kc.makeApiClient(k8s.ApiregistrationV1Api);
    const list = await reg.listAPIService();
    const findings: CertFinding[] = [];

    for (const svc of list.items) {
      const ca = svc.spec?.caBundle;
      if (!ca) continue;
      const parsed = parseCertSafe(ca);
      if (!parsed) continue;
      const days = daysUntil(parsed.notAfter);
      const severity = certSeverityFromDays(days, opts.certExpiryDays);
      if (severity === "info") continue;
      findings.push({
        source: "APIService",
        identifier: svc.metadata?.name ?? "?",
        subject: parsed.subject,
        notAfter: parsed.notAfter.toISOString(),
        daysUntilExpiry: days,
        severity,
      });
      if (findings.length >= opts.maxPerSection) break;
    }
    findings.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    return { status: "ok", data: findings };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_silent_killers.apiServiceCerts",
    };
    return {
      status: "unavailable",
      reason: classifyError(err, ctx).message,
    };
  }
}

async function collectWebhookHealth(
  k8sClient: K8sClient,
  opts: AuditOptions,
): Promise<SectionResult<BrokenWebhook[]>> {
  try {
    const kc = (k8sClient as any).kc as k8s.KubeConfig | undefined;
    if (!kc)
      return {
        status: "degraded",
        reason: "API clients unavailable",
        data: [],
      };
    const adm = kc.makeApiClient(k8s.AdmissionregistrationV1Api);
    const core = k8sClient.getCoreV1Api();
    const findings: BrokenWebhook[] = [];

    const [vw, mw] = await Promise.all([
      adm.listValidatingWebhookConfiguration().catch(() => null),
      adm.listMutatingWebhookConfiguration().catch(() => null),
    ]);

    const checkSvc = async (
      ns: string | undefined,
      name: string | undefined,
    ): Promise<string | null> => {
      if (!ns || !name) return null;
      try {
        await core.readNamespacedService({ name, namespace: ns });
      } catch {
        return `service ${ns}/${name} not found`;
      }
      try {
        const ep = await core.readNamespacedEndpoints({ name, namespace: ns });
        const ready = (ep.subsets ?? []).some((sub) =>
          (sub.addresses ?? []).length > 0,
        );
        if (!ready) {
          return `endpoints ${ns}/${name} have no ready addresses`;
        }
      } catch {
        return `endpoints ${ns}/${name} not found`;
      }
      return null;
    };

    const inspect = async (
      configs:
        | {
            items: Array<{
              metadata?: { name?: string };
              webhooks?: Array<{
                name?: string;
                failurePolicy?: string;
                clientConfig?: {
                  service?: { name?: string; namespace?: string };
                };
              }>;
            }>;
          }
        | null,
      kind: BrokenWebhook["kind"],
    ): Promise<void> => {
      if (!configs) return;
      for (const cfg of configs.items) {
        for (const wh of cfg.webhooks ?? []) {
          if (wh.failurePolicy !== "Fail") continue;
          const reason = await checkSvc(
            wh.clientConfig?.service?.namespace,
            wh.clientConfig?.service?.name,
          );
          if (reason) {
            findings.push({
              kind,
              configName: cfg.metadata?.name ?? "?",
              webhookName: wh.name ?? "?",
              failurePolicy: wh.failurePolicy ?? "Fail",
              reason,
              severity: "critical",
            });
            if (findings.length >= opts.maxPerSection) return;
          }
        }
      }
    };

    await inspect(vw, "ValidatingWebhookConfiguration");
    await inspect(mw, "MutatingWebhookConfiguration");
    return { status: "ok", data: findings };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_silent_killers.webhookHealth",
    };
    return {
      status: "unavailable",
      reason: classifyError(err, ctx).message,
    };
  }
}

async function collectStaleApiServices(
  k8sClient: K8sClient,
  opts: AuditOptions,
): Promise<SectionResult<StaleApiService[]>> {
  try {
    const kc = (k8sClient as any).kc as k8s.KubeConfig | undefined;
    if (!kc)
      return {
        status: "degraded",
        reason: "ApiRegistration API client unavailable",
        data: [],
      };
    const reg = kc.makeApiClient(k8s.ApiregistrationV1Api);
    const list = await reg.listAPIService();
    const findings: StaleApiService[] = [];

    for (const svc of list.items) {
      const cond = svc.status?.conditions?.find((c) => c.type === "Available");
      if (!cond || cond.status === "True") continue;
      const ageHours = hoursSince(cond.lastTransitionTime);
      if (ageHours < opts.stuckThresholdHours) continue;
      findings.push({
        name: svc.metadata?.name ?? "?",
        conditionReason: cond.reason ?? "Unknown",
        conditionMessage: (cond.message ?? "").slice(0, 240),
        ageHours,
        severity: ageHours > opts.stuckThresholdHours * 4 ? "critical" : "warning",
      });
      if (findings.length >= opts.maxPerSection) break;
    }
    return { status: "ok", data: findings };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_silent_killers.apiServiceHealth",
    };
    return {
      status: "unavailable",
      reason: classifyError(err, ctx).message,
    };
  }
}

async function collectStuckFinalizers(
  k8sClient: K8sClient,
  opts: AuditOptions,
): Promise<SectionResult<StuckResource[]>> {
  try {
    const core = k8sClient.getCoreV1Api();
    const findings: StuckResource[] = [];

    const nsList = await core.listNamespace();
    for (const ns of nsList.items) {
      if (!ns.metadata?.deletionTimestamp) continue;
      const ageHours = hoursSince(ns.metadata.deletionTimestamp);
      if (ageHours < opts.stuckThresholdHours) continue;
      findings.push({
        kind: "Namespace",
        name: ns.metadata.name ?? "?",
        ageHours,
        finalizers: [
          ...(ns.spec?.finalizers ?? []),
          ...(ns.metadata.finalizers ?? []),
        ],
        severity: ageHours > opts.stuckThresholdHours * 4 ? "critical" : "warning",
      });
      if (findings.length >= opts.maxPerSection) break;
    }

    if (findings.length < opts.maxPerSection) {
      const podList = await core.listPodForAllNamespaces();
      for (const pod of podList.items) {
        if (!pod.metadata?.deletionTimestamp) continue;
        const ageHours = hoursSince(pod.metadata.deletionTimestamp);
        if (ageHours < opts.stuckThresholdHours) continue;
        findings.push({
          kind: "Pod",
          name: pod.metadata.name ?? "?",
          namespace: pod.metadata.namespace,
          ageHours,
          finalizers: pod.metadata.finalizers ?? [],
          severity:
            ageHours > opts.stuckThresholdHours * 4 ? "critical" : "warning",
        });
        if (findings.length >= opts.maxPerSection) break;
      }
    }

    findings.sort((a, b) => b.ageHours - a.ageHours);
    return { status: "ok", data: findings };
  } catch (err) {
    const ctx: ErrorContext = { operation: "k8s_silent_killers.finalizers" };
    return {
      status: "unavailable",
      reason: classifyError(err, ctx).message,
    };
  }
}

async function collectOrphanPvcs(
  k8sClient: K8sClient,
  opts: AuditOptions,
): Promise<SectionResult<OrphanPvc[]>> {
  try {
    const core = k8sClient.getCoreV1Api();
    const [pvcList, podList] = await Promise.all([
      core.listPersistentVolumeClaimForAllNamespaces(),
      core.listPodForAllNamespaces(),
    ]);

    // Build set of PVC keys (ns/name) currently referenced by pods.
    const referenced = new Set<string>();
    for (const pod of podList.items) {
      const ns = pod.metadata?.namespace;
      for (const v of pod.spec?.volumes ?? []) {
        const cn = v.persistentVolumeClaim?.claimName;
        if (cn && ns) referenced.add(`${ns}/${cn}`);
      }
    }

    const findings: OrphanPvc[] = [];
    const orphanThresholdMs = opts.orphanPvcDays * 86400000;
    for (const pvc of pvcList.items) {
      if (pvc.status?.phase !== "Bound") continue;
      const key = `${pvc.metadata?.namespace ?? "?"}/${pvc.metadata?.name ?? "?"}`;
      if (referenced.has(key)) continue;
      const created = pvc.metadata?.creationTimestamp;
      if (!created) continue;
      const ageMs = Date.now() - new Date(created).getTime();
      if (ageMs < orphanThresholdMs) continue;
      const ageDays = Math.floor(ageMs / 86400000);
      findings.push({
        name: pvc.metadata?.name ?? "?",
        namespace: pvc.metadata?.namespace ?? "?",
        ageDays,
        capacity: pvc.spec?.resources?.requests?.storage ?? "unknown",
        storageClass: pvc.spec?.storageClassName,
        severity: ageDays > opts.orphanPvcDays * 3 ? "warning" : "info",
      });
      if (findings.length >= opts.maxPerSection) break;
    }
    findings.sort((a, b) => b.ageDays - a.ageDays);
    return { status: "ok", data: findings };
  } catch (err) {
    const ctx: ErrorContext = { operation: "k8s_silent_killers.orphanPvcs" };
    return {
      status: "unavailable",
      reason: classifyError(err, ctx).message,
    };
  }
}

// ---------------------------------------------------------------------------
// Severity rollup (exported for testing)
// ---------------------------------------------------------------------------

export function computeSummary(
  snap: SilentKillersResult,
): SilentKillersResult["summary"] {
  let critical = 0;
  let warning = 0;
  const headlineParts: string[] = [];

  const tally = (
    items: Array<{ severity: Severity }> | undefined,
    label: string,
  ): void => {
    if (!items || items.length === 0) return;
    let c = 0;
    let w = 0;
    for (const it of items) {
      if (it.severity === "critical") c++;
      else if (it.severity === "warning") w++;
    }
    critical += c;
    warning += w;
    if (c > 0 || w > 0) {
      headlineParts.push(`${label}: ${c} critical, ${w} warning`);
    }
  };

  tally(snap.tlsCerts.data, "TLS certs");
  tally(snap.webhookCerts.data, "webhook certs");
  tally(snap.apiServiceCerts.data, "APIService certs");
  tally(snap.webhookHealth.data, "broken webhooks");
  tally(snap.apiServiceHealth.data, "stale APIServices");
  tally(snap.finalizers.data, "stuck finalizers");
  tally(snap.orphanPvcs.data, "orphan PVCs");

  let severity: "green" | "yellow" | "red" = "green";
  if (critical > 0) severity = "red";
  else if (warning > 0) severity = "yellow";

  return {
    severity,
    headline:
      headlineParts.length === 0
        ? "No silent killers detected."
        : headlineParts.join("; "),
    critical,
    warning,
  };
}
