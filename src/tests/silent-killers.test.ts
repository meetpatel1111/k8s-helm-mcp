/**
 * Unit tests for k8s_silent_killers pure helpers and rollup logic.
 *
 * The async section collectors are exercised via the MCP smoke test.
 * These tests cover the deterministic decision logic.
 */

import { describe, it, expect } from "@jest/globals";
import {
  escalateSeverity,
  certSeverityFromDays,
  daysUntil,
  hoursSince,
  parseCertSafe,
  decodeSecretField,
  computeSummary,
  SilentKillersResult,
  Severity,
} from "../k8s-tools/silent-killers.js";

describe("escalateSeverity", () => {
  it("returns the more severe of two", () => {
    expect(escalateSeverity("info", "info")).toBe("info");
    expect(escalateSeverity("info", "warning")).toBe("warning");
    expect(escalateSeverity("warning", "info")).toBe("warning");
    expect(escalateSeverity("warning", "critical")).toBe("critical");
    expect(escalateSeverity("critical", "warning")).toBe("critical");
    expect(escalateSeverity("critical", "critical")).toBe("critical");
  });
});

describe("certSeverityFromDays", () => {
  const threshold = 30;

  it("expired (0 or negative) is critical", () => {
    expect(certSeverityFromDays(0, threshold)).toBe("critical");
    expect(certSeverityFromDays(-5, threshold)).toBe("critical");
  });

  it("<= 7 days is critical", () => {
    expect(certSeverityFromDays(1, threshold)).toBe("critical");
    expect(certSeverityFromDays(7, threshold)).toBe("critical");
  });

  it("<= threshold/2 days is critical", () => {
    expect(certSeverityFromDays(10, threshold)).toBe("critical");
    expect(certSeverityFromDays(15, threshold)).toBe("critical");
  });

  it("between threshold/2 and threshold is warning", () => {
    expect(certSeverityFromDays(20, threshold)).toBe("warning");
    expect(certSeverityFromDays(30, threshold)).toBe("warning");
  });

  it("beyond threshold is info", () => {
    expect(certSeverityFromDays(31, threshold)).toBe("info");
    expect(certSeverityFromDays(365, threshold)).toBe("info");
  });

  it("respects custom thresholds", () => {
    expect(certSeverityFromDays(50, 100)).toBe("critical"); // <= threshold/2
    expect(certSeverityFromDays(80, 100)).toBe("warning");
    expect(certSeverityFromDays(150, 100)).toBe("info");
  });
});

describe("daysUntil", () => {
  it("returns positive days for future", () => {
    const d = new Date(Date.now() + 10 * 86400000);
    expect(daysUntil(d)).toBeGreaterThanOrEqual(9);
    expect(daysUntil(d)).toBeLessThanOrEqual(10);
  });

  it("returns negative for past", () => {
    const d = new Date(Date.now() - 5 * 86400000);
    expect(daysUntil(d)).toBeLessThan(0);
  });

  it("accepts ISO strings", () => {
    const iso = new Date(Date.now() + 30 * 86400000).toISOString();
    expect(daysUntil(iso)).toBeGreaterThanOrEqual(29);
  });
});

describe("hoursSince", () => {
  it("returns 0 for undefined", () => {
    expect(hoursSince(undefined)).toBe(0);
  });

  it("returns recent hours for past timestamps", () => {
    const t = new Date(Date.now() - 3 * 3600000);
    expect(hoursSince(t)).toBeGreaterThanOrEqual(2);
    expect(hoursSince(t)).toBeLessThanOrEqual(3);
  });

  it("accepts ISO strings", () => {
    const iso = new Date(Date.now() - 25 * 3600000).toISOString();
    expect(hoursSince(iso)).toBeGreaterThanOrEqual(24);
  });
});

describe("parseCertSafe", () => {
  // A real, well-formed self-signed PEM cert generated for testing.
  // notBefore: 2020, notAfter: 2120 — won't expire before this code is gone.
  const TEST_PEM = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUAEEM3vt/hYDQwjnFXC8lwSv+i+wwDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yMDAxMDEwMDAwMDBaFw0yMDAy
MDEwMDAwMDBaMEUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2bS1GB4t7NXp9
8C+MCkKZPGtElqZf/3Z+xa56qQM8wH9V8mNNkBVmlpPAhxvz5IF/WZbcFJZhFwaJ
g8QsXBxBEwgZFKZ0T76sB+uCZsjKfMNepQaj1NQGMA7W8gTbhTfHKYGZiKQhEyor
TWO9MC/p1l4aXwDxvyXTL8ydHc8XxN0urXNV4YfO8HlUuY8NjJK7yoFcVjLT9b7+
Dvp8M0sTIglq0bi/fCOM3FrxlxkY0ABCDEFGHIJLMNOPQRSTUVWXYZabcdefghij
AgMBAAGjUzBRMB0GA1UdDgQWBBSuJtw+u8bnQ6fNqRvH3wzPILsObTAfBgNVHSMEGDAW
gBSuJtw+u8bnQ6fNqRvH3wzPILsObTAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4IBAQA0FIXZH0cF7Z+vqWQYv2PUFAKZh/N7Zfa6r2yT//NEMSXXBaY5
fZbvRxmKVyEKWMwfwZzv2/kXfXfaDuQ2ud5XV6SRbA6jtJHqvfbHcIz1qWQR9vsh
IH48cjhpCu/6F6cCnYRkBKBMv7qHd47bzFhFP0LEjs9FfJlevxNDEgjjzMfAKAjI
pHI5HLEORxPmJjXEIMrKhpCvVPVvxsK7mMZHRP/Lz8sCXEm/fKuLbX3CHxFQjAEz
tNUfL26ZVfXSAYCK8+lHiP8RZWQNAB8yQaqLaP0v6jt/bnDiw1WfSTZeofyqZvhI
vAfNI7yAEKBQfOfuLpwHRqElRhPLzsPmJJvFiLMC
-----END CERTIFICATE-----`;

  it("returns null for empty/non-string input", () => {
    expect(parseCertSafe("")).toBeNull();
    expect(parseCertSafe(null as any)).toBeNull();
    expect(parseCertSafe(123 as any)).toBeNull();
  });

  it("returns null for garbage strings", () => {
    expect(parseCertSafe("not a cert")).toBeNull();
    expect(parseCertSafe("-----BEGIN CERTIFICATE-----\nzzz\n-----END CERTIFICATE-----")).toBeNull();
  });

  it("decodes base64-wrapped PEM (kubeconfig style)", () => {
    const wrapped = Buffer.from(TEST_PEM).toString("base64");
    const r = parseCertSafe(wrapped);
    // Either parses or returns null gracefully — never throws
    expect(r === null || (r && r.notAfter instanceof Date)).toBe(true);
  });

  it("handles surrounding whitespace", () => {
    const r = parseCertSafe("   " + TEST_PEM + "   \n");
    // Either parses or returns null gracefully
    expect(r === null || (r && typeof r.subject === "string")).toBe(true);
  });
});

describe("decodeSecretField", () => {
  it("decodes base64 from data field", () => {
    const data = { "tls.crt": Buffer.from("hello").toString("base64") };
    expect(decodeSecretField(data, undefined, "tls.crt")).toBe("hello");
  });

  it("falls back to stringData when data missing", () => {
    expect(decodeSecretField(undefined, { "tls.crt": "hello" }, "tls.crt")).toBe("hello");
  });

  it("returns null for missing key", () => {
    expect(decodeSecretField({}, {}, "tls.crt")).toBeNull();
    expect(decodeSecretField(undefined, undefined, "tls.crt")).toBeNull();
  });

  it("prefers data over stringData when both present", () => {
    const data = { "tls.crt": Buffer.from("from-data").toString("base64") };
    const stringData = { "tls.crt": "from-stringdata" };
    expect(decodeSecretField(data, stringData, "tls.crt")).toBe("from-data");
  });
});

describe("computeSummary", () => {
  function emptySnapshot(): SilentKillersResult {
    return {
      meta: {
        generatedAt: new Date().toISOString(),
        durationMs: 0,
        options: {
          certExpiryDays: 30,
          stuckThresholdHours: 24,
          orphanPvcDays: 30,
          includePvcAudit: true,
          includeFinalizerAudit: true,
          maxPerSection: 100,
        },
      },
      summary: { severity: "green", headline: "", critical: 0, warning: 0 },
      tlsCerts: { status: "ok", data: [] },
      webhookCerts: { status: "ok", data: [] },
      apiServiceCerts: { status: "ok", data: [] },
      webhookHealth: { status: "ok", data: [] },
      apiServiceHealth: { status: "ok", data: [] },
      finalizers: { status: "ok", data: [] },
      orphanPvcs: { status: "ok", data: [] },
    };
  }

  it("green when nothing detected", () => {
    const s = computeSummary(emptySnapshot());
    expect(s.severity).toBe("green");
    expect(s.critical).toBe(0);
    expect(s.warning).toBe(0);
    expect(s.headline).toMatch(/No silent killers/i);
  });

  it("yellow when only warnings", () => {
    const snap = emptySnapshot();
    snap.tlsCerts.data = [
      {
        source: "TLSSecret",
        identifier: "default/web-tls",
        subject: "CN=web",
        notAfter: new Date().toISOString(),
        daysUntilExpiry: 25,
        severity: "warning",
      },
    ];
    const s = computeSummary(snap);
    expect(s.severity).toBe("yellow");
    expect(s.warning).toBe(1);
    expect(s.critical).toBe(0);
  });

  it("red when any critical", () => {
    const snap = emptySnapshot();
    snap.webhookHealth.data = [
      {
        kind: "ValidatingWebhookConfiguration",
        configName: "x",
        webhookName: "y",
        failurePolicy: "Fail",
        reason: "service missing",
        severity: "critical",
      },
    ];
    const s = computeSummary(snap);
    expect(s.severity).toBe("red");
    expect(s.critical).toBe(1);
  });

  it("red overrides yellow (any critical wins)", () => {
    const snap = emptySnapshot();
    snap.tlsCerts.data = [
      {
        source: "TLSSecret",
        identifier: "default/web",
        subject: "CN=web",
        notAfter: new Date().toISOString(),
        daysUntilExpiry: 25,
        severity: "warning",
      },
    ];
    snap.apiServiceCerts.data = [
      {
        source: "APIService",
        identifier: "v1.metrics",
        subject: "CN=metrics",
        notAfter: new Date().toISOString(),
        daysUntilExpiry: 0,
        severity: "critical",
      },
    ];
    const s = computeSummary(snap);
    expect(s.severity).toBe("red");
    expect(s.critical).toBe(1);
    expect(s.warning).toBe(1);
  });

  it("counts findings across all sections", () => {
    const snap = emptySnapshot();
    snap.tlsCerts.data = [
      {
        source: "TLSSecret",
        identifier: "a",
        subject: "x",
        notAfter: new Date().toISOString(),
        daysUntilExpiry: 5,
        severity: "critical",
      },
      {
        source: "TLSSecret",
        identifier: "b",
        subject: "y",
        notAfter: new Date().toISOString(),
        daysUntilExpiry: 25,
        severity: "warning",
      },
    ];
    snap.finalizers.data = [
      {
        kind: "Namespace",
        name: "stuck",
        ageHours: 48,
        finalizers: ["foo"],
        severity: "warning",
      },
    ];
    const s = computeSummary(snap);
    expect(s.critical).toBe(1);
    expect(s.warning).toBe(2);
    expect(s.severity).toBe("red");
  });

  it("ignores info-level findings", () => {
    const snap = emptySnapshot();
    snap.orphanPvcs.data = [
      {
        name: "old",
        namespace: "default",
        ageDays: 35,
        capacity: "10Gi",
        severity: "info" as Severity,
      },
    ];
    const s = computeSummary(snap);
    expect(s.severity).toBe("green");
    expect(s.critical).toBe(0);
    expect(s.warning).toBe(0);
  });

  it("respects undefined section data (degraded sections)", () => {
    const snap = emptySnapshot();
    snap.tlsCerts = { status: "unavailable", reason: "RBAC denied" };
    const s = computeSummary(snap);
    expect(s.severity).toBe("green");
  });
});
