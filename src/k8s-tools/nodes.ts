import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName } from "../validators.js";
import { commonListQuerySchema, commonGetQuerySchema, applySortAndLimit, applyGetFormatting, isNotFoundError } from "../utils/query-helper.js";
import {
  commonMutationQuerySchema,
  isClientDryRun,
  formatClientDryRunMutation,
  buildServerMutationParams,
} from "../utils/safety-helper.js";

export function registerNodeTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_nodes",
        description: "List all nodes in the cluster with status and resource information",
        inputSchema: {
          type: "object",
          properties: {
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ labelSelector, fieldSelector, sortBy, descending, limit }: {
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      } = {}) => {
        try {
          const nodes = await k8sClient.listNodes({ labelSelector, fieldSelector });
          const mapped = nodes.map((node: k8s.V1Node) => {
            const conditions = node.status?.conditions || [];
            const readyCondition = conditions.find((c: k8s.V1NodeCondition) => c.type === "Ready");
            const memoryPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === "MemoryPressure");
            const diskPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === "DiskPressure");
            const pidPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === "PIDPressure");

            return {
              name: node.metadata?.name,
              status: readyCondition?.status === "True" ? "Ready" : "NotReady",
              message: readyCondition?.message,
              kernelVersion: node.status?.nodeInfo?.kernelVersion,
              osImage: node.status?.nodeInfo?.osImage,
              containerRuntime: node.status?.nodeInfo?.containerRuntimeVersion,
              kubeletVersion: node.status?.nodeInfo?.kubeletVersion,
              architecture: node.status?.nodeInfo?.architecture,
              capacity: node.status?.capacity,
              allocatable: node.status?.allocatable,
              conditions: {
                ready: readyCondition?.status,
                memoryPressure: memoryPressure?.status,
                diskPressure: diskPressure?.status,
                pidPressure: pidPressure?.status,
              },
              labels: node.metadata?.labels,
              taints: node.spec?.taints,
              created: node.metadata?.creationTimestamp,
            };
          });

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            nodes: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_nodes" };
          const classified = classifyError(error, context);
          return {
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_node",
        description: "Get detailed information about a specific node",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node",
            },
            ...commonGetQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        output,
        subpath,
        ignoreNotFound,
      }: {
        name: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "node");
          const node = await k8sClient.getNode(name);
          const conditions = node.status?.conditions || [];
        
          const rawResult = {
            name: node.metadata?.name,
            labels: node.metadata?.labels,
            annotations: node.metadata?.annotations,
            creationTimestamp: node.metadata?.creationTimestamp,
            status: {
              phase: node.status?.phase,
              conditions: conditions.map((c: k8s.V1NodeCondition) => ({
                type: c.type,
                status: c.status,
                reason: c.reason,
                message: c.message,
                lastHeartbeatTime: c.lastHeartbeatTime,
                lastTransitionTime: c.lastTransitionTime,
              })),
              addresses: node.status?.addresses,
              capacity: node.status?.capacity,
              allocatable: node.status?.allocatable,
              nodeInfo: node.status?.nodeInfo,
            },
            spec: {
              taints: node.spec?.taints,
              unschedulable: node.spec?.unschedulable,
            },
          };

          return applyGetFormatting(rawResult, {
            kind: "Node",
            name,
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              message: `Node "${name}" not found`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_node", resource: name };
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
        name: "k8s_cordon_node",
        description: "Mark a node as unschedulable (cordon)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node to cordon",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, dryRun }: { name: string; dryRun?: string }) => {
        try {
          validateResourceName(name, "node");
          const patch = { spec: { unschedulable: true } };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Cordon node",
              kind: "Node",
              name,
              patch,
            });
          }

          const mutationParams = buildServerMutationParams({ dryRun });
          await k8sClient.patchNode(name, patch, mutationParams);
          return { success: true, dryRun: dryRun || "none", message: `Node ${name} cordoned successfully` };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_cordon_node", resource: name };
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
        name: "k8s_uncordon_node",
        description: "Mark a node as schedulable (uncordon)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node to uncordon",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, dryRun }: { name: string; dryRun?: string }) => {
        try {
          validateResourceName(name, "node");
          const patch = { spec: { unschedulable: false } };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Uncordon node",
              kind: "Node",
              name,
              patch,
            });
          }

          const mutationParams = buildServerMutationParams({ dryRun });
          await k8sClient.patchNode(name, patch, mutationParams);
          return { success: true, dryRun: dryRun || "none", message: `Node ${name} uncordoned successfully` };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_uncordon_node", resource: name };
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
        name: "k8s_drain_node",
        description: "Drain a node by cordoning it and evicting all pods",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node to drain",
            },
            force: {
              type: "boolean",
              description: "Force deletion of pods with local storage",
              default: false,
            },
            gracePeriodSeconds: {
              type: "number",
              description: "Grace period for pod termination",
              default: 30,
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, force, gracePeriodSeconds, dryRun }: { 
        name: string; 
        force?: boolean; 
        gracePeriodSeconds?: number;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "node");
          const coreApi = k8sClient.getCoreV1Api();

          if (isClientDryRun(dryRun)) {
            const pods = await coreApi.listPodForAllNamespaces({
              fieldSelector: `spec.nodeName=${name}`
            });

            const evictablePods: string[] = [];
            const skippedPods: string[] = [];

            for (const pod of pods.items) {
              const podName = pod.metadata?.name || "";
              const namespace = pod.metadata?.namespace || "";

              if (pod.metadata?.ownerReferences?.some((ref: k8s.V1OwnerReference) => ref.kind === "DaemonSet")) {
                skippedPods.push(`${namespace}/${podName} (DaemonSet)`);
                continue;
              }

              if (pod.metadata?.annotations?.["kubernetes.io/config.mirror"]) {
                skippedPods.push(`${namespace}/${podName} (mirror pod)`);
                continue;
              }

              evictablePods.push(`${namespace}/${podName}`);
            }

            return formatClientDryRunMutation({
              operation: "Drain node",
              kind: "Node",
              name,
              details: {
                cordoned: true,
                evictablePodsCount: evictablePods.length,
                skippedPodsCount: skippedPods.length,
                evictablePods,
                skippedPods,
              },
            });
          }

          // First cordon the node
          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          const cordonPatch = { spec: { unschedulable: true } };
          await k8sClient.patchNode(name, cordonPatch, { dryRun: serverDryRunParam });

          // Get all pods on the node
          const pods = await coreApi.listPodForAllNamespaces({
            fieldSelector: `spec.nodeName=${name}`
          });

          const deletedPods: string[] = [];
          const skippedPods: string[] = [];

          for (const pod of pods.items) {
            const podName = pod.metadata?.name || "";
            const namespace = pod.metadata?.namespace || "";

            // Skip pods managed by DaemonSets
            if (pod.metadata?.ownerReferences?.some((ref: k8s.V1OwnerReference) => ref.kind === "DaemonSet")) {
              skippedPods.push(`${namespace}/${podName} (DaemonSet)`);
              continue;
            }

            // Skip mirror pods
            if (pod.metadata?.annotations?.["kubernetes.io/config.mirror"]) {
              skippedPods.push(`${namespace}/${podName} (mirror pod)`);
              continue;
            }

            // Delete the pod
            try {
              await coreApi.deleteNamespacedPod({
                name: podName,
                namespace,
                gracePeriodSeconds,
                dryRun: serverDryRunParam,
              });
              deletedPods.push(`${namespace}/${podName}`);
            } catch (error) {
              skippedPods.push(`${namespace}/${podName} (delete failed)`);
            }
          }

          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Node ${name} drained successfully`,
            details: {
              cordoned: true,
              podsDeleted: deletedPods.length,
              podsSkipped: skippedPods.length,
              deletedPods,
              skippedPods,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_drain_node", resource: name };
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
        name: "k8s_add_node_taint",
        description: "Add a taint to a node",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node",
            },
            key: {
              type: "string",
              description: "Taint key",
            },
            value: {
              type: "string",
              description: "Taint value",
            },
            effect: {
              type: "string",
              description: "Taint effect (NoSchedule, PreferNoSchedule, NoExecute)",
              enum: ["NoSchedule", "PreferNoSchedule", "NoExecute"],
            },
            ...commonMutationQuerySchema,
          },
          required: ["name", "key", "effect"],
        },
      },
      handler: async ({ name, key, value, effect, dryRun }: { 
        name: string; 
        key: string; 
        value?: string; 
        effect: string;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "node");
          const node = await k8sClient.getNode(name);
          const existingTaints = node.spec?.taints || [];
        
          // Check if taint already exists
          const exists = existingTaints.some((t: k8s.V1Taint) => t.key === key && t.effect === effect);
          if (exists) {
            return { success: false, message: `Taint ${key}:${effect} already exists on node ${name}` };
          }

          const newTaint: k8s.V1Taint = { key, value, effect };
          const patch = { spec: { taints: [...existingTaints, newTaint] } };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Add taint to node",
              kind: "Node",
              name,
              patch,
              details: { taint: newTaint },
            });
          }

          const mutationParams = buildServerMutationParams({ dryRun });
          await k8sClient.patchNode(name, patch, mutationParams);
          return { success: true, dryRun: dryRun || "none", message: `Taint ${key}${value ? `=${value}` : ""}:${effect} added to node ${name}` };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_add_node_taint", resource: name };
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
        name: "k8s_remove_node_taint",
        description: "Remove a taint from a node",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node",
            },
            key: {
              type: "string",
              description: "Taint key to remove",
            },
            effect: {
              type: "string",
              description: "Taint effect (optional, removes all matching keys if not specified)",
              enum: ["NoSchedule", "PreferNoSchedule", "NoExecute"],
            },
            ...commonMutationQuerySchema,
          },
          required: ["name", "key"],
        },
      },
      handler: async ({ name, key, effect, dryRun }: { 
        name: string; 
        key: string; 
        effect?: string;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "node");
          const node = await k8sClient.getNode(name);
          const existingTaints = node.spec?.taints || [];
        
          const filteredTaints = existingTaints.filter((t: k8s.V1Taint) => {
            if (t.key !== key) return true;
            if (effect && t.effect !== effect) return true;
            return false;
          });

          if (filteredTaints.length === existingTaints.length) {
            return { success: false, message: `Taint ${key}${effect ? `:${effect}` : ""} not found on node ${name}` };
          }

          const patch = { spec: { taints: filteredTaints } };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Remove taint from node",
              kind: "Node",
              name,
              patch,
              details: { removedTaint: { key, effect } },
            });
          }

          const mutationParams = buildServerMutationParams({ dryRun });
          await k8sClient.patchNode(name, patch, mutationParams);
          return { success: true, dryRun: dryRun || "none", message: `Taint ${key}${effect ? `:${effect}` : ""} removed from node ${name}` };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_remove_node_taint", resource: name };
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
        name: "k8s_add_node_label",
        description: "Add or update a label on a node",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node",
            },
            key: {
              type: "string",
              description: "Label key",
            },
            value: {
              type: "string",
              description: "Label value",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name", "key", "value"],
        },
      },
      handler: async ({ name, key, value, dryRun }: { name: string; key: string; value: string; dryRun?: string }) => {
        try {
          validateResourceName(name, "node");
          const patch = {
            metadata: {
              labels: {
                [key]: value,
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Add label to node",
              kind: "Node",
              name,
              patch,
              details: { label: { [key]: value } },
            });
          }

          const mutationParams = buildServerMutationParams({ dryRun });
          await k8sClient.patchNode(name, patch, mutationParams);
          return { success: true, dryRun: dryRun || "none", message: `Label ${key}=${value} added to node ${name}` };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_add_node_label", resource: name };
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
        name: "k8s_remove_node_label",
        description: "Remove a label from a node",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node",
            },
            key: {
              type: "string",
              description: "Label key to remove",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name", "key"],
        },
      },
      handler: async ({ name, key, dryRun }: { name: string; key: string; dryRun?: string }) => {
        try {
          validateResourceName(name, "node");
          const patch = {
            metadata: {
              labels: {
                [key]: null,
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Remove label from node",
              kind: "Node",
              name,
              patch,
              details: { removedLabel: key },
            });
          }

          const mutationParams = buildServerMutationParams({ dryRun });
          await k8sClient.patchNode(name, patch, mutationParams);
          return { success: true, dryRun: dryRun || "none", message: `Label ${key} removed from node ${name}` };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_remove_node_label", resource: name };
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
        name: "k8s_node_pressure_status",
        description: "Check for node pressure conditions (Memory, Disk, PID)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the node (optional, checks all nodes if not specified)",
            },
          },
        },
      },
      handler: async ({ name }: { name?: string }) => {
        try {
          const nodes = name ? [await k8sClient.getNode(name)] : await k8sClient.listNodes();
        
          const pressureStatus = nodes.map((node: k8s.V1Node) => {
            const conditions = node.status?.conditions || [];
            const memoryPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === "MemoryPressure");
            const diskPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === "DiskPressure");
            const pidPressure = conditions.find((c: k8s.V1NodeCondition) => c.type === "PIDPressure");

            return {
              name: node.metadata?.name,
              pressures: {
                memory: memoryPressure?.status === "True",
                disk: diskPressure?.status === "True",
                pid: pidPressure?.status === "True",
              },
              details: {
                memoryMessage: memoryPressure?.message,
                diskMessage: diskPressure?.message,
                pidMessage: pidPressure?.message,
              },
              hasPressure: memoryPressure?.status === "True" || 
                           diskPressure?.status === "True" || 
                           pidPressure?.status === "True",
            };
          });

          return {
            nodes: pressureStatus,
            totalNodesWithPressure: pressureStatus.filter((n) => n.hasPressure).length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_node_pressure_status", resource: name };
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
