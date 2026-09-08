import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName } from "../validators.js";
import { commonListQuerySchema, applySortAndLimit } from "../utils/query-helper.js";
import {
  commonDeleteQuerySchema,
  commonCreateQuerySchema,
  isClientDryRun,
  formatClientDryRunDelete,
  formatClientDryRunCreate,
  handleDeleteError,
  buildServerDeleteParams,
  buildServerCreateParams,
} from "../utils/safety-helper.js";

export function registerMonitoringTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_events",
        description: "List cluster events",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            type: {
              type: "string",
              description: "Event type filter (Normal, Warning)",
            },
            ...commonListQuerySchema,
          },
        },
      },
      handler: async ({
        namespace,
        fieldSelector,
        type,
        labelSelector,
        sortBy,
        descending,
        limit,
      }: { 
        namespace?: string; 
        fieldSelector?: string;
        type?: string;
        labelSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      } = {}) => {
        try {
          let selector = fieldSelector || "";
          if (type) {
            selector = selector ? `${selector},type=${type}` : `type=${type}`;
          }
          
          const events = await k8sClient.listEvents(namespace, {
            fieldSelector: selector || undefined,
            labelSelector,
          });
          
          const mapped = events.map((e: k8s.CoreV1Event) => ({
            name: e.metadata?.name,
            type: e.type,
            reason: e.reason,
            message: e.message,
            involvedObject: {
              kind: e.involvedObject?.kind,
              name: e.involvedObject?.name,
              namespace: e.involvedObject?.namespace,
            },
            count: e.count,
            firstTimestamp: e.firstTimestamp,
            lastTimestamp: e.lastTimestamp,
            source: e.source?.component,
            creationTimestamp: e.metadata?.creationTimestamp,
          }));

          const effectiveSortBy = sortBy || "lastTimestamp";
          const effectiveDescending = descending !== undefined ? descending : (sortBy ? false : true);
          const effectiveLimit = limit !== undefined ? limit : 100;

          const queryResult = applySortAndLimit(mapped, {
            sortBy: effectiveSortBy,
            descending: effectiveDescending,
            limit: effectiveLimit,
          });

          return {
            events: queryResult.items,
            total: events.length,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            warningCount: events.filter((e: k8s.CoreV1Event) => e.type === "Warning").length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_events", namespace };
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
        name: "k8s_get_resource_quotas",
        description: "List ResourceQuotas per namespace",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            ...commonListQuerySchema,
          },
        },
      },
      handler: async ({
        namespace,
        sortBy,
        descending,
        limit,
        output,
      }: {
        namespace?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
        output?: string;
      } = {}) => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const response = namespace
            ? await coreApi.listNamespacedResourceQuota({ namespace })
            : await coreApi.listResourceQuotaForAllNamespaces();
          
          const mapped = response.items.map((rq: k8s.V1ResourceQuota) => ({
            name: rq.metadata?.name,
            namespace: rq.metadata?.namespace,
            spec: rq.spec?.hard,
            status: {
              used: rq.status?.used,
              hard: rq.status?.hard,
            },
            age: rq.metadata?.creationTimestamp,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit, output });

          return {
            resourceQuotas: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            yaml: queryResult.yaml,
            names: queryResult.names,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_resource_quotas", namespace };
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
        name: "k8s_get_limit_ranges",
        description: "List LimitRanges per namespace",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            ...commonListQuerySchema,
          },
        },
      },
      handler: async ({
        namespace,
        sortBy,
        descending,
        limit,
        output,
      }: {
        namespace?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
        output?: string;
      } = {}) => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const response = namespace
            ? await coreApi.listNamespacedLimitRange({ namespace })
            : await coreApi.listLimitRangeForAllNamespaces();
          
          const mapped = response.items.map((lr: k8s.V1LimitRange) => ({
            name: lr.metadata?.name,
            namespace: lr.metadata?.namespace,
            limits: lr.spec?.limits?.map((l: k8s.V1LimitRangeItem) => ({
              type: l.type,
              max: l.max,
              min: l.min,
              _default: l._default,
              defaultRequest: l.defaultRequest,
              maxLimitRequestRatio: l.maxLimitRequestRatio,
            })),
            age: lr.metadata?.creationTimestamp,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit, output });

          return {
            limitRanges: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            yaml: queryResult.yaml,
            names: queryResult.names,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_limit_ranges", namespace };
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
        name: "k8s_find_crashloop_pods",
        description: "Find pods in CrashLoopBackOff state",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to search",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const pods = await k8sClient.listPods(namespace);
          
          const crashLoopPods = pods.filter((pod: k8s.V1Pod) => {
            const containerStatuses = pod.status?.containerStatuses || [];
            return containerStatuses.some((c: k8s.V1ContainerStatus) => 
              c.state?.waiting?.reason === "CrashLoopBackOff" ||
              (c.restartCount && c.restartCount > 5)
            );
          });

          return {
            totalPods: pods.length,
            crashLoopCount: crashLoopPods.length,
            pods: crashLoopPods.map((pod: k8s.V1Pod) => {
              const containerStatuses = pod.status?.containerStatuses || [];
              const crashing = containerStatuses.find((c: k8s.V1ContainerStatus) => 
                c.state?.waiting?.reason === "CrashLoopBackOff"
              );
              
              return {
                name: pod.metadata?.name,
                namespace: pod.metadata?.namespace,
                container: crashing?.name,
                restartCount: crashing?.restartCount,
                lastState: crashing?.lastState,
                reason: crashing?.state?.waiting?.reason,
                message: crashing?.state?.waiting?.message,
              };
            }),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_find_crashloop_pods", namespace };
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
        name: "k8s_get_pod_metrics",
        description: "Get pod metrics (CPU/Memory) - requires metrics-server",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            name: {
              type: "string",
              description: "Specific pod name (optional)",
            },
          },
        },
      },
      handler: async ({ namespace, name }: { namespace?: string; name?: string }) => {
        try {
          const rawClient = k8sClient as any;
          const ns = namespace || "default";
          const path = name 
            ? `/apis/metrics.k8s.io/v1/namespaces/${ns}/pods/${name}`
            : `/apis/metrics.k8s.io/v1/namespaces/${ns}/pods`;
          
          const result = await rawClient.rawApiRequest(path);
          return result;
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_pod_metrics", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: [
              ...classified.suggestions,
              "Install metrics-server: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml",
              "Verify metrics-server is running: kubectl get pods -n kube-system -l k8s-app=metrics-server",
              "Try k8s_describe_pod for resource requests/limits as fallback",
            ],
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_node_metrics",
        description: "Get node metrics (CPU/Memory) - requires metrics-server",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Specific node name (optional)",
            },
          },
        },
      },
      handler: async ({ name }: { name?: string }) => {
        try {
          const rawClient = k8sClient as any;
          const path = name 
            ? `/apis/metrics.k8s.io/v1/nodes/${name}`
            : `/apis/metrics.k8s.io/v1/nodes`;
          
          const result = await rawClient.rawApiRequest(path);
          return result;
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_node_metrics", resource: name };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: [
              ...classified.suggestions,
              "Install metrics-server: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml",
              "Verify metrics-server is running: kubectl get pods -n kube-system -l k8s-app=metrics-server",
            ],
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_health_score",
        description: "Calculate cluster health score based on various factors",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        const [nodes, pods, events, deployments] = await Promise.all([
          k8sClient.listNodes(),
          k8sClient.listPods(),
          k8sClient.listEvents(),
          k8sClient.listDeployments(),
        ]);

        // Node health
        const totalNodes = nodes.length;
        const readyNodes = nodes.filter((n: k8s.V1Node) =>
          n.status?.conditions?.some((c: k8s.V1NodeCondition) => c.type === "Ready" && c.status === "True")
        ).length;
        const nodeHealth = totalNodes > 0 ? (readyNodes / totalNodes) * 100 : 0;

        // Pod health
        const totalPods = pods.length;
        const runningPods = pods.filter((p: k8s.V1Pod) => p.status?.phase === "Running").length;
        const podHealth = totalPods > 0 ? (runningPods / totalPods) * 100 : 0;

        // Find issues
        const pendingPods = pods.filter((p: k8s.V1Pod) => p.status?.phase === "Pending").length;
        const failedPods = pods.filter((p: k8s.V1Pod) => p.status?.phase === "Failed").length;
        
        const containerStatuses = pods.flatMap((p: k8s.V1Pod) => p.status?.containerStatuses || []);
        const crashLoopContainers = containerStatuses.filter((c: k8s.V1ContainerStatus) => 
          c.state?.waiting?.reason === "CrashLoopBackOff"
        ).length;
        const restartHeavy = containerStatuses.filter((c: k8s.V1ContainerStatus) => 
          (c.restartCount || 0) > 5
        ).length;

        // Deployment health
        const deploymentHealth = deployments.map((d: k8s.V1Deployment) => {
          const desired = d.spec?.replicas || 0;
          const ready = d.status?.readyReplicas || 0;
          return desired > 0 ? (ready / desired) * 100 : 100;
        });
        const avgDeploymentHealth = deploymentHealth.length > 0
          ? deploymentHealth.reduce((a: number, b: number) => a + b, 0) / deploymentHealth.length
          : 100;

        // Recent warning events
        const recentWarnings = events.filter((e: k8s.CoreV1Event) => {
          if (e.type !== "Warning") return false;
          const age = Date.now() - new Date(e.lastTimestamp || 0).getTime();
          return age < 3600000; // Last hour
        }).length;

        // Calculate overall score (0-100)
        const weights = {
          nodes: 0.25,
          pods: 0.25,
          deployments: 0.3,
          issues: 0.2,
        };

        const issueDeduction = Math.min(20, 
          (pendingPods * 0.5) + 
          (failedPods * 1) + 
          (crashLoopContainers * 2) + 
          (restartHeavy * 1) + 
          (recentWarnings * 0.1)
        );

        const overallScore = Math.round(
          (nodeHealth * weights.nodes) +
          (podHealth * weights.pods) +
          (avgDeploymentHealth * weights.deployments) +
          ((100 - issueDeduction) * weights.issues)
        );

        return {
          overallScore,
          status: overallScore >= 90 ? "Healthy" : overallScore >= 70 ? "Degraded" : "Critical",
          breakdown: {
            nodeHealth: Math.round(nodeHealth),
            podHealth: Math.round(podHealth),
            deploymentHealth: Math.round(avgDeploymentHealth),
          },
          issues: {
            pendingPods,
            failedPods,
            crashLoopContainers,
            containersWithHighRestarts: restartHeavy,
            recentWarnings,
            nodesNotReady: totalNodes - readyNodes,
          },
          summary: {
            totalNodes,
            readyNodes,
            totalPods,
            runningPods,
            totalDeployments: deployments.length,
          },
        };
      },
    },
    {
      tool: {
        name: "k8s_top_pod",
        description: "Display resource usage (CPU/Memory) for pods (like kubectl top pod). Requires metrics-server.",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter (shows all if not specified)",
            },
            name: {
              type: "string",
              description: "Specific pod name (optional, shows all pods if not specified)",
            },
            allNamespaces: {
              type: "boolean",
              description: "Show pods from all namespaces",
              default: false,
            },
            containers: {
              type: "boolean",
              description: "Show per-container metrics",
              default: false,
            },
            sortBy: {
              type: "string",
              description: "Sort results by field (cpu or memory)",
              enum: ["cpu", "memory"],
            },
          },
        },
      },
      handler: async ({ namespace, name, allNamespaces, containers, sortBy }: { 
        namespace?: string; 
        name?: string;
        allNamespaces?: boolean;
        containers?: boolean;
        sortBy?: string;
      }) => {
        try {
          const rawClient = k8sClient as any;
          let path: string;
          
          if (name) {
            // Specific pod
            path = `/apis/metrics.k8s.io/v1/namespaces/${namespace || "default"}/pods/${name}`;
          } else if (allNamespaces) {
            // All pods across all namespaces
            path = "/apis/metrics.k8s.io/v1/pods";
          } else {
            // All pods in specific namespace
            path = `/apis/metrics.k8s.io/v1/namespaces/${namespace || "default"}/pods`;
          }
          
          const metrics = await rawClient.rawApiRequest(path);
          
          if (!metrics || metrics.error) {
            const context: ErrorContext = { operation: "k8s_top_pod", namespace };
            const classified = classifyError(new Error("Metrics unavailable"), context);
            return {
              success: false,
              error: "Failed to get metrics. Ensure metrics-server is installed.",
              type: "not_found",
              suggestions: [
                "Install metrics-server: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml",
                "Verify metrics-server is running: kubectl get pods -n kube-system -l k8s-app=metrics-server",
              ],
            };
          }
          
          // Format the results like kubectl top
          let items = metrics.items || [metrics];
          
          // Map and calculate metrics
          let formatted = items.map((item: any) => {
            const containerMetrics = item.containers?.map((c: any) => ({
              name: c.name,
              cpu: c.usage?.cpu || "0",
              memory: c.usage?.memory || "0",
            })) || [];
            
            // Calculate totals for sorting
            const totalCpu = containerMetrics.reduce((sum: number, c: any) => {
              const cpu = parseInt(c.cpu.replace(/[^0-9]/g, "")) || 0;
              return sum + cpu;
            }, 0);
            const totalMemory = containerMetrics.reduce((sum: number, c: any) => {
              const mem = parseInt(c.memory.replace(/[^0-9]/g, "")) || 0;
              return sum + mem;
            }, 0);
            
            return {
              name: item.metadata?.name,
              namespace: item.metadata?.namespace,
              cpu: containers ? containerMetrics : `${totalCpu}n`,
              memory: containers ? containerMetrics : `${totalMemory}Ki`,
              cpuValue: totalCpu, // For sorting
              memoryValue: totalMemory, // For sorting
              timestamp: item.timestamp,
              window: item.window,
            };
          });
          
          // Sort if requested
          if (sortBy) {
            formatted = formatted.sort((a: any, b: any) => {
              if (sortBy === "cpu") {
                return b.cpuValue - a.cpuValue;
              } else if (sortBy === "memory") {
                return b.memoryValue - a.memoryValue;
              }
              return 0;
            });
          }
          
          // Remove sorting values from output
          formatted = formatted.map((item: any) => ({
            name: item.name,
            namespace: item.namespace,
            cpu: item.cpu,
            memory: item.memory,
            timestamp: item.timestamp,
            window: item.window,
          }));
          
          return {
            pods: formatted,
            total: formatted.length,
            sortBy: sortBy || undefined,
            note: "CPU in nanocores (n), Memory in KiB. Requires metrics-server.",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_top_pod", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: [
              ...classified.suggestions,
              "Install metrics-server: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml",
              "Verify metrics-server is running: kubectl get pods -n kube-system -l k8s-app=metrics-server",
            ],
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_top_node",
        description: "Display resource usage (CPU/Memory) for nodes (like kubectl top node). Requires metrics-server.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Specific node name (optional, shows all nodes if not specified)",
            },
          },
        },
      },
      handler: async ({ name }: { name?: string }) => {
        try {
          const rawClient = k8sClient as any;
          const path = name 
            ? `/apis/metrics.k8s.io/v1/nodes/${name}`
            : "/apis/metrics.k8s.io/v1/nodes";
          
          const metrics = await rawClient.rawApiRequest(path);
          
          if (!metrics || metrics.error) {
            const context: ErrorContext = { operation: "k8s_top_node", resource: name };
            const classified = classifyError(new Error("Metrics unavailable"), context);
            return {
              success: false,
              error: "Failed to get metrics. Ensure metrics-server is installed.",
              type: "not_found",
              suggestions: [
                "Install metrics-server: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml",
                "Verify metrics-server is running: kubectl get pods -n kube-system -l k8s-app=metrics-server",
              ],
            };
          }
          
          const items = metrics.items || [metrics];
          const formatted = items.map((item: any) => ({
            name: item.metadata?.name,
            cpu: item.usage?.cpu || "0",
            memory: item.usage?.memory || "0",
            cpuPercent: item.usage?.cpu 
              ? Math.round((parseInt(item.usage.cpu.replace(/[^0-9]/g, "")) / 1000000000) * 100) 
              : null,
            memoryPercent: item.usage?.memory 
              ? Math.round((parseInt(item.usage.memory.replace(/[^0-9]/g, "")) / (1024 * 1024)) * 100) 
              : null,
            timestamp: item.timestamp,
            window: item.window,
          }));
          
          return {
            nodes: formatted,
            total: formatted.length,
            note: "CPU in cores, Memory in bytes. Requires metrics-server.",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_top_node", resource: name };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: [
              ...classified.suggestions,
              "Install metrics-server: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml",
              "Verify metrics-server is running: kubectl get pods -n kube-system -l k8s-app=metrics-server",
            ],
          };
        }
      },
    },
    // Create ResourceQuota
    {
      tool: {
        name: "k8s_create_resource_quota",
        description: "Create a ResourceQuota to limit resource consumption in a namespace",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ResourceQuota",
            },
            namespace: {
              type: "string",
              description: "Namespace for the ResourceQuota",
              default: "default",
            },
            hard: {
              type: "object",
              description: "Resource limits (e.g., {pods: '10', 'requests.cpu': '20', 'requests.memory': '100Gi'})",
            },
            scopeSelector: {
              type: "object",
              description: "Scope selector to match pods",
            },
            scopes: {
              type: "array",
              description: "Scopes for the quota (e.g., Terminating, NotTerminating)",
              items: { type: "string" },
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "hard"],
        },
      },
      handler: async ({ name, namespace, hard, scopeSelector, scopes, dryRun }: { 
        name: string; 
        namespace?: string;
        hard: Record<string, string>;
        scopeSelector?: any;
        scopes?: string[];
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "resourcequota");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const resourceQuota: k8s.V1ResourceQuota = {
            apiVersion: "v1",
            kind: "ResourceQuota",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              hard,
              scopeSelector,
              scopes,
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "ResourceQuota",
              name,
              namespace: ns,
              manifest: resourceQuota,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespacedResourceQuota({ namespace: ns, body: resourceQuota, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `ResourceQuota ${name} created in namespace ${ns}`,
            resourceQuota: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              hard: result.spec?.hard,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_resource_quota", resource: name, namespace };
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
    // Create LimitRange
    {
      tool: {
        name: "k8s_create_limit_range",
        description: "Create a LimitRange to set default resource limits for pods/containers in a namespace",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the LimitRange",
            },
            namespace: {
              type: "string",
              description: "Namespace for the LimitRange",
              default: "default",
            },
            limits: {
              type: "array",
              description: "Limit range specs",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    description: "Type of resource (Container, Pod, PersistentVolumeClaim)",
                    enum: ["Container", "Pod", "PersistentVolumeClaim"],
                  },
                  max: {
                    type: "object",
                    description: "Maximum resource limits",
                  },
                  min: {
                    type: "object",
                    description: "Minimum resource limits",
                  },
                  default: {
                    type: "object",
                    description: "Default resource limits",
                  },
                  defaultRequest: {
                    type: "object",
                    description: "Default resource requests",
                  },
                  maxLimitRequestRatio: {
                    type: "object",
                    description: "Max limit/request ratio",
                  },
                },
              },
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "limits"],
        },
      },
      handler: async ({ name, namespace, limits, dryRun }: { 
        name: string; 
        namespace?: string;
        limits: any[];
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "limitrange");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const limitRange: k8s.V1LimitRange = {
            apiVersion: "v1",
            kind: "LimitRange",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              limits: limits.map((l: any) => ({
                type: l.type,
                max: l.max,
                min: l.min,
                default: l.default,
                defaultRequest: l.defaultRequest,
                maxLimitRequestRatio: l.maxLimitRequestRatio,
              })),
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "LimitRange",
              name,
              namespace: ns,
              manifest: limitRange,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespacedLimitRange({ namespace: ns, body: limitRange, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `LimitRange ${name} created in namespace ${ns}`,
            limitRange: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              limits: result.spec?.limits?.length,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_limit_range", resource: name, namespace };
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
    // Delete LimitRange
    {
      tool: {
        name: "k8s_delete_limitrange",
        description: "Delete a LimitRange",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the LimitRange to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the LimitRange",
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
          validateResourceName(name, "limitrange");
          const effPropagationPolicy = propagationPolicy || "Foreground";

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "LimitRange",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy: effPropagationPolicy,
            });
          }

          const coreApi = k8sClient.getCoreV1Api();
          const deleteParams = buildServerDeleteParams({
            dryRun,
            gracePeriodSeconds,
            propagationPolicy: effPropagationPolicy,
          });

          await coreApi.deleteNamespacedLimitRange({ 
            name, 
            namespace: ns,
            ...deleteParams,
          }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `LimitRange ${name} deleted from namespace ${ns}`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "LimitRange", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_limitrange", resource: name, namespace: ns };
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
    // Delete ResourceQuota
    {
      tool: {
        name: "k8s_delete_resourcequota",
        description: "Delete a ResourceQuota",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ResourceQuota to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the ResourceQuota",
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
          validateResourceName(name, "resourcequota");
          const effPropagationPolicy = propagationPolicy || "Foreground";

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "ResourceQuota",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy: effPropagationPolicy,
            });
          }

          const coreApi = k8sClient.getCoreV1Api();
          const deleteParams = buildServerDeleteParams({
            dryRun,
            gracePeriodSeconds,
            propagationPolicy: effPropagationPolicy,
          });

          await coreApi.deleteNamespacedResourceQuota({ 
            name, 
            namespace: ns,
            ...deleteParams,
          }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `ResourceQuota ${name} deleted from namespace ${ns}`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "ResourceQuota", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_resourcequota", resource: name, namespace: ns };
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
    // List PodDisruptionBudgets
    {
      tool: {
        name: "k8s_list_pod_disruption_budgets",
        description: "List PodDisruptionBudgets (PDBs) for protecting pods during voluntary disruptions",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            ...commonListQuerySchema,
          },
        },
      },
      handler: async ({
        namespace,
        labelSelector,
        fieldSelector,
        sortBy,
        descending,
        limit,
      }: {
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      } = {}) => {
        try {
          const rawClient = k8sClient as any;
          const ns = namespace;
          
          // PDB is in policy/v1 API
          let path = ns
            ? `/apis/policy/v1/namespaces/${ns}/poddisruptionbudgets`
            : `/apis/policy/v1/poddisruptionbudgets`;
          
          const params = new URLSearchParams();
          if (labelSelector) params.append("labelSelector", labelSelector);
          if (fieldSelector) params.append("fieldSelector", fieldSelector);
          const qs = params.toString();
          if (qs) path += `?${qs}`;

          const result = await rawClient.rawApiRequest(path);
          
          if (!result || !result.items) {
            return {
              podDisruptionBudgets: [],
              total: 0,
              returned: 0,
              note: "No PodDisruptionBudgets found or policy API not available",
            };
          }
          
          const mapped = result.items.map((pdb: any) => ({
            name: pdb.metadata?.name,
            namespace: pdb.metadata?.namespace,
            minAvailable: pdb.spec?.minAvailable,
            maxUnavailable: pdb.spec?.maxUnavailable,
            selector: pdb.spec?.selector?.matchLabels,
            disruptionsAllowed: pdb.status?.disruptionsAllowed,
            currentHealthy: pdb.status?.currentHealthy,
            desiredHealthy: pdb.status?.desiredHealthy,
            age: pdb.metadata?.creationTimestamp,
            creationTimestamp: pdb.metadata?.creationTimestamp,
            labels: pdb.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            podDisruptionBudgets: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_pod_disruption_budgets", namespace };
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
