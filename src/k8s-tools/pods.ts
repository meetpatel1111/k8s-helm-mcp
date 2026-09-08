import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import * as yaml from "js-yaml";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace, validateLabelSelector } from "../validators.js";
import { scrubSensitiveData } from "../utils/secret-scrubber.js";
import { commonListQuerySchema, commonGetQuerySchema, applySortAndLimit, applyGetFormatting, isNotFoundError } from "../utils/query-helper.js";
import {
  commonDeleteQuerySchema,
  commonMutationQuerySchema,
  commonCreateQuerySchema,
  isClientDryRun,
  formatClientDryRunDelete,
  formatClientDryRunMutation,
  formatClientDryRunCreate,
  handleDeleteError,
  buildServerDeleteParams,
  buildServerCreateParams,
} from "../utils/safety-helper.js";

export function registerPodTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_pods",
        description: "List pods across all namespaces or a specific namespace",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter by (optional, shows all if not specified)",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
            context: {
              type: "string",
              description: "Kubernetes context to use (from kubeconfig). Uses current context if not specified",
            },
          },
        },
      },
      handler: async ({ namespace, labelSelector, fieldSelector, sortBy, descending, limit, context }: { 
        namespace?: string; 
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
        context?: string;
      }) => {
        try {
          if (labelSelector) {
            validateLabelSelector(labelSelector);
          }
          if (namespace) {
            validateNamespace(namespace);
          }
          
          const listPods = async () => {
            const coreApi = k8sClient.getCoreV1Api();
            const response = namespace
              ? await coreApi.listNamespacedPod({
                  namespace,
                  fieldSelector,
                  labelSelector
                })
              : await coreApi.listPodForAllNamespaces({
                  fieldSelector: fieldSelector as any,
                  labelSelector: labelSelector as any
                });
            return response;
          };
          
          const response = context 
            ? await k8sClient.withContext(context, listPods)
            : await listPods();
          
          const pods = response.items.map((pod: k8s.V1Pod) => {
            const containerStatuses = pod.status?.containerStatuses || [];
            const readyContainers = containerStatuses.filter((c: k8s.V1ContainerStatus) => c.ready).length;
            const totalContainers = containerStatuses.length;
            
            // Calculate restarts
            const totalRestarts = containerStatuses.reduce((sum: number, c: k8s.V1ContainerStatus) => sum + (c.restartCount || 0), 0);

            return {
              name: pod.metadata?.name,
              namespace: pod.metadata?.namespace,
              status: pod.status?.phase,
              ready: `${readyContainers}/${totalContainers}`,
              restarts: totalRestarts,
              age: pod.metadata?.creationTimestamp,
              node: pod.spec?.nodeName,
              ip: pod.status?.podIP,
              containers: pod.spec?.containers.map((c: k8s.V1Container) => c.name),
              labels: pod.metadata?.labels,
            };
          });

          const queryResult = applySortAndLimit(pods, { sortBy, descending, limit });

          return { 
            pods: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_pods", namespace };
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
        name: "k8s_get_pod",
        description: "Get detailed information about a specific pod",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the pod",
            },
            namespace: {
              type: "string",
              description: "Namespace of the pod",
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
          const pod = await k8sClient.getPod(name, namespace || "default");
          const containerStatuses = pod.status?.containerStatuses || [];
          const initContainerStatuses = pod.status?.initContainerStatuses || [];
          
          const rawResult = {
            metadata: {
              name: pod.metadata?.name,
              namespace: pod.metadata?.namespace,
              labels: pod.metadata?.labels,
              annotations: pod.metadata?.annotations,
              creationTimestamp: pod.metadata?.creationTimestamp,
              uid: pod.metadata?.uid,
            },
            spec: {
              nodeName: pod.spec?.nodeName,
              serviceAccount: pod.spec?.serviceAccountName,
              restartPolicy: pod.spec?.restartPolicy,
              dnsPolicy: pod.spec?.dnsPolicy,
              hostNetwork: pod.spec?.hostNetwork,
              securityContext: pod.spec?.securityContext,
              schedulerName: pod.spec?.schedulerName,
              priority: pod.spec?.priority,
              terminationGracePeriodSeconds: pod.spec?.terminationGracePeriodSeconds,
            },
            status: {
              phase: pod.status?.phase,
              conditions: pod.status?.conditions?.map((c: k8s.V1PodCondition) => ({
                type: c.type,
                status: c.status,
                reason: c.reason,
                message: c.message,
                lastTransitionTime: c.lastTransitionTime,
              })),
              hostIP: pod.status?.hostIP,
              podIP: pod.status?.podIP,
              startTime: pod.status?.startTime,
              qosClass: pod.status?.qosClass,
            },
            containers: pod.spec?.containers.map((c: k8s.V1Container) => ({
              name: c.name,
              image: c.image,
              command: c.command,
              args: c.args,
              ports: c.ports,
              resources: c.resources,
              volumeMounts: c.volumeMounts,
              livenessProbe: c.livenessProbe ? { configured: true } : undefined,
              readinessProbe: c.readinessProbe ? { configured: true } : undefined,
              startupProbe: c.startupProbe ? { configured: true } : undefined,
            })),
            initContainers: pod.spec?.initContainers?.map((c: k8s.V1Container) => ({
              name: c.name,
              image: c.image,
            })),
            containerStatuses: containerStatuses.map((c: k8s.V1ContainerStatus) => ({
              name: c.name,
              ready: c.ready,
              restartCount: c.restartCount,
              state: c.state,
              lastState: c.lastState,
              image: c.image,
              imageID: c.imageID,
              started: c.started,
            })),
            initContainerStatuses: initContainerStatuses.map((c: k8s.V1ContainerStatus) => ({
              name: c.name,
              ready: c.ready,
              restartCount: c.restartCount,
              state: c.state,
            })),
            volumes: pod.spec?.volumes?.map((v: k8s.V1Volume) => ({
              name: v.name,
              type: Object.keys(v).find((k) => k !== "name") || "unknown",
            })),
          };

          return applyGetFormatting(rawResult, {
            kind: "Pod",
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
              message: `Pod "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          throw error;
        }
      },
    },
    {
      tool: {
        name: "k8s_get_logs",
        description: "Get logs from a pod, deployment, statefulset, daemonset, job, or service. Supports following logs, previous container instances, time-based filtering, and label selectors.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the pod, deployment (deploy/name), statefulset (sts/name), daemonset (ds/name), job (job/name), or service (svc/name). Use format like 'deploy/my-deployment', 'sts/my-statefulset', or 'svc/my-service'",
            },
            namespace: {
              type: "string",
              description: "Namespace of the resource",
              default: "default",
            },
            container: {
              type: "string",
              description: "Container name (for multi-container pods)",
            },
            tailLines: {
              type: "number",
              description: "Number of lines to show from the end",
              default: 100,
            },
            previous: {
              type: "boolean",
              description: "Get logs from previous container instance (for crashed containers)",
              default: false,
            },
            follow: {
              type: "boolean",
              description: "Stream logs in real-time (like tail -f). Note: In MCP, this returns initial logs only.",
              default: false,
            },
            labelSelector: {
              type: "string",
              description: "Label selector to select pods (e.g., 'app=nginx,name=myLabel')",
            },
            allContainers: {
              type: "boolean",
              description: "Get logs from all containers in the pod(s)",
              default: false,
            },
            timestamps: {
              type: "boolean",
              description: "Include timestamps in log output",
              default: false,
            },
            sinceSeconds: {
              type: "number",
              description: "Only return logs newer than a relative duration (e.g., 300 for 5 minutes)",
            },
            sinceTime: {
              type: "string",
              description: "Only return logs after a specific date (RFC3339 format, e.g., '2024-01-01T00:00:00Z')",
            },
            since: {
              type: "string",
              description: "Only return logs newer than a relative duration (e.g., '5s', '2m', '3h'). Mutually exclusive with sinceSeconds.",
            },
            limitBytes: {
              type: "number",
              description: "Maximum bytes of logs to return",
            },
            prefix: {
              type: "boolean",
              description: "Prefix each log line with the log source (pod name and container name)",
              default: false,
            },
            filter: {
              type: "string",
              description: "Filter logs by pattern (case-insensitive substring match, like grep)",
            },
            exclude: {
              type: "string",
              description: "Exclude lines matching pattern (case-insensitive)",
            },
            level: {
              type: "string",
              description: "Filter by log level keywords",
              enum: ["error", "warn", "info", "debug"],
            },
            format: {
              type: "string",
              description: "Output format for multi-pod results",
              enum: ["structured", "text", "summary"],
              default: "structured",
            },
            maxPods: {
              type: "number",
              description: "Maximum pods to fetch logs from when using labelSelector or deployment/service (default: 10, max: 50)",
              default: 10,
            },
            analyze: {
              type: "boolean",
              description: "Enable AI analysis mode - returns statistics, patterns, and insights without full log content",
              default: false,
            },
            patterns: {
              type: "array",
              items: { type: "string" },
              description: "Custom patterns to search for and count (e.g., ['timeout', 'connection refused', 'database'])",
            },
            scrub: {
              type: "boolean",
              description: "Mask potential secrets in logs (passwords, tokens, emails, IPs)",
              default: false,
            },
          },
        },
      },
      handler: async ({ name, namespace, container, tailLines, previous, follow, labelSelector, allContainers, timestamps, sinceSeconds, sinceTime, since, limitBytes, prefix, filter, exclude, level, format, maxPods, analyze, patterns, scrub }: { 
        name?: string; 
        namespace?: string;
        container?: string;
        tailLines?: number;
        previous?: boolean;
        follow?: boolean;
        labelSelector?: string;
        allContainers?: boolean;
        timestamps?: boolean;
        sinceSeconds?: number;
        sinceTime?: string;
        since?: string;
        limitBytes?: number;
        prefix?: boolean;
        filter?: string;
        exclude?: string;
        level?: "error" | "warn" | "info" | "debug";
        format?: "structured" | "text" | "summary";
        maxPods?: number;
        analyze?: boolean;
        patterns?: string[];
        scrub?: boolean;
      }) => {
        const ns = namespace || "default";
        const coreApi = k8sClient.getCoreV1Api();
        const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
        
        // Parse duration string (e.g., "5s", "2m", "3h") to seconds
        const parseDuration = (duration: string): number => {
          const match = duration.match(/^(\d+)([smh])$/);
          if (!match) return 0;
          const value = parseInt(match[1], 10);
          const unit = match[2];
          switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 3600;
            default: return 0;
          }
        };
        
        // Use since if provided, otherwise use sinceSeconds
        const effectiveSinceSeconds = since ? parseDuration(since) : sinceSeconds;
        
        // Define analysis patterns
        const analysisPatterns: Record<string, RegExp> = {
          errors: /\b(error|ERROR|Exception|EXCEPTION|FATAL|fatal|panic|PANIC|crash|CRASH)\b/i,
          warnings: /\b(warn|WARN|warning|WARNING)\b/i,
          httpErrors: /\b(4\d{2}|5\d{2})\b/,
          timeouts: /\b(timeout|TIMEOUT|deadline exceeded|context deadline)\b/i,
          connections: /\b(connection refused|connection reset|ECONNREFUSED|ECONNRESET)\b/i,
          restarts: /\b(restart|Restart|restarting|restarted)\b/i,
          database: /\b(database|DB|postgres|mysql|mongodb|redis|sql|query)\b/i,
          network: /\b(network|dns|resolve|connect|disconnect|socket)\b/i,
          memory: /\b(memory|oom|out of memory|heap|gc|garbage collection)\b/i,
        };
        
        // Add custom patterns if provided
        if (patterns) {
          for (const pattern of patterns) {
            analysisPatterns[`custom_${pattern}`] = new RegExp(pattern, "i");
          }
        }
        
        // Helper function for comprehensive log analysis
        const analyzeLogs = (logContent: string): {
          filtered: string;
          totalLines: number;
          matchedLines: number;
          analysis: {
            errors: number;
            warnings: number;
            errorRate: string;
            patternMatches: Record<string, number>;
            uniqueErrors: string[];
          };
        } => {
          if (!logContent) {
            return {
              filtered: "",
              totalLines: 0,
              matchedLines: 0,
              analysis: { errors: 0, warnings: 0, errorRate: "0%", patternMatches: {}, uniqueErrors: [] },
            };
          }
          
          let lines = logContent.split("\n").filter((line: string) => line.trim());
          const totalLines = lines.length;
          const uniqueErrors: string[] = [];
          
          // Count patterns
          const patternMatches: Record<string, number> = {};
          for (const [name, regex] of Object.entries(analysisPatterns)) {
            const matches = lines.filter((line: string) => regex.test(line));
            patternMatches[name] = matches.length;
            
            // Collect unique error samples
            if (name === "errors" || name.startsWith("custom_")) {
              for (const match of matches.slice(0, 3)) {
                const trimmed = match.trim();
                if (trimmed.length > 20 && !uniqueErrors.includes(trimmed)) {
                  uniqueErrors.push(trimmed.substring(0, 200));
                }
              }
            }
          }
          
          // Apply filters if not in analyze-only mode
          if (!analyze) {
            if (filter) {
              const filterRegex = new RegExp(filter, "i");
              lines = lines.filter((line: string) => filterRegex.test(line));
            }
            if (exclude) {
              const excludeRegex = new RegExp(exclude, "i");
              lines = lines.filter((line: string) => !excludeRegex.test(line));
            }
            if (level) {
              const levelPatterns: Record<string, RegExp> = {
                error: /\b(error|ERROR|Exception|EXCEPTION|FATAL|fatal|panic|PANIC)\b/i,
                warn: /\b(warn|WARN|warning|WARNING)\b/i,
                info: /\b(info|INFO|log|LOG)\b/i,
                debug: /\b(debug|DEBUG|trace|TRACE)\b/i,
              };
              const levelRegex = levelPatterns[level];
              if (levelRegex) {
                lines = lines.filter((line: string) => levelRegex.test(line));
              }
            }
          }
          
          const errorRate = totalLines > 0 
            ? ((patternMatches["errors"] || 0) / totalLines * 100).toFixed(2) + "%"
            : "0%";
          
          return {
            filtered: lines.join("\n"),
            totalLines,
            matchedLines: lines.length,
            analysis: {
              errors: patternMatches["errors"] || 0,
              warnings: patternMatches["warnings"] || 0,
              errorRate,
              patternMatches,
              uniqueErrors: uniqueErrors.slice(0, 5),
            },
          };
        };
        
        const podLimit = Math.min(maxPods || 10, 50);
        
        try {
          // Parse resource type from name (e.g., "deploy/my-deployment" or "svc/my-service")
          let resourceType = "pod";
          let resourceName = name;
          
          if (name && name.includes("/")) {
            const [type, ...rest] = name.split("/");
            resourceName = rest.join("/");
            
            if (type === "deploy" || type === "deployment" || type === "deployments") {
              resourceType = "deployment";
            } else if (type === "svc" || type === "service" || type === "services") {
              resourceType = "service";
            } else if (type === "pod" || type === "pods") {
              resourceType = "pod";
            } else if (type === "sts" || type === "statefulset" || type === "statefulsets") {
              resourceType = "statefulset";
            } else if (type === "ds" || type === "daemonset" || type === "daemonsets") {
              resourceType = "daemonset";
            } else if (type === "job" || type === "jobs") {
              resourceType = "job";
            } else if (type === "cj" || type === "cronjob" || type === "cronjobs") {
              resourceType = "cronjob";
            } else if (type === "rs" || type === "replicaset" || type === "replicasets") {
              resourceType = "replicaset";
            }
          }
          
          // Handle label selector - get logs from multiple pods with filtering and formatting
          if (labelSelector) {
            const response = await coreApi.listNamespacedPod({
              namespace: ns,
              labelSelector
            });
            const pods = response.items.slice(0, podLimit);
            
            if (pods.length === 0) {
              return { error: `No pods found with label selector: ${labelSelector}` };
            }
            
            const podLogs: Array<{
              pod: string;
              container?: string;
              logs?: string;
              totalLines: number;
              matchedLines: number;
              analysis: {
                errors: number;
                warnings: number;
                errorRate: string;
                patternMatches: Record<string, number>;
                uniqueErrors: string[];
              };
            }> = [];
            
            for (const pod of pods) {
              const podName = pod.metadata?.name;
              if (!podName) continue;
              
              const containers = allContainers 
                ? (pod.spec?.containers?.map((c: any) => c.name) || [undefined])
                : [container];
              
              for (const cont of containers) {
                try {
                  const logContent = await k8sClient.getPodLogs(podName, ns, cont, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
                  const { filtered, totalLines, matchedLines, analysis } = analyzeLogs(logContent || "");
                  
                  let finalLog = filtered || "(no logs available)";
                  if (prefix) {
                    const source = cont || "default";
                    finalLog = finalLog.split('\n').map((line: string) => `[${podName}/${source}] ${line}`).join('\n');
                  }
                  if (scrub) {
                    finalLog = scrubSensitiveData(finalLog);
                  }
                  
                  podLogs.push({
                    pod: podName,
                    container: cont,
                    logs: analyze ? undefined : finalLog,
                    totalLines,
                    matchedLines,
                    analysis,
                  });
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  podLogs.push({
                    pod: podName,
                    container: cont,
                    logs: `Error: ${errorMessage}`,
                    totalLines: 0,
                    matchedLines: 0,
                    analysis: { errors: 0, warnings: 0, errorRate: "0%", patternMatches: {}, uniqueErrors: [] },
                  });
                }
              }
            }
            
            // Calculate totals
            const totalLines = podLogs.reduce((sum, p) => sum + p.totalLines, 0);
            const matchedLines = podLogs.reduce((sum, p) => sum + p.matchedLines, 0);
            
            // Format output based on requested format
            let result: any;
            switch (format) {
              case "text":
                result = {
                  text: podLogs.map(p => p.logs).join("\n"),
                  totalLines: matchedLines,
                };
                break;
              case "summary":
                result = {
                  pods: podLogs.map(p => ({
                    pod: p.pod,
                    container: p.container,
                    lines: p.matchedLines,
                    totalLines: p.totalLines,
                  })),
                };
                break;
              default: // structured
                const logs: Record<string, any> = {};
                for (const p of podLogs) {
                  if (!logs[p.pod]) logs[p.pod] = {};
                  logs[p.pod][p.container || "default"] = p.logs;
                }
                result = { logs };
            }
            
            // Aggregate analysis across all pods
            const totalErrors = podLogs.reduce((sum, p) => sum + (p.analysis?.errors || 0), 0);
            const totalWarnings = podLogs.reduce((sum, p) => sum + (p.analysis?.warnings || 0), 0);
            const aggregatedPatterns: Record<string, number> = {};
            for (const podLog of podLogs) {
              for (const [pattern, count] of Object.entries(podLog.analysis?.patternMatches || {})) {
                aggregatedPatterns[pattern] = (aggregatedPatterns[pattern] || 0) + count;
              }
            }
            
            // Find pods with most errors
            const podsByErrors = [...podLogs]
              .sort((a, b) => (b.analysis?.errors || 0) - (a.analysis?.errors || 0))
              .slice(0, 5)
              .map(p => ({
                pod: p.pod,
                errors: p.analysis?.errors || 0,
                warnings: p.analysis?.warnings || 0,
                errorRate: p.analysis?.errorRate,
                sampleErrors: p.analysis?.uniqueErrors?.slice(0, 3),
              }));
            
            return {
              pods: pods.length,
              labelSelector,
              allContainers,
              filter,
              exclude,
              level,
              patterns,
              analyze,
              format,
              summary: {
                totalPods: pods.length,
                totalLines,
                matchedLines,
                totalErrors,
                totalWarnings,
                filterApplied: !!(filter || exclude || level),
                errorRate: totalLines > 0 ? ((totalErrors / totalLines) * 100).toFixed(2) + "%" : "0%",
              },
              aggregatedAnalysis: {
                patterns: aggregatedPatterns,
                topProblematicPods: podsByErrors,
              },
              podAnalysis: analyze ? podLogs.map(p => ({
                pod: p.pod,
                container: p.container,
                analysis: p.analysis,
              })) : undefined,
              ...result,
              note: analyze 
                ? "Analysis mode enabled. Set analyze: false to retrieve full logs."
                : follow ? "Follow mode requested - returned initial logs. Use kubectl for real-time streaming." : undefined,
            };
          }
          
          // Handle deployment-based logs
          if (resourceType === "deployment" && resourceName) {
            // Get deployment to find selector
            const deployment = await k8sClient.getDeployment(resourceName, ns);
            const selector = deployment.spec?.selector?.matchLabels;
            
            if (!selector) {
              return { error: `Deployment ${resourceName} has no selector` };
            }
            
            // Convert selector to label selector string
            const labelSelectorStr = Object.entries(selector)
              .map(([k, v]) => `${k}=${v}`)
              .join(",");
            
            const response = await coreApi.listNamespacedPod({ namespace: ns, labelSelector: labelSelectorStr });
            const pods = response.items || [];
            
            if (pods.length === 0) {
              return { error: `No pods found for deployment ${resourceName}` };
            }
            
            const logs: Record<string, any> = {};
            
            for (const pod of pods) {
              const podName = pod.metadata?.name;
              if (!podName) continue;
              
              const containers = allContainers 
                ? (pod.spec?.containers?.map((c: any) => c.name) || [undefined])
                : [container];
              
              logs[podName] = {};
              
              for (const cont of containers) {
                try {
                  const logContent = await k8sClient.getPodLogs(podName, ns, cont, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
                  let finalLog = logContent || "(no logs available)";
                  if (prefix) {
                    const source = cont || "default";
                    finalLog = finalLog.split('\n').map(line => `[${podName}/${source}] ${line}`).join('\n');
                  }
                  if (scrub) {
                    finalLog = scrubSensitiveData(finalLog);
                  }
                  logs[podName][cont || "default"] = finalLog;
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  // Provide helpful error message for common log issues
                  if (errorMessage.includes('HTTP request failed') || errorMessage.includes('streaming')) {
                    logs[podName][cont || "default"] = "Unable to retrieve logs - container may not produce logs or streaming not supported. Use kubectl logs for direct access.";
                  } else {
                    logs[podName][cont || "default"] = `Error: ${errorMessage}`;
                  }
                }
              }
            }
            
            return {
              deployment: resourceName,
              pods: pods.length,
              allContainers,
              logs,
              note: follow ? "Follow mode requested - returned initial logs. Use kubectl for real-time streaming." : undefined,
            };
          }
          
          // Handle service-based logs
          if (resourceType === "service" && resourceName) {
            // Get service to find selector
            const serviceResponse = await coreApi.readNamespacedService({ name: resourceName, namespace: ns });
            const selector = serviceResponse.spec?.selector;
            
            if (!selector) {
              return { error: `Service ${resourceName} has no selector` };
            }
            
            // Convert selector to label selector string
            const labelSelectorStr = Object.entries(selector)
              .map(([k, v]) => `${k}=${v}`)
              .join(",");
            
            const response = await coreApi.listNamespacedPod({
              namespace: ns,
              labelSelector: labelSelectorStr
            });
            const pods = response.items;
            
            if (pods.length === 0) {
              return { error: `No pods found for service ${resourceName}` };
            }
            
            const logs: Record<string, any> = {};
            
            for (const pod of pods) {
              const podName = pod.metadata?.name;
              if (!podName) continue;
              
              const containers = allContainers 
                ? (pod.spec?.containers?.map((c: any) => c.name) || [undefined])
                : [container];
              
              logs[podName] = {};
              
              for (const cont of containers) {
                try {
                  const logContent = await k8sClient.getPodLogs(podName, ns, cont, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
                  let finalLog = logContent || "(no logs available)";
                  if (prefix) {
                    const source = cont || "default";
                    finalLog = finalLog.split('\n').map(line => `[${podName}/${source}] ${line}`).join('\n');
                  }
                  if (scrub) {
                    finalLog = scrubSensitiveData(finalLog);
                  }
                  logs[podName][cont || "default"] = finalLog;
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  // Provide helpful error message for common log issues
                  if (errorMessage.includes('HTTP request failed') || errorMessage.includes('streaming')) {
                    logs[podName][cont || "default"] = "Unable to retrieve logs - container may not produce logs or streaming not supported. Use kubectl logs for direct access.";
                  } else {
                    logs[podName][cont || "default"] = `Error: ${errorMessage}`;
                  }
                }
              }
            }
            
            return {
              service: resourceName,
              pods: pods.length,
              allContainers,
              logs,
              note: follow ? "Follow mode requested - returned initial logs. Use kubectl for real-time streaming." : undefined,
            };
          }
          
          // Handle statefulset-based logs
          if (resourceType === "statefulset" && resourceName) {
            // Get statefulset to find selector
            const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
            const statefulsetResponse = await appsApi.readNamespacedStatefulSet({ name: resourceName, namespace: ns });
            const selector = statefulsetResponse.spec?.selector?.matchLabels;
            
            if (!selector) {
              return { error: `StatefulSet ${resourceName} has no selector` };
            }
            
            // Convert selector to label selector string
            const labelSelectorStr = Object.entries(selector)
              .map(([k, v]) => `${k}=${v}`)
              .join(",");
            
            const response = await coreApi.listNamespacedPod({
              namespace: ns,
              labelSelector: labelSelectorStr
            });
            const pods = response.items;
            
            if (pods.length === 0) {
              return { error: `No pods found for statefulset ${resourceName}` };
            }
            
            const logs: Record<string, any> = {};
            
            for (const pod of pods) {
              const podName = pod.metadata?.name;
              if (!podName) continue;
              
              const containers = allContainers 
                ? (pod.spec?.containers?.map((c: any) => c.name) || [undefined])
                : [container];
              
              logs[podName] = {};
              
              for (const cont of containers) {
                try {
                  const logContent = await k8sClient.getPodLogs(podName, ns, cont, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
                  let finalLog = logContent || "(no logs available)";
                  if (prefix) {
                    const source = cont || "default";
                    finalLog = finalLog.split('\n').map(line => `[${podName}/${source}] ${line}`).join('\n');
                  }
                  if (scrub) {
                    finalLog = scrubSensitiveData(finalLog);
                  }
                  logs[podName][cont || "default"] = finalLog;
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  // Provide helpful error message for common log issues
                  if (errorMessage.includes('HTTP request failed') || errorMessage.includes('streaming')) {
                    logs[podName][cont || "default"] = "Unable to retrieve logs - container may not produce logs or streaming not supported. Use kubectl logs for direct access.";
                  } else {
                    logs[podName][cont || "default"] = `Error: ${errorMessage}`;
                  }
                }
              }
            }
            
            return {
              statefulset: resourceName,
              pods: pods.length,
              allContainers,
              logs,
              note: follow ? "Follow mode requested - returned initial logs. Use kubectl for real-time streaming." : undefined,
            };
          }
          
          // Handle daemonset-based logs
          if (resourceType === "daemonset" && resourceName) {
            // Get daemonset to find selector
            const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
            const daemonsetResponse = await appsApi.readNamespacedDaemonSet({ name: resourceName, namespace: ns });
            const selector = daemonsetResponse.spec?.selector?.matchLabels;
            
            if (!selector) {
              return { error: `DaemonSet ${resourceName} has no selector` };
            }
            
            // Convert selector to label selector string
            const labelSelectorStr = Object.entries(selector)
              .map(([k, v]) => `${k}=${v}`)
              .join(",");
            
            const response = await coreApi.listNamespacedPod({
              namespace: ns,
              labelSelector: labelSelectorStr
            });
            const pods = response.items;
            
            if (pods.length === 0) {
              return { error: `No pods found for daemonset ${resourceName}` };
            }
            
            const logs: Record<string, any> = {};
            
            for (const pod of pods) {
              const podName = pod.metadata?.name;
              if (!podName) continue;
              
              const containers = allContainers 
                ? (pod.spec?.containers?.map((c: any) => c.name) || [undefined])
                : [container];
              
              logs[podName] = {};
              
              for (const cont of containers) {
                try {
                  const logContent = await k8sClient.getPodLogs(podName, ns, cont, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
                  let finalLog = logContent || "(no logs available)";
                  if (prefix) {
                    const source = cont || "default";
                    finalLog = finalLog.split('\n').map(line => `[${podName}/${source}] ${line}`).join('\n');
                  }
                  if (scrub) {
                    finalLog = scrubSensitiveData(finalLog);
                  }
                  logs[podName][cont || "default"] = finalLog;
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  // Provide helpful error message for common log issues
                  if (errorMessage.includes('HTTP request failed') || errorMessage.includes('streaming')) {
                    logs[podName][cont || "default"] = "Unable to retrieve logs - container may not produce logs or streaming not supported. Use kubectl logs for direct access.";
                  } else {
                    logs[podName][cont || "default"] = `Error: ${errorMessage}`;
                  }
                }
              }
            }
            
            return {
              daemonset: resourceName,
              pods: pods.length,
              allContainers,
              logs,
              note: follow ? "Follow mode requested - returned initial logs. Use kubectl for real-time streaming." : undefined,
            };
          }
          
          // Handle job-based logs
          if (resourceType === "job" && resourceName) {
            // Get job to find selector
            const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
            const jobResponse = await batchApi.readNamespacedJob({ name: resourceName, namespace: ns });
            const selector = jobResponse.spec?.selector?.matchLabels;
            
            if (!selector) {
              return { error: `Job ${resourceName} has no selector` };
            }
            
            // Convert selector to label selector string
            const labelSelectorStr = Object.entries(selector)
              .map(([k, v]) => `${k}=${v}`)
              .join(",");
            
            const response = await coreApi.listNamespacedPod({
              namespace: ns,
              labelSelector: labelSelectorStr
            });
            const pods = response.items;
            
            if (pods.length === 0) {
              return { error: `No pods found for job ${resourceName}` };
            }
            
            const logs: Record<string, any> = {};
            
            for (const pod of pods) {
              const podName = pod.metadata?.name;
              if (!podName) continue;
              
              const containers = allContainers 
                ? (pod.spec?.containers?.map((c: any) => c.name) || [undefined])
                : [container];
              
              logs[podName] = {};
              
              for (const cont of containers) {
                try {
                  const logContent = await k8sClient.getPodLogs(podName, ns, cont, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
                  let finalLog = logContent || "(no logs available)";
                  if (prefix) {
                    const source = cont || "default";
                    finalLog = finalLog.split('\n').map(line => `[${podName}/${source}] ${line}`).join('\n');
                  }
                  if (scrub) {
                    finalLog = scrubSensitiveData(finalLog);
                  }
                  logs[podName][cont || "default"] = finalLog;
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  // Provide helpful error message for common log issues
                  if (errorMessage.includes('HTTP request failed') || errorMessage.includes('streaming')) {
                    logs[podName][cont || "default"] = "Unable to retrieve logs - container may not produce logs or streaming not supported. Use kubectl logs for direct access.";
                  } else {
                    logs[podName][cont || "default"] = `Error: ${errorMessage}`;
                  }
                }
              }
            }
            
            return {
              job: resourceName,
              pods: pods.length,
              allContainers,
              logs,
              note: follow ? "Follow mode requested - returned initial logs. Use kubectl for real-time streaming." : undefined,
            };
          }
          
          // Handle cronjob-based logs - aggregate from all jobs created by cronjob
          if (resourceType === "cronjob" && resourceName) {
            const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
            // Find all jobs owned by this cronjob
            const jobsResponse = await batchApi.listNamespacedJob({
              namespace: ns,
              labelSelector: `owner-name=${resourceName}`
            });
            const jobs = jobsResponse.items;
            
            if (jobs.length === 0) {
              return { error: `No jobs found for cronjob ${resourceName}` };
            }
            
            const allLogs: Record<string, any> = {};
            
            for (const job of jobs) {
              const jobName = job.metadata?.name;
              if (!jobName) continue;
              
              const jobSelector = job.spec?.selector?.matchLabels;
              if (!jobSelector) continue;
              
              const labelSelectorStr = Object.entries(jobSelector)
                .map(([k, v]) => `${k}=${v}`)
                .join(",");
              
              try {
                const podResponse = await coreApi.listNamespacedPod({
                  namespace: ns,
                  labelSelector: labelSelectorStr
                });
                const pods = podResponse.items;
                
                const jobLogs: Record<string, any> = {};
                
                for (const pod of pods) {
                  const podName = pod.metadata?.name;
                  if (!podName) continue;
                  
                  const containers = allContainers 
                    ? (pod.spec?.containers?.map((c: any) => c.name) || [undefined])
                    : [container];
                  
                  jobLogs[podName] = {};
                  
                  for (const cont of containers) {
                    try {
                      const logContent = await k8sClient.getPodLogs(podName, ns, cont, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
                      let finalLog = logContent || "(no logs available)";
                      if (prefix) {
                        const source = cont || "default";
                        finalLog = finalLog.split('\n').map((line: string) => `[${podName}/${source}] ${line}`).join('\n');
                      }
                      if (scrub) {
                        finalLog = scrubSensitiveData(finalLog);
                      }
                      jobLogs[podName][cont || "default"] = finalLog;
                    } catch (err) {
                      const errorMessage = err instanceof Error ? err.message : String(err);
                      jobLogs[podName][cont || "default"] = `Error: ${errorMessage}`;
                    }
                  }
                }
                
                allLogs[jobName] = jobLogs;
              } catch (err) {
                allLogs[jobName] = { error: `Failed to get logs: ${err instanceof Error ? err.message : String(err)}` };
              }
            }
            
            return {
              cronjob: resourceName,
              jobs: jobs.length,
              allContainers,
              logs: allLogs,
              note: follow ? "Follow mode requested - returned initial logs. Use kubectl for real-time streaming." : undefined,
            };
          }
          
          // Handle replicaset-based logs
          if (resourceType === "replicaset" && resourceName) {
            const selector = {
              "pod-template-hash": resourceName.split("-")[resourceName.split("-").length - 1] || resourceName
            };
            // Use owner name to find pods
            const labelSelectorStr = `owner-name=${resourceName}`;
            
            const response = await coreApi.listNamespacedPod({
              namespace: ns,
              labelSelector: labelSelectorStr
            });
            const pods = response.items;
            
            if (pods.length === 0) {
              // Fallback: try to find pods by owner reference
              const allPods = await coreApi.listNamespacedPod({ namespace: ns });
              const rsPods = allPods.items.filter((pod: any) => 
                pod.metadata?.ownerReferences?.some((ref: any) => 
                  ref.name === resourceName && ref.kind === "ReplicaSet"
                )
              );
              
              if (rsPods.length === 0) {
                return { error: `No pods found for replicaset ${resourceName}` };
              }
              
              pods.push(...rsPods);
            }
            
            const logs: Record<string, any> = {};
            
            for (const pod of pods) {
              const podName = pod.metadata?.name;
              if (!podName) continue;
              
              const containers = allContainers 
                ? (pod.spec?.containers?.map((c: any) => c.name) || [undefined])
                : [container];
              
              logs[podName] = {};
              
              for (const cont of containers) {
                try {
                  const logContent = await k8sClient.getPodLogs(podName, ns, cont, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
                  let finalLog = logContent || "(no logs available)";
                  if (prefix) {
                    const source = cont || "default";
                    finalLog = finalLog.split('\n').map((line: string) => `[${podName}/${source}] ${line}`).join('\n');
                  }
                  if (scrub) {
                    finalLog = scrubSensitiveData(finalLog);
                  }
                  logs[podName][cont || "default"] = finalLog;
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  logs[podName][cont || "default"] = `Error: ${errorMessage}`;
                }
              }
            }
            
            return {
              replicaset: resourceName,
              pods: pods.length,
              allContainers,
              logs,
              note: follow ? "Follow mode requested - returned initial logs. Use kubectl for real-time streaming." : undefined,
            };
          }
          
          // Single pod logs
          if (!resourceName) {
            return { error: "Either 'name' or 'labelSelector' must be specified" };
          }
          
          const logContent = await k8sClient.getPodLogs(resourceName, ns, container, tailLines, false, previous, effectiveSinceSeconds, sinceTime, limitBytes);
          const { filtered, totalLines, matchedLines, analysis: singlePodAnalysis } = analyzeLogs(logContent || "");
          
          let finalLog = filtered || "(no logs available)";
          if (prefix) {
            const source = container || "default";
            finalLog = finalLog.split('\n').map((line: string) => `[${resourceName}/${source}] ${line}`).join('\n');
          }
          if (scrub) {
            finalLog = scrubSensitiveData(finalLog);
          }
          
          return {
            pod: resourceName,
            namespace: ns,
            container,
            previous: previous || false,
            follow: false, // Always false for MCP compatibility
            lines: tailLines || 100,
            sinceSeconds,
            sinceTime,
            timestamps: timestamps || false,
            limitBytes,
            prefix: prefix || false,
            filter,
            exclude,
            level,
            patterns,
            analyze,
            scrub: scrub || false,
            logs: analyze ? undefined : finalLog, // Don't return full logs in analyze mode
            analysis: singlePodAnalysis,
            summary: {
              totalLines,
              matchedLines,
              filterApplied: !!(filter || exclude || level),
            },
            note: analyze 
              ? "Analysis mode enabled - full logs excluded. Set analyze: false to retrieve logs."
              : "Follow mode is not supported in MCP context. Use kubectl logs -f for real-time streaming.",
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { error: errorMessage };
        }
      },
    },
    {
      tool: {
        name: "k8s_delete_pod",
        description: "Delete a pod",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the pod to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the pod",
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
        try {
          validateResourceName(name, "pod");
          const ns = namespace || "default";

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "Pod",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await k8sClient.deletePod(name, ns, deleteParams);
          return { 
            success: true, 
            dryRun: dryRun || "none",
            message: `Pod ${name} in namespace ${ns} deleted` 
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "Pod", name, namespace, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_pod", resource: name, namespace };
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
        name: "k8s_describe_pod",
        description: "Get full YAML description of a pod",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the pod",
            },
            namespace: {
              type: "string",
              description: "Namespace of the pod",
              default: "default",
            },
            scrub: {
              type: "boolean",
              description: "Mask potential secrets in pod spec (env vars, command args)",
              default: false,
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, scrub }: { name: string; namespace?: string; scrub?: boolean }) => {
        try {
          validateResourceName(name, "pod");
          const pod = await k8sClient.getPod(name, namespace || "default");
          let yamlOutput = JSON.stringify(pod, null, 2);
          if (scrub) {
            yamlOutput = scrubSensitiveData(yamlOutput);
          }
          return {
            pod: name,
            namespace: namespace || "default",
            scrubbed: scrub || false,
            yaml: yamlOutput,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_describe_pod", resource: name, namespace };
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
        name: "k8s_get_pod_events",
        description: "Get events for a specific pod",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the pod",
            },
            namespace: {
              type: "string",
              description: "Namespace of the pod",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "pod");
          const events = await k8sClient.listEvents(namespace, `involvedObject.name=${name}`);
          return {
            pod: name,
            namespace: namespace || "default",
            events: events.map((e: k8s.CoreV1Event) => ({
              type: e.type,
              reason: e.reason,
              message: e.message,
              count: e.count,
              firstTimestamp: e.firstTimestamp,
              lastTimestamp: e.lastTimestamp,
              source: e.source?.component,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_pod_events", resource: name, namespace };
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
        name: "k8s_find_unhealthy_pods",
        description: "Find pods that are not in Running state or have issues",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to search (optional, all if not specified)",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const pods = await k8sClient.listPods(namespace);
        
          const unhealthy = pods.filter((pod: k8s.V1Pod) => {
            const phase = pod.status?.phase;
            if (phase !== "Running" && phase !== "Succeeded") return true;
          
            const containerStatuses = pod.status?.containerStatuses || [];
            return containerStatuses.some((c: k8s.V1ContainerStatus) => {
              if (!c.ready && phase === "Running") return true;
              if (c.restartCount && c.restartCount > 5) return true;
              if (c.state?.waiting?.reason === "CrashLoopBackOff") return true;
              return false;
            });
          });

          return {
            totalPods: pods.length,
            unhealthyPods: unhealthy.length,
            pods: unhealthy.map((pod: k8s.V1Pod) => ({
              name: pod.metadata?.name,
              namespace: pod.metadata?.namespace,
              status: pod.status?.phase,
              node: pod.spec?.nodeName,
              issues: getPodIssues(pod),
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_find_unhealthy_pods", namespace };
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
        name: "k8s_restart_pod",
        description: "Restart a pod by deleting it (will be recreated if part of a controller)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the pod to restart",
            },
            namespace: {
              type: "string",
              description: "Namespace of the pod",
              default: "default",
            },
            ...commonMutationQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, dryRun }: { name: string; namespace?: string; dryRun?: string }) => {
        try {
          const ns = namespace || "default";
          validateResourceName(name, "pod");
          const pod = await k8sClient.getPod(name, ns);
        
          // Check if pod has owner references (controller)
          const hasController = (pod.metadata?.ownerReferences?.length || 0) > 0;

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Restart pod",
              kind: "Pod",
              name,
              namespace: ns,
              details: {
                hasController,
                ownerReferences: pod.metadata?.ownerReferences,
                recreationExpected: hasController,
              },
            });
          }
        
          await k8sClient.deletePod(name, ns, { dryRun: dryRun === "server" ? "All" : undefined });
        
          return {
            success: true,
            dryRun: dryRun || "none",
            message: hasController 
              ? `Pod ${name} deleted. It will be recreated by its controller.`
              : `Pod ${name} deleted. Note: This pod has no controller and will not be recreated automatically.`,
            hasController,
            ownerReferences: pod.metadata?.ownerReferences,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_restart_pod", resource: name, namespace };
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
        name: "k8s_debug_scheduling",
        description: "Debug why a pod is stuck in Pending state",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the pending pod",
            },
            namespace: {
              type: "string",
              description: "Namespace of the pod",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        const ns = namespace || "default";
        const pod = await k8sClient.getPod(name, ns);
        const events = await k8sClient.listEvents(ns, `involvedObject.name=${name}`);
        
        if (pod.status?.phase !== "Pending") {
          return {
            pod: name,
            status: pod.status?.phase,
            message: "Pod is not in Pending state. No scheduling issues to debug.",
          };
        }

        const schedulingIssues = [];
        const podSpec = pod.spec;
        
        // Check node selector
        if (podSpec?.nodeSelector && Object.keys(podSpec.nodeSelector).length > 0) {
          schedulingIssues.push({
            type: "nodeSelector",
            details: podSpec.nodeSelector,
            message: "Pod has nodeSelector constraints",
          });
        }

        // Check affinity
        if (podSpec?.affinity) {
          schedulingIssues.push({
            type: "affinity",
            details: podSpec.affinity,
            message: "Pod has affinity/anti-affinity rules",
          });
        }

        // Check tolerations
        if (podSpec?.tolerations && podSpec.tolerations.length > 0) {
          schedulingIssues.push({
            type: "tolerations",
            count: podSpec.tolerations.length,
            message: "Pod requires specific taint tolerations",
          });
        }

        // Check resource requests
        const containers = podSpec?.containers || [];
        const resourceRequests = containers.map((c: k8s.V1Container) => ({
          name: c.name,
          requests: c.resources?.requests,
        }));
        
        const hasResourceRequests = resourceRequests.some((r: any) => r.requests);
        if (hasResourceRequests) {
          schedulingIssues.push({
            type: "resources",
            details: resourceRequests,
            message: "Pod has resource requests that may exceed available capacity",
          });
        }

        // Check PVC bounds
        const volumes = podSpec?.volumes || [];
        const pvcVolumes = volumes.filter((v: k8s.V1Volume) => v.persistentVolumeClaim);
        if (pvcVolumes.length > 0) {
          schedulingIssues.push({
            type: "storage",
            volumes: pvcVolumes.map((v: k8s.V1Volume) => v.persistentVolumeClaim?.claimName),
            message: "Pod requires PersistentVolumeClaims to be bound",
          });
        }

        return {
          pod: name,
          namespace: ns,
          status: pod.status?.phase,
          conditions: pod.status?.conditions?.map((c: k8s.V1PodCondition) => ({
            type: c.type,
            status: c.status,
            reason: c.reason,
            message: c.message,
          })),
          schedulingIssues,
          events: events.slice(0, 5).map((e: k8s.CoreV1Event) => ({
            reason: e.reason,
            message: e.message,
            count: e.count,
            lastSeen: e.lastTimestamp,
          })),
          recommendations: generateSchedulingRecommendations(schedulingIssues, events),
        };
      },
    },
    {
      tool: {
        name: "k8s_debug_pod",
        description: "Create an ephemeral debug container in a running pod (like kubectl debug)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the pod to debug",
            },
            namespace: {
              type: "string",
              description: "Namespace of the pod",
              default: "default",
            },
            image: {
              type: "string",
              description: "Debug container image (default: busybox)",
              default: "busybox:latest",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description: "Command to run in debug container",
              default: ["sh"],
            },
            target: {
              type: "string",
              description: "Target container name (defaults to first container)",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, image, command, target }: { 
        name: string; 
        namespace?: string; 
        image?: string; 
        command?: string[];
        target?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          // Get the target pod
          const pod = await k8sClient.getPod(name, ns);
          
          // Determine target container
          const targetContainer = target || pod.spec?.containers?.[0]?.name;
          
          if (!targetContainer) {
            return { success: false, error: "No target container found" };
          }
          
          // Create ephemeral debug container spec
          const debugContainerName = `debug-${Date.now()}`;
          
          // Note: Full implementation requires EphemeralContainers API
          // For now, we provide the kubectl command and instructions
          return {
            success: true,
            pod: name,
            namespace: ns,
            targetContainer,
            debugContainer: {
              name: debugContainerName,
              image: image || "busybox:latest",
              command: command || ["sh"],
            },
            kubectlCommand: `kubectl debug -it ${name} -n ${ns} --target=${targetContainer} --image=${image || "busybox:latest"} -- ${(command || ["sh"]).join(" ")}`,
            note: "Ephemeral debug containers require Kubernetes 1.23+ and the EphemeralContainers feature gate. Use the provided kubectl command for interactive debugging.",
            alternatives: [
              `k8s_exec_pod for existing container execution`,
              `k8s_attach_pod for attaching to running containers`,
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
      },
    },
    {
      tool: {
        name: "k8s_run",
        description: "Run a pod imperatively (like kubectl run). Creates and starts a single pod.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name for the pod (optional, auto-generated if not provided)",
            },
            image: {
              type: "string",
              description: "Container image to run",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description: "Command to run in the container",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "Arguments for the command",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "Environment variables (KEY=VALUE format)",
            },
            labels: {
              type: "object",
              description: "Labels to apply to the pod",
            },
            port: {
              type: "number",
              description: "Container port to expose",
            },
            restartPolicy: {
              type: "string",
              description: "Restart policy",
              enum: ["Always", "OnFailure", "Never"],
              default: "Always",
            },
            serviceAccount: {
              type: "string",
              description: "ServiceAccount to use",
            },
            ...commonCreateQuerySchema,
            output: {
              type: "string",
              description: "Output format for dry-run",
              enum: ["json", "yaml"],
              default: "yaml",
            },
            tty: {
              type: "boolean",
              description: "Allocate TTY for interactive use",
              default: false,
            },
            stdin: {
              type: "boolean",
              description: "Keep stdin open",
              default: false,
            },
          },
          required: ["image"],
        },
      },
      handler: async ({ name, image, namespace, command, args, env, labels, port, restartPolicy, serviceAccount, dryRun, output, tty, stdin }: { 
        name?: string;
        image: string;
        namespace?: string;
        command?: string[];
        args?: string[];
        env?: string[];
        labels?: Record<string, string>;
        port?: number;
        restartPolicy?: string;
        serviceAccount?: string;
        dryRun?: string;
        output?: string;
        tty?: boolean;
        stdin?: boolean;
      }) => {
        const ns = namespace || "default";
        const podName = name || `run-${Date.now().toString(36)}`;
        
        try {
          // Parse environment variables
          const containerEnv = env?.map((e) => {
            const [key, ...valueParts] = e.split("=");
            return { name: key, value: valueParts.join("=") };
          }) || [];
          
          const pod: k8s.V1Pod = {
            apiVersion: "v1",
            kind: "Pod",
            metadata: {
              name: podName,
              namespace: ns,
              labels: {
                run: podName,
                ...labels,
              },
            },
            spec: {
              restartPolicy: restartPolicy || "Always",
              ...(serviceAccount ? { serviceAccountName: serviceAccount } : {}),
              containers: [
                {
                  name: podName,
                  image,
                  ...(command ? { command } : {}),
                  ...(args ? { args } : {}),
                  ...(containerEnv.length > 0 ? { env: containerEnv } : {}),
                  ...(port ? { ports: [{ containerPort: port }] } : {}),
                  ...(tty || stdin ? { tty, stdin } : {}),
                },
              ],
            },
          };
          
          // Handle dry-run mode
          if (isClientDryRun(dryRun)) {
            return {
              ...formatClientDryRunCreate({ kind: "Pod", name: podName, namespace: ns, manifest: pod }),
              manifest: output === "json" ? JSON.stringify(pod, null, 2) : yaml.dump(pod),
            };
          }

          const coreApi = k8sClient.getCoreV1Api();
          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespacedPod({ namespace: ns, body: pod, ...createParams });

          return {
            success: true,
            dryRun: dryRun || "none",
            pod: podName,
            namespace: ns,
            image,
            status: result.status?.phase || "Pending",
            created: result.metadata?.creationTimestamp,
            message: `Pod ${podName} created successfully`,
            commands: {
              logs: `k8s_get_pod_logs({ name: "${podName}", namespace: "${ns}" })`,
              exec: `k8s_exec_pod({ podName: "${podName}", namespace: "${ns}", command: ["/bin/sh"] })`,
              delete: `k8s_delete({ resource: "pod", name: "${podName}", namespace: "${ns}" })`,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
      },
    },
    {
      tool: {
        name: "k8s_attach",
        description: "Attach to a running container (like kubectl attach). View output or interact with a running container.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Pod name",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            container: {
              type: "string",
              description: "Container name (defaults to first container)",
            },
            stdin: {
              type: "boolean",
              description: "Pass stdin to the container",
              default: false,
            },
            tty: {
              type: "boolean",
              description: "Allocate a TTY for the container",
              default: false,
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, container, stdin, tty }: { 
        name: string; 
        namespace?: string; 
        container?: string;
        stdin?: boolean;
        tty?: boolean;
      }) => {
        const ns = namespace || "default";
        
        try {
          const pod = await k8sClient.getPod(name, ns);
          const targetContainer = container || pod.spec?.containers?.[0]?.name;
          
          if (!targetContainer) {
            return { success: false, error: "No container found in pod" };
          }
          
          // For MCP, we provide the kubectl command as attachment requires WebSocket
          return {
            success: true,
            pod: name,
            namespace: ns,
            container: targetContainer,
            stdin: stdin || false,
            tty: tty || false,
            kubectlCommand: `kubectl attach ${name} -n ${ns} -c ${targetContainer}${stdin ? " -i" : ""}${tty ? " -t" : ""}`,
            note: "For interactive attachment, use the kubectl command. In MCP context, use k8s_exec_pod for command execution.",
            alternatives: [
              `k8s_exec_pod({ podName: "${name}", namespace: "${ns}", container: "${targetContainer}", command: ["/bin/sh"], stdin: true, tty: true })`,
              `k8s_get_pod_logs({ name: "${name}", namespace: "${ns}", container: "${targetContainer}", follow: true })`,
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
      },
    },
    {
      tool: {
        name: "k8s_debug_node",
        description: "Debug a node by creating a debug pod on it (like kubectl debug node). Creates a privileged pod on the target node for debugging.",
        inputSchema: {
          type: "object",
          properties: {
            node: {
              type: "string",
              description: "Node name to debug",
            },
            image: {
              type: "string",
              description: "Debug container image",
              default: "busybox:latest",
            },
            namespace: {
              type: "string",
              description: "Namespace for debug pod",
              default: "default",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description: "Command to run",
              default: ["sh"],
            },
            ...commonCreateQuerySchema,
          },
          required: ["node"],
        },
      },
      handler: async ({ node, image, namespace, command, dryRun }: {
        node: string;
        image?: string;
        namespace?: string;
        command?: string[];
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        const debugPodName = `node-debug-${node}-${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 63);
        
        try {
          const coreApi = k8sClient.getCoreV1Api();
          
          // Create a privileged debug pod that runs on the target node
          const debugPod: k8s.V1Pod = {
            apiVersion: "v1",
            kind: "Pod",
            metadata: {
              name: debugPodName,
              namespace: ns,
              labels: {
                app: "node-debug",
                targetNode: node,
              },
            },
            spec: {
              nodeName: node,
              hostNetwork: true,
              hostPID: true,
              hostIPC: true,
              containers: [
                {
                  name: "debugger",
                  image: image || "busybox:latest",
                  command: command || ["sh"],
                  securityContext: {
                    privileged: true,
                  },
                  volumeMounts: [
                    { name: "host-root", mountPath: "/host" },
                  ],
                },
              ],
              volumes: [
                {
                  name: "host-root",
                  hostPath: { path: "/" },
                },
              ],
              restartPolicy: "Never",
            },
          };

          if (isClientDryRun(dryRun)) {
            return {
              ...formatClientDryRunCreate({ kind: "Pod", name: debugPodName, namespace: ns, manifest: debugPod }),
              node,
              warnings: [
                "This pod runs in privileged mode",
                "Has access to host filesystem at /host",
                "Shares host network, PID, and IPC namespaces",
                "Delete when debugging is complete",
              ],
            };
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespacedPod({ namespace: ns, body: debugPod, ...createParams });

          return {
            success: true,
            dryRun: dryRun || "none",
            debugPod: debugPodName,
            node,
            namespace: ns,
            image: image || "busybox:latest",
            created: result.metadata?.creationTimestamp,
            message: `Debug pod ${debugPodName} created on node ${node}`,
            kubectlCommands: {
              exec: `kubectl exec -it ${debugPodName} -n ${ns} -- sh`,
              viewHost: `kubectl exec ${debugPodName} -n ${ns} -- ls /host`,
              delete: `kubectl delete pod ${debugPodName} -n ${ns}`,
            },
            note: "Debug pod has full host access. Use with caution in production.",
            warnings: [
              "This pod runs in privileged mode",
              "Has access to host filesystem at /host",
              "Shares host network, PID, and IPC namespaces",
              "Delete when debugging is complete",
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
      },
    },
  ];
}

function getPodIssues(pod: k8s.V1Pod): string[] {
  const issues: string[] = [];
  
  if (pod.status?.phase !== "Running" && pod.status?.phase !== "Succeeded") {
    issues.push(`Status: ${pod.status?.phase}`);
  }
  
  const containerStatuses = pod.status?.containerStatuses || [];
  for (const c of containerStatuses) {
    if (c.state?.waiting) {
      issues.push(`Container ${c.name} waiting: ${c.state.waiting.reason} - ${c.state.waiting.message}`);
    }
    if (c.state?.terminated && c.state.terminated.exitCode !== 0) {
      issues.push(`Container ${c.name} terminated with exit code ${c.state.terminated.exitCode}`);
    }
    if (c.restartCount && c.restartCount > 5) {
      issues.push(`Container ${c.name} has ${c.restartCount} restarts`);
    }
  }

  // Check init containers
  const initStatuses = pod.status?.initContainerStatuses || [];
  for (const c of initStatuses) {
    if (!c.ready) {
      issues.push(`Init container ${c.name} not ready`);
    }
  }

  return issues;
}

function generateSchedulingRecommendations(issues: any[], events: k8s.CoreV1Event[]): string[] {
  const recommendations: string[] = [];
  
  // Analyze events for common patterns
  const failedScheduling = events.some((e) => e.reason === "FailedScheduling");
  if (failedScheduling) {
    recommendations.push("Review FailedScheduling events - insufficient resources or constraints");
  }

  for (const issue of issues) {
    switch (issue.type) {
      case "nodeSelector":
        recommendations.push(`Verify nodes have matching labels for nodeSelector: ${JSON.stringify(issue.details)}`);
        break;
      case "affinity":
        recommendations.push("Check that affinity rules can be satisfied by available nodes");
        break;
      case "tolerations":
        recommendations.push("Verify nodes have the required taints that this pod can tolerate");
        break;
      case "resources":
        recommendations.push("Consider reducing resource requests or scaling up cluster capacity");
        break;
      case "storage":
        recommendations.push("Ensure PersistentVolumeClaims are created and bound");
        break;
    }
  }

  return recommendations;
}
