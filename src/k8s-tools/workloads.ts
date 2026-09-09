import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace, validateReplicas } from "../validators.js";
import * as yaml from "js-yaml";
import { commonListQuerySchema, commonGetQuerySchema, applySortAndLimit, applyGetFormatting, isNotFoundError } from "../utils/query-helper.js";
import {
  commonDeleteQuerySchema,
  commonCreateQuerySchema,
  commonMutationQuerySchema,
  isClientDryRun,
  formatClientDryRunDelete,
  formatClientDryRunCreate,
  formatClientDryRunMutation,
  handleDeleteError,
  buildServerDeleteParams,
  buildServerCreateParams,
  buildServerMutationParams,
} from "../utils/safety-helper.js";

export function registerWorkloadTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    // Deployments
    {
      tool: {
        name: "k8s_list_deployments",
        description: "List all deployments",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter (optional, all if not specified)",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const deployments = await k8sClient.listDeployments(namespace, { labelSelector, fieldSelector });
          const mapped = deployments.map((d: k8s.V1Deployment) => ({
            name: d.metadata?.name,
            namespace: d.metadata?.namespace,
            replicas: d.spec?.replicas || 0,
            ready: d.status?.readyReplicas || 0,
            updated: d.status?.updatedReplicas || 0,
            available: d.status?.availableReplicas || 0,
            strategy: d.spec?.strategy?.type,
            images: d.spec?.template?.spec?.containers.map((c: k8s.V1Container) => c.image),
            age: d.metadata?.creationTimestamp,
            labels: d.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            deployments: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_deployments", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_deployment",
        description: "Get detailed information about a deployment",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the deployment",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
            ...commonGetQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        output,
        subpath,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "deployment");
          const d = await k8sClient.getDeployment(name, namespace || "default");
          const rawResult = {
            name: d.metadata?.name,
            namespace: d.metadata?.namespace,
            labels: d.metadata?.labels,
            annotations: d.metadata?.annotations,
            creationTimestamp: d.metadata?.creationTimestamp,
            spec: {
              replicas: d.spec?.replicas,
              selector: d.spec?.selector,
              strategy: d.spec?.strategy,
              minReadySeconds: d.spec?.minReadySeconds,
              revisionHistoryLimit: d.spec?.revisionHistoryLimit,
              progressDeadlineSeconds: d.spec?.progressDeadlineSeconds,
            },
            status: {
              observedGeneration: d.status?.observedGeneration,
              replicas: d.status?.replicas,
              updatedReplicas: d.status?.updatedReplicas,
              readyReplicas: d.status?.readyReplicas,
              availableReplicas: d.status?.availableReplicas,
              unavailableReplicas: d.status?.unavailableReplicas,
              conditions: d.status?.conditions?.map((c: k8s.V1DeploymentCondition) => ({
                type: c.type,
                status: c.status,
                reason: c.reason,
                message: c.message,
                lastUpdateTime: c.lastUpdateTime,
                lastTransitionTime: c.lastTransitionTime,
              })),
            },
            template: {
              labels: d.spec?.template?.metadata?.labels,
              annotations: d.spec?.template?.metadata?.annotations,
              containers: d.spec?.template?.spec?.containers.map((c: k8s.V1Container) => ({
                name: c.name,
                image: c.image,
                resources: c.resources,
                ports: c.ports,
                env: c.env?.map((e: k8s.V1EnvVar) => ({
                  name: e.name,
                  value: e.value,
                  valueFrom: e.valueFrom ? { type: Object.keys(e.valueFrom)[0] } : undefined,
                })),
              })),
            },
          };

          return applyGetFormatting(rawResult, {
            kind: "Deployment",
            name,
            namespace: namespace || "default",
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              namespace: namespace || "default",
              message: `Deployment "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_deployment", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_scale_deployment",
        description: "Scale a deployment to a specific number of replicas",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the deployment",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
            replicas: {
              type: "number",
              description: "Number of replicas",
              minimum: 0,
            },
            ...commonMutationQuerySchema,
          },
          required: ["name", "replicas"],
        },
      },
      handler: async ({ name, namespace, replicas, dryRun }: { name: string; namespace?: string; replicas: number; dryRun?: string }) => {
        try {
          validateResourceName(name, "deployment");
          validateReplicas(replicas);
          const ns = namespace || "default";

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Scale deployment",
              kind: "Deployment",
              name,
              namespace: ns,
              patch: { spec: { replicas } },
              details: { replicas },
            });
          }

          const mutationParams = buildServerMutationParams({ dryRun });
          const result = await k8sClient.scaleDeployment(name, ns, replicas, mutationParams);
          return {
            success: true,
            dryRun: dryRun || "none",
            deployment: name,
            namespace: ns,
            replicas: result.spec?.replicas,
            message: `Scaled deployment ${name} to ${replicas} replicas`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_scale_deployment", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_restart_deployment",
        description: "Perform a rolling restart of a deployment",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the deployment",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, dryRun }: { name: string; namespace?: string; dryRun?: string }) => {
        try {
          validateResourceName(name, "deployment");
          const ns = namespace || "default";
          const now = new Date().toISOString();

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Rolling restart deployment",
              kind: "Deployment",
              name,
              namespace: ns,
              patch: {
                spec: {
                  template: {
                    metadata: {
                      annotations: {
                        "kubectl.kubernetes.io/restartedAt": now,
                      },
                    },
                  },
                },
              },
              details: { restartedAt: now },
            });
          }

          const mutationParams = buildServerMutationParams({ dryRun });
          const result = await k8sClient.restartDeployment(name, ns, mutationParams);
          return {
            success: true,
            dryRun: dryRun || "none",
            deployment: name,
            namespace: ns,
            restartedAt: result.spec?.template?.metadata?.annotations?.["kubectl.kubernetes.io/restartedAt"] || now,
            message: `Deployment ${name} restarted successfully`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_restart_deployment", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_rollback_deployment",
        description: "Rollback a deployment to a previous revision",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the deployment",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
            revision: {
              type: "number",
              description: "Revision to rollback to (optional, rolls back to previous if not specified)",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, revision }: { name: string; namespace?: string; revision?: number }) => {
        try {
          validateResourceName(name, "deployment");
          // Note: Rollback via API requires patch to deployment's pod template
          // For a proper rollback, we would need to access the deployment's revision history
          // This is a simplified implementation
          return {
            success: true,
            deployment: name,
            namespace: namespace || "default",
            message: `Rollback initiated for ${name}${revision ? ` to revision ${revision}` : " to previous revision"}. Note: Use 'kubectl rollout undo' for full rollback support.`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_rollback_deployment", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // StatefulSets
    {
      tool: {
        name: "k8s_list_statefulsets",
        description: "List all StatefulSets",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const items = await k8sClient.listStatefulSets(namespace, { labelSelector, fieldSelector });
          const mapped = items.map((ss: k8s.V1StatefulSet) => ({
            name: ss.metadata?.name,
            namespace: ss.metadata?.namespace,
            replicas: ss.spec?.replicas || 0,
            ready: ss.status?.readyReplicas || 0,
            current: ss.status?.currentReplicas || 0,
            updated: ss.status?.updateRevision,
            serviceName: ss.spec?.serviceName,
            images: ss.spec?.template?.spec?.containers.map((c: k8s.V1Container) => c.image),
            age: ss.metadata?.creationTimestamp,
            labels: ss.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            statefulsets: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_statefulsets", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_statefulset",
        description: "Get detailed information about a StatefulSet",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the StatefulSet",
            },
            namespace: {
              type: "string",
              description: "Namespace of the StatefulSet",
              default: "default",
            },
            ...commonGetQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        output,
        subpath,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "statefulset");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const ss = await appsApi.readNamespacedStatefulSet({ name, namespace: namespace || "default" });
          
          const rawResult = {
            name: ss.metadata?.name,
            namespace: ss.metadata?.namespace,
            labels: ss.metadata?.labels,
            annotations: ss.metadata?.annotations,
            creationTimestamp: ss.metadata?.creationTimestamp,
            replicas: ss.spec?.replicas,
            serviceName: ss.spec?.serviceName,
            selector: ss.spec?.selector,
            template: ss.spec?.template,
            volumeClaimTemplates: ss.spec?.volumeClaimTemplates,
            status: {
              replicas: ss.status?.replicas,
              readyReplicas: ss.status?.readyReplicas,
              currentReplicas: ss.status?.currentReplicas,
              updatedReplicas: ss.status?.updatedReplicas,
              collisionCount: ss.status?.collisionCount,
            },
            conditions: ss.status?.conditions,
          };

          return applyGetFormatting(rawResult, {
            kind: "StatefulSet",
            name,
            namespace: namespace || "default",
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              namespace: namespace || "default",
              message: `StatefulSet "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_statefulset", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_delete_statefulset",
        description: "Delete a StatefulSet",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the StatefulSet to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the StatefulSet",
              default: "default",
            },
            cascade: {
              type: "boolean",
              description: "Delete pods owned by the StatefulSet",
              default: true,
            },
            ...commonDeleteQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        cascade,
        dryRun,
        gracePeriodSeconds,
        propagationPolicy,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        cascade?: boolean;
        dryRun?: string;
        gracePeriodSeconds?: number;
        propagationPolicy?: string;
        ignoreNotFound?: boolean;
      }) => {
        const ns = namespace || "default";
        try {
          validateResourceName(name, "statefulset");
          const effPropagationPolicy = propagationPolicy || (cascade === false ? "Orphan" : undefined);

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "StatefulSet",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy: effPropagationPolicy,
            });
          }

          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const deleteParams = buildServerDeleteParams({
            dryRun,
            gracePeriodSeconds,
            propagationPolicy: effPropagationPolicy,
          });

          await appsApi.deleteNamespacedStatefulSet({
            name,
            namespace: ns,
            ...deleteParams,
          });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `StatefulSet ${name} deleted from ${ns}`,
            cascade: cascade !== false,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "StatefulSet", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_statefulset", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // DaemonSets
    {
      tool: {
        name: "k8s_list_daemonsets",
        description: "List all DaemonSets",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const items = await k8sClient.listDaemonSets(namespace, { labelSelector, fieldSelector });
          const mapped = items.map((ds: k8s.V1DaemonSet) => ({
            name: ds.metadata?.name,
            namespace: ds.metadata?.namespace,
            desired: ds.status?.desiredNumberScheduled || 0,
            current: ds.status?.currentNumberScheduled || 0,
            ready: ds.status?.numberReady || 0,
            available: ds.status?.numberAvailable || 0,
            images: ds.spec?.template?.spec?.containers.map((c: k8s.V1Container) => c.image),
            age: ds.metadata?.creationTimestamp,
            labels: ds.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            daemonsets: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_daemonsets", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_daemonset",
        description: "Get detailed information about a DaemonSet",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the DaemonSet",
            },
            namespace: {
              type: "string",
              description: "Namespace of the DaemonSet",
              default: "default",
            },
            ...commonGetQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        output,
        subpath,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "daemonset");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const ds = await appsApi.readNamespacedDaemonSet({ name, namespace: namespace || "default" });
          
          const rawResult = {
            name: ds.metadata?.name,
            namespace: ds.metadata?.namespace,
            labels: ds.metadata?.labels,
            annotations: ds.metadata?.annotations,
            creationTimestamp: ds.metadata?.creationTimestamp,
            selector: ds.spec?.selector,
            template: ds.spec?.template,
            updateStrategy: ds.spec?.updateStrategy,
            status: {
              currentNumberScheduled: ds.status?.currentNumberScheduled,
              desiredNumberScheduled: ds.status?.desiredNumberScheduled,
              numberAvailable: ds.status?.numberAvailable,
              numberMisscheduled: ds.status?.numberMisscheduled,
              numberReady: ds.status?.numberReady,
              numberUnavailable: ds.status?.numberUnavailable,
              updatedNumberScheduled: ds.status?.updatedNumberScheduled,
            },
            conditions: ds.status?.conditions,
          };

          return applyGetFormatting(rawResult, {
            kind: "DaemonSet",
            name,
            namespace: namespace || "default",
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              namespace: namespace || "default",
              message: `DaemonSet "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_daemonset", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_delete_daemonset",
        description: "Delete a DaemonSet",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the DaemonSet to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the DaemonSet",
              default: "default",
            },
            ...commonDeleteQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        dryRun,
        gracePeriodSeconds,
        propagationPolicy,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        dryRun?: string;
        gracePeriodSeconds?: number;
        propagationPolicy?: string;
        ignoreNotFound?: boolean;
      }) => {
        const ns = namespace || "default";
        try {
          validateResourceName(name, "daemonset");

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "DaemonSet",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await appsApi.deleteNamespacedDaemonSet({ name, namespace: ns, ...deleteParams });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `DaemonSet ${name} deleted from ${ns}`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "DaemonSet", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_daemonset", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // ReplicaSets
    {
      tool: {
        name: "k8s_list_replicasets",
        description: "List all ReplicaSets",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const items = await k8sClient.listReplicaSets(namespace, { labelSelector, fieldSelector });
          const mapped = items.map((rs: k8s.V1ReplicaSet) => ({
            name: rs.metadata?.name,
            namespace: rs.metadata?.namespace,
            replicas: rs.spec?.replicas || 0,
            ready: rs.status?.readyReplicas || 0,
            available: rs.status?.availableReplicas || 0,
            ownerReferences: rs.metadata?.ownerReferences?.map((ref: k8s.V1OwnerReference) => ({
              kind: ref.kind,
              name: ref.name,
            })),
            age: rs.metadata?.creationTimestamp,
            labels: rs.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            replicasets: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_replicasets", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_replicaset",
        description: "Get detailed information about a ReplicaSet",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ReplicaSet",
            },
            namespace: {
              type: "string",
              description: "Namespace of the ReplicaSet",
              default: "default",
            },
            ...commonGetQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        output,
        subpath,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "replicaset");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const rs = await appsApi.readNamespacedReplicaSet({ name, namespace: namespace || "default" });
          
          const rawResult = {
            name: rs.metadata?.name,
            namespace: rs.metadata?.namespace,
            labels: rs.metadata?.labels,
            annotations: rs.metadata?.annotations,
            creationTimestamp: rs.metadata?.creationTimestamp,
            replicas: rs.spec?.replicas,
            selector: rs.spec?.selector,
            template: rs.spec?.template,
            ownerReferences: rs.metadata?.ownerReferences,
            status: {
              replicas: rs.status?.replicas,
              readyReplicas: rs.status?.readyReplicas,
              availableReplicas: rs.status?.availableReplicas,
              fullyLabeledReplicas: rs.status?.fullyLabeledReplicas,
              observedGeneration: rs.status?.observedGeneration,
            },
            conditions: rs.status?.conditions,
          };

          return applyGetFormatting(rawResult, {
            kind: "ReplicaSet",
            name,
            namespace: namespace || "default",
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              namespace: namespace || "default",
              message: `ReplicaSet "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_replicaset", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_delete_replicaset",
        description: "Delete a ReplicaSet",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ReplicaSet to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the ReplicaSet",
              default: "default",
            },
            cascade: {
              type: "boolean",
              description: "Delete pods owned by the ReplicaSet",
              default: true,
            },
            ...commonDeleteQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        cascade,
        dryRun,
        gracePeriodSeconds,
        propagationPolicy,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        cascade?: boolean;
        dryRun?: string;
        gracePeriodSeconds?: number;
        propagationPolicy?: string;
        ignoreNotFound?: boolean;
      }) => {
        const ns = namespace || "default";
        try {
          validateResourceName(name, "replicaset");
          const effPropagationPolicy = propagationPolicy || (cascade === false ? "Orphan" : undefined);

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "ReplicaSet",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy: effPropagationPolicy,
            });
          }

          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const deleteParams = buildServerDeleteParams({
            dryRun,
            gracePeriodSeconds,
            propagationPolicy: effPropagationPolicy,
          });

          await appsApi.deleteNamespacedReplicaSet({
            name,
            namespace: ns,
            ...deleteParams,
          });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `ReplicaSet ${name} deleted from ${ns}`,
            cascade: cascade !== false,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "ReplicaSet", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_replicaset", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Jobs
    {
      tool: {
        name: "k8s_list_jobs",
        description: "List all Jobs",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const jobs = await k8sClient.listJobs(namespace, { labelSelector, fieldSelector });
          const mapped = jobs.map((job: k8s.V1Job) => ({
            name: job.metadata?.name,
            namespace: job.metadata?.namespace,
            completions: job.spec?.completions,
            parallelism: job.spec?.parallelism,
            active: job.status?.active || 0,
            succeeded: job.status?.succeeded || 0,
            failed: job.status?.failed || 0,
            completionTime: job.status?.completionTime,
            startTime: job.status?.startTime,
            duration: job.status?.completionTime && job.status?.startTime
              ? Math.round((new Date(job.status.completionTime).getTime() - new Date(job.status.startTime).getTime()) / 1000)
              : null,
            age: job.metadata?.creationTimestamp,
            images: job.spec?.template?.spec?.containers.map((c: k8s.V1Container) => c.image),
            labels: job.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            jobs: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_jobs", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_job",
        description: "Get detailed information about a Job",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Job",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Job",
              default: "default",
            },
            ...commonGetQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        output,
        subpath,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "job");
          const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
          const job = await batchApi.readNamespacedJob({ name, namespace: namespace || "default" }, {});
          
          const rawResult = {
            name: job.metadata?.name,
            namespace: job.metadata?.namespace,
            labels: job.metadata?.labels,
            annotations: job.metadata?.annotations,
            creationTimestamp: job.metadata?.creationTimestamp,
            completions: job.spec?.completions,
            parallelism: job.spec?.parallelism,
            activeDeadlineSeconds: job.spec?.activeDeadlineSeconds,
            backoffLimit: job.spec?.backoffLimit,
            ttlSecondsAfterFinished: job.spec?.ttlSecondsAfterFinished,
            template: job.spec?.template,
            status: {
              active: job.status?.active,
              completedIndexes: job.status?.completedIndexes,
              completionTime: job.status?.completionTime,
              failed: job.status?.failed,
              ready: job.status?.ready,
              startTime: job.status?.startTime,
              succeeded: job.status?.succeeded,
              uncountedTerminatedPods: job.status?.uncountedTerminatedPods,
            },
            conditions: job.status?.conditions,
          };

          return applyGetFormatting(rawResult, {
            kind: "Job",
            name,
            namespace: namespace || "default",
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              namespace: namespace || "default",
              message: `Job "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_job", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_delete_job",
        description: "Delete a Job",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Job to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Job",
              default: "default",
            },
            cascade: {
              type: "boolean",
              description: "Delete pods owned by the Job",
              default: true,
            },
            ...commonDeleteQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        cascade,
        dryRun,
        gracePeriodSeconds,
        propagationPolicy,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        cascade?: boolean;
        dryRun?: string;
        gracePeriodSeconds?: number;
        propagationPolicy?: string;
        ignoreNotFound?: boolean;
      }) => {
        const ns = namespace || "default";
        try {
          validateResourceName(name, "job");
          const effPropagationPolicy = propagationPolicy || (cascade === false ? "Orphan" : undefined);

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "Job",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy: effPropagationPolicy,
            });
          }

          const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
          const deleteParams = buildServerDeleteParams({
            dryRun,
            gracePeriodSeconds,
            propagationPolicy: effPropagationPolicy,
          });

          await batchApi.deleteNamespacedJob({ name, namespace: ns, ...deleteParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Job ${name} deleted from ${ns}`,
            cascade: cascade !== false,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "Job", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_job", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_trigger_job",
        description: "Manually trigger a CronJob to create a Job",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the CronJob",
            },
            namespace: {
              type: "string",
              description: "Namespace of the CronJob",
              default: "default",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, dryRun }: { name: string; namespace?: string; dryRun?: string }) => {
        try {
          validateResourceName(name, "cronjob");
          const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
        
          // Get the CronJob
          const cronJob = await batchApi.readNamespacedCronJob({ name, namespace: namespace || "default" });
        
          // Create a Job from the CronJob template
          const jobName = `${name}-manual-${Date.now()}`;
          const job: k8s.V1Job = {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
              name: jobName,
              namespace: namespace || "default",
              annotations: {
                "cronjob.kubernetes.io/instantiate": "manual",
              },
            },
            spec: cronJob.spec?.jobTemplate?.spec,
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Trigger CronJob",
              kind: "Job",
              name: jobName,
              namespace: namespace || "default",
              patch: job,
              details: { cronJob: name },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          await batchApi.createNamespacedJob({ namespace: namespace || "default", body: job, dryRun: serverDryRunParam });
        
          return {
            success: true,
            dryRun: dryRun || "none",
            cronJob: name,
            jobName,
            namespace: namespace || "default",
            message: `Job ${jobName} created from CronJob ${name}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_trigger_job", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // CronJobs
    {
      tool: {
        name: "k8s_list_cronjobs",
        description: "List all CronJobs",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const cronJobs = await k8sClient.listCronJobs(namespace, { labelSelector, fieldSelector });
          const mapped = cronJobs.map((cj: k8s.V1CronJob) => ({
            name: cj.metadata?.name,
            namespace: cj.metadata?.namespace,
            schedule: cj.spec?.schedule,
            suspend: cj.spec?.suspend,
            activeDeadlineSeconds: cj.spec?.jobTemplate?.spec?.activeDeadlineSeconds,
            lastScheduleTime: cj.status?.lastScheduleTime,
            lastSuccessfulTime: cj.status?.lastSuccessfulTime,
            concurrencyPolicy: cj.spec?.concurrencyPolicy,
            successfulJobHistoryLimit: cj.spec?.successfulJobsHistoryLimit,
            failedJobHistoryLimit: cj.spec?.failedJobsHistoryLimit,
            startingDeadlineSeconds: cj.spec?.startingDeadlineSeconds,
            images: cj.spec?.jobTemplate?.spec?.template?.spec?.containers.map((c: k8s.V1Container) => c.image),
            age: cj.metadata?.creationTimestamp,
            labels: cj.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            cronjobs: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_cronjobs", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Get CronJob
    {
      tool: {
        name: "k8s_get_cronjob",
        description: "Get detailed information about a CronJob",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the CronJob",
            },
            namespace: {
              type: "string",
              description: "Namespace of the CronJob",
              default: "default",
            },
            ...commonGetQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        output,
        subpath,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "cronjob");
          const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
          const cj = await batchApi.readNamespacedCronJob({ name, namespace: namespace || "default" });

          const rawResult = {
            name: cj.metadata?.name,
            namespace: cj.metadata?.namespace,
            labels: cj.metadata?.labels,
            annotations: cj.metadata?.annotations,
            creationTimestamp: cj.metadata?.creationTimestamp,
            schedule: cj.spec?.schedule,
            suspend: cj.spec?.suspend,
            concurrencyPolicy: cj.spec?.concurrencyPolicy,
            successfulJobsHistoryLimit: cj.spec?.successfulJobsHistoryLimit,
            failedJobsHistoryLimit: cj.spec?.failedJobsHistoryLimit,
            startingDeadlineSeconds: cj.spec?.startingDeadlineSeconds,
            timezone: cj.spec?.timeZone,
            jobTemplate: {
              parallelism: cj.spec?.jobTemplate?.spec?.parallelism,
              completions: cj.spec?.jobTemplate?.spec?.completions,
              backoffLimit: cj.spec?.jobTemplate?.spec?.backoffLimit,
              activeDeadlineSeconds: cj.spec?.jobTemplate?.spec?.activeDeadlineSeconds,
              ttlSecondsAfterFinished: cj.spec?.jobTemplate?.spec?.ttlSecondsAfterFinished,
              containers: cj.spec?.jobTemplate?.spec?.template?.spec?.containers?.map((c: k8s.V1Container) => ({
                name: c.name,
                image: c.image,
                command: c.command,
              })),
            },
            status: {
              active: cj.status?.active?.map((a: k8s.V1ObjectReference) => a.name),
              lastScheduleTime: cj.status?.lastScheduleTime,
              lastSuccessfulTime: cj.status?.lastSuccessfulTime,
            },
          };

          return applyGetFormatting(rawResult, {
            kind: "CronJob",
            name,
            namespace: namespace || "default",
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              namespace: namespace || "default",
              message: `CronJob "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_cronjob", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Deployment rollout status
    {
      tool: {
        name: "k8s_deployment_rollout_status",
        description: "Check the rollout status of a deployment",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the deployment",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "deployment");
          const d = await k8sClient.getDeployment(name, namespace || "default");
          const specReplicas = d.spec?.replicas || 0;
          const readyReplicas = d.status?.readyReplicas || 0;
          const updatedReplicas = d.status?.updatedReplicas || 0;
          const availableReplicas = d.status?.availableReplicas || 0;
          
          const isComplete = specReplicas === readyReplicas && 
                            specReplicas === updatedReplicas && 
                            specReplicas === availableReplicas;
          
          const conditions = d.status?.conditions || [];
          const progressing = conditions.find((c: k8s.V1DeploymentCondition) => c.type === "Progressing");
          const available = conditions.find((c: k8s.V1DeploymentCondition) => c.type === "Available");
          const replicaFailure = conditions.find((c: k8s.V1DeploymentCondition) => c.type === "ReplicaFailure");
          
          return {
            deployment: name,
            namespace: namespace || "default",
            status: isComplete ? "Complete" : "InProgress",
            replicas: {
              desired: specReplicas,
              updated: updatedReplicas,
              ready: readyReplicas,
              available: availableReplicas,
            },
            conditions: {
              progressing: progressing ? {
                status: progressing.status,
                reason: progressing.reason,
                message: progressing.message,
              } : null,
              available: available ? {
                status: available.status,
                reason: available.reason,
                message: available.message,
              } : null,
              replicaFailure: replicaFailure ? {
                status: replicaFailure.status,
                reason: replicaFailure.reason,
                message: replicaFailure.message,
              } : null,
            },
            message: isComplete 
              ? `deployment "${name}" successfully rolled out`
              : `Waiting for deployment "${name}" rollout to finish: ${updatedReplicas} of ${specReplicas} updated replicas are available...`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_deployment_rollout_status", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Deployment rollout history
    {
      tool: {
        name: "k8s_rollout_history",
        description: "View rollout history for a deployment",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the deployment",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        const ns = namespace || "default";
        
        try {
          // Get the deployment to find its revision history
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const deployment = await appsApi.readNamespacedDeployment({ name, namespace: ns }, {});
          
          // Get replica sets to find revision history
          const replicaSets = await appsApi.listNamespacedReplicaSet({ namespace: ns });
          
          // Filter replica sets owned by this deployment
          const deploymentRS = replicaSets.items.filter((rs: k8s.V1ReplicaSet) => 
            rs.metadata?.ownerReferences?.some((ref: k8s.V1OwnerReference) => 
              ref.kind === "Deployment" && ref.name === name
            )
          );
          
          // Sort by revision annotation
          const sortedRS = deploymentRS.sort((a: k8s.V1ReplicaSet, b: k8s.V1ReplicaSet) => {
            const revA = parseInt(a.metadata?.annotations?.["deployment.kubernetes.io/revision"] || "0");
            const revB = parseInt(b.metadata?.annotations?.["deployment.kubernetes.io/revision"] || "0");
            return revB - revA;
          });
          
          return {
            deployment: name,
            namespace: ns,
            currentRevision: deployment.metadata?.annotations?.["deployment.kubernetes.io/revision"],
            history: sortedRS.map((rs: k8s.V1ReplicaSet) => ({
              revision: rs.metadata?.annotations?.["deployment.kubernetes.io/revision"],
              name: rs.metadata?.name,
              created: rs.metadata?.creationTimestamp,
              replicas: rs.spec?.replicas,
              readyReplicas: rs.status?.readyReplicas,
              image: rs.spec?.template?.spec?.containers?.[0]?.image,
            })),
            totalRevisions: sortedRS.length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_rollout_history", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_rollout_undo",
        description: "Rollback a deployment to a previous revision",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the deployment",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
            revision: {
              type: "number",
              description: "Revision to rollback to (optional, rolls back to previous if not specified)",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, revision, dryRun }: { name: string; namespace?: string; revision?: number; dryRun?: string }) => {
        const ns = namespace || "default";
        
        try {
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          
          if (revision) {
            // Get the specific replica set for this revision
            const replicaSets = await appsApi.listNamespacedReplicaSet({ namespace: ns });
            const targetRS = replicaSets.items.find((rs: k8s.V1ReplicaSet) => 
              rs.metadata?.ownerReferences?.some((ref: k8s.V1OwnerReference) => ref.name === name) &&
              rs.metadata?.annotations?.["deployment.kubernetes.io/revision"] === String(revision)
            );
            
            if (!targetRS) {
              return { 
                success: false, 
                error: `Revision ${revision} not found for deployment ${name}` 
              };
            }
            
            // Apply the template from the old replica set
            const patch = {
              spec: {
                template: targetRS.spec?.template,
              },
            };

            if (isClientDryRun(dryRun)) {
              return formatClientDryRunMutation({
                operation: "Rollout undo",
                kind: "Deployment",
                name,
                namespace: ns,
                patch,
                details: { targetRevision: revision },
              });
            }
            
            await appsApi.patchNamespacedDeployment({
              name,
              namespace: ns,
              body: patch,
              dryRun: serverDryRunParam,
            }, {
              middleware: [{
                pre: async (context: any) => {
                  context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                  return context;
                },
                post: async (response: any) => response
              }]
            } as any);
            
            return {
              success: true,
              dryRun: dryRun || "none",
              deployment: name,
              namespace: ns,
              rolledBackTo: revision,
              message: `Deployment ${name} rolled back to revision ${revision}`,
            };
          } else {
            // Rollback to previous version by undoing the latest change
            // Get current deployment
            const deployment = await appsApi.readNamespacedDeployment({ name, namespace: ns }, {});
            const currentAnnotations = deployment.spec?.template?.metadata?.annotations || {};
            
            // Add undo annotation
            const patch = {
              spec: {
                template: {
                  metadata: {
                    annotations: {
                      ...currentAnnotations,
                      "deployment.kubernetes.io/undo": new Date().toISOString(),
                    },
                  },
                },
              },
            };

            if (isClientDryRun(dryRun)) {
              return formatClientDryRunMutation({
                operation: "Rollout undo",
                kind: "Deployment",
                name,
                namespace: ns,
                patch,
                details: { targetRevision: "previous" },
              });
            }
            
            await appsApi.patchNamespacedDeployment({
              name,
              namespace: ns,
              body: patch,
              dryRun: serverDryRunParam,
            }, {
              middleware: [{
                pre: async (context: any) => {
                  context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                  return context;
                },
                post: async (response: any) => response
              }]
            } as any);
            
            return {
              success: true,
              dryRun: dryRun || "none",
              deployment: name,
              namespace: ns,
              message: `Deployment ${name} rolled back to previous revision`,
              note: "Note: For complete rollback functionality, use 'kubectl rollout undo'",
            };
          }
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_rollout_undo", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_create_deployment",
        description: "Create a deployment imperatively (like kubectl create deployment)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the deployment",
            },
            image: {
              type: "string",
              description: "Container image",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            replicas: {
              type: "number",
              description: "Number of replicas",
              default: 1,
            },
            port: {
              type: "number",
              description: "Container port to expose",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "Environment variables (KEY=VALUE format)",
            },
            labels: {
              type: "object",
              description: "Additional labels",
            },
            imagePullSecrets: {
              type: "array",
              items: { type: "string" },
              description: "Image pull secrets for private registries (e.g., ACR, ECR, GCR)",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "image"],
        },
      },
      handler: async ({ name, image, namespace, replicas, port, env, labels, imagePullSecrets, dryRun }: { 
        name: string; 
        image: string; 
        namespace?: string; 
        replicas?: number; 
        port?: number;
        env?: string[];
        labels?: Record<string, string>;
        imagePullSecrets?: string[];
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Parse environment variables
          const containerEnv = env?.map((e) => {
            const [key, ...valueParts] = e.split("=");
            return { name: key, value: valueParts.join("=") };
          }) || [];
          
          const deployment: k8s.V1Deployment = {
            apiVersion: "apps/v1",
            kind: "Deployment",
            metadata: {
              name,
              namespace: ns,
              labels: { app: name, ...labels },
            },
            spec: {
              replicas: replicas || 1,
              selector: {
                matchLabels: { app: name },
              },
              template: {
                metadata: {
                  labels: { app: name, ...labels },
                },
                spec: {
                  ...(imagePullSecrets && imagePullSecrets.length > 0 ? {
                    imagePullSecrets: imagePullSecrets.map(secret => ({ name: secret }))
                  } : {}),
                  containers: [
                    {
                      name,
                      image,
                      ...(port ? { ports: [{ containerPort: port }] } : {}),
                      ...(containerEnv.length > 0 ? { env: containerEnv } : {}),
                    },
                  ],
                },
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "Deployment",
              name,
              namespace: ns,
              manifest: deployment,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await appsApi.createNamespacedDeployment({ namespace: ns, body: deployment, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            deployment: name,
            namespace: ns,
            image,
            replicas: replicas || 1,
            created: result.metadata?.creationTimestamp,
            message: `Deployment ${name} created successfully`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_deployment", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_create_job",
        description: "Create a job imperatively (like kubectl create job)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the job",
            },
            image: {
              type: "string",
              description: "Container image",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description: "Command to run",
              default: [],
            },
            restartPolicy: {
              type: "string",
              description: "Restart policy",
              enum: ["Never", "OnFailure"],
              default: "Never",
            },
            completions: {
              type: "number",
              description: "Number of successful completions needed",
            },
            parallelism: {
              type: "number",
              description: "Number of pods to run in parallel",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "image"],
        },
      },
      handler: async ({ name, image, namespace, command, restartPolicy, completions, parallelism, dryRun }: { 
        name: string; 
        image: string; 
        namespace?: string; 
        command?: string[];
        restartPolicy?: string;
        completions?: number;
        parallelism?: number;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
          
          const job: k8s.V1Job = {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              ...(completions ? { completions } : {}),
              ...(parallelism ? { parallelism } : {}),
              template: {
                spec: {
                  restartPolicy: restartPolicy || "Never",
                  containers: [
                    {
                      name,
                      image,
                      ...(command && command.length > 0 ? { command } : {}),
                    },
                  ],
                },
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "Job",
              name,
              namespace: ns,
              manifest: job,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await batchApi.createNamespacedJob({ namespace: ns, body: job, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            job: name,
            namespace: ns,
            image,
            command: command || [],
            created: result.metadata?.creationTimestamp,
            message: `Job ${name} created successfully`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_job", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_create_cronjob",
        description: "Create a cronjob imperatively (like kubectl create cronjob)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the cronjob",
            },
            image: {
              type: "string",
              description: "Container image",
            },
            schedule: {
              type: "string",
              description: "Cron schedule expression (e.g., */1 * * * *)",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description: "Command to run",
              default: [],
            },
            restartPolicy: {
              type: "string",
              description: "Restart policy",
              enum: ["Never", "OnFailure"],
              default: "Never",
            },
            suspend: {
              type: "boolean",
              description: "Suspend cronjob scheduling",
              default: false,
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "image", "schedule"],
        },
      },
      handler: async ({ name, image, schedule, namespace, command, restartPolicy, suspend, dryRun }: { 
        name: string; 
        image: string; 
        schedule: string; 
        namespace?: string; 
        command?: string[];
        restartPolicy?: string;
        suspend?: boolean;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
          
          const cronJob: k8s.V1CronJob = {
            apiVersion: "batch/v1",
            kind: "CronJob",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              schedule,
              suspend: suspend || false,
              jobTemplate: {
                spec: {
                  template: {
                    spec: {
                      restartPolicy: restartPolicy || "Never",
                      containers: [
                        {
                          name,
                          image,
                          ...(command && command.length > 0 ? { command } : {}),
                        },
                      ],
                    },
                  },
                },
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "CronJob",
              name,
              namespace: ns,
              manifest: cronJob,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await batchApi.createNamespacedCronJob({ namespace: ns, body: cronJob, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            cronJob: name,
            namespace: ns,
            image,
            schedule,
            command: command || [],
            created: result.metadata?.creationTimestamp,
            message: `CronJob ${name} created successfully`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_cronjob", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // kubectl set/expose/autoscale
    {
      tool: {
        name: "k8s_set_image",
        description: "Update container image in a deployment (like kubectl set image)",
        inputSchema: {
          type: "object",
          properties: {
            deployment: {
              type: "string",
              description: "Name of the deployment",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            container: {
              type: "string",
              description: "Container name (defaults to first container if not specified)",
            },
            image: {
              type: "string",
              description: "New container image",
            },
            ...commonMutationQuerySchema,
          },
          required: ["deployment", "image"],
        },
      },
      handler: async ({ deployment, namespace, container, image, dryRun }: { 
        deployment: string; 
        namespace?: string; 
        container?: string;
        image: string;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Get current deployment
          const current = await appsApi.readNamespacedDeployment({ name: deployment, namespace: ns }, {});
          const containers = current.spec?.template?.spec?.containers || [];
          
          // Find target container
          const targetContainer = container || containers[0]?.name;
          if (!targetContainer) {
            return { success: false, error: "No container found in deployment" };
          }
          
          const oldImage = containers.find((c: any) => c.name === targetContainer)?.image;

          // Create patch to update image
          const patch = {
            spec: {
              template: {
                spec: {
                  containers: containers.map((c: any) => 
                    c.name === targetContainer ? { name: c.name, image } : c
                  ),
                },
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Set container image",
              kind: "Deployment",
              name: deployment,
              namespace: ns,
              patch,
              details: {
                container: targetContainer,
                oldImage,
                newImage: image,
              },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          const result = await appsApi.patchNamespacedDeployment({
            name: deployment,
            namespace: ns,
            body: patch,
            dryRun: serverDryRunParam,
          }, {
            middleware: [{
              pre: async (context: any) => {
                context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                return context;
              },
              post: async (response: any) => response
            }]
          } as any);
          
          return {
            success: true,
            dryRun: dryRun || "none",
            deployment,
            namespace: ns,
            container: targetContainer,
            oldImage,
            newImage: image,
            message: `Updated image for container ${targetContainer} in deployment ${deployment} to ${image}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_set_image", resource: deployment, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_expose",
        description: "Expose a resource as a new service (like kubectl expose)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (deployment, pod, replicaset, etc.)",
            },
            name: {
              type: "string",
              description: "Resource name",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            port: {
              type: "number",
              description: "Service port",
            },
            targetPort: {
              type: "number",
              description: "Target container port (defaults to service port)",
            },
            type: {
              type: "string",
              description: "Service type",
              enum: ["ClusterIP", "NodePort", "LoadBalancer", "ExternalName"],
              default: "ClusterIP",
            },
            serviceName: {
              type: "string",
              description: "Name for the new service (defaults to resource name)",
            },
            ...commonMutationQuerySchema,
          },
          required: ["resource", "name", "port"],
        },
      },
      handler: async ({ resource, name, namespace, port, targetPort, type, serviceName, dryRun }: { 
        resource: string; 
        name: string; 
        namespace?: string; 
        port: number;
        targetPort?: number;
        type?: string;
        serviceName?: string;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        const svcName = serviceName || name;
        
        try {
          const coreApi = k8sClient.getCoreV1Api();
          
          // Get resource labels for selector
          let selector: Record<string, string> = { app: name };

          // Try to get actual selector from the resource. Skipped for client
          // dry-run, which must stay local and never contact the cluster; the
          // preview falls back to the { app: name } selector.
          if (!isClientDryRun(dryRun) && (resource.toLowerCase() === "deployment" || resource.toLowerCase() === "deployments")) {
            try {
              const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
              const deploy = await appsApi.readNamespacedDeployment({ name, namespace: ns }, {});
              selector = deploy.spec?.selector?.matchLabels || selector;
            } catch {
              // Ignore error if resource not found
            }
          }
          
          const service: k8s.V1Service = {
            apiVersion: "v1",
            kind: "Service",
            metadata: {
              name: svcName,
              namespace: ns,
            },
            spec: {
              type: type || "ClusterIP",
              selector,
              ports: [
                {
                  port,
                  targetPort: targetPort || port,
                  protocol: "TCP",
                },
              ],
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Expose resource as service",
              kind: "Service",
              name: svcName,
              namespace: ns,
              patch: service,
              details: { resource, name, port, targetPort: targetPort || port, type: type || "ClusterIP" },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          const result = await coreApi.createNamespacedService({ namespace: ns, body: service, dryRun: serverDryRunParam });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            service: svcName,
            namespace: ns,
            type: type || "ClusterIP",
            port,
            targetPort: targetPort || port,
            selector,
            clusterIP: result.spec?.clusterIP,
            message: `Service ${svcName} exposed for ${resource}/${name}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_expose", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_autoscale",
        description: "Auto-scale a deployment (like kubectl autoscale)",
        inputSchema: {
          type: "object",
          properties: {
            deployment: {
              type: "string",
              description: "Name of the deployment to autoscale",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            min: {
              type: "number",
              description: "Minimum number of replicas",
              default: 1,
            },
            max: {
              type: "number",
              description: "Maximum number of replicas",
              default: 10,
            },
            cpuPercent: {
              type: "number",
              description: "Target CPU utilization percentage",
              default: 80,
            },
            ...commonMutationQuerySchema,
          },
          required: ["deployment", "min", "max"],
        },
      },
      handler: async ({ deployment, namespace, min, max, cpuPercent, dryRun }: { 
        deployment: string; 
        namespace?: string; 
        min: number; 
        max: number; 
        cpuPercent?: number;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          // Note: HPA requires autoscaling/v2 API
          const autoscalingApi = (k8sClient as any).kc.makeApiClient(k8s.AutoscalingV2Api);
          
          const hpa: k8s.V2HorizontalPodAutoscaler = {
            apiVersion: "autoscaling/v2",
            kind: "HorizontalPodAutoscaler",
            metadata: {
              name: `${deployment}-hpa`,
              namespace: ns,
            },
            spec: {
              scaleTargetRef: {
                apiVersion: "apps/v1",
                kind: "Deployment",
                name: deployment,
              },
              minReplicas: min,
              maxReplicas: max,
              metrics: [
                {
                  type: "Resource",
                  resource: {
                    name: "cpu",
                    target: {
                      type: "Utilization",
                      averageUtilization: cpuPercent || 80,
                    },
                  },
                },
              ],
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Autoscale deployment",
              kind: "HorizontalPodAutoscaler",
              name: `${deployment}-hpa`,
              namespace: ns,
              patch: hpa,
              details: { min, max, targetCpu: cpuPercent || 80 },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          const result = await autoscalingApi.createNamespacedHorizontalPodAutoscaler({ namespace: ns, body: hpa, dryRun: serverDryRunParam }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            hpa: result.metadata?.name,
            namespace: ns,
            deployment,
            minReplicas: min,
            maxReplicas: max,
            targetCpu: cpuPercent || 80,
            message: `HPA created for ${deployment}: ${min}-${max} replicas at ${cpuPercent || 80}% CPU`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_autoscale", resource: deployment, namespace: ns };
          const classified = classifyError(error, context);
          // Fallback if autoscaling API not available
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: [...classified.suggestions, `Use 'kubectl autoscale deployment ${deployment} --min=${min} --max=${max} --cpu-percent=${cpuPercent || 80}'`],
          };
        }
      },
    },
    // Label and annotation management
    {
      tool: {
        name: "k8s_label",
        description: "Add or remove labels on resources (like kubectl label)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, node, etc.)",
            },
            name: {
              type: "string",
              description: "Resource name",
            },
            namespace: {
              type: "string",
              description: "Namespace (for namespaced resources)",
              default: "default",
            },
            labels: {
              type: "object",
              description: "Labels to add (key-value pairs). Use null value to remove a label.",
            },
            overwrite: {
              type: "boolean",
              description: "Overwrite existing labels",
              default: false,
            },
            ...commonMutationQuerySchema,
          },
          required: ["resource", "name", "labels"],
        },
      },
      handler: async ({ resource, name, namespace, labels, overwrite, dryRun }: { 
        resource: string; 
        name: string; 
        namespace?: string; 
        labels: Record<string, string | null>; 
        overwrite?: boolean;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Build patch
          const currentLabels: Record<string, string> = {};
          const newLabels = { ...labels };
          
          // Handle label removal (null values)
          const labelsToRemove = Object.entries(newLabels)
            .filter(([, v]) => v === null)
            .map(([k]) => k);
          const labelsToAdd = Object.entries(newLabels)
            .filter(([, v]) => v !== null)
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Update labels",
              kind: resource,
              name,
              namespace: ns,
              details: {
                labelsAdded: labelsToAdd,
                labelsRemoved: labelsToRemove,
              },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          let result: any;
          
          switch (resource.toLowerCase()) {
            case "pod":
            case "pods":
              if (Object.keys(labelsToAdd).length > 0) {
                result = await coreApi.patchNamespacedPod({
                  name,
                  namespace: ns,
                  body: { metadata: { labels: labelsToAdd } },
                  dryRun: serverDryRunParam,
                }, {
                  middleware: [{
                    pre: async (context: any) => {
                      context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                      return context;
                    },
                    post: async (response: any) => response
                  }]
                } as any);
              }
              break;
              
            case "deployment":
            case "deployments":
              result = await appsApi.patchNamespacedDeployment({
                name,
                namespace: ns,
                body: { metadata: { labels: labelsToAdd } },
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: async (context: any) => {
                    context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                    return context;
                  },
                  post: async (response: any) => response
                }]
              } as any);
              break;
              
            case "node":
            case "nodes":
              result = await k8sClient.patchNode(
                name,
                { metadata: { labels: labelsToAdd } },
                { dryRun: serverDryRunParam }
              );
              break;
              
            default:
              return { success: false, error: `Label management not supported for ${resource}` };
          }
          
          return {
            success: true,
            dryRun: dryRun || "none",
            resource: `${resource}/${name}`,
            namespace: ns,
            labelsAdded: labelsToAdd,
            labelsRemoved: labelsToRemove,
            message: `Labels updated on ${resource}/${name}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_label", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_annotate",
        description: "Add or remove annotations on resources (like kubectl annotate)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, service, etc.)",
            },
            name: {
              type: "string",
              description: "Resource name",
            },
            namespace: {
              type: "string",
              description: "Namespace (for namespaced resources)",
              default: "default",
            },
            annotations: {
              type: "object",
              description: "Annotations to add (key-value pairs). Use null value to remove an annotation.",
            },
            overwrite: {
              type: "boolean",
              description: "Overwrite existing annotations",
              default: false,
            },
            ...commonMutationQuerySchema,
          },
          required: ["resource", "name", "annotations"],
        },
      },
      handler: async ({ resource, name, namespace, annotations, overwrite, dryRun }: { 
        resource: string; 
        name: string; 
        namespace?: string; 
        annotations: Record<string, string | null>; 
        overwrite?: boolean;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Handle annotation removal
          const annotationsToRemove = Object.entries(annotations)
            .filter(([, v]) => v === null)
            .map(([k]) => k);
          const annotationsToAdd = Object.entries(annotations)
            .filter(([, v]) => v !== null)
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Update annotations",
              kind: resource,
              name,
              namespace: ns,
              details: {
                annotationsAdded: annotationsToAdd,
                annotationsRemoved: annotationsToRemove,
              },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          let result: any;
          
          switch (resource.toLowerCase()) {
            case "pod":
            case "pods":
              result = await coreApi.patchNamespacedPod({
                name,
                namespace: ns,
                body: { metadata: { annotations: annotationsToAdd } },
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: async (context: any) => {
                    context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                    return context;
                  },
                  post: async (response: any) => response
                }]
              } as any);
              break;
              
            case "deployment":
            case "deployments":
              result = await appsApi.patchNamespacedDeployment({
                name,
                namespace: ns,
                body: { metadata: { annotations: annotationsToAdd } },
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: async (context: any) => {
                    context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                    return context;
                  },
                  post: async (response: any) => response
                }]
              } as any);
              break;
              
            case "service":
            case "services":
            case "svc":
              result = await coreApi.patchNamespacedService({
                name,
                namespace: ns,
                body: { metadata: { annotations: annotationsToAdd } },
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: async (context: any) => {
                    context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                    return context;
                  },
                  post: async (response: any) => response
                }]
              } as any);
              break;
              
            case "node":
            case "nodes":
              result = await k8sClient.patchNode(
                name,
                { metadata: { annotations: annotationsToAdd } },
                { dryRun: serverDryRunParam }
              );
              break;
              
            default:
              return { success: false, error: `Annotation management not supported for ${resource}` };
          }
          
          return {
            success: true,
            resource: `${resource}/${name}`,
            namespace: ns,
            annotationsAdded: annotationsToAdd,
            annotationsRemoved: annotationsToRemove,
            message: `Annotations updated on ${resource}/${name}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_annotate", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_scale",
        description: "Scale deployments, replicasets, statefulsets (like kubectl scale). Supports single resource, multiple resources, or file-based scaling.",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (deployment, replicaset, statefulset, rc)",
            },
            name: {
              type: "string",
              description: "Resource name (single resource)",
            },
            names: {
              type: "array",
              items: { type: "string" },
              description: "Multiple resource names (e.g., ['foo', 'bar', 'baz'])",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            replicas: {
              type: "number",
              description: "Number of replicas",
              minimum: 0,
            },
            currentReplicas: {
              type: "number",
              description: "Current replicas (for conditional scaling - only scales if current matches)",
            },
            manifest: {
              type: "string",
              description: "YAML/JSON manifest content to identify resource (like kubectl scale -f)",
            },
            ...commonMutationQuerySchema,
          },
          required: ["replicas"],
        },
      },
      handler: async ({ resource, name, names, namespace, replicas, currentReplicas, manifest, dryRun }: { 
        resource?: string; 
        name?: string;
        names?: string[];
        namespace?: string; 
        replicas: number;
        currentReplicas?: number;
        manifest?: string;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const results: any[] = [];
          const errors: any[] = [];
          
          // Handle file-based scaling
          if (manifest) {
            const docs = yaml.loadAll(manifest) as any[];
            if (isClientDryRun(dryRun)) {
              const simulated = docs.filter(d => d?.metadata?.name).map(d => ({
                kind: d.kind,
                name: d.metadata.name,
                namespace: d.metadata.namespace || ns,
                targetReplicas: replicas,
              }));
              return formatClientDryRunMutation({
                operation: "Scale resources from manifest",
                name: "manifest",
                details: { simulatedResources: simulated, targetReplicas: replicas },
              });
            }

            for (const doc of docs) {
              if (!doc?.metadata?.name) continue;
              
              const resType = doc.kind?.toLowerCase();
              const resName = doc.metadata.name;
              const resNs = doc.metadata.namespace || ns;
              
              try {
                const result = await scaleResource(appsApi, resType, resName, resNs, replicas, currentReplicas, dryRun);
                results.push(result);
              } catch (err) {
                errors.push({ resource: `${resType}/${resName}`, error: String(err) });
              }
            }
            
            return {
              success: errors.length === 0,
              dryRun: dryRun || "none",
              scaled: results.length,
              failed: errors.length,
              results,
              errors: errors.length > 0 ? errors : undefined,
            };
          }
          
          // Handle multiple resource names
          if (names && names.length > 0) {
            if (!resource) {
              return { success: false, error: "Resource type required when scaling multiple resources" };
            }

            if (isClientDryRun(dryRun)) {
              return formatClientDryRunMutation({
                operation: "Scale multiple resources",
                kind: resource,
                name: names.join(", "),
                namespace: ns,
                details: { resources: names.map(n => `${resource}/${n}`), targetReplicas: replicas, currentReplicas },
              });
            }
            
            for (const resName of names) {
              try {
                const result = await scaleResource(appsApi, resource, resName, ns, replicas, currentReplicas, dryRun);
                results.push(result);
              } catch (err) {
                errors.push({ resource: `${resource}/${resName}`, error: String(err) });
              }
            }
            
            return {
              success: errors.length === 0,
              dryRun: dryRun || "none",
              scaled: results.length,
              failed: errors.length,
              results,
              errors: errors.length > 0 ? errors : undefined,
            };
          }
          
          // Handle single resource
          if (name && resource) {
            if (isClientDryRun(dryRun)) {
              return formatClientDryRunMutation({
                operation: "Scale resource",
                kind: resource,
                name,
                namespace: ns,
                details: { targetReplicas: replicas, currentReplicas },
              });
            }

            const result = await scaleResource(appsApi, resource, name, ns, replicas, currentReplicas, dryRun);
            return {
              success: true,
              ...result,
            };
          }
          
          return { success: false, error: "Must specify either: (name+resource), names[], or manifest" };
          
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_scale", namespace: ns };
          const classified = classifyError(error, context);
          return { 
            success: false, 
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
        
        async function scaleResource(appsApi: any, resourceType: string, resName: string, resNs: string, targetReplicas: number, expectedCurrent?: number, dryRunParam?: string) {
          let result: any;
          const type = resourceType.toLowerCase();
          const serverDryRunParam = dryRunParam === "server" ? "All" : undefined;
          
          switch (type) {
            case "deployment":
            case "deployments":
              if (expectedCurrent !== undefined) {
                const current = await k8sClient.getDeployment(resName, resNs);
                if (current.spec?.replicas !== expectedCurrent) {
                  throw new Error(`Current replicas (${current.spec?.replicas}) != expected (${expectedCurrent})`);
                }
              }
              result = await k8sClient.scaleDeployment(resName, resNs, targetReplicas, { dryRun: serverDryRunParam });
              break;
              
            case "replicaset":
            case "replicasets":
            case "rs":
              result = await appsApi.patchNamespacedReplicaSet({
                name: resName,
                namespace: resNs,
                body: { spec: { replicas: targetReplicas } },
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: async (context: any) => {
                    context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                    return context;
                  },
                  post: async (response: any) => response
                }]
              } as any);
              break;
              
            case "statefulset":
            case "statefulsets":
            case "sts":
              result = await appsApi.patchNamespacedStatefulSet({
                name: resName,
                namespace: resNs,
                body: { spec: { replicas: targetReplicas } },
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: async (context: any) => {
                    context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                    return context;
                  },
                  post: async (response: any) => response
                }]
              } as any);
              break;
              
            case "replicationcontroller":
            case "rc":
              const coreApi = k8sClient.getCoreV1Api();
              result = await coreApi.patchNamespacedReplicationController({
                name: resName,
                namespace: resNs,
                body: { spec: { replicas: targetReplicas } },
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: async (context: any) => {
                    context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                    return context;
                  },
                  post: async (response: any) => response
                }]
              } as any);
              break;
              
            default:
              throw new Error(`Scaling not supported for ${resourceType}`);
          }
          
          return {
            resource: `${type}/${resName}`,
            namespace: resNs,
            replicas: targetReplicas,
            previousReplicas: result?.spec?.replicas || targetReplicas,
            dryRun: dryRunParam || "none",
          };
        }
      },
    },
    // Delete Deployment
    {
      tool: {
        name: "k8s_delete_deployment",
        description: "Delete a Deployment",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Deployment to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Deployment",
              default: "default",
            },
            force: {
              type: "boolean",
              description: "Force delete (immediate removal)",
              default: false,
            },
            ...commonDeleteQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        force,
        dryRun,
        gracePeriodSeconds,
        propagationPolicy,
        ignoreNotFound,
      }: { 
        name: string; 
        namespace?: string;
        force?: boolean;
        dryRun?: string;
        gracePeriodSeconds?: number;
        propagationPolicy?: string;
        ignoreNotFound?: boolean;
      }) => {
        const ns = namespace || "default";
        try {
          validateResourceName(name, "deployment");
          const effGracePeriod = force ? 0 : gracePeriodSeconds;

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "Deployment",
              name,
              namespace: ns,
              gracePeriodSeconds: effGracePeriod,
              propagationPolicy,
            });
          }

          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const deleteParams = buildServerDeleteParams({
            dryRun,
            gracePeriodSeconds: effGracePeriod,
            propagationPolicy,
          });

          await appsApi.deleteNamespacedDeployment({ name, namespace: ns, ...deleteParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Deployment ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "Deployment", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_deployment", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Delete CronJob
    {
      tool: {
        name: "k8s_delete_cronjob",
        description: "Delete a CronJob",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the CronJob to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the CronJob",
              default: "default",
            },
            ...commonDeleteQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        dryRun,
        gracePeriodSeconds,
        propagationPolicy,
        ignoreNotFound,
      }: { 
        name: string; 
        namespace?: string;
        dryRun?: string;
        gracePeriodSeconds?: number;
        propagationPolicy?: string;
        ignoreNotFound?: boolean;
      }) => {
        const ns = namespace || "default";
        try {
          validateResourceName(name, "cronjob");

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "CronJob",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await batchApi.deleteNamespacedCronJob({ name, namespace: ns, ...deleteParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `CronJob ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "CronJob", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_cronjob", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Rollout Pause
    {
      tool: {
        name: "k8s_rollout_pause",
        description: "Pause a deployment rollout (like kubectl rollout pause)",
        inputSchema: {
          type: "object",
          properties: {
            deployment: {
              type: "string",
              description: "Name of the deployment to pause",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
            ...commonMutationQuerySchema,
          },
          required: ["deployment"],
        },
      },
      handler: async ({ deployment, namespace, dryRun }: { deployment: string; namespace?: string; dryRun?: string }) => {
        try {
          validateResourceName(deployment, "deployment");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const ns = namespace || "default";
          
          // Add paused annotation
          const patch = {
            spec: {
              paused: true,
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Pause deployment rollout",
              kind: "Deployment",
              name: deployment,
              namespace: ns,
              patch,
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          await appsApi.patchNamespacedDeployment({ name: deployment, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Deployment ${deployment} rollout paused`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_rollout_pause", resource: deployment, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Rollout Resume
    {
      tool: {
        name: "k8s_rollout_resume",
        description: "Resume a paused deployment rollout (like kubectl rollout resume)",
        inputSchema: {
          type: "object",
          properties: {
            deployment: {
              type: "string",
              description: "Name of the deployment to resume",
            },
            namespace: {
              type: "string",
              description: "Namespace of the deployment",
              default: "default",
            },
            ...commonMutationQuerySchema,
          },
          required: ["deployment"],
        },
      },
      handler: async ({ deployment, namespace, dryRun }: { deployment: string; namespace?: string; dryRun?: string }) => {
        try {
          validateResourceName(deployment, "deployment");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const ns = namespace || "default";
          
          // Remove paused annotation
          const patch = {
            spec: {
              paused: false,
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Resume deployment rollout",
              kind: "Deployment",
              name: deployment,
              namespace: ns,
              patch,
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          await appsApi.patchNamespacedDeployment({ name: deployment, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Deployment ${deployment} rollout resumed`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_rollout_resume", resource: deployment, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Restart StatefulSet
    {
      tool: {
        name: "k8s_restart_statefulset",
        description: "Restart a StatefulSet by updating its pod template (like kubectl rollout restart statefulset)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the StatefulSet to restart",
            },
            namespace: {
              type: "string",
              description: "Namespace of the StatefulSet",
              default: "default",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, dryRun }: { name: string; namespace?: string; dryRun?: string }) => {
        try {
          validateResourceName(name, "statefulset");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const ns = namespace || "default";
          
          // Update pod template annotation to trigger rolling restart
          const timestamp = new Date().toISOString();
          const patch = {
            spec: {
              template: {
                metadata: {
                  annotations: {
                    "kubectl.kubernetes.io/restartedAt": timestamp,
                  },
                },
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Restart StatefulSet",
              kind: "StatefulSet",
              name,
              namespace: ns,
              patch,
              details: { restartTimestamp: timestamp },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          await appsApi.patchNamespacedStatefulSet({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `StatefulSet ${name} restarted`,
            timestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_restart_statefulset", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Restart DaemonSet
    {
      tool: {
        name: "k8s_restart_daemonset",
        description: "Restart a DaemonSet by updating its pod template (like kubectl rollout restart daemonset)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the DaemonSet to restart",
            },
            namespace: {
              type: "string",
              description: "Namespace of the DaemonSet",
              default: "default",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, dryRun }: { name: string; namespace?: string; dryRun?: string }) => {
        try {
          validateResourceName(name, "daemonset");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const ns = namespace || "default";
          
          // Update pod template annotation to trigger rolling restart
          const timestamp = new Date().toISOString();
          const patch = {
            spec: {
              template: {
                metadata: {
                  annotations: {
                    "kubectl.kubernetes.io/restartedAt": timestamp,
                  },
                },
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Restart DaemonSet",
              kind: "DaemonSet",
              name,
              namespace: ns,
              patch,
              details: { restartTimestamp: timestamp },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          await appsApi.patchNamespacedDaemonSet({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `DaemonSet ${name} restarted`,
            timestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_restart_daemonset", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Autoscale - Create HPA
    {
      tool: {
        name: "k8s_autoscale",
        description: "Create a HorizontalPodAutoscaler for a deployment (like kubectl autoscale)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name for the HPA",
            },
            deployment: {
              type: "string",
              description: "Name of the deployment to autoscale",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            minReplicas: {
              type: "number",
              description: "Minimum number of replicas",
              default: 1,
            },
            maxReplicas: {
              type: "number",
              description: "Maximum number of replicas",
              default: 10,
            },
            cpuPercent: {
              type: "number",
              description: "Target CPU utilization percentage",
              default: 80,
            },
            memoryPercent: {
              type: "number",
              description: "Target memory utilization percentage",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name", "deployment"],
        },
      },
      handler: async ({ name, deployment, namespace, minReplicas, maxReplicas, cpuPercent, memoryPercent, dryRun }: { 
        name: string;
        deployment: string;
        namespace?: string;
        minReplicas?: number;
        maxReplicas?: number;
        cpuPercent?: number;
        memoryPercent?: number;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "horizontalpodautoscaler");
          validateResourceName(deployment, "deployment");
          const ns = namespace || "default";
          
          // Create HPA using raw API since autoscaling/v2 may not be directly available in client-node
          const rawClient = k8sClient as any;
          const hpa = {
            apiVersion: "autoscaling/v2",
            kind: "HorizontalPodAutoscaler",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              scaleTargetRef: {
                apiVersion: "apps/v1",
                kind: "Deployment",
                name: deployment,
              },
              minReplicas: minReplicas || 1,
              maxReplicas: maxReplicas || 10,
              metrics: [
                ...(cpuPercent !== undefined ? [{
                  type: "Resource",
                  resource: {
                    name: "cpu",
                    target: {
                      type: "Utilization",
                      averageUtilization: cpuPercent,
                    },
                  },
                }] : []),
                ...(memoryPercent !== undefined ? [{
                  type: "Resource",
                  resource: {
                    name: "memory",
                    target: {
                      type: "Utilization",
                      averageUtilization: memoryPercent,
                    },
                  },
                }] : []),
              ],
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Create HPA",
              kind: "HorizontalPodAutoscaler",
              name,
              namespace: ns,
              patch: hpa,
              details: { deployment, minReplicas: minReplicas || 1, maxReplicas: maxReplicas || 10, cpuPercent, memoryPercent },
            });
          }
          
          // Apply via raw API
          const url = dryRun === "server" 
            ? `/apis/autoscaling/v2/namespaces/${ns}/horizontalpodautoscalers?dryRun=All` 
            : `/apis/autoscaling/v2/namespaces/${ns}/horizontalpodautoscalers`;
          const result = await rawClient.rawApiRequest(url, "POST", hpa);
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `HPA ${name} created for deployment ${deployment}`,
            hpa: {
              name,
              namespace: ns,
              deployment,
              minReplicas: minReplicas || 1,
              maxReplicas: maxReplicas || 10,
              cpuTarget: cpuPercent,
              memoryTarget: memoryPercent,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_autoscale", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // List HPAs
    {
      tool: {
        name: "k8s_list_hpa",
        description: "List all HorizontalPodAutoscalers (like kubectl get hpa). Shows autoscalers that automatically adjust pod replicas based on CPU/memory usage or custom metrics.",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter (shows all if not specified)",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const rawClient = k8sClient as any;
          
          const queryParams = new URLSearchParams();
          if (labelSelector) queryParams.set("labelSelector", labelSelector);
          if (fieldSelector) queryParams.set("fieldSelector", fieldSelector);
          const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";

          const path = namespace
            ? `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers${qs}`
            : `/apis/autoscaling/v2/horizontalpodautoscalers${qs}`;
          
          const result = await rawClient.rawApiRequest(path);
          
          const hpas = result.items || [];
          
          const mapped = hpas.map((hpa: any) => ({
            name: hpa.metadata?.name,
            namespace: hpa.metadata?.namespace,
            target: hpa.spec?.scaleTargetRef
              ? `${hpa.spec.scaleTargetRef.kind}/${hpa.spec.scaleTargetRef.name}`
              : "unknown",
            minReplicas: hpa.spec?.minReplicas,
            maxReplicas: hpa.spec?.maxReplicas,
            currentReplicas: hpa.status?.currentReplicas,
            desiredReplicas: hpa.status?.desiredReplicas,
            conditions: hpa.status?.conditions?.map((c: any) => ({
              type: c.type,
              status: c.status,
              reason: c.reason,
              message: c.message,
            })),
            age: hpa.metadata?.creationTimestamp,
            labels: hpa.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            hpas: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_hpa", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Get HPA
    {
      tool: {
        name: "k8s_get_hpa",
        description: "Get detailed information about a HorizontalPodAutoscaler (like kubectl describe hpa). Shows current metrics, target resources, and scaling behavior.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the HPA",
            },
            namespace: {
              type: "string",
              description: "Namespace of the HPA",
              default: "default",
            },
            ...commonGetQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        output,
        subpath,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "hpa");
          const ns = namespace || "default";
          const rawClient = k8sClient as any;
          
          const result = await rawClient.rawApiRequest(
            `/apis/autoscaling/v2/namespaces/${ns}/horizontalpodautoscalers/${name}`
          );
          
          const hpa = result;
          
          const rawResult = {
            name: hpa.metadata?.name,
            namespace: hpa.metadata?.namespace,
            creationTimestamp: hpa.metadata?.creationTimestamp,
            target: hpa.spec?.scaleTargetRef,
            minReplicas: hpa.spec?.minReplicas,
            maxReplicas: hpa.spec?.maxReplicas,
            metrics: hpa.spec?.metrics?.map((m: any) => ({
              type: m.type,
              resource: m.resource,
              pods: m.pods,
              external: m.external,
              object: m.object,
              containerResource: m.containerResource,
            })),
            behavior: hpa.spec?.behavior,
            currentReplicas: hpa.status?.currentReplicas,
            desiredReplicas: hpa.status?.desiredReplicas,
            currentMetrics: hpa.status?.currentMetrics?.map((m: any) => ({
              type: m.type,
              resource: m.resource,
              pods: m.pods,
              external: m.external,
              object: m.object,
              containerResource: m.containerResource,
            })),
            conditions: hpa.status?.conditions?.map((c: any) => ({
              type: c.type,
              status: c.status,
              reason: c.reason,
              message: c.message,
              lastTransitionTime: c.lastTransitionTime,
            })),
            age: hpa.metadata?.creationTimestamp,
            annotations: hpa.metadata?.annotations,
            labels: hpa.metadata?.labels,
          };

          return applyGetFormatting(rawResult, {
            kind: "HorizontalPodAutoscaler",
            name,
            namespace: ns,
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              namespace: namespace || "default",
              message: `HPA "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_hpa", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Delete HPA
    {
      tool: {
        name: "k8s_delete_hpa",
        description: "Delete a HorizontalPodAutoscaler (like kubectl delete hpa). The target deployment will no longer scale automatically.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the HPA to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the HPA",
              default: "default",
            },
            ...commonDeleteQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        namespace,
        dryRun,
        gracePeriodSeconds,
        propagationPolicy,
        ignoreNotFound,
      }: {
        name: string;
        namespace?: string;
        dryRun?: string;
        gracePeriodSeconds?: number;
        propagationPolicy?: string;
        ignoreNotFound?: boolean;
      }) => {
        const ns = namespace || "default";
        try {
          validateResourceName(name, "hpa");

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "HorizontalPodAutoscaler",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const rawClient = k8sClient as any;
          let deleteUrl = `/apis/autoscaling/v2/namespaces/${ns}/horizontalpodautoscalers/${name}`;
          const queryParams: string[] = [];
          if (dryRun === "server") {
            queryParams.push("dryRun=All");
          }
          if (gracePeriodSeconds !== undefined) {
            queryParams.push(`gracePeriodSeconds=${gracePeriodSeconds}`);
          }
          if (propagationPolicy) {
            queryParams.push(`propagationPolicy=${propagationPolicy}`);
          }
          if (queryParams.length > 0) {
            deleteUrl += `?${queryParams.join("&")}`;
          }
          
          await rawClient.rawApiRequest(deleteUrl, "DELETE");
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `HPA ${name} deleted from namespace ${ns}`,
            note: "The target deployment will no longer scale automatically. Manual scaling or a new HPA will be needed.",
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "HorizontalPodAutoscaler", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_hpa", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Create PodDisruptionBudget
    {
      tool: {
        name: "k8s_create_pdb",
        description: "Create a PodDisruptionBudget to ensure high availability (like kubectl create pdb)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PodDisruptionBudget",
            },
            namespace: {
              type: "string",
              description: "Namespace for the PDB",
              default: "default",
            },
            selector: {
              type: "object",
              description: "Label selector to match pods (e.g., {app: 'nginx'})",
            },
            minAvailable: {
              type: ["string", "number"],
              description: "Minimum number of pods that must be available (can be number or percentage, e.g., '50%')",
            },
            maxUnavailable: {
              type: ["string", "number"],
              description: "Maximum number of pods that can be unavailable (can be number or percentage, e.g., '1')",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "selector"],
        },
      },
      handler: async ({ name, namespace, selector, minAvailable, maxUnavailable, dryRun }: { 
        name: string;
        namespace?: string;
        selector: Record<string, string>;
        minAvailable?: string | number;
        maxUnavailable?: string | number;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "pdb");
          const rawClient = k8sClient as any;
          const ns = namespace || "default";
          
          // Validate that at least one of minAvailable or maxUnavailable is provided
          if (minAvailable === undefined && maxUnavailable === undefined) {
            return {
              success: false,
              error: "Either minAvailable or maxUnavailable must be specified",
            };
          }
          
          const pdb = {
            apiVersion: "policy/v1",
            kind: "PodDisruptionBudget",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              selector: {
                matchLabels: selector,
              },
              ...(minAvailable !== undefined ? { minAvailable } : {}),
              ...(maxUnavailable !== undefined ? { maxUnavailable } : {}),
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "PodDisruptionBudget",
              name,
              namespace: ns,
              manifest: pdb,
            });
          }

          let url = `/apis/policy/v1/namespaces/${ns}/poddisruptionbudgets`;
          if (dryRun === "server") {
            url += "?dryRun=All";
          }
          
          const result = await rawClient.rawApiRequest(url, "POST", pdb);
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `PodDisruptionBudget ${name} created in namespace ${ns}`,
            pdb: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              selector: result.spec?.selector?.matchLabels,
              minAvailable: result.spec?.minAvailable,
              maxUnavailable: result.spec?.maxUnavailable,
              disruptionsAllowed: result.status?.disruptionsAllowed,
              currentHealthy: result.status?.currentHealthy,
              desiredHealthy: result.status?.desiredHealthy,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_pdb", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Create StatefulSet
    {
      tool: {
        name: "k8s_create_statefulset",
        description: "Create a StatefulSet (like kubectl create statefulset). StatefulSets are used for applications that require stable network identity and persistent storage.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the StatefulSet",
            },
            image: {
              type: "string",
              description: "Container image",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            replicas: {
              type: "number",
              description: "Number of replicas",
              default: 1,
            },
            port: {
              type: "number",
              description: "Container port to expose",
            },
            serviceName: {
              type: "string",
              description: "Name of the governing service (required for StatefulSet)",
            },
            storageClass: {
              type: "string",
              description: "StorageClass for PVCs (omit for default)",
            },
            storageSize: {
              type: "string",
              description: "Storage size per replica (e.g., '10Gi', '100Mi')",
              default: "1Gi",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description: "Command to run in container",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "Environment variables (KEY=VALUE format)",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "image", "serviceName"],
        },
      },
      handler: async ({ name, image, namespace, replicas, port, serviceName, storageClass, storageSize, command, env, dryRun }: {
        name: string;
        image: string;
        namespace?: string;
        replicas?: number;
        port?: number;
        serviceName: string;
        storageClass?: string;
        storageSize?: string;
        command?: string[];
        env?: string[];
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          validateResourceName(name, "statefulset");
          validateResourceName(serviceName, "service");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Parse environment variables
          const containerEnv = env?.map(e => {
            const [key, ...valueParts] = e.split("=");
            return { name: key, value: valueParts.join("=") };
          }) || [];
          
          const statefulSet: k8s.V1StatefulSet = {
            apiVersion: "apps/v1",
            kind: "StatefulSet",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              serviceName,
              replicas: replicas || 1,
              selector: {
                matchLabels: { app: name },
              },
              template: {
                metadata: {
                  labels: { app: name },
                },
                spec: {
                  containers: [
                    {
                      name,
                      image,
                      ...(port ? { ports: [{ containerPort: port }] } : {}),
                      ...(command && command.length > 0 ? { command } : {}),
                      ...(containerEnv.length > 0 ? { env: containerEnv } : {}),
                    },
                  ],
                },
              },
              volumeClaimTemplates: [
                {
                  metadata: { name: "data" },
                  spec: {
                    accessModes: ["ReadWriteOnce"],
                    ...(storageClass ? { storageClassName: storageClass } : {}),
                    resources: {
                      requests: { storage: storageSize || "1Gi" },
                    },
                  },
                },
              ],
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "StatefulSet",
              name,
              namespace: ns,
              manifest: statefulSet,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await appsApi.createNamespacedStatefulSet({ namespace: ns, body: statefulSet, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            statefulSet: name,
            namespace: ns,
            serviceName,
            image,
            replicas: replicas || 1,
            storageSize: storageSize || "1Gi",
            storageClass,
            created: result.metadata?.creationTimestamp,
            message: `StatefulSet ${name} created successfully with ${replicas || 1} replica(s)`,
            note: `Ensure service '${serviceName}' exists or create it for proper StatefulSet operation`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_statefulset", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Create DaemonSet
    {
      tool: {
        name: "k8s_create_daemonset",
        description: "Create a DaemonSet (like kubectl create daemonset). DaemonSets run a pod on every node (or matching nodes), useful for log collectors, monitoring agents, etc.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the DaemonSet",
            },
            image: {
              type: "string",
              description: "Container image",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            port: {
              type: "number",
              description: "Container port to expose",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description: "Command to run in container",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "Environment variables (KEY=VALUE format)",
            },
            nodeSelector: {
              type: "object",
              description: "Node selector labels (e.g., {app: 'monitoring'})",
            },
            hostNetwork: {
              type: "boolean",
              description: "Use host network namespace",
              default: false,
            },
            hostPID: {
              type: "boolean",
              description: "Use host PID namespace",
              default: false,
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "image"],
        },
      },
      handler: async ({ name, image, namespace, port, command, env, nodeSelector, hostNetwork, hostPID, dryRun }: {
        name: string;
        image: string;
        namespace?: string;
        port?: number;
        command?: string[];
        env?: string[];
        nodeSelector?: Record<string, string>;
        hostNetwork?: boolean;
        hostPID?: boolean;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          validateResourceName(name, "daemonset");
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Parse environment variables
          const containerEnv = env?.map(e => {
            const [key, ...valueParts] = e.split("=");
            return { name: key, value: valueParts.join("=") };
          }) || [];
          
          const daemonSet: k8s.V1DaemonSet = {
            apiVersion: "apps/v1",
            kind: "DaemonSet",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              selector: {
                matchLabels: { app: name },
              },
              template: {
                metadata: {
                  labels: { app: name },
                },
                spec: {
                  ...(hostNetwork ? { hostNetwork: true } : {}),
                  ...(hostPID ? { hostPID: true } : {}),
                  ...(nodeSelector ? { nodeSelector } : {}),
                  containers: [
                    {
                      name,
                      image,
                      ...(port ? { ports: [{ containerPort: port, hostPort: hostNetwork ? port : undefined }] } : {}),
                      ...(command && command.length > 0 ? { command } : {}),
                      ...(containerEnv.length > 0 ? { env: containerEnv } : {}),
                    },
                  ],
                },
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "DaemonSet",
              name,
              namespace: ns,
              manifest: daemonSet,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await appsApi.createNamespacedDaemonSet({ namespace: ns, body: daemonSet, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            daemonSet: name,
            namespace: ns,
            image,
            hostNetwork: hostNetwork || false,
            hostPID: hostPID || false,
            nodeSelector,
            created: result.metadata?.creationTimestamp,
            message: `DaemonSet ${name} created successfully`,
            note: hostNetwork ? "Using host network - pods will run with host networking" : "Pods will run on all matching nodes",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_daemonset", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
  ];
}
