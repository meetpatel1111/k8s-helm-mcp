/**
 * Toolsets: registration-time gating of which tools the server exposes.
 *
 * Large tool surfaces cost the model context and can hit client tool-count
 * limits, so operators can select a subset via env vars. This only controls
 * which tools are *registered* — it never changes any tool's behavior. The
 * default (no env set) is "all", identical to registering every tool.
 *
 *   K8S_TOOLSETS           comma list of categories and/or presets. Default "all".
 *                          categories: cluster,nodes,pods,workloads,networking,
 *                          storage,security,monitoring,config,diagnostics,
 *                          advanced,templates,websocket,multicluster,sre,helm
 *                          presets:    all | full | admin | kubernetes | helm |
 *                                      core | diagnostics
 *                          filters:    readonly | readwrite | nodelete | lean
 *   K8S_DISABLED_TOOLSETS  comma list of categories to remove after selection.
 *
 * "kubernetes" (alias "k8s") selects every Kubernetes category and excludes
 * Helm; "helm" selects only the Helm tools — the two are complements that
 * together equal "all".
 *
 * Access-level ladder (familiar from other Kubernetes MCP servers), expressed
 * as filters over the selected categories:
 *   readonly   only read/list/get/inspect tools (same classification the Strict
 *              protection mode uses) — ideal for read-heavy enterprise fleets.
 *   readwrite  reads + resource CRUD, but NOT node-admin ops (cordon, drain,
 *              taint, node labels). The middle rung of the ladder.
 *   admin      alias for "all" — every tool, including node lifecycle.
 * "nodelete" is an orthogonal filter (reads + updates, no delete/destroy;
 * mirrors the NoDelete protection mode) and composes with readwrite, e.g.
 * "readwrite,nodelete". "lean" exposes just the generic kubectl passthrough
 * plus a few core reads. Filters compose with any category selection, e.g.
 * "kubernetes,readonly". Default (unset) is "all".
 */
import { K8sClient } from "./k8s-client.js";
import { CacheManager } from "./cache-manager.js";
import { ProtectionManager } from "./security/protection-manager.js";
import { ToolRegistration } from "./tool-registry.js";

import { registerClusterTools } from "./k8s-tools/cluster.js";
import { registerNodeTools } from "./k8s-tools/nodes.js";
import { registerPodTools } from "./k8s-tools/pods.js";
import { registerWorkloadTools } from "./k8s-tools/workloads.js";
import { registerNetworkingTools } from "./k8s-tools/networking.js";
import { registerStorageTools } from "./k8s-tools/storage.js";
import { registerSecurityTools } from "./k8s-tools/security.js";
import { registerMonitoringTools } from "./k8s-tools/monitoring.js";
import { registerConfigTools } from "./k8s-tools/config.js";
import { registerDiagnosticsTools } from "./k8s-tools/diagnostics.js";
import { registerAdvancedTools } from "./k8s-tools/advanced.js";
import { registerTemplateTools } from "./k8s-tools/templates.js";
import { registerWebSocketTools } from "./k8s-tools/websocket.js";
import { registerMultiClusterTools } from "./k8s-tools/multi-cluster.js";
import { registerIncidentSnapshotTools } from "./k8s-tools/incident-snapshot.js";
import { registerChangesSinceTools } from "./k8s-tools/changes-since.js";
import { registerBlastRadiusTools } from "./k8s-tools/blast-radius.js";
import { registerWorkloadDiffTools } from "./k8s-tools/workload-diff.js";
import { registerSilentKillersTools } from "./k8s-tools/silent-killers.js";
import { registerHelmReleaseListTools } from "./helm-tools/release-list.js";
import { registerHelmReleaseStatusTools } from "./helm-tools/release-status.js";
import { registerHelmReleaseHistoryTools } from "./helm-tools/release-history.js";
import { registerHelmReleaseGetValuesTools } from "./helm-tools/release-get-values.js";
import { registerHelmReleaseInstallTools } from "./helm-tools/release-install.js";
import { registerHelmReleaseUninstallTools } from "./helm-tools/release-uninstall.js";
import { registerHelmReleaseUpgradeTools } from "./helm-tools/release-upgrade.js";
import { registerHelmReleaseRollbackTools } from "./helm-tools/release-rollback.js";
import { registerHelmReleaseTestTools } from "./helm-tools/release-test.js";
import { registerHelmReleaseGetInfoTools } from "./helm-tools/release-get-info.js";
import { registerHelmSearchHubTools } from "./helm-tools/search-hub.js";
import { registerHelmRepoManagementTools } from "./helm-tools/repo-management.js";
import { registerHelmShowChartTools } from "./helm-tools/show-chart.js";
import { registerHelmChartManagementTools } from "./helm-tools/chart-management.js";
import { registerHelmChartTemplateTools } from "./helm-tools/chart-template.js";
import { registerHelmDependencyManagementTools } from "./helm-tools/dependency-management.js";
import { registerHelmPluginManagementTools } from "./helm-tools/plugin-management.js";
import { registerHelmRegistryManagementTools } from "./helm-tools/registry-management.js";
import { registerHelmEnvironmentTools } from "./helm-tools/environment.js";

export const TOOLSET_CATEGORIES = [
  "cluster", "nodes", "pods", "workloads", "networking", "storage", "security",
  "monitoring", "config", "diagnostics", "advanced", "templates", "websocket",
  "multicluster", "sre", "helm",
] as const;
export type ToolsetCategory = (typeof TOOLSET_CATEGORIES)[number];

/** Every category except Helm — the "kubernetes" preset. */
const KUBERNETES_CATEGORIES = TOOLSET_CATEGORIES.filter((c) => c !== "helm");

/** Preset names that expand to a group of categories. */
const PRESET_CATEGORIES: Record<string, ToolsetCategory[]> = {
  kubernetes: KUBERNETES_CATEGORIES,
  k8s: KUBERNETES_CATEGORIES,
  helm: ["helm"],
  core: ["cluster", "nodes", "pods", "workloads", "networking", "storage", "config"],
  diagnostics: ["diagnostics", "monitoring", "sre"],
};

/** Minimal footprint: generic passthrough + a handful of core reads. */
const LEAN_TOOL_NAMES = new Set<string>([
  "k8s_kubectl",
  "k8s_cluster_health", "k8s_cluster_info", "k8s_list_namespaces",
  "k8s_list_pods", "k8s_get_pod", "k8s_get_logs",
  "k8s_list_deployments", "k8s_list_services", "k8s_list_events",
]);

/** Build the full set of tools grouped by category (all instantiated). */
export function buildCategorizedTools(
  k8sClient: K8sClient,
  cacheManager?: CacheManager,
): Record<ToolsetCategory, ToolRegistration[]> {
  return {
    cluster: registerClusterTools(k8sClient),
    nodes: registerNodeTools(k8sClient),
    pods: registerPodTools(k8sClient),
    workloads: registerWorkloadTools(k8sClient),
    networking: registerNetworkingTools(k8sClient),
    storage: registerStorageTools(k8sClient),
    security: registerSecurityTools(k8sClient),
    monitoring: registerMonitoringTools(k8sClient),
    config: registerConfigTools(k8sClient),
    diagnostics: registerDiagnosticsTools(k8sClient),
    advanced: registerAdvancedTools(k8sClient, cacheManager),
    templates: registerTemplateTools(k8sClient),
    websocket: registerWebSocketTools(k8sClient),
    multicluster: registerMultiClusterTools(k8sClient),
    sre: [
      ...registerIncidentSnapshotTools(k8sClient),
      ...registerChangesSinceTools(k8sClient),
      ...registerBlastRadiusTools(k8sClient),
      ...registerWorkloadDiffTools(k8sClient),
      ...registerSilentKillersTools(k8sClient),
    ],
    helm: [
      ...registerHelmReleaseListTools(k8sClient),
      ...registerHelmReleaseStatusTools(k8sClient),
      ...registerHelmReleaseHistoryTools(k8sClient),
      ...registerHelmReleaseGetValuesTools(k8sClient),
      ...registerHelmReleaseInstallTools(k8sClient),
      ...registerHelmReleaseUninstallTools(k8sClient),
      ...registerHelmReleaseUpgradeTools(k8sClient),
      ...registerHelmReleaseRollbackTools(k8sClient),
      ...registerHelmReleaseTestTools(k8sClient),
      ...registerHelmReleaseGetInfoTools(k8sClient),
      ...registerHelmSearchHubTools(k8sClient),
      ...registerHelmRepoManagementTools(k8sClient),
      ...registerHelmShowChartTools(k8sClient),
      ...registerHelmChartManagementTools(k8sClient),
      ...registerHelmChartTemplateTools(k8sClient),
      ...registerHelmDependencyManagementTools(k8sClient),
      ...registerHelmPluginManagementTools(k8sClient),
      ...registerHelmRegistryManagementTools(k8sClient),
      ...registerHelmEnvironmentTools(k8sClient),
    ],
  };
}

export interface ToolsetSelection {
  categories: Set<ToolsetCategory>;
  readOnly: boolean;
  readWrite: boolean;
  noDelete: boolean;
  lean: boolean;
  raw: string;
}

function splitEnv(value: string | undefined): string[] {
  return (value || "").toLowerCase().split(",").map((t) => t.trim()).filter(Boolean);
}

/** Parse K8S_TOOLSETS / K8S_DISABLED_TOOLSETS into a resolved selection. */
export function loadToolsetConfig(): ToolsetSelection {
  const raw = (process.env.K8S_TOOLSETS || "all").trim();
  const tokens = splitEnv(raw);
  const disabled = new Set(splitEnv(process.env.K8S_DISABLED_TOOLSETS));

  const categories = new Set<ToolsetCategory>();
  let readOnly = false;
  let readWrite = false;
  let noDelete = false;
  let lean = false;
  const addAll = () => TOOLSET_CATEGORIES.forEach((c) => categories.add(c));

  for (const t of tokens) {
    if (t === "all" || t === "full" || t === "admin") addAll();
    else if (t === "readonly" || t === "read-only" || t === "ro") readOnly = true;
    else if (t === "readwrite" || t === "read-write" || t === "rw") readWrite = true;
    else if (t === "nodelete" || t === "no-delete") noDelete = true;
    else if (t === "lean" || t === "minimal") lean = true;
    else if (PRESET_CATEGORIES[t]) PRESET_CATEGORIES[t].forEach((c) => categories.add(c));
    else if ((TOOLSET_CATEGORIES as readonly string[]).includes(t)) categories.add(t as ToolsetCategory);
    else console.error(`[toolsets] ignoring unknown toolset '${t}'`);
  }

  // If only filter flags (or nothing usable) were given, default to every category.
  if (categories.size === 0) addAll();
  for (const d of disabled) categories.delete(d as ToolsetCategory);

  return { categories, readOnly, readWrite, noDelete, lean, raw };
}

/** Apply a selection to the categorized tools, returning the tools to register. */
export function selectTools(
  categorized: Record<ToolsetCategory, ToolRegistration[]>,
  sel: ToolsetSelection,
): ToolRegistration[] {
  let entries: ToolRegistration[] = [];
  for (const cat of TOOLSET_CATEGORIES) {
    if (sel.categories.has(cat)) entries = entries.concat(categorized[cat]);
  }
  if (sel.lean) {
    entries = entries.filter((e) => LEAN_TOOL_NAMES.has(e.tool.name));
  }
  if (sel.readOnly) {
    // Strictest rung — terminal; readonly already excludes writes and deletes.
    entries = entries.filter((e) => ProtectionManager.isReadOnly(e.tool.name));
  } else {
    // readwrite and nodelete are independent filters that compose (AND).
    if (sel.readWrite) {
      entries = entries.filter((e) => !ProtectionManager.isNodeAdmin(e.tool.name));
    }
    if (sel.noDelete) {
      entries = entries.filter((e) => !ProtectionManager.isDeletion(e.tool.name));
    }
  }
  return entries;
}

/** Human-readable summary of the active selection (for logs / server info). */
export function describeSelection(sel: ToolsetSelection): string {
  const cats = sel.categories.size === TOOLSET_CATEGORIES.length
    ? "all"
    : [...sel.categories].join("+");
  const flags = [
    sel.readOnly ? "readonly" : "",
    sel.readWrite ? "readwrite" : "",
    sel.noDelete ? "nodelete" : "",
    sel.lean ? "lean" : "",
  ].filter(Boolean);
  return flags.length ? `${cats} (${flags.join(",")})` : cats;
}
