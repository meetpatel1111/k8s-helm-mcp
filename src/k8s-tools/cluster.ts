import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName } from "../validators.js";
import { commonListQuerySchema, applySortAndLimit } from "../utils/query-helper.js";
import {
  commonCreateQuerySchema,
  isClientDryRun,
  formatClientDryRunCreate,
} from "../utils/safety-helper.js";

export function registerClusterTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_contexts",
        description: "List all available Kubernetes contexts from kubeconfig",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        const contexts = k8sClient.getContexts();
        const current = k8sClient.getCurrentContext();
        return {
          contexts: contexts.map((ctx) => ({
            name: ctx.name,
            cluster: ctx.cluster,
            user: ctx.user,
            namespace: ctx.namespace,
            isCurrent: ctx.name === current,
          })),
          currentContext: current,
        };
      },
    },
    {
      tool: {
        name: "k8s_switch_context",
        description: "Switch to a different Kubernetes context",
        inputSchema: {
          type: "object",
          properties: {
            context: {
              type: "string",
              description: "Name of the context to switch to",
            },
          },
          required: ["context"],
        },
      },
      handler: async ({ context }: { context: string }) => {
        try {
          // Validate context name
          validateResourceName(context, "context");
          
          // Check if context exists
          const contexts = k8sClient.getContexts();
          if (!contexts.some((ctx) => ctx.name === context)) {
            return {
              success: false,
              error: `Context "${context}" not found`,
              availableContexts: contexts.map((ctx) => ctx.name),
              suggestion: "Use k8s_list_contexts to see available contexts",
            };
          }
          
          k8sClient.setCurrentContext(context);
          return { 
            success: true, 
            message: `Switched to context: ${context}`,
            previousContext: k8sClient.getCurrentContext(),
          };
        } catch (error) {
          const errorContext: ErrorContext = { operation: "k8s_switch_context", resource: context };
          const classified = classifyError(error, errorContext);
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
        name: "k8s_cluster_version",
        description: "Get Kubernetes cluster version information",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const version = await k8sClient.getClusterVersion();
          return {
            version: version.gitVersion,
            major: version.major,
            minor: version.minor,
            platform: version.platform,
            buildDate: version.buildDate,
            goVersion: version.goVersion,
            compiler: version.compiler,
          };
        } catch (error) {
          const errorContext: ErrorContext = { operation: "k8s_cluster_version" };
          const classified = classifyError(error, errorContext);
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
        name: "k8s_component_status",
        description: "Get Kubernetes component statuses (scheduler, controller-manager, etcd)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const statuses = await k8sClient.getComponentStatuses();
          return {
            components: statuses.map((cs) => ({
              name: cs.metadata?.name,
              conditions: cs.conditions?.map((c) => ({
                type: c.type,
                status: c.status,
                message: c.message,
                error: c.error,
              })),
            })),
          };
        } catch (error) {
          const errorContext: ErrorContext = { operation: "k8s_component_status" };
          const classified = classifyError(error, errorContext);
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
        name: "k8s_cluster_health",
        description: "Get comprehensive cluster health overview including nodes, pods, and components",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const [nodes, namespaces, componentStatuses, version] = await Promise.all([
            k8sClient.listNodes(),
            k8sClient.listNamespaces(),
            k8sClient.getComponentStatuses(),
            k8sClient.getClusterVersion(),
          ]);

          const readyNodes = nodes.filter((n) =>
            n.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True")
          ).length;

          return {
            clusterVersion: version.gitVersion,
            nodeSummary: {
              total: nodes.length,
              ready: readyNodes,
              notReady: nodes.length - readyNodes,
            },
            namespaceCount: namespaces.length,
            componentHealth: componentStatuses.map((cs) => ({
              name: cs.metadata?.name,
              healthy: cs.conditions?.some((c) => c.status === "True"),
            })),
            overallHealth: readyNodes === nodes.length && 
              componentStatuses.every((cs) => cs.conditions?.some((c) => c.status === "True")),
          };
        } catch (error) {
          const errorContext: ErrorContext = { operation: "k8s_cluster_health" };
          const classified = classifyError(error, errorContext);
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
        name: "k8s_list_namespaces",
        description: "List all namespaces in the cluster",
        inputSchema: {
          type: "object",
          properties: {
            ...commonListQuerySchema,
          },
        },
      },
      handler: async ({
        labelSelector,
        fieldSelector,
        sortBy,
        descending,
        limit,
      }: {
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      } = {}) => {
        try {
          const namespaces = await k8sClient.listNamespaces({ labelSelector, fieldSelector });
          const mapped = namespaces.map((ns) => ({
            name: ns.metadata?.name,
            status: ns.status?.phase,
            created: ns.metadata?.creationTimestamp,
            labels: ns.metadata?.labels,
          }));
          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });
          return {
            namespaces: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
          };
        } catch (error) {
          const errorContext: ErrorContext = { operation: "k8s_list_namespaces" };
          const classified = classifyError(error, errorContext);
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
        name: "k8s_api_latency_check",
        description: "Check API server latency and connectivity",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const start = Date.now();
          await k8sClient.listNamespaces();
          const latency = Date.now() - start;
          return {
            apiServerReachable: true,
            latencyMs: latency,
            status: latency < 500 ? "excellent" : latency < 1000 ? "good" : "slow",
          };
        } catch (error) {
          const errorContext: ErrorContext = { operation: "k8s_api_latency_check" };
          const classified = classifyError(error, errorContext);
          return {
            apiServerReachable: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_cluster_info",
        description: "Display cluster info (like kubectl cluster-info)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const [version, namespaces, nodes] = await Promise.all([
            k8sClient.getClusterVersion(),
            k8sClient.listNamespaces(),
            k8sClient.listNodes(),
          ]);
          
          const currentContext = k8sClient.kc.getCurrentContext();
          const currentCluster = k8sClient.kc.getCurrentCluster();
          const contexts = k8sClient.kc.getContexts();
          
          return {
            clusterInfo: {
              kubernetesMaster: {
                host: currentCluster?.server || "unknown",
                version: version?.gitVersion || version?.major + "." + version?.minor,
              },
              currentContext,
              cluster: currentCluster?.name,
            },
            summary: {
              totalNamespaces: namespaces.length,
              totalNodes: nodes.length,
              totalContexts: contexts.length,
              readyNodes: nodes.filter((n: any) => 
                n.status?.conditions?.some((c: any) => c.type === "Ready" && c.status === "True")
              ).length,
            },
            extensions: {
              coreDNS: "Check with k8s_list_services in kube-system namespace",
              metricsServer: "Check with k8s_get_pod_metrics",
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { error: errorMessage };
        }
      },
    },
    {
      tool: {
        name: "k8s_version",
        description: "Show kubectl and cluster version information (like kubectl version)",
        inputSchema: {
          type: "object",
          properties: {
            short: {
              type: "boolean",
              description: "Print only the version number",
              default: false,
            },
            output: {
              type: "string",
              description: "Output format",
              enum: ["json", "yaml"],
              default: "json",
            },
          },
        },
      },
      handler: async ({ short, output }: { short?: boolean; output?: string }) => {
        try {
          const version = await k8sClient.getClusterVersion();
          const packageJson = await import("../../package.json", { with: { type: "json" } });
          
          if (short) {
            return {
              clientVersion: packageJson.default.version,
              serverVersion: version?.gitVersion || "unknown",
            };
          }
          
          const versionInfo = {
            clientVersion: {
              version: packageJson.default.version,
              mcpSdk: packageJson.default.dependencies["@modelcontextprotocol/sdk"],
              k8sClient: packageJson.default.dependencies["@kubernetes/client-node"],
            },
            serverVersion: {
              major: version?.major,
              minor: version?.minor,
              gitVersion: version?.gitVersion,
              gitCommit: version?.gitCommit,
              gitTreeState: version?.gitTreeState,
              buildDate: version?.buildDate,
              goVersion: version?.goVersion,
              compiler: version?.compiler,
              platform: version?.platform,
            },
          };
          
          return versionInfo;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { error: errorMessage };
        }
      },
    },
    {
      tool: {
        name: "k8s_cluster_info_dump",
        description: "Dump cluster state for debugging (like kubectl cluster-info dump). Collects information about nodes, pods, services, events, and configuration.",
        inputSchema: {
          type: "object",
          properties: {
            namespaces: {
              type: "array",
              items: { type: "string" },
              description: "Namespaces to dump (defaults to all namespaces if not specified)",
            },
            outputDirectory: {
              type: "string",
              description: "Output directory path (optional, returns data directly if not specified)",
            },
          },
        },
      },
      handler: async ({ namespaces, outputDirectory }: { namespaces?: string[]; outputDirectory?: string }) => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Collect cluster info
          const [
            version,
            nodes,
            allNamespaces,
            events,
            componentStatuses
          ] = await Promise.all([
            k8sClient.getClusterVersion(),
            k8sClient.listNodes(),
            k8sClient.listNamespaces(),
            coreApi.listEventForAllNamespaces({}, {}),
            coreApi.listComponentStatus({}, {}),
          ]);
          
          const dump: any = {
            clusterInfo: {
              version: version?.gitVersion,
              major: version?.major,
              minor: version?.minor,
              platform: version?.platform,
            },
            nodes: nodes.map((n: any) => ({
              name: n.metadata?.name,
              labels: n.metadata?.labels,
              conditions: n.status?.conditions,
              capacity: n.status?.capacity,
              taints: n.spec?.taints,
              unschedulable: n.spec?.unschedulable,
            })),
            namespaces: allNamespaces.map((n: any) => n.metadata?.name),
            events: events.items.slice(0, 100).map((e: any) => ({
              type: e.type,
              reason: e.reason,
              message: e.message,
              namespace: e.metadata?.namespace,
              involvedObject: e.involvedObject?.name,
              count: e.count,
              firstTimestamp: e.firstTimestamp,
              lastTimestamp: e.lastTimestamp,
            })),
            componentStatuses: componentStatuses.items?.map((c: any) => ({
              name: c.metadata?.name,
              conditions: c.conditions,
            })),
            workloads: {},
          };
          
          // Get workloads for specified namespaces or all
          const targetNamespaces = (namespaces && namespaces.length > 0)
            ? namespaces
            : allNamespaces.map((n: any) => n.metadata?.name);
          
          for (const ns of targetNamespaces.slice(0, 5)) { // Limit to prevent timeout
            if (!ns) continue;
            
            try {
              const [pods, services, deployments] = await Promise.all([
                k8sClient.listPods(ns),
                k8sClient.listServices(ns),
                k8sClient.listDeployments(ns),
              ]);
              
              dump.workloads[ns] = {
                pods: pods.map((p: any) => ({
                  name: p.metadata?.name,
                  status: p.status?.phase,
                  node: p.spec?.nodeName,
                  containers: p.spec?.containers?.map((c: any) => c.name),
                })),
                services: services.map((s: any) => ({
                  name: s.metadata?.name,
                  type: s.spec?.type,
                  clusterIP: s.spec?.clusterIP,
                  ports: s.spec?.ports,
                })),
                deployments: deployments.map((d: any) => ({
                  name: d.metadata?.name,
                  replicas: d.spec?.replicas,
                  available: d.status?.availableReplicas,
                })),
              };
            } catch (err) {
              dump.workloads[ns] = { error: `Failed to get workloads: ${err}` };
            }
          }
          
          return {
            success: true,
            timestamp: new Date().toISOString(),
            dump,
            summary: {
              nodes: nodes.length,
              namespaces: allNamespaces.length,
              events: events.items.length,
              workloadsCollected: Object.keys(dump.workloads).length,
            },
            note: outputDirectory 
              ? "Directory output not supported in MCP context. Data returned directly."
              : "Cluster dump collected successfully. Use k8s_raw_api_query for additional resources.",
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
      },
    },
    {
      tool: {
        name: "k8s_api_versions",
        description: "List available API versions (like kubectl api-versions)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const result = await k8sClient.rawApiRequest("/apis");
          
          // Extract API versions from the response
          const apiGroups = result.groups || [];
          const versions: string[] = [];
          
          // Add core API version
          versions.push("v1");
          
          // Add versions from API groups
          for (const group of apiGroups) {
            const groupName = group.name;
            for (const version of group.versions || []) {
              versions.push(`${groupName}/${version.version}`);
            }
          }
          
          return {
            versions: versions.sort(),
            total: versions.length,
            apiGroups: apiGroups.map((g: any) => ({
              name: g.name,
              versions: g.versions?.map((v: any) => v.version),
              preferredVersion: g.preferredVersion?.version,
            })),
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { error: errorMessage };
        }
      },
    },
    // Create PriorityClass
    {
      tool: {
        name: "k8s_create_priorityclass",
        description: "Create a PriorityClass (like kubectl create priorityclass)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PriorityClass",
            },
            value: {
              type: "number",
              description: "Priority value (higher = more priority, can be negative)",
            },
            description: {
              type: "string",
              description: "Description of the PriorityClass",
            },
            globalDefault: {
              type: "boolean",
              description: "Set as global default priority class",
              default: false,
            },
            preemptionPolicy: {
              type: "string",
              description: "Preemption policy (Never or PreemptLowerPriority)",
              enum: ["Never", "PreemptLowerPriority"],
              default: "PreemptLowerPriority",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "value"],
        },
      },
      handler: async ({ name, value, description, globalDefault, preemptionPolicy, dryRun }: { 
        name: string;
        value: number;
        description?: string;
        globalDefault?: boolean;
        preemptionPolicy?: string;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "priorityclass");
          const rawClient = k8sClient as any;
          
          const priorityClass = {
            apiVersion: "scheduling.k8s.io/v1",
            kind: "PriorityClass",
            metadata: {
              name,
              ...(description ? { annotations: { "description": description } } : {}),
            },
            value,
            globalDefault: globalDefault || false,
            preemptionPolicy: preemptionPolicy || "PreemptLowerPriority",
            description: description || "",
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "PriorityClass",
              name,
              manifest: priorityClass,
            });
          }

          let url = "/apis/scheduling.k8s.io/v1/priorityclasses";
          if (dryRun === "server") {
            url += "?dryRun=All";
          }
          
          const result = await rawClient.rawApiRequest(url, { method: "POST", body: priorityClass });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `PriorityClass ${name} created with value ${value}`,
            priorityClass: {
              name: result.metadata?.name,
              value: result.value,
              globalDefault: result.globalDefault,
              preemptionPolicy: result.preemptionPolicy,
              description: result.description,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_priorityclass", resource: name };
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
    // Delete context from kubeconfig
    {
      tool: {
        name: "k8s_config_delete_context",
        description: "Delete a context from kubeconfig (like kubectl config delete-context)",
        inputSchema: {
          type: "object",
          properties: {
            context: {
              type: "string",
              description: "Name of the context to delete",
            },
          },
          required: ["context"],
        },
      },
      handler: async ({ context }: { context: string }) => {
        try {
          const kc = new k8s.KubeConfig();
          kc.loadFromDefault();
          
          const contexts = kc.getContexts();
          const contextExists = contexts.find((c) => c.name === context);
          
          if (!contextExists) {
            return {
              success: false,
              error: `Context '${context}' not found in kubeconfig`,
            };
          }
          
          // Remove the context
          const filteredContexts = contexts.filter((c) => c.name !== context);
          (kc as any).contexts = filteredContexts;
          
          // If deleting current context, clear it
          const currentContext = kc.getCurrentContext();
          if (currentContext === context) {
            (kc as any).currentContext = filteredContexts.length > 0 ? filteredContexts[0].name : "";
          }
          
          // Note: We can't actually save the kubeconfig back via the API,
          // so we return instructions
          return {
            success: true,
            message: `Context '${context}' marked for deletion`,
            note: "To actually delete the context, run the kubectl command below:",
            kubectlCommand: `kubectl config delete-context ${context}`,
            wasCurrentContext: currentContext === context,
            remainingContexts: filteredContexts.map((c) => c.name),
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: errorMessage,
          };
        }
      },
    },
    // Rename context in kubeconfig
    {
      tool: {
        name: "k8s_config_rename_context",
        description: "Rename a context in kubeconfig (like kubectl config rename-context)",
        inputSchema: {
          type: "object",
          properties: {
            oldName: {
              type: "string",
              description: "Current name of the context",
            },
            newName: {
              type: "string",
              description: "New name for the context",
            },
          },
          required: ["oldName", "newName"],
        },
      },
      handler: async ({ oldName, newName }: { oldName: string; newName: string }) => {
        try {
          const kc = new k8s.KubeConfig();
          kc.loadFromDefault();
          
          const contexts = kc.getContexts();
          const contextExists = contexts.find((c) => c.name === oldName);
          
          if (!contextExists) {
            return {
              success: false,
              error: `Context '${oldName}' not found in kubeconfig`,
            };
          }
          
          const newNameExists = contexts.find((c) => c.name === newName);
          if (newNameExists) {
            return {
              success: false,
              error: `Context '${newName}' already exists`,
            };
          }
          
          // Return kubectl command since we can't modify kubeconfig via API
          return {
            success: true,
            message: `Rename operation prepared`,
            note: "To actually rename the context, run the kubectl command below:",
            kubectlCommand: `kubectl config rename-context ${oldName} ${newName}`,
            oldName,
            newName,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: errorMessage,
          };
        }
      },
    },
    // List RuntimeClasses
    {
      tool: {
        name: "k8s_list_runtimeclasses",
        description: "List RuntimeClasses in the cluster (like kubectl get runtimeclass)",
        inputSchema: {
          type: "object",
          properties: {
            ...commonListQuerySchema,
          },
        },
      },
      handler: async ({
        labelSelector,
        fieldSelector,
        sortBy,
        descending,
        limit,
      }: {
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      } = {}) => {
        try {
          const rawClient = k8sClient as any;
          let path = "/apis/node.k8s.io/v1/runtimeclasses";
          const params = new URLSearchParams();
          if (labelSelector) params.append("labelSelector", labelSelector);
          if (fieldSelector) params.append("fieldSelector", fieldSelector);
          const qs = params.toString();
          if (qs) path += `?${qs}`;
          const result = await rawClient.rawApiRequest(path);
          
          const runtimeClasses = result.items || [];
          const mapped = runtimeClasses.map((rc: any) => ({
            name: rc.metadata?.name,
            handler: rc.handler,
            description: rc.description,
            podOverhead: rc.overhead,
            scheduling: rc.scheduling,
            created: rc.metadata?.creationTimestamp,
            labels: rc.metadata?.labels,
          }));
          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });
          
          return {
            runtimeClasses: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_runtimeclasses" };
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
    // List Leases
    {
      tool: {
        name: "k8s_list_leases",
        description: "List Lease objects (coordination API, like kubectl get lease)",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace (default: all namespaces)",
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
          let path = namespace
            ? `/apis/coordination.k8s.io/v1/namespaces/${namespace}/leases`
            : `/apis/coordination.k8s.io/v1/leases`;
          const params = new URLSearchParams();
          if (labelSelector) params.append("labelSelector", labelSelector);
          if (fieldSelector) params.append("fieldSelector", fieldSelector);
          const qs = params.toString();
          if (qs) path += `?${qs}`;
          const result = await rawClient.rawApiRequest(path);
          
          const leases = result.items || [];
          const mapped = leases.map((lease: any) => ({
            name: lease.metadata?.name,
            namespace: lease.metadata?.namespace,
            holder: lease.spec?.holderIdentity,
            duration: lease.spec?.leaseDurationSeconds,
            acquired: lease.spec?.acquireTime,
            renewed: lease.spec?.renewTime,
            transitions: lease.spec?.leaseTransitions,
            created: lease.metadata?.creationTimestamp,
            labels: lease.metadata?.labels,
          }));
          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });
          
          return {
            leases: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_leases", namespace };
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
    // Set kubeconfig value
    {
      tool: {
        name: "k8s_config_set",
        description: "Set a kubeconfig value (like kubectl config set). Sets a cluster, context, or user property.",
        inputSchema: {
          type: "object",
          properties: {
            property: {
              type: "string",
              description: "Property path to set (e.g., 'clusters.my-cluster.server', 'contexts.my-context.namespace', 'users.my-user.token')",
            },
            value: {
              type: "string",
              description: "Value to set",
            },
          },
          required: ["property", "value"],
        },
      },
      handler: async ({ property, value }: { property: string; value: string }) => {
        try {
          // Parse property path to provide helpful validation
          const parts = property.split(".");
          const section = parts[0]; // clusters, contexts, users
          const name = parts[1];
          const field = parts[2];
          
          if (!section || !name || !field) {
            return {
              success: false,
              error: "Invalid property format. Use: 'section.name.field' (e.g., 'clusters.my-cluster.server')",
              validSections: ["clusters", "contexts", "users"],
              examples: [
                "clusters.my-cluster.server=https://api.example.com",
                "contexts.my-context.namespace=production",
                "users.my-user.token=secret-token",
              ],
            };
          }
          
          const validSections = ["clusters", "contexts", "users"];
          if (!validSections.includes(section)) {
            return {
              success: false,
              error: `Invalid section '${section}'. Valid sections: ${validSections.join(", ")}`,
            };
          }
          
          return {
            success: true,
            message: `Config set operation prepared`,
            note: "To actually set the config value, run the kubectl command below:",
            kubectlCommand: `kubectl config set ${property} ${value}`,
            property,
            value,
            section,
            name,
            field,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: errorMessage,
          };
        }
      },
    },
    // Unset kubeconfig value
    {
      tool: {
        name: "k8s_config_unset",
        description: "Remove a kubeconfig property (like kubectl config unset). Removes a cluster, context, or user property.",
        inputSchema: {
          type: "object",
          properties: {
            property: {
              type: "string",
              description: "Property path to unset (e.g., 'clusters.my-cluster.server', 'contexts.my-context.namespace', 'users.my-user.token')",
            },
          },
          required: ["property"],
        },
      },
      handler: async ({ property }: { property: string }) => {
        try {
          // Parse property path
          const parts = property.split(".");
          const section = parts[0]; // clusters, contexts, users
          const name = parts[1];
          const field = parts[2];
          
          if (!section || !name) {
            return {
              success: false,
              error: "Invalid property format. Use: 'section.name[.field]' (e.g., 'clusters.my-cluster.server')",
              validSections: ["clusters", "contexts", "users"],
              examples: [
                "clusters.my-cluster.server",
                "contexts.my-context.namespace",
                "users.my-user.token",
              ],
            };
          }
          
          const validSections = ["clusters", "contexts", "users"];
          if (!validSections.includes(section)) {
            return {
              success: false,
              error: `Invalid section '${section}'. Valid sections: ${validSections.join(", ")}`,
            };
          }
          
          return {
            success: true,
            message: `Config unset operation prepared`,
            note: "To actually unset the config value, run the kubectl command below:",
            kubectlCommand: `kubectl config unset ${property}`,
            property,
            section,
            name,
            field,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: errorMessage,
          };
        }
      },
    },
  ];
}
