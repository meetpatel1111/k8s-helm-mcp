import { applySortAndLimit, extractFieldValue, applyGetFormatting, isNotFoundError } from "../utils/query-helper.js";

describe("query-helper", () => {
  describe("extractFieldValue", () => {
    const sample = {
      name: "frontend-pod",
      namespace: "production",
      status: "Running",
      metadata: {
        name: "frontend-pod",
        namespace: "production",
        creationTimestamp: "2026-01-01T00:00:00Z",
      },
      spec: {
        nodeName: "node-1",
      },
      ip: "10.244.0.5",
      restarts: 3,
      replicas: 5,
    };

    it("should extract top-level properties", () => {
      expect(extractFieldValue(sample, "name")).toBe("frontend-pod");
      expect(extractFieldValue(sample, "status")).toBe("Running");
      expect(extractFieldValue(sample, "restarts")).toBe(3);
    });

    it("should extract nested properties with dot notation", () => {
      expect(extractFieldValue(sample, "metadata.name")).toBe("frontend-pod");
      expect(extractFieldValue(sample, ".metadata.creationTimestamp")).toBe("2026-01-01T00:00:00Z");
      expect(extractFieldValue(sample, "spec.nodeName")).toBe("node-1");
    });

    it("should resolve common shorthand aliases", () => {
      expect(extractFieldValue(sample, "creationTimestamp")).toBe("2026-01-01T00:00:00Z");
      expect(extractFieldValue(sample, "age")).toBe("2026-01-01T00:00:00Z");
      expect(extractFieldValue(sample, "node")).toBe("node-1");
      expect(extractFieldValue(sample, "ip")).toBe("10.244.0.5");
    });

    it("should return undefined for non-existent paths safely", () => {
      expect(extractFieldValue(sample, "nonexistent")).toBeUndefined();
      expect(extractFieldValue(sample, "metadata.nonexistent.deep")).toBeUndefined();
      expect(extractFieldValue(null, "name")).toBeUndefined();
    });
  });

  describe("applySortAndLimit", () => {
    const items = [
      { name: "web-2", restarts: 5, created: "2026-01-03T00:00:00Z" },
      { name: "web-1", restarts: 0, created: "2026-01-01T00:00:00Z" },
      { name: "api-1", restarts: 2, created: "2026-01-02T00:00:00Z" },
    ];

    it("should return all items intact when no options provided", () => {
      const res = applySortAndLimit(items);
      expect(res.total).toBe(3);
      expect(res.returned).toBe(3);
      expect(res.sortedBy).toBeUndefined();
      expect(res.items.map((i) => i.name)).toEqual(["web-2", "web-1", "api-1"]);
    });

    it("should sort items ascending by string field", () => {
      const res = applySortAndLimit(items, { sortBy: "name" });
      expect(res.sortedBy).toBe("name (asc)");
      expect(res.items.map((i) => i.name)).toEqual(["api-1", "web-1", "web-2"]);
    });

    it("should sort items descending by string field", () => {
      const res = applySortAndLimit(items, { sortBy: "name", descending: true });
      expect(res.sortedBy).toBe("name (desc)");
      expect(res.items.map((i) => i.name)).toEqual(["web-2", "web-1", "api-1"]);
    });

    it("should sort items ascending by numeric field", () => {
      const res = applySortAndLimit(items, { sortBy: "restarts" });
      expect(res.items.map((i) => i.restarts)).toEqual([0, 2, 5]);
    });

    it("should sort items descending by numeric field", () => {
      const res = applySortAndLimit(items, { sortBy: "restarts", descending: true });
      expect(res.items.map((i) => i.restarts)).toEqual([5, 2, 0]);
    });

    it("should sort items by timestamp", () => {
      const res = applySortAndLimit(items, { sortBy: "created" });
      expect(res.items.map((i) => i.name)).toEqual(["web-1", "api-1", "web-2"]);
    });

    it("should slice items according to limit", () => {
      const res = applySortAndLimit(items, { sortBy: "name", limit: 2 });
      expect(res.total).toBe(3);
      expect(res.returned).toBe(2);
      expect(res.items.map((i) => i.name)).toEqual(["api-1", "web-1"]);
    });

    it("should handle limit greater than item count gracefully", () => {
      const res = applySortAndLimit(items, { limit: 10 });
      expect(res.total).toBe(3);
      expect(res.returned).toBe(3);
      expect(res.items.length).toBe(3);
    });

    it("should format output as YAML when requested", () => {
      const res = applySortAndLimit(items, { output: "yaml" });
      expect(res.yaml).toBeDefined();
      expect(typeof res.yaml).toBe("string");
      expect(res.yaml).toContain("web-1");
    });

    it("should format output as names list when requested", () => {
      const res = applySortAndLimit(items, { output: "name" });
      expect(res.names).toEqual(["web-2", "web-1", "api-1"]);
    });
  });

  describe("applyGetFormatting", () => {
    const resource = {
      name: "nginx-deployment",
      namespace: "production",
      metadata: {
        name: "nginx-deployment",
        labels: { app: "nginx", tier: "frontend" },
      },
      spec: {
        replicas: 3,
        nodeName: "worker-1",
      },
      status: {
        readyReplicas: 3,
        podIP: "10.244.1.20",
      },
    };

    it("should return the resource intact by default (json)", () => {
      const res = applyGetFormatting(resource);
      expect(res).toEqual(resource);
    });

    it("should format resource as YAML when output='yaml'", () => {
      const res = applyGetFormatting(resource, { output: "yaml" });
      expect(res.yaml).toBeDefined();
      expect(typeof res.yaml).toBe("string");
      expect(res.yaml).toContain("name: nginx-deployment");
      expect(res.yaml).toContain("replicas: 3");
    });

    it("should format resource as resource name when output='name' with kind", () => {
      const res = applyGetFormatting(resource, { kind: "Deployment", output: "name" });
      expect(res).toEqual({ name: "deployment/nginx-deployment" });
    });

    it("should format resource as resource name without kind if not provided", () => {
      const res = applyGetFormatting(resource, { output: "name" });
      expect(res).toEqual({ name: "nginx-deployment" });
    });

    it("should extract specific field when subpath is specified", () => {
      const res = applyGetFormatting(resource, { subpath: "status.podIP" });
      expect(res).toEqual({
        path: "status.podIP",
        value: "10.244.1.20",
      });
    });

    it("should extract nested subpath and combine with YAML output", () => {
      const res = applyGetFormatting(resource, { subpath: "metadata.labels", output: "yaml" });
      expect(res.yaml).toBeDefined();
      expect(res.yaml).toContain("app: nginx");
      expect(res.yaml).toContain("tier: frontend");
    });

    it("should return null or undefined gracefully", () => {
      expect(applyGetFormatting(null)).toBeNull();
      expect(applyGetFormatting(undefined)).toBeUndefined();
    });
  });

  describe("isNotFoundError", () => {
    it("should return true for error with statusCode 404", () => {
      expect(isNotFoundError({ statusCode: 404 })).toBe(true);
    });

    it("should return true for error with status 404", () => {
      expect(isNotFoundError({ status: 404 })).toBe(true);
    });

    it("should return true for error with response.statusCode 404", () => {
      expect(isNotFoundError({ response: { statusCode: 404 } })).toBe(true);
    });

    it("should return true for error with 'not found' message", () => {
      expect(isNotFoundError(new Error("Pod 'my-pod' not found"))).toBe(true);
      expect(isNotFoundError(new Error("HTTP 404 Client Error"))).toBe(true);
    });

    it("should return false for other errors", () => {
      expect(isNotFoundError(null)).toBe(false);
      expect(isNotFoundError(undefined)).toBe(false);
      expect(isNotFoundError({ statusCode: 500 })).toBe(false);
      expect(isNotFoundError(new Error("Connection refused"))).toBe(false);
    });
  });
});
