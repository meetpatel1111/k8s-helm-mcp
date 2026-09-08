import {
  isClientDryRun,
  isServerDryRun,
  buildServerDeleteParams,
  formatClientDryRunDelete,
  formatClientDryRunMutation,
  handleDeleteError,
  commonDeleteQuerySchema,
  commonApplyQuerySchema,
  commonMutationQuerySchema,
} from "../utils/safety-helper.js";

describe("safety-helper", () => {
  describe("isClientDryRun & isServerDryRun", () => {
    it("should correctly identify client dry-run", () => {
      expect(isClientDryRun("client")).toBe(true);
      expect(isClientDryRun("server")).toBe(false);
      expect(isClientDryRun("none")).toBe(false);
      expect(isClientDryRun(undefined)).toBe(false);
      expect(isClientDryRun("")).toBe(false);
    });

    it("should correctly identify server dry-run", () => {
      expect(isServerDryRun("server")).toBe(true);
      expect(isServerDryRun("client")).toBe(false);
      expect(isServerDryRun("none")).toBe(false);
      expect(isServerDryRun(undefined)).toBe(false);
      expect(isServerDryRun("")).toBe(false);
    });
  });

  describe("buildServerDeleteParams", () => {
    it("should return empty object for default/empty options", () => {
      expect(buildServerDeleteParams()).toEqual({});
      expect(buildServerDeleteParams({})).toEqual({});
      expect(buildServerDeleteParams({ dryRun: "none" })).toEqual({});
      expect(buildServerDeleteParams({ dryRun: "client" })).toEqual({});
    });

    it("should set dryRun='All' when server dry-run is requested", () => {
      const params = buildServerDeleteParams({ dryRun: "server" });
      expect(params.dryRun).toBe("All");
    });

    it("should include gracePeriodSeconds when provided as a number", () => {
      expect(buildServerDeleteParams({ gracePeriodSeconds: 30 })).toEqual({ gracePeriodSeconds: 30 });
      expect(buildServerDeleteParams({ gracePeriodSeconds: 0 })).toEqual({ gracePeriodSeconds: 0 });
    });

    it("should include propagationPolicy when provided", () => {
      expect(buildServerDeleteParams({ propagationPolicy: "Foreground" })).toEqual({ propagationPolicy: "Foreground" });
      expect(buildServerDeleteParams({ propagationPolicy: "Orphan" })).toEqual({ propagationPolicy: "Orphan" });
    });

    it("should combine all server parameters correctly", () => {
      const params = buildServerDeleteParams({
        dryRun: "server",
        gracePeriodSeconds: 15,
        propagationPolicy: "Background",
      });
      expect(params).toEqual({
        dryRun: "All",
        gracePeriodSeconds: 15,
        propagationPolicy: "Background",
      });
    });
  });

  describe("formatClientDryRunDelete", () => {
    it("should format client dry-run delete response with namespace", () => {
      const res = formatClientDryRunDelete({
        kind: "Pod",
        name: "test-pod",
        namespace: "staging",
        gracePeriodSeconds: 10,
        propagationPolicy: "Foreground",
      });

      expect(res.success).toBe(true);
      expect(res.dryRun).toBe("client");
      expect(res.message).toBe("[Client Dry-Run] Pod 'test-pod' in namespace 'staging' would be deleted.");
      expect(res.resource).toEqual({
        kind: "Pod",
        name: "test-pod",
        namespace: "staging",
        gracePeriodSeconds: 10,
        propagationPolicy: "Foreground",
      });
    });

    it("should format client dry-run delete response without namespace (cluster-scoped)", () => {
      const res = formatClientDryRunDelete({
        kind: "ClusterRole",
        name: "admin-role",
      });

      expect(res.success).toBe(true);
      expect(res.dryRun).toBe("client");
      expect(res.message).toBe("[Client Dry-Run] ClusterRole 'admin-role' would be deleted.");
      expect(res.resource.propagationPolicy).toBe("Background");
    });
  });

  describe("handleDeleteError", () => {
    it("should return null if ignoreNotFound is not set or false", () => {
      const notFoundError = { response: { statusCode: 404 } };
      expect(handleDeleteError(notFoundError, { kind: "Service", name: "my-svc" })).toBeNull();
      expect(handleDeleteError(notFoundError, { kind: "Service", name: "my-svc", ignoreNotFound: false })).toBeNull();
    });

    it("should return null if error is not a 404 error, even when ignoreNotFound is true", () => {
      const serverError = { response: { statusCode: 500, body: { message: "Internal Server Error" } } };
      expect(handleDeleteError(serverError, { kind: "Service", name: "my-svc", ignoreNotFound: true })).toBeNull();

      const authError = { response: { statusCode: 403, body: { message: "Forbidden" } } };
      expect(handleDeleteError(authError, { kind: "Service", name: "my-svc", ignoreNotFound: true })).toBeNull();
    });

    it("should handle 404 when ignoreNotFound is true (response.statusCode: 404)", () => {
      const error = { response: { statusCode: 404 } };
      const res = handleDeleteError(error, {
        kind: "Deployment",
        name: "api-gateway",
        namespace: "prod",
        ignoreNotFound: true,
      });

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.deleted).toBe(false);
      expect(res?.notFound).toBe(true);
      expect(res?.message).toBe("Deployment 'api-gateway' in namespace 'prod' not found (ignored).");
    });

    it("should handle 404 with error message containing NotFound", () => {
      const error = new Error('deployments.apps "api-gateway" not found');
      const res = handleDeleteError(error, {
        kind: "Deployment",
        name: "api-gateway",
        ignoreNotFound: true,
      });

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.deleted).toBe(false);
      expect(res?.notFound).toBe(true);
      expect(res?.message).toBe("Deployment 'api-gateway' not found (ignored).");
    });
  });

  describe("schema definitions", () => {
    it("should define valid commonDeleteQuerySchema", () => {
      expect(commonDeleteQuerySchema.dryRun.enum).toEqual(["none", "client", "server"]);
      expect(commonDeleteQuerySchema.propagationPolicy.enum).toEqual(["Background", "Foreground", "Orphan"]);
      expect(commonDeleteQuerySchema.ignoreNotFound.type).toBe("boolean");
      expect(commonDeleteQuerySchema.gracePeriodSeconds.type).toBe("number");
    });

    it("should define valid commonApplyQuerySchema", () => {
      expect(commonApplyQuerySchema.dryRun.enum).toEqual(["none", "client", "server"]);
      expect(commonApplyQuerySchema.fieldManager.type).toBe("string");
      expect(commonApplyQuerySchema.forceConflicts.type).toBe("boolean");
      expect(commonApplyQuerySchema.serverSide.type).toBe("boolean");
    });

    it("should define valid commonMutationQuerySchema", () => {
      expect(commonMutationQuerySchema.dryRun.enum).toEqual(["none", "client", "server"]);
    });
  });

  describe("formatClientDryRunMutation", () => {
    it("should format client dry-run mutation response with patch and namespace", () => {
      const res = formatClientDryRunMutation({
        operation: "Cordon node",
        kind: "Node",
        name: "node-1",
        patch: { spec: { unschedulable: true } },
      });

      expect(res.success).toBe(true);
      expect(res.dryRun).toBe("client");
      expect(res.operation).toBe("Cordon node");
      expect(res.resource.kind).toBe("Node");
      expect(res.resource.name).toBe("node-1");
      expect(res.resource.patch).toEqual({ spec: { unschedulable: true } });
      expect(res.message).toContain("Cordon node");
    });

    it("should format client dry-run mutation response with namespace and details", () => {
      const res = formatClientDryRunMutation({
        operation: "Scale deployment",
        kind: "Deployment",
        name: "frontend",
        namespace: "prod",
        details: { targetReplicas: 5 },
      });

      expect(res.success).toBe(true);
      expect(res.dryRun).toBe("client");
      expect(res.resource.namespace).toBe("prod");
      expect(res.resource.details).toEqual({ targetReplicas: 5 });
    });
  });
});
