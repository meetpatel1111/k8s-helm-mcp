import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import * as yaml from "js-yaml";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace } from "../validators.js";
import { CacheManager } from "../cache-manager.js";
import { execFileSync } from "child_process";
import { scrubSensitiveData } from "../utils/secret-scrubber.js";
import { commonListQuerySchema, commonGetQuerySchema, applySortAndLimit, applyGetFormatting, isNotFoundError } from "../utils/query-helper.js";
import {
  commonMutationQuerySchema,
  isClientDryRun,
  isServerDryRun,
  formatClientDryRunMutation,
} from "../utils/safety-helper.js";

export function registerAdvancedTools(k8sClient: K8sClient, cacheManager?: CacheManager): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_cache_stats",
        description: "Get cache statistics including hit rate, miss rate, and total requests. Provides visibility into cache effectiveness.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        if (!cacheManager) {
          return {
            success: false,
            error: "Cache manager not available",
            message: "Cache statistics are not available in this configuration",
          };
        }
        
        try {
          const stats = cacheManager.getStats();
          return {
            success: true,
            statistics: stats,
            summary: {
              totalEntries: stats.size,
              hitRate: `${stats.hitRate.toFixed(2)}%`,
              missRate: `${stats.missRate.toFixed(2)}%`,
              totalRequests: stats.totalRequests,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_cache_stats" };
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
        name: "k8s_cache_clear",
        description: "Clear all cached entries and reset statistics. Use this to force fresh data retrieval.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        if (!cacheManager) {
          return {
            success: false,
            error: "Cache manager not available",
            message: "Cache operations are not available in this configuration",
          };
        }
        
        try {
          const statsBefore = cacheManager.getStats();
          cacheManager.clear();
          return {
            success: true,
            message: "Cache cleared successfully",
            clearedEntries: statsBefore.size,
            resetStatistics: {
              hits: statsBefore.hits,
              misses: statsBefore.misses,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_cache_clear" };
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
        name: "k8s_batch_get_resources",
        description: "Get multiple Kubernetes resources in parallel for improved performance. Supports Pod, Deployment, Service, ConfigMap, Secret, Node, Namespace, StatefulSet, DaemonSet, Job, CronJob, Ingress, PVC, PV, StorageClass, ServiceAccount, Role, ClusterRole, RoleBinding, ClusterRoleBinding.",
        inputSchema: {
          type: "object",
          properties: {
            resources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: {
                    type: "string",
                    description: "Resource kind (e.g., Pod, Deployment, Service)",
                  },
                  name: {
                    type: "string",
                    description: "Resource name",
                  },
                  namespace: {
                    type: "string",
                    description: "Resource namespace (defaults to 'default' for namespaced resources)",
                  },
                },
                required: ["kind", "name"],
              },
              description: "Array of resources to fetch",
            },
          },
          required: ["resources"],
        },
      },
      handler: async ({ resources }: { resources: { kind: string; name: string; namespace?: string }[] }) => {
        try {
          const results = await k8sClient.batchGetResources(resources);
          return {
            success: true,
            count: results.length,
            resources: results,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_batch_get_resources" };
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
        name: "k8s_kubectl",
        description: "Execute arbitrary kubectl command (fallback for unsupported operations). Use with caution - this is a generic tool for commands not covered by specific tools.",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "kubectl command to execute (without 'kubectl' prefix, e.g., 'get pods -o wide')",
            },
            namespace: {
              type: "string",
              description: "Namespace to use (optional, defaults to current context)",
            },
            context: {
              type: "string",
              description: "Kubeconfig context to use (optional)",
            },
            scrub: {
              type: "boolean",
              description: "Mask potential secrets in output (passwords, tokens, emails, IPs)",
              default: false,
            },
          },
          required: ["command"],
        },
      },
      handler: async ({ command, namespace, context, scrub }: { command: string; namespace?: string; context?: string; scrub?: boolean }) => {
        try {
          // Build kubectl command
          let kubectlArgs = command.split(' ');
          
          // Add namespace if specified
          if (namespace) {
            kubectlArgs = ['-n', namespace, ...kubectlArgs];
          }
          
          // Add context if specified
          if (context) {
            kubectlArgs = ['--context', context, ...kubectlArgs];
          }
          
          // Execute kubectl command
          let output = execFileSync('kubectl', kubectlArgs, {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          
          if (scrub) {
            output = scrubSensitiveData(output);
          }
          
          return {
            success: true,
            command: `kubectl ${kubectlArgs.join(' ')}`,
            output: output,
            scrubbed: scrub || false,
          };
        } catch (error: any) {
          const context: ErrorContext = { operation: "k8s_kubectl", details: { command } };
          const classified = classifyError(error, context);
          return { 
            success: false,
            command: `kubectl ${command}`,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
            stderr: error.stderr || error.message,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_raw_api_query",
        description: "Execute a raw API query against the Kubernetes API server",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "API path (e.g., /api/v1/nodes, /apis/apps/v1/deployments)",
            },
          },
          required: ["path"],
        },
      },
      handler: async ({ path }: { path: string }) => {
        try {
          const result = await k8sClient.rawApiRequest(path);
          return result;
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_raw_api_query", details: { path } };
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
        name: "k8s_analyze_pod_failure",
        description: "AI-style diagnosis of why a pod is failing",
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
        const ns = namespace || "default";
        
        try {
          validateResourceName(name, "pod");
          const [pod, events] = await Promise.all([
          k8sClient.getPod(name, ns),
          k8sClient.listEvents(ns, `involvedObject.name=${name}`),
        ]);

        const analysis: any = {
          pod: name,
          namespace: ns,
          status: pod.status?.phase,
          diagnosis: [],
          recommendations: [],
        };

        // Phase-based analysis
        switch (pod.status?.phase) {
          case "Pending":
            analysis.diagnosis.push("Pod is in Pending state - not yet scheduled or resources unavailable");
            
            // Check for scheduling issues
            const scheduledCondition = pod.status?.conditions?.find((c: k8s.V1PodCondition) => c.type === "PodScheduled");
            if (scheduledCondition?.status === "False") {
              analysis.diagnosis.push(`Scheduling failed: ${scheduledCondition.message}`);
              analysis.recommendations.push("Check node resources and pod resource requests");
              analysis.recommendations.push("Verify node selector and affinity rules match available nodes");
            }
            break;
            
          case "Failed":
            analysis.diagnosis.push("Pod has failed - check container exit codes");
            analysis.recommendations.push("Check pod logs for error messages");
            analysis.recommendations.push("Verify container image is accessible");
            break;
            
          case "Unknown":
            analysis.diagnosis.push("Pod status is unknown - node may be unreachable");
            analysis.recommendations.push("Check node status");
            break;
        }

        // Container state analysis
        const containerStatuses = pod.status?.containerStatuses || [];
        for (const cs of containerStatuses) {
          if (cs.state?.waiting) {
            const reason = cs.state.waiting.reason;
            const message = cs.state.waiting.message;
            
            analysis.diagnosis.push(`Container ${cs.name} waiting: ${reason}${message ? ` - ${message}` : ""}`);
            
            switch (reason) {
              case "CrashLoopBackOff":
                analysis.recommendations.push(`Container ${cs.name} is crashing. Check application logs and verify configuration`);
                analysis.recommendations.push(`Consider increasing memory/CPU limits if resource constraints are suspected`);
                break;
              case "ImagePullBackOff":
              case "ErrImagePull":
                analysis.recommendations.push(`Verify image name/tag for container ${cs.name} is correct`);
                analysis.recommendations.push(`Check image registry credentials and pull secrets`);
                break;
              case "CreateContainerConfigError":
                analysis.recommendations.push(`Check ConfigMap/Secret references for container ${cs.name}`);
                break;
              case "CreateContainerError":
                analysis.recommendations.push(`Check container runtime and node resources`);
                break;
              case "InvalidImageName":
                analysis.recommendations.push(`Fix invalid image name for container ${cs.name}`);
                break;
            }
          }
          
          if (cs.state?.terminated && cs.state.terminated.exitCode !== 0) {
            analysis.diagnosis.push(`Container ${cs.name} terminated with exit code ${cs.state.terminated.exitCode}`);
            analysis.recommendations.push(`Check container logs: k8s_get_pod_logs for ${name}`);
            if (cs.state.terminated.exitCode === 137) {
              analysis.recommendations.push("Exit code 137 indicates OOMKilled - consider increasing memory limit");
            }
            if (cs.state.terminated.exitCode === 1) {
              analysis.recommendations.push("Exit code 1 indicates application error - check application logs");
            }
          }
          
          if (cs.restartCount && cs.restartCount > 5) {
            analysis.diagnosis.push(`Container ${cs.name} has ${cs.restartCount} restarts`);
            analysis.recommendations.push("High restart count indicates instability - review application health checks");
          }
        }

        // Check init containers
        const initContainerStatuses = pod.status?.initContainerStatuses || [];
        for (const ics of initContainerStatuses) {
          if (!ics.ready) {
            analysis.diagnosis.push(`Init container ${ics.name} is not ready`);
            analysis.recommendations.push(`Check init container logs: k8s_get_pod_logs with container="${ics.name}"`);
          }
        }

        // Recent events
        const relevantEvents = events
          .filter((e: k8s.CoreV1Event) => e.type === "Warning")
          .slice(0, 5);
        
        if (relevantEvents.length > 0) {
          analysis.diagnosis.push(`${relevantEvents.length} recent warning events found`);
          analysis.recentWarnings = relevantEvents.map((e: k8s.CoreV1Event) => ({
            reason: e.reason,
            message: e.message,
            count: e.count,
          }));
        }

        // Resource analysis
        const containers = pod.spec?.containers || [];
        const resourceIssues = [];
        for (const c of containers) {
          if (!c.resources?.limits && !c.resources?.requests) {
            resourceIssues.push(`Container ${c.name} has no resource limits/requests`);
          }
          if (c.resources?.limits?.memory && !c.resources.requests?.memory) {
            resourceIssues.push(`Container ${c.name} has memory limit but no request`);
          }
        }
        
        if (resourceIssues.length > 0) {
          analysis.resourceWarnings = resourceIssues;
          analysis.recommendations.push("Consider adding resource requests/limits for better scheduling");
        }

        return analysis;
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_analyze_pod_failure", resource: name, namespace: ns };
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
        name: "k8s_suggest_optimizations",
        description: "Analyze resources and suggest optimizations",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to analyze",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const [pods, deployments, pvcs] = await Promise.all([
          k8sClient.listPods(namespace),
          k8sClient.listDeployments(namespace),
          k8sClient.listPVCs(namespace),
        ]);

        const suggestions: any[] = [];

        // Check for pods without resource limits
        const podsWithoutResources = pods.filter((p: k8s.V1Pod) => {
          return p.spec?.containers?.some((c: k8s.V1Container) => 
            !c.resources?.limits && !c.resources?.requests
          );
        });
        
        if (podsWithoutResources.length > 0) {
          suggestions.push({
            type: "resource-management",
            severity: "medium",
            description: `${podsWithoutResources.length} pods lack resource requests/limits`,
            recommendation: "Add resource requests/limits for predictable performance and better scheduling",
            affectedPods: podsWithoutResources.map((p: k8s.V1Pod) => `${p.metadata?.namespace}/${p.metadata?.name}`),
          });
        }

        // Check for deployments with single replicas and no PDB
        const singleReplicaDeployments = deployments.filter((d: k8s.V1Deployment) => 
          (d.spec?.replicas || 0) === 1
        );
        
        if (singleReplicaDeployments.length > 0) {
          suggestions.push({
            type: "high-availability",
            severity: "high",
            description: `${singleReplicaDeployments.length} deployments have only 1 replica`,
            recommendation: "Consider increasing replicas for high availability",
            affectedDeployments: singleReplicaDeployments.map((d: k8s.V1Deployment) => d.metadata?.name),
          });
        }

        // Check for unbound PVCs
        const unboundPVCs = pvcs.filter((p: k8s.V1PersistentVolumeClaim) => p.status?.phase !== "Bound");
        if (unboundPVCs.length > 0) {
          suggestions.push({
            type: "storage",
            severity: "high",
            description: `${unboundPVCs.length} PVCs are not bound`,
            recommendation: "Check StorageClass configuration and PV availability",
            affectedPVCs: unboundPVCs.map((p: k8s.V1PersistentVolumeClaim) => `${p.metadata?.namespace}/${p.metadata?.name}`),
          });
        }

        // Find pods with high restart counts
        const unstablePods = pods.filter((p: k8s.V1Pod) => {
          const restartCount = p.status?.containerStatuses?.reduce(
            (sum: number, c: k8s.V1ContainerStatus) => sum + (c.restartCount || 0), 0
          );
          return (restartCount || 0) > 5;
        });
        
        if (unstablePods.length > 0) {
          suggestions.push({
            type: "stability",
            severity: "high",
            description: `${unstablePods.length} pods have high restart counts`,
            recommendation: "Investigate application stability and resource constraints",
            affectedPods: unstablePods.map((p: k8s.V1Pod) => ({
              name: `${p.metadata?.namespace}/${p.metadata?.name}`,
              restarts: p.status?.containerStatuses?.reduce(
                (sum: number, c: k8s.V1ContainerStatus) => sum + (c.restartCount || 0), 0
              ),
            })),
          });
        }

        return {
          summary: {
            totalSuggestions: suggestions.length,
            highSeverity: suggestions.filter((s) => s.severity === "high").length,
            mediumSeverity: suggestions.filter((s) => s.severity === "medium").length,
          },
          suggestions,
        };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_suggest_optimizations", namespace };
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
        name: "k8s_bulk_delete_pods",
        description: "Delete multiple pods matching criteria",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace (required)",
            },
            labelSelector: {
              type: "string",
              description: "Label selector to match pods",
            },
            status: {
              type: "string",
              description: "Filter by pod status (e.g., Failed, Evicted)",
            },
            dryRun: {
              type: "string",
              enum: ["none", "client", "server"],
              description: "Dry-run mode: 'client' previews matched pods without calling the API, 'server' validates deletion via the API without persisting",
              default: "none",
            },
          },
          required: ["namespace"],
        },
      },
      handler: async ({ namespace, labelSelector, status, dryRun }: { 
        namespace: string;
        labelSelector?: string;
        status?: string;
        dryRun?: string;
      }) => {
        try {
          validateNamespace(namespace);
          const serverDryRun = isServerDryRun(dryRun);
          const coreApi = k8sClient.getCoreV1Api();
          const response = await coreApi.listNamespacedPod({
            namespace,
            fieldSelector: status ? `status.phase=${status}` : undefined,
            labelSelector
          });
          
          const pods = response.items;
          
          if (pods.length === 0) {
            return {
              matched: 0,
              deleted: 0,
              message: "No pods matched the criteria",
            };
          }

          if (isClientDryRun(dryRun)) {
            return {
              dryRun: "client",
              matched: pods.length,
              wouldDelete: pods.map((p: k8s.V1Pod) => ({
                name: p.metadata?.name,
                status: p.status?.phase,
              })),
              message: `${pods.length} pods would be deleted (client dry-run)`,
            };
          }

          let deleted = 0;
          const failed: string[] = [];

          for (const pod of pods) {
            try {
              await coreApi.deleteNamespacedPod({ name: pod.metadata?.name || "", namespace, ...(serverDryRun ? { dryRun: "All" } : {}) });
              deleted++;
            } catch (error) {
              failed.push(pod.metadata?.name || "");
            }
          }

          return {
            matched: pods.length,
            deleted,
            failed,
            dryRun: dryRun || "none",
            message: serverDryRun
              ? `${deleted} of ${pods.length} pods validated for deletion (server dry-run)`
              : `Deleted ${deleted} of ${pods.length} pods`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_bulk_delete_pods", namespace };
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
        name: "k8s_find_orphaned_resources",
        description: "Find resources that may be orphaned or unused",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to analyze",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const [pods, services, pvcs, configMaps] = await Promise.all([
          k8sClient.listPods(namespace),
          k8sClient.listServices(namespace),
          k8sClient.listPVCs(namespace),
          k8sClient.listConfigMaps(namespace),
        ]);

        const findings: any[] = [];

        // Find services with no endpoints (no matching pods)
        const coreApi = k8sClient.getCoreV1Api();
        for (const svc of services) {
          const selector = svc.spec?.selector || {};
          const matchingPods = pods.filter((p: k8s.V1Pod) => {
            const labels = p.metadata?.labels || {};
            return Object.entries(selector).every(([k, v]) => labels[k] === v);
          });
          
          if (matchingPods.length === 0 && svc.spec?.type !== "ExternalName") {
            findings.push({
              type: "service-no-endpoints",
              resource: `Service/${svc.metadata?.namespace}/${svc.metadata?.name}`,
              description: "Service has no matching pods",
              selector,
            });
          }
        }

        // Find unbound PVCs
        const unboundPVCs = pvcs.filter((p: k8s.V1PersistentVolumeClaim) => p.status?.phase !== "Bound");
        for (const pvc of unboundPVCs) {
          findings.push({
            type: "pvc-unbound",
            resource: `PVC/${pvc.metadata?.namespace}/${pvc.metadata?.name}`,
            description: `PVC is ${pvc.status?.phase}`,
          });
        }

        // Find ConfigMaps not referenced by any pod
        const usedConfigMaps = new Set<string>();
        for (const pod of pods) {
          const volumes = pod.spec?.volumes || [];
          for (const vol of volumes) {
            if (vol.configMap?.name) {
              usedConfigMaps.add(vol.configMap.name);
            }
          }
          
          const containers = [...(pod.spec?.containers || []), ...(pod.spec?.initContainers || [])];
          for (const c of containers) {
            for (const env of c.env || []) {
              if (env.valueFrom?.configMapKeyRef?.name) {
                usedConfigMaps.add(env.valueFrom.configMapKeyRef.name);
              }
            }
            for (const envFrom of c.envFrom || []) {
              if (envFrom.configMapRef?.name) {
                usedConfigMaps.add(envFrom.configMapRef.name);
              }
            }
          }
        }

        const unusedConfigMaps = configMaps.filter((cm: k8s.V1ConfigMap) => 
          !usedConfigMaps.has(cm.metadata?.name || "")
        );

        if (unusedConfigMaps.length > 0) {
          findings.push({
            type: "configmap-unused",
            count: unusedConfigMaps.length,
            resources: unusedConfigMaps.map((cm: k8s.V1ConfigMap) => 
              `ConfigMap/${cm.metadata?.namespace}/${cm.metadata?.name}`
            ),
            description: "ConfigMaps not referenced by any pod",
          });
        }

        return {
          totalFindings: findings.length,
          findings,
        };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_find_orphaned_resources", namespace };
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
        name: "k8s_explain",
        description: "Show resource documentation and schema (like kubectl explain)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (e.g., pod, deployment, service)",
            },
            field: {
              type: "string",
              description: "Specific field path (e.g., spec.containers)",
            },
          },
          required: ["resource"],
        },
      },
      handler: async ({ resource, field }: { resource: string; field?: string }) => {
        try {
          // Resource documentation map
          const docs: Record<string, any> = {
          pod: {
            apiVersion: "v1",
            kind: "Pod",
            description: "Pod is a collection of containers that can run on a host.",
            fields: {
              "apiVersion": "string - APIVersion defines the versioned schema",
              "kind": "string - Kind is a string value representing the REST resource",
              "metadata": "ObjectMeta - Standard object metadata",
              "spec": {
                description: "PodSpec is a description of a pod",
                fields: {
                  "containers": "array - List of containers belonging to the pod",
                  "initContainers": "array - List of initialization containers",
                  "restartPolicy": "string - Restart policy (Always, OnFailure, Never)",
                  "nodeSelector": "object - Selector for scheduling on specific nodes",
                  "serviceAccountName": "string - ServiceAccount to attach to pod",
                  "volumes": "array - List of volumes that can be mounted",
                },
              },
              "status": "PodStatus - Current status of the pod",
            },
          },
          deployment: {
            apiVersion: "apps/v1",
            kind: "Deployment",
            description: "Deployment enables declarative updates for Pods and ReplicaSets.",
            fields: {
              "apiVersion": "string - APIVersion defines the versioned schema",
              "kind": "string - Kind is a string value representing the REST resource",
              "metadata": "ObjectMeta - Standard object metadata",
              "spec": {
                description: "DeploymentSpec is the specification of the desired behavior",
                fields: {
                  "replicas": "integer - Number of desired pods",
                  "selector": "LabelSelector - Label selector for pods",
                  "template": "PodTemplateSpec - Template for pod creation",
                  "strategy": "DeploymentStrategy - Strategy for rolling updates",
                },
              },
            },
          },
          service: {
            apiVersion: "v1",
            kind: "Service",
            description: "Service is an abstraction which defines a logical set of pods.",
            fields: {
              "apiVersion": "string - APIVersion defines the versioned schema",
              "kind": "string - Kind is a string value representing the REST resource",
              "metadata": "ObjectMeta - Standard object metadata",
              "spec": {
                description: "ServiceSpec describes the attributes of a service",
                fields: {
                  "selector": "object - Route traffic to pods with these labels",
                  "ports": "array - List of service ports",
                  "type": "string - Service type (ClusterIP, NodePort, LoadBalancer, ExternalName)",
                  "clusterIP": "string - Internal cluster IP",
                },
              },
            },
          },
          configmap: {
            apiVersion: "v1",
            kind: "ConfigMap",
            description: "ConfigMap holds configuration data for pods to consume.",
            fields: {
              "data": "object - Configuration data key-value pairs",
              "binaryData": "object - Binary data as base64-encoded strings",
              "immutable": "boolean - If true, prevents updates to the configmap",
            },
          },
          secret: {
            apiVersion: "v1",
            kind: "Secret",
            description: "Secret holds sensitive information such as passwords.",
            fields: {
              "type": "string - Type of secret (Opaque, kubernetes.io/tls, etc.)",
              "data": "object - Secret data base64 encoded",
              "stringData": "object - Secret data as plain strings (write-only)",
              "immutable": "boolean - If true, prevents updates to the secret",
            },
          },
          job: {
            apiVersion: "batch/v1",
            kind: "Job",
            description: "Job represents the configuration of a single job.",
            fields: {
              "spec": {
                description: "JobSpec describes how the job execution will look like",
                fields: {
                  "parallelism": "integer - Number of pods to run in parallel",
                  "completions": "integer - Number of successful completions needed",
                  "activeDeadlineSeconds": "integer - Duration of job before terminating",
                  "template": "PodTemplateSpec - Template for pod creation",
                },
              },
            },
          },
        };

        const resourceDoc = docs[resource.toLowerCase()];
        
        if (!resourceDoc) {
          return {
            availableResources: Object.keys(docs),
            error: `Documentation for '${resource}' not found. Available resources: ${Object.keys(docs).join(", ")}`,
          };
        }

        if (field) {
          // Navigate to specific field
          const fieldPath = field.split(".");
          let current: any = resourceDoc;
          for (const part of fieldPath) {
            current = current?.fields?.[part] || current?.[part];
            if (!current) {
              return { error: `Field '${field}' not found in ${resource}` };
            }
          }
          return {
            resource,
            field,
            documentation: current,
          };
        }

        return {
          resource,
          documentation: resourceDoc,
        };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_explain", resource };
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
        name: "k8s_api_resources",
        description: "List available API resources (like kubectl api-resources). Supports filtering by namespaced, verbs, API group, and output formats.",
        inputSchema: {
          type: "object",
          properties: {
            namespaced: {
              type: "boolean",
              description: "Filter to namespaced or cluster-scoped resources",
            },
            verbs: {
              type: "array",
              items: { type: "string" },
              description: "Filter by supported verbs (e.g., list, get)",
            },
            apiGroup: {
              type: "string",
              description: "Filter by API group (e.g., 'apps', 'extensions', 'rbac.authorization.k8s.io')",
            },
            output: {
              type: "string",
              description: "Output format",
              enum: ["standard", "name", "wide"],
              default: "standard",
            },
          },
        },
      },
      handler: async ({ namespaced, verbs, apiGroup, output }: { namespaced?: boolean; verbs?: string[]; apiGroup?: string; output?: string }) => {
        try {
          // Common Kubernetes API resources
          const apiResources = [
          { name: "pods", shortnames: ["po"], namespaced: true, kind: "Pod", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "services", shortnames: ["svc"], namespaced: true, kind: "Service", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "configmaps", shortnames: ["cm"], namespaced: true, kind: "ConfigMap", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "secrets", shortnames: [], namespaced: true, kind: "Secret", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "persistentvolumeclaims", shortnames: ["pvc"], namespaced: true, kind: "PersistentVolumeClaim", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "persistentvolumes", shortnames: ["pv"], namespaced: false, kind: "PersistentVolume", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "namespaces", shortnames: ["ns"], namespaced: false, kind: "Namespace", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "get", "list", "patch", "update", "watch"] },
          { name: "deployments", shortnames: ["deploy"], namespaced: true, kind: "Deployment", apiVersion: "apps/v1", apiGroup: "apps", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "replicasets", shortnames: ["rs"], namespaced: true, kind: "ReplicaSet", apiVersion: "apps/v1", apiGroup: "apps", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "statefulsets", shortnames: ["sts"], namespaced: true, kind: "StatefulSet", apiVersion: "apps/v1", apiGroup: "apps", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "daemonsets", shortnames: ["ds"], namespaced: true, kind: "DaemonSet", apiVersion: "apps/v1", apiGroup: "apps", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "jobs", shortnames: [], namespaced: true, kind: "Job", apiVersion: "batch/v1", apiGroup: "batch", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "cronjobs", shortnames: ["cj"], namespaced: true, kind: "CronJob", apiVersion: "batch/v1", apiGroup: "batch", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "ingresses", shortnames: ["ing"], namespaced: true, kind: "Ingress", apiVersion: "networking.k8s.io/v1", apiGroup: "networking.k8s.io", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "networkpolicies", shortnames: ["netpol"], namespaced: true, kind: "NetworkPolicy", apiVersion: "networking.k8s.io/v1", apiGroup: "networking.k8s.io", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "serviceaccounts", shortnames: ["sa"], namespaced: true, kind: "ServiceAccount", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "roles", shortnames: [], namespaced: true, kind: "Role", apiVersion: "rbac.authorization.k8s.io/v1", apiGroup: "rbac.authorization.k8s.io", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "rolebindings", shortnames: [], namespaced: true, kind: "RoleBinding", apiVersion: "rbac.authorization.k8s.io/v1", apiGroup: "rbac.authorization.k8s.io", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "clusterroles", shortnames: [], namespaced: false, kind: "ClusterRole", apiVersion: "rbac.authorization.k8s.io/v1", apiGroup: "rbac.authorization.k8s.io", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "clusterrolebindings", shortnames: [], namespaced: false, kind: "ClusterRoleBinding", apiVersion: "rbac.authorization.k8s.io/v1", apiGroup: "rbac.authorization.k8s.io", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "storageclasses", shortnames: ["sc"], namespaced: false, kind: "StorageClass", apiVersion: "storage.k8s.io/v1", apiGroup: "storage.k8s.io", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "events", shortnames: ["ev"], namespaced: true, kind: "Event", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "nodes", shortnames: ["no"], namespaced: false, kind: "Node", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
          { name: "endpoints", shortnames: ["ep"], namespaced: true, kind: "Endpoints", apiVersion: "v1", apiGroup: "", verbs: ["create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"] },
        ];

        let filtered = apiResources;

        // Filter by namespaced
        if (namespaced !== undefined) {
          filtered = filtered.filter((r) => r.namespaced === namespaced);
        }

        // Filter by verbs
        if (verbs && verbs.length > 0) {
          filtered = filtered.filter((r) => verbs.every((v) => r.verbs.includes(v)));
        }

        // Filter by API group
        if (apiGroup) {
          filtered = filtered.filter((r) => r.apiGroup === apiGroup);
        }

        // Format output based on requested format
        let resources;
        switch (output) {
          case "name":
            // Simple output - just resource names
            resources = filtered.map((r) => r.name);
            return {
              resources,
              total: filtered.length,
              output: "name",
              filters: {
                namespaced,
                verbs,
                apiGroup,
              },
            };
          
          case "wide":
            // Expanded output with all details
            resources = filtered.map((r) => ({
              name: r.name,
              shortnames: r.shortnames,
              apiGroup: r.apiGroup || "core",
              apiVersion: r.apiVersion,
              namespaced: r.namespaced,
              kind: r.kind,
              verbs: r.verbs,
            }));
            return {
              resources,
              total: filtered.length,
              output: "wide",
              filters: {
                namespaced,
                verbs,
                apiGroup,
              },
              summary: {
                namespaced: filtered.filter((r) => r.namespaced).length,
                clusterScoped: filtered.filter((r) => !r.namespaced).length,
              },
            };
          
          default:
            // Standard output (default)
            resources = filtered.map((r) => ({
              name: r.name,
              shortnames: r.shortnames,
              apiGroup: r.apiGroup || "core",
              namespaced: r.namespaced,
              kind: r.kind,
            }));
            return {
              resources,
              total: filtered.length,
              output: "standard",
              filters: {
                namespaced,
                verbs,
                apiGroup,
              },
              summary: {
                namespaced: filtered.filter((r) => r.namespaced).length,
                clusterScoped: filtered.filter((r) => !r.namespaced).length,
              },
            };
        }
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_api_resources" };
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
        name: "k8s_get_sorted",
        description: "Get resources sorted by a specific field (like kubectl get --sort-by)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pods, services, nodes, etc.)",
            },
            namespace: {
              type: "string",
              description: "Namespace (for namespaced resources)",
            },
            sortBy: {
              type: "string",
              description: "Field to sort by (e.g., .metadata.name, .status.phase, .metadata.creationTimestamp)",
            },
            descending: {
              type: "boolean",
              description: "Sort in descending order",
              default: false,
            },
          },
          required: ["resource", "sortBy"],
        },
      },
      handler: async ({ resource, namespace, sortBy, descending }: { 
        resource: string; 
        namespace?: string; 
        sortBy: string;
        descending?: boolean;
      }) => {
        try {
          // Get resources based on type
          let items: any[] = [];
          const ns = namespace || "default";
          
          switch (resource.toLowerCase()) {
            case "pods":
            case "pod":
              items = await k8sClient.listPods(namespace);
              break;
            case "services":
            case "svc":
            case "service":
              items = await k8sClient.listServices(namespace);
              break;
            case "nodes":
            case "node":
              items = await k8sClient.listNodes();
              break;
            case "deployments":
            case "deployment":
              items = await k8sClient.listDeployments(namespace);
              break;
            case "pvs":
            case "persistentvolumes":
            case "persistentvolume":
              items = await k8sClient.listPVs();
              break;
            case "pvcs":
            case "persistentvolumeclaims":
            case "persistentvolumeclaim":
              items = await k8sClient.listPVCs(namespace);
              break;
            case "jobs":
            case "job":
              items = await k8sClient.listJobs(namespace);
              break;
            default:
              return { error: `Sorting for resource '${resource}' not supported` };
          }
          
          // Sort by the specified field
          const sorted = [...items].sort((a, b) => {
            const valA = getFieldValue(a, sortBy);
            const valB = getFieldValue(b, sortBy);
            
            if (valA < valB) return descending ? 1 : -1;
            if (valA > valB) return descending ? -1 : 1;
            return 0;
          });
          
          return {
            resource,
            total: sorted.length,
            sortBy,
            descending: descending || false,
            items: sorted.map((item) => ({
              name: item.metadata?.name,
              namespace: item.metadata?.namespace,
              sortValue: getFieldValue(item, sortBy),
              created: item.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_sorted", namespace };
          const classified = classifyError(error, context);
          return { 
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
        
        function getFieldValue(obj: any, path: string): any {
          const parts = path.replace(/^\./, "").split(".");
          let current = obj;
          for (const part of parts) {
            if (current === null || current === undefined) return "";
            // Handle array index notation like containerStatuses[0]
            const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
            if (arrayMatch) {
              current = current[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
            } else {
              current = current[part];
            }
          }
          return current || "";
        }
      },
    },
    {
      tool: {
        name: "k8s_get_jsonpath",
        description: "Extract data using JSONPath expression (like kubectl -o jsonpath)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type",
            },
            name: {
              type: "string",
              description: "Resource name (optional, gets all if not specified)",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            jsonpath: {
              type: "string",
              description: "JSONPath expression (e.g., {.metadata.name}, {.items[*].metadata.name})",
            },
          },
          required: ["resource", "jsonpath"],
        },
      },
      handler: async ({ resource, name, namespace, jsonpath }: { 
        resource: string; 
        name?: string; 
        namespace?: string;
        jsonpath: string;
      }) => {
        try {
          let data: any;
          const ns = namespace || "default";
          
          // Get the resource data
          switch (resource.toLowerCase()) {
            case "pod":
            case "pods":
              if (name) {
                data = await k8sClient.getPod(name, ns);
              } else {
                data = { items: await k8sClient.listPods(namespace) };
              }
              break;
            case "node":
            case "nodes":
              if (name) {
                data = await k8sClient.getNode(name);
              } else {
                data = { items: await k8sClient.listNodes() };
              }
              break;
            case "deployment":
            case "deployments":
              if (name) {
                data = await k8sClient.getDeployment(name, ns);
              } else {
                data = { items: await k8sClient.listDeployments(namespace) };
              }
              break;
            case "service":
            case "services":
            case "svc":
              if (name) {
                const coreApi = k8sClient.getCoreV1Api();
                const result = await coreApi.readNamespacedService({ name, namespace: ns });
                data = result;
              } else {
                data = { items: await k8sClient.listServices(namespace) };
              }
              break;
            case "configmap":
            case "configmaps":
            case "cm":
              if (name) {
                const coreApi = k8sClient.getCoreV1Api();
                const result = await coreApi.readNamespacedConfigMap({ name, namespace: ns });
                data = result;
              } else {
                data = { items: await k8sClient.listConfigMaps(namespace) };
              }
              break;
            case "secret":
            case "secrets":
              if (name) {
                const coreApi = k8sClient.getCoreV1Api();
                const result = await coreApi.readNamespacedSecret({ name, namespace: ns });
                data = result;
              } else {
                data = { items: await k8sClient.listSecrets(namespace) };
              }
              break;
            default:
              return { error: `JSONPath for resource '${resource}' not supported` };
          }
          
          // Simple JSONPath evaluation
          const result = evaluateJsonPath(data, jsonpath);
          
          return {
            resource,
            name,
            namespace: ns,
            jsonpath,
            result,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_jsonpath", resource, namespace };
          const classified = classifyError(error, context);
          return { 
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
        
        function evaluateJsonPath(obj: any, path: string): any {
          // Simple JSONPath implementation for common patterns
          path = path.replace(/^\{/, "").replace(/\}$/, "");
          
          // Handle {.items[*].field} pattern
          const itemsMatch = path.match(/^\.items\[\*\]\.(.+)$/);
          if (itemsMatch) {
            const field = itemsMatch[1];
            return obj.items?.map((item: any) => getValue(item, field));
          }
          
          // Handle {.items[?(@.selector)].name} - filter pattern
          const filterMatch = path.match(/^\.items\[\?\(@\.(.+?)\)\]\.(.+)$/);
          if (filterMatch) {
            const filterField = filterMatch[1];
            const resultField = filterMatch[2];
            return obj.items
              ?.filter((item: any) => getValue(item, filterField))
              .map((item: any) => getValue(item, resultField));
          }
          
          // Simple dot notation
          if (path.startsWith(".")) {
            return getValue(obj, path.substring(1));
          }
          
          return obj;
          
          function getValue(obj: any, path: string): any {
            const parts = path.split(".");
            let current = obj;
            for (const part of parts) {
              if (current === null || current === undefined) return undefined;
              current = current[part];
            }
            return current;
          }
        }
      },
    },
    {
      tool: {
        name: "k8s_get_custom_columns",
        description: "Get resources with custom column output (like kubectl -o custom-columns)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pods, nodes, services, etc.)",
            },
            namespace: {
              type: "string",
              description: "Namespace (for namespaced resources)",
            },
            columns: {
              type: "array",
              items: { type: "string" },
              description: "Custom columns (format: NAME:JSONPATH, e.g., NAME:.metadata.name, STATUS:.status.phase)",
            },
          },
          required: ["resource", "columns"],
        },
      },
      handler: async ({ resource, namespace, columns }: { 
        resource: string; 
        namespace?: string;
        columns: string[];
      }) => {
        try {
          let items: any[] = [];
          
          // Get resources
          switch (resource.toLowerCase()) {
            case "pods":
            case "pod":
              items = await k8sClient.listPods(namespace);
              break;
            case "nodes":
            case "node":
              items = await k8sClient.listNodes();
              break;
            case "services":
            case "service":
            case "svc":
              items = await k8sClient.listServices(namespace);
              break;
            case "deployments":
            case "deployment":
              items = await k8sClient.listDeployments(namespace);
              break;
            default:
              return { error: `Custom columns for resource '${resource}' not supported` };
          }
          
          // Parse column definitions
          const columnDefs = columns.map((col) => {
            const parts = col.split(":");
            return {
              name: parts[0],
              path: parts.slice(1).join(":").replace(/^\./, ""),
            };
          });
          
          // Transform items
          const rows = items.map((item) => {
            const row: Record<string, any> = {};
            columnDefs.forEach((col) => {
              row[col.name] = getValue(item, col.path);
            });
            return row;
          });
          
          return {
            resource,
            total: rows.length,
            columns: columnDefs.map((c) => c.name),
            rows,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_custom_columns", resource, namespace };
          const classified = classifyError(error, context);
          return { 
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
        
        function getValue(obj: any, path: string): any {
          const parts = path.split(".");
          let current = obj;
          for (const part of parts) {
            if (current === null || current === undefined) return "<none>";
            // Handle bracket notation
            const match = part.match(/^([^\[]+)\[(\d+)\]$/);
            if (match) {
              current = current[match[1]]?.[parseInt(match[2])];
            } else {
              current = current[part];
            }
          }
          return current ?? "<none>";
        }
      },
    },
    {
      tool: {
        name: "k8s_get_with_labels",
        description: "Get resources with their labels displayed (like kubectl get --show-labels)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pods, nodes, services, etc.)",
            },
            namespace: {
              type: "string",
              description: "Namespace",
            },
            selector: {
              type: "string",
              description: "Label selector (e.g., app=nginx, env=prod)",
            },
          },
          required: ["resource"],
        },
      },
      handler: async ({ resource, namespace, selector }: { 
        resource: string; 
        namespace?: string;
        selector?: string;
      }) => {
        try {
          let items: any[] = [];
          
          // Get resources
          switch (resource.toLowerCase()) {
            case "pods":
            case "pod":
              items = await k8sClient.listPods(namespace);
              break;
            case "nodes":
            case "node":
              items = await k8sClient.listNodes();
              break;
            case "services":
            case "service":
            case "svc":
              items = await k8sClient.listServices(namespace);
              break;
            case "deployments":
            case "deployment":
              items = await k8sClient.listDeployments(namespace);
              break;
            default:
              return { error: `Labels display for resource '${resource}' not supported` };
          }
          
          // Filter by selector if provided
          if (selector) {
            const selectors = selector.split(",").map((s) => {
              const [key, value] = s.split("=");
              return { key: key.trim(), value: value?.trim() };
            });
            items = items.filter((item) => {
              const labels = item.metadata?.labels || {};
              return selectors.every((sel) => labels[sel.key] === sel.value);
            });
          }
          
          // Format with labels
          const rows = items.map((item) => ({
            name: item.metadata?.name,
            namespace: item.metadata?.namespace,
            labels: item.metadata?.labels || {},
            status: item.status?.phase || getNodeStatus(item),
            age: item.metadata?.creationTimestamp,
          }));
          
          return {
            resource,
            total: rows.length,
            selector,
            rows,
          };
          
          function getNodeStatus(node: any): string {
            const conditions = node.status?.conditions || [];
            const ready = conditions.find((c: any) => c.type === "Ready");
            return ready?.status === "True" ? "Ready" : "NotReady";
          }
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_with_labels", resource, namespace };
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
        name: "k8s_patch",
        description: "Patch a resource with JSON or merge patch (like kubectl patch)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, node, service, etc.)",
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
            patch: {
              type: "string",
              description: "JSON patch content (object or JSON string)",
            },
            patchType: {
              type: "string",
              description: "Patch type",
              enum: ["strategic", "merge", "json"],
              default: "strategic",
            },
            subresource: {
              type: "string",
              description: "Subresource to patch (e.g., 'scale', 'status')",
            },
            ...commonMutationQuerySchema,
          },
          required: ["resource", "name", "patch"],
        },
      },
      handler: async ({ resource, name, namespace, patch, patchType, subresource, dryRun }: { 
        resource: string; 
        name: string; 
        namespace?: string;
        patch: string | object;
        patchType?: string;
        subresource?: string;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        // Parse patch if it's a string (declare outside try for catch block access)
        const patchData = typeof patch === "string" ? JSON.parse(patch) : patch;

        if (isClientDryRun(dryRun)) {
          return formatClientDryRunMutation({
            operation: "Patch resource",
            kind: resource,
            name,
            namespace: ns,
            patch: patchData,
            details: { patchType: patchType || "strategic", subresource },
          });
        }
        
        try {
          // Determine content type based on patch type
          let contentType = "application/strategic-merge-patch+json";
          if (patchType === "merge") {
            contentType = "application/merge-patch+json";
          } else if (patchType === "json") {
            contentType = "application/json-patch+json";
          }
          
          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          
          let result: any;
          
          switch (resource.toLowerCase()) {
            case "pod":
            case "pods":
              result = await coreApi.patchNamespacedPod({
                name,
                namespace: ns,
                body: patchData,
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: (context: k8s.RequestContext) => {
                    context.setHeaderParam("Content-Type", contentType);
                    return Promise.resolve(context);
                  },
                  post: (response: k8s.ResponseContext) => Promise.resolve(response)
                }]
              } as any);
              break;
              
            case "deployment":
            case "deployments":
              if (subresource === "scale") {
                // Handle scale subresource specially
                const scaleApi = (k8sClient as any).kc.makeApiClient(k8s.AutoscalingV1Api);
                result = await scaleApi.patchNamespacedDeploymentScale({
                  name,
                  namespace: ns,
                  body: patchData,
                  dryRun: serverDryRunParam,
                }, {
                  middleware: [{
                    pre: (context: k8s.RequestContext) => {
                      context.setHeaderParam("Content-Type", contentType);
                      return Promise.resolve(context);
                    },
                    post: (response: k8s.ResponseContext) => Promise.resolve(response)
                  }]
                } as any);
              } else {
                result = await appsApi.patchNamespacedDeployment({
                  name,
                  namespace: ns,
                  body: patchData,
                  dryRun: serverDryRunParam,
                }, {
                  middleware: [{
                    pre: (context: k8s.RequestContext) => {
                      context.setHeaderParam("Content-Type", contentType);
                      return Promise.resolve(context);
                    },
                    post: (response: k8s.ResponseContext) => Promise.resolve(response)
                  }]
                } as any);
              }
              break;
              
            case "node":
            case "nodes":
              result = await k8sClient.patchNode(name, patchData, { dryRun: serverDryRunParam });
              break;
              
            case "service":
            case "services":
            case "svc":
              result = await coreApi.patchNamespacedService({
                name,
                namespace: ns,
                body: patchData,
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: (context: k8s.RequestContext) => {
                    context.setHeaderParam("Content-Type", contentType);
                    return Promise.resolve(context);
                  },
                  post: (response: k8s.ResponseContext) => Promise.resolve(response)
                }]
              } as any);
              break;
              
            case "configmap":
            case "configmaps":
            case "cm":
              result = await coreApi.patchNamespacedConfigMap({
                name,
                namespace: ns,
                body: patchData,
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: (context: k8s.RequestContext) => {
                    context.setHeaderParam("Content-Type", contentType);
                    return Promise.resolve(context);
                  },
                  post: (response: k8s.ResponseContext) => Promise.resolve(response)
                }]
              } as any);
              break;
              
            case "secret":
            case "secrets":
              result = await coreApi.patchNamespacedSecret({
                name,
                namespace: ns,
                body: patchData,
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: (context: k8s.RequestContext) => {
                    context.setHeaderParam("Content-Type", contentType);
                    return Promise.resolve(context);
                  },
                  post: (response: k8s.ResponseContext) => Promise.resolve(response)
                }]
              } as any);
              break;
              
            case "serviceaccount":
            case "sa":
            case "serviceaccounts":
              result = await coreApi.patchNamespacedServiceAccount({
                name,
                namespace: ns,
                body: patchData,
                dryRun: serverDryRunParam,
              }, {
                middleware: [{
                  pre: (context: k8s.RequestContext) => {
                    context.setHeaderParam("Content-Type", contentType);
                    return Promise.resolve(context);
                  },
                  post: (response: k8s.ResponseContext) => Promise.resolve(response)
                }]
              } as any);
              break;
              
            default:
              return { 
                success: false, 
                error: `Patch not supported for ${resource}. Use k8s_apply_manifest or implement specific patch.` 
              };
          }
          
          return {
            success: true,
            dryRun: dryRun || "none",
            resource: `${resource}/${name}`,
            namespace: ns,
            patchType: patchType || "strategic",
            subresource,
            patched: result ? "success" : "unknown",
            message: `Patched ${resource}/${name}${subresource ? `/${subresource}` : ""}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_patch", resource: name, namespace: ns };
          const classified = classifyError(error, context);
          
          // If strategic merge patch fails and patchType is strategic, try fallback to merge patch
          if (patchType === "strategic" && classified.type === "validation") {
            try {
              let contentType = "application/merge-patch+json";
              const coreApi = k8sClient.getCoreV1Api();
              const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
              const serverDryRunParam = dryRun === "server" ? "All" : undefined;
              let result: any;
              
              const patchOptions = {
                middleware: [{
                  pre: async (context: any) => {
                    context.setHeaderParam("Content-Type", contentType);
                    return context;
                  },
                  post: async (response: any) => response
                }]
              } as any;
              
              switch (resource.toLowerCase()) {
                case "pod":
                case "pods":
                  result = await coreApi.patchNamespacedPod({ name, namespace: ns, body: patchData, dryRun: serverDryRunParam }, patchOptions);
                  break;
                case "deployment":
                case "deployments":
                  result = await appsApi.patchNamespacedDeployment({ name, namespace: ns, body: patchData, dryRun: serverDryRunParam }, patchOptions);
                  break;
                case "service":
                case "services":
                  result = await coreApi.patchNamespacedService({ name, namespace: ns, body: patchData, dryRun: serverDryRunParam }, patchOptions);
                  break;
                case "configmap":
                case "configmaps":
                  result = await coreApi.patchNamespacedConfigMap({ name, namespace: ns, body: patchData, dryRun: serverDryRunParam }, patchOptions);
                  break;
                default:
                  throw error; // Re-throw if no fallback available
              }
              
              return {
                success: true,
                dryRun: dryRun || "none",
                resource: `${resource}/${name}`,
                namespace: ns,
                patchType: "merge",
                message: `Patched ${resource}/${name} using merge patch (strategic merge not supported)`,
              };
            } catch (fallbackError) {
              // Fallback also failed, return original error
              return { 
                success: false, 
                error: classified.message,
                type: classified.type,
                suggestions: [...(classified.suggestions || []), "Try using patchType: 'merge' instead of 'strategic'"],
              };
            }
          }
          
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
        name: "k8s_delete",
        description: "Delete resources with selectors and options (like kubectl delete). Supports single/multiple resources, file-based deletion, label selectors, and force deletion.",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, service, etc.) or comma-separated list (pod,service)",
            },
            name: {
              type: "string",
              description: "Specific resource name to delete",
            },
            names: {
              type: "array",
              items: { type: "string" },
              description: "Multiple resource names to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            allNamespaces: {
              type: "boolean",
              description: "Delete from all namespaces",
              default: false,
            },
            labelSelector: {
              type: "string",
              description: "Label selector (e.g., app=nginx, env=prod)",
            },
            fieldSelector: {
              type: "string",
              description: "Field selector (e.g., status.phase=Failed)",
            },
            gracePeriodSeconds: {
              type: "number",
              description: "Grace period for pod termination (default: 30, 0 for immediate)",
            },
            now: {
              type: "boolean",
              description: "Force deletion with grace period 0 (like --now flag)",
              default: false,
            },
            force: {
              type: "boolean",
              description: "Force deletion (ignore grace period)",
              default: false,
            },
            all: {
              type: "boolean",
              description: "Delete all resources of specified type(s) in namespace",
              default: false,
            },
            cascade: {
              type: "string",
              description: "Cascade deletion policy",
              enum: ["background", "orphan", "foreground"],
              default: "background",
            },
            manifest: {
              type: "string",
              description: "YAML/JSON manifest content to identify resources to delete (like kubectl delete -f)",
            },
            dryRun: {
              type: "string",
              enum: ["none", "client", "server"],
              description: "Dry-run mode: 'client' previews without calling the API, 'server' validates via the API without persisting",
              default: "none",
            },
            wait: {
              type: "boolean",
              description: "Wait for resource deletion to complete",
              default: false,
            },
          },
          required: [],
        },
      },
      handler: async ({ resource, name, names, namespace, allNamespaces, labelSelector, fieldSelector, gracePeriodSeconds, now, force, all, cascade, manifest, dryRun, wait }: { 
        resource?: string; 
        name?: string;
        names?: string[];
        namespace?: string; 
        allNamespaces?: boolean;
        labelSelector?: string;
        fieldSelector?: string;
        gracePeriodSeconds?: number;
        now?: boolean;
        force?: boolean;
        all?: boolean;
        cascade?: string;
        manifest?: string;
        dryRun?: string;
        wait?: boolean;
      }) => {
        const ns = namespace || "default";
        const gracePeriod = now ? 0 : gracePeriodSeconds;
        const serverDryRun = isServerDryRun(dryRun);
        const isDry = isClientDryRun(dryRun) || serverDryRun;

        try {
          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          
          const deleted: string[] = [];
          const failed: string[] = [];
          const skipped: string[] = [];
          
          // Handle file-based deletion
          if (manifest) {
            try {
              const docs = yaml.loadAll(manifest) as any[];
              for (const doc of docs) {
                if (!doc?.metadata?.name || !doc?.kind) continue;
                
                const kind = doc.kind.toLowerCase();
                const resName = doc.metadata.name;
                const resNs = doc.metadata.namespace || ns;
                
                if (isClientDryRun(dryRun)) {
                  deleted.push(`${kind}/${resNs}/${resName} (dry-run)`);
                  continue;
                }
                
                try {
                  await deleteResource(coreApi, appsApi, batchApi, netApi, kind, resName, resNs, gracePeriod, !!force);
                  deleted.push(`${kind}/${resNs}/${resName}`);
                } catch (err) {
                  failed.push(`${kind}/${resNs}/${resName}: ${err}`);
                }
              }
              
              return {
                success: failed.length === 0,
                deleted,
                failed: failed.length > 0 ? failed : undefined,
                dryRun,
                message: isDry 
                  ? `Would delete ${deleted.length} resources from manifest`
                  : `Deleted ${deleted.length} resources from manifest`,
              };
            } catch (error) {
              return { success: false, error: `Failed to parse manifest: ${error}` };
            }
          }
          
          // Handle multiple resource types with names (kubectl delete pod,service baz foo)
          if (resource && (name || (names && names.length > 0))) {
            const resources = resource.split(",").map((r) => r.trim().toLowerCase());
            const targetNames = name ? [name] : (names || []);
            
            for (const resType of resources) {
              for (const targetName of targetNames) {
                if (isClientDryRun(dryRun)) {
                  deleted.push(`${resType}/${ns}/${targetName} (dry-run)`);
                  continue;
                }
                
                try {
                  await deleteResource(coreApi, appsApi, batchApi, netApi, resType, targetName, ns, gracePeriod, !!force);
                  deleted.push(`${resType}/${ns}/${targetName}`);
                } catch (err) {
                  failed.push(`${resType}/${ns}/${targetName}: ${err}`);
                }
              }
            }
            
            return {
              success: failed.length === 0,
              deleted,
              failed: failed.length > 0 ? failed : undefined,
              message: isDry
                ? `Would delete ${deleted.length} resources`
                : `Deleted ${deleted.length} resources`,
            };
          }
          
          // Handle delete all with --all flag
          if (all && resource) {
            const resources = resource.split(",").map((r) => r.trim().toLowerCase());
            
            for (const resType of resources) {
              try {
                // List all resources of this type and delete them
                const items = await listResources(k8sClient, resType, ns, !!allNamespaces);
                
                for (const item of items) {
                  const itemNs = item.metadata?.namespace || ns;
                  const itemName = item.metadata?.name;
                  
                  if (!itemName) continue;
                  
                  if (isClientDryRun(dryRun)) {
                    deleted.push(`${resType}/${itemNs}/${itemName} (dry-run)`);
                    continue;
                  }
                  
                  try {
                    await deleteResource(coreApi, appsApi, batchApi, netApi, resType, itemName, itemNs, gracePeriod, !!force);
                    deleted.push(`${resType}/${itemNs}/${itemName}`);
                  } catch (err) {
                    failed.push(`${resType}/${itemNs}/${itemName}: ${err}`);
                  }
                }
              } catch (err) {
                failed.push(`${resType}: ${err}`);
              }
            }
            
            return {
              success: failed.length === 0,
              deleted,
              failed: failed.length > 0 ? failed : undefined,
              message: isDry
                ? `Would delete ${deleted.length} resources (--all)`
                : `Deleted ${deleted.length} resources (--all)`,
            };
          }
          
          // Handle label selector based deletion
          if (labelSelector && resource) {
            const resources = resource.split(",").map((r) => r.trim().toLowerCase());
            
            for (const resType of resources) {
              try {
                const items = await listResourcesWithSelector(k8sClient, resType, ns, !!allNamespaces, labelSelector);
                
                for (const item of items) {
                  const itemNs = item.metadata?.namespace || ns;
                  const itemName = item.metadata?.name;
                  
                  if (!itemName) continue;
                  
                  if (isClientDryRun(dryRun)) {
                    deleted.push(`${resType}/${itemNs}/${itemName} (dry-run, matched label)`);
                    continue;
                  }
                  
                  try {
                    await deleteResource(coreApi, appsApi, batchApi, netApi, resType, itemName, itemNs, gracePeriod, !!force);
                    deleted.push(`${resType}/${itemNs}/${itemName}`);
                  } catch (err) {
                    failed.push(`${resType}/${itemNs}/${itemName}: ${err}`);
                  }
                }
              } catch (err) {
                skipped.push(`${resType}: ${err}`);
              }
            }
            
            return {
              success: failed.length === 0,
              deleted,
              failed: failed.length > 0 ? failed : undefined,
              skipped: skipped.length > 0 ? skipped : undefined,
              labelSelector,
              message: isDry
                ? `Would delete ${deleted.length} resources matching label selector`
                : `Deleted ${deleted.length} resources matching label selector`,
            };
          }
          
          return { 
            error: "Must specify either: (resource+name/names), (resource+all), (resource+labelSelector), or manifest" 
          };
          
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete", namespace };
          const classified = classifyError(error, context);
          return { 
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
        
        // Helper function to delete a single resource
        async function deleteResource(
          coreApi: any, appsApi: any, batchApi: any, netApi: any,
          kind: string, resName: string, resNs: string, grace: number | undefined, forceDelete: boolean
        ) {
          const options: any = grace !== undefined || forceDelete || serverDryRun ? {
            gracePeriodSeconds: grace,
            propagationPolicy: forceDelete ? "Foreground" : undefined,
            ...(serverDryRun ? { dryRun: "All" } : {}),
          } : undefined;
          
          switch (kind) {
            case "pod":
            case "pods":
              await coreApi.deleteNamespacedPod({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "deployment":
            case "deployments":
              await appsApi.deleteNamespacedDeployment({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "replicaset":
            case "replicasets":
            case "rs":
              await appsApi.deleteNamespacedReplicaSet({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "statefulset":
            case "statefulsets":
            case "sts":
              await appsApi.deleteNamespacedStatefulSet({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "daemonset":
            case "daemonsets":
            case "ds":
              await appsApi.deleteNamespacedDaemonSet({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "service":
            case "services":
            case "svc":
              await coreApi.deleteNamespacedService({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "configmap":
            case "configmaps":
            case "cm":
              await coreApi.deleteNamespacedConfigMap({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "secret":
            case "secrets":
              await coreApi.deleteNamespacedSecret({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "job":
            case "jobs":
              await batchApi.deleteNamespacedJob({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "cronjob":
            case "cronjobs":
            case "cj":
              await batchApi.deleteNamespacedCronJob({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "ingress":
            case "ingresses":
            case "ing":
              await netApi.deleteNamespacedIngress({ name: resName, namespace: resNs, ...options }, {});
              break;
            case "pvc":
            case "persistentvolumeclaim":
            case "persistentvolumeclaims":
              await coreApi.deleteNamespacedPersistentVolumeClaim({ name: resName, namespace: resNs, ...options }, {});
              break;
            default:
              throw new Error(`Delete not supported for ${kind}`);
          }
        }
        
        // Helper to list resources
        async function listResources(client: K8sClient, kind: string, ns: string, allNs: boolean) {
          const items: any[] = [];
          
          switch (kind) {
            case "pod":
            case "pods":
              return allNs ? client.listPods() : client.listPods(ns);
            case "deployment":
            case "deployments":
              return allNs ? client.listDeployments() : client.listDeployments(ns);
            case "service":
            case "services":
            case "svc":
              return allNs ? client.listServices() : client.listServices(ns);
            case "configmap":
            case "configmaps":
            case "cm":
              return allNs ? client.listConfigMaps() : client.listConfigMaps(ns);
            case "secret":
            case "secrets":
              return allNs ? client.listSecrets() : client.listSecrets(ns);
            default:
              return [];
          }
        }
        
        // Helper to list with label selector
        async function listResourcesWithSelector(client: K8sClient, kind: string, ns: string, allNs: boolean, selector: string) {
          const items: any[] = [];
          const coreApi = client.getCoreV1Api();
          
          switch (kind) {
            case "pod":
            case "pods": {
              const response = allNs 
                ? await coreApi.listPodForAllNamespaces({ labelSelector: selector })
                : await coreApi.listNamespacedPod({ namespace: ns, labelSelector: selector });
              return response.items;
            }
            case "service":
            case "services":
            case "svc": {
              const response = allNs
                ? await coreApi.listServiceForAllNamespaces({ labelSelector: selector })
                : await coreApi.listNamespacedService({ namespace: ns, labelSelector: selector });
              return response.items;
            }
            default:
              // For unsupported types, return all and filter client-side
              return listResources(client, kind, ns, allNs);
          }
        }
      },
    },
    {
      tool: {
        name: "k8s_get_go_template",
        description: "Get resources using Go template syntax (like kubectl -o go-template). Supports Go template expressions for formatting output.",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pods, nodes, services, deployments, etc.)",
            },
            name: {
              type: "string",
              description: "Resource name (optional, gets all if not specified)",
            },
            namespace: {
              type: "string",
              description: "Namespace (for namespaced resources)",
              default: "default",
            },
            template: {
              type: "string",
              description: "Go template string (e.g., {{range .items}}{{ .metadata.name }}{{end}})",
            },
          },
          required: ["resource", "template"],
        },
      },
      handler: async ({ resource, name, namespace, template }: { 
        resource: string; 
        name?: string; 
        namespace?: string;
        template: string;
      }) => {
        try {
          let data: any;
          const ns = namespace || "default";
          
          // Get the resource data
          switch (resource.toLowerCase()) {
            case "pod":
            case "pods":
              if (name) {
                data = await k8sClient.getPod(name, ns);
              } else {
                data = { items: await k8sClient.listPods(namespace) };
              }
              break;
            case "node":
            case "nodes":
              if (name) {
                data = await k8sClient.getNode(name);
              } else {
                data = { items: await k8sClient.listNodes() };
              }
              break;
            case "deployment":
            case "deployments":
              if (name) {
                data = await k8sClient.getDeployment(name, ns);
              } else {
                data = { items: await k8sClient.listDeployments(namespace) };
              }
              break;
            case "service":
            case "services":
            case "svc":
              if (name) {
                const coreApi = k8sClient.getCoreV1Api();
                const result = await coreApi.readNamespacedService({ name, namespace: ns });
                data = result;
              } else {
                data = { items: await k8sClient.listServices(namespace) };
              }
              break;
            default:
              return { error: `Go template for resource '${resource}' not supported` };
          }
          
          // Simple Go template-like evaluation
          const result = evaluateGoTemplate(data, template);
          
          return {
            resource,
            name,
            namespace: ns,
            template,
            result,
            note: "Go template evaluation is simplified. Complex templates may require kubectl.",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_go_template", resource: name, namespace };
          const classified = classifyError(error, context);
          return { 
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
        
        function evaluateGoTemplate(obj: any, tmpl: string): string {
          // Handle {{range .items}}...{{end}}
          const rangeMatch = tmpl.match(/\{\{range \.items\}\}([\s\S]*?)\{\{end\}\}/);
          if (rangeMatch) {
            const innerTemplate = rangeMatch[1];
            const items = obj.items || [];
            return items.map((item: any) => processTemplate(item, innerTemplate)).join("");
          }
          
          // Single object processing
          return processTemplate(obj, tmpl);
        }
        
        function processTemplate(obj: any, tmpl: string): string {
          return tmpl.replace(/\{\{\.?([\w.\[\]]+)\}\}/g, (match, path) => {
            const value = getValue(obj, path);
            return value !== undefined ? String(value) : "";
          });
        }
        
        function getValue(obj: any, path: string): any {
          const parts = path.split(".");
          let current = obj;
          for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
            if (arrayMatch) {
              current = current[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
            } else {
              current = current[part];
            }
          }
          return current;
        }
      },
    },
    // Generic Patch operation
    {
      tool: {
        name: "k8s_patch",
        description: "Patch any Kubernetes resource (like kubectl patch). Supports strategic merge patch.",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, service, configmap, etc.)",
            },
            name: {
              type: "string",
              description: "Resource name",
            },
            namespace: {
              type: "string",
              description: "Namespace (if namespaced resource)",
              default: "default",
            },
            patch: {
              type: "object",
              description: "JSON patch object to apply",
            },
            patchType: {
              type: "string",
              description: "Patch type",
              enum: ["strategic", "merge", "json"],
              default: "strategic",
            },
            ...commonMutationQuerySchema,
          },
          required: ["resource", "name", "patch"],
        },
      },
      handler: async ({ resource, name, namespace, patch, patchType, dryRun }: { 
        resource: string; 
        name: string;
        namespace?: string;
        patch: any;
        patchType?: string;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          validateResourceName(name, resource);

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Patch resource",
              kind: resource,
              name,
              namespace: ns,
              patch,
              details: { patchType: patchType || "strategic" },
            });
          }

          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          
          let result: any;
          
          switch (resource.toLowerCase()) {
            case "pod":
            case "pods":
              result = await coreApi.patchNamespacedPod({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "deployment":
            case "deployments":
              result = await appsApi.patchNamespacedDeployment({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "service":
            case "svc":
            case "services":
              result = await coreApi.patchNamespacedService({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "configmap":
            case "configmaps":
            case "cm":
              result = await coreApi.patchNamespacedConfigMap({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "secret":
            case "secrets":
              result = await coreApi.patchNamespacedSecret({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "statefulset":
            case "statefulsets":
            case "sts":
              result = await appsApi.patchNamespacedStatefulSet({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "daemonset":
            case "daemonsets":
            case "ds":
              result = await appsApi.patchNamespacedDaemonSet({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "replicaset":
            case "replicasets":
            case "rs":
              result = await appsApi.patchNamespacedReplicaSet({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "ingress":
            case "ingresses":
            case "ing":
              result = await netApi.patchNamespacedIngress({ name, namespace: ns, body: patch, dryRun: serverDryRunParam }, {});
              break;
            case "node":
            case "nodes":
            case "no":
              result = await coreApi.patchNode({ name, body: patch, dryRun: serverDryRunParam }, {});
              break;
            default:
              return {
                success: false,
                error: `Patch not supported for resource type '${resource}'. Supported: pod, deployment, service, configmap, secret, statefulset, daemonset, replicaset, ingress, node`,
              };
          }
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Patched ${resource}/${name}`,
            patchType: patchType || "strategic",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_patch", resource: name, namespace: ns };
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
    // Generic Label operation
    {
      tool: {
        name: "k8s_label",
        description: "Add, update, or remove labels on any Kubernetes resource (like kubectl label)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, service, node, etc.)",
            },
            name: {
              type: "string",
              description: "Resource name",
            },
            namespace: {
              type: "string",
              description: "Namespace (if namespaced resource)",
              default: "default",
            },
            labels: {
              type: "object",
              description: "Labels to add/update (use null value to remove a label)",
            },
            overwrite: {
              type: "boolean",
              description: "Overwrite existing labels",
              default: true,
            },
            all: {
              type: "boolean",
              description: "Apply to all resources of the type (requires selector)",
              default: false,
            },
            selector: {
              type: "string",
              description: "Label selector when using --all",
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
          validateResourceName(name, resource);
          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Build the patch for metadata.labels
          const labelPatch: any = { metadata: { labels: {} } };
          
          for (const [key, value] of Object.entries(labels)) {
            if (value === null) {
              // Remove label by setting to null
              labelPatch.metadata.labels[key] = null;
            } else {
              labelPatch.metadata.labels[key] = value;
            }
          }

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Label resource",
              kind: resource,
              name,
              namespace: ns,
              patch: labelPatch,
              details: { labels, overwrite },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          
          const patchOptions = {
            middleware: [{
              pre: async (context: any) => {
                context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                return context;
              },
              post: async (response: any) => response
            }]
          } as any;
          
          switch (resource.toLowerCase()) {
            case "pod":
            case "pods":
              await coreApi.patchNamespacedPod({ name, namespace: ns, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "deployment":
            case "deployments":
              await appsApi.patchNamespacedDeployment({ name, namespace: ns, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "service":
            case "svc":
            case "services":
              await coreApi.patchNamespacedService({ name, namespace: ns, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "configmap":
            case "configmaps":
            case "cm":
              await coreApi.patchNamespacedConfigMap({ name, namespace: ns, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "secret":
            case "secrets":
              await coreApi.patchNamespacedSecret({ name, namespace: ns, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "statefulset":
            case "statefulsets":
            case "sts":
              await appsApi.patchNamespacedStatefulSet({ name, namespace: ns, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "daemonset":
            case "daemonsets":
            case "ds":
              await appsApi.patchNamespacedDaemonSet({ name, namespace: ns, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "replicaset":
            case "replicasets":
            case "rs":
              await appsApi.patchNamespacedReplicaSet({ name, namespace: ns, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "node":
            case "nodes":
            case "no":
              await coreApi.patchNode({ name, body: labelPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            default:
              return {
                success: false,
                error: `Label operation not supported for resource type '${resource}'`,
              };
          }
          
          const added = Object.entries(labels).filter(([_, v]) => v !== null).map(([k]) => k);
          const removed = Object.entries(labels).filter(([_, v]) => v === null).map(([k]) => k);
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Labels updated on ${resource}/${name}`,
            added: added.length > 0 ? added : undefined,
            removed: removed.length > 0 ? removed : undefined,
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
    // Generic Annotate operation
    {
      tool: {
        name: "k8s_annotate",
        description: "Add, update, or remove annotations on any Kubernetes resource (like kubectl annotate)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, service, node, etc.)",
            },
            name: {
              type: "string",
              description: "Resource name",
            },
            namespace: {
              type: "string",
              description: "Namespace (if namespaced resource)",
              default: "default",
            },
            annotations: {
              type: "object",
              description: "Annotations to add/update (use null value to remove)",
            },
            overwrite: {
              type: "boolean",
              description: "Overwrite existing annotations",
              default: true,
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
          validateResourceName(name, resource);
          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Build the patch for metadata.annotations
          const annotationPatch: any = { metadata: { annotations: {} } };
          
          for (const [key, value] of Object.entries(annotations)) {
            if (value === null) {
              // Remove annotation by setting to null
              annotationPatch.metadata.annotations[key] = null;
            } else {
              annotationPatch.metadata.annotations[key] = value;
            }
          }

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Annotate resource",
              kind: resource,
              name,
              namespace: ns,
              patch: annotationPatch,
              details: { annotations, overwrite },
            });
          }

          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          
          const patchOptions = {
            middleware: [{
              pre: async (context: any) => {
                context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
                return context;
              },
              post: async (response: any) => response
            }]
          } as any;
          
          switch (resource.toLowerCase()) {
            case "pod":
            case "pods":
              await coreApi.patchNamespacedPod({ name, namespace: ns, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "deployment":
            case "deployments":
              await appsApi.patchNamespacedDeployment({ name, namespace: ns, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "service":
            case "svc":
            case "services":
              await coreApi.patchNamespacedService({ name, namespace: ns, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "configmap":
            case "configmaps":
            case "cm":
              await coreApi.patchNamespacedConfigMap({ name, namespace: ns, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "secret":
            case "secrets":
              await coreApi.patchNamespacedSecret({ name, namespace: ns, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "statefulset":
            case "statefulsets":
            case "sts":
              await appsApi.patchNamespacedStatefulSet({ name, namespace: ns, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "daemonset":
            case "daemonsets":
            case "ds":
              await appsApi.patchNamespacedDaemonSet({ name, namespace: ns, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "replicaset":
            case "replicasets":
            case "rs":
              await appsApi.patchNamespacedReplicaSet({ name, namespace: ns, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            case "node":
            case "nodes":
            case "no":
              await coreApi.patchNode({ name, body: annotationPatch, dryRun: serverDryRunParam }, patchOptions);
              break;
            default:
              return {
                success: false,
                error: `Annotate operation not supported for resource type '${resource}'`,
              };
          }
          
          const added = Object.entries(annotations).filter(([_, v]) => v !== null).map(([k]) => k);
          const removed = Object.entries(annotations).filter(([_, v]) => v === null).map(([k]) => k);
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Annotations updated on ${resource}/${name}`,
            added: added.length > 0 ? added : undefined,
            removed: removed.length > 0 ? removed : undefined,
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
    // List Custom Resource Definitions
    {
      tool: {
        name: "k8s_list_crd",
        description: "List Custom Resource Definitions (CRDs) in the cluster",
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
          let path = "/apis/apiextensions.k8s.io/v1/customresourcedefinitions";
          const params = new URLSearchParams();
          if (labelSelector) params.append("labelSelector", labelSelector);
          if (fieldSelector) params.append("fieldSelector", fieldSelector);
          const qs = params.toString();
          if (qs) path += `?${qs}`;

          const result = await rawClient.rawApiRequest(path);
          
          if (!result || !result.items) {
            return {
              customResourceDefinitions: [],
              total: 0,
              returned: 0,
            };
          }
          
          const mapped = result.items.map((crd: any) => ({
            name: crd.metadata?.name,
            group: crd.spec?.group,
            version: crd.spec?.versions?.[0]?.name,
            versions: crd.spec?.versions?.map((v: any) => v.name),
            scope: crd.spec?.scope,
            kind: crd.spec?.names?.kind,
            plural: crd.spec?.names?.plural,
            shortNames: crd.spec?.names?.shortNames,
            age: crd.metadata?.creationTimestamp,
            creationTimestamp: crd.metadata?.creationTimestamp,
            labels: crd.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            customResourceDefinitions: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_crd" };
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
    // Get Custom Resource
    {
      tool: {
        name: "k8s_get_custom_resource",
        description: "Get a specific custom resource by its API group, version, kind, namespace and name",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "API group of the custom resource (e.g., monitoring.coreos.com)",
            },
            version: {
              type: "string",
              description: "API version (e.g., v1)",
            },
            plural: {
              type: "string",
              description: "Plural name of the resource (e.g., servicemonitors, prometheusrules)",
            },
            namespace: {
              type: "string",
              description: "Namespace of the resource",
            },
            name: {
              type: "string",
              description: "Name of the resource",
            },
            ...commonGetQuerySchema,
          },
          required: ["group", "version", "plural", "namespace", "name"],
        },
      },
      handler: async ({
        group,
        version,
        plural,
        namespace,
        name,
        output,
        subpath,
        ignoreNotFound,
      }: { 
        group: string; 
        version: string; 
        plural: string;
        namespace: string;
        name: string;
        output?: string;
        subpath?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          const rawClient = k8sClient as any;
          const path = `/apis/${group}/${version}/namespaces/${namespace}/${plural}/${name}`;
          const result = await rawClient.rawApiRequest(path);
          
          const rawResult = {
            success: true,
            customResource: {
              apiVersion: result.apiVersion,
              kind: result.kind,
              metadata: {
                name: result.metadata?.name,
                namespace: result.metadata?.namespace,
                creationTimestamp: result.metadata?.creationTimestamp,
                labels: result.metadata?.labels,
                annotations: result.metadata?.annotations,
              },
              spec: result.spec,
              status: result.status,
            },
          };

          return applyGetFormatting(rawResult, {
            kind: result.kind || plural,
            name,
            namespace,
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              namespace,
              message: `Custom resource '${plural}/${name}' not found in namespace '${namespace}'`,
            };
          }
          const context: ErrorContext = { 
            operation: "k8s_get_custom_resource", 
            resource: `${group}/${version}/${plural}/${name}`,
            namespace 
          };
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
    // List Custom Resources
    {
      tool: {
        name: "k8s_list_custom_resources",
        description: "List custom resources by their API group, version, and plural name",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "API group of the custom resource (e.g., monitoring.coreos.com)",
            },
            version: {
              type: "string",
              description: "API version (e.g., v1)",
            },
            plural: {
              type: "string",
              description: "Plural name of the resource (e.g., servicemonitors, prometheusrules)",
            },
            namespace: {
              type: "string",
              description: "Namespace (omit for cluster-scoped resources)",
            },
            ...commonListQuerySchema,
          },
          required: ["group", "version", "plural"],
        },
      },
      handler: async ({
        group,
        version,
        plural,
        namespace,
        labelSelector,
        fieldSelector,
        sortBy,
        descending,
        limit,
      }: { 
        group: string; 
        version: string; 
        plural: string;
        namespace?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const rawClient = k8sClient as any;
          let path = namespace
            ? `/apis/${group}/${version}/namespaces/${namespace}/${plural}`
            : `/apis/${group}/${version}/${plural}`;
          
          const params = new URLSearchParams();
          if (labelSelector) params.append("labelSelector", labelSelector);
          if (fieldSelector) params.append("fieldSelector", fieldSelector);
          const qs = params.toString();
          if (qs) path += `?${qs}`;

          const result = await rawClient.rawApiRequest(path);
          
          if (!result || !result.items) {
            return {
              customResources: [],
              total: 0,
              returned: 0,
              apiVersion: result?.apiVersion || `${group}/${version}`,
            };
          }
          
          const mapped = result.items.map((cr: any) => ({
            name: cr.metadata?.name,
            namespace: cr.metadata?.namespace,
            creationTimestamp: cr.metadata?.creationTimestamp,
            labels: cr.metadata?.labels,
            annotations: cr.metadata?.annotations,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            customResources: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            apiVersion: result.apiVersion,
            kind: result.kind,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { 
            operation: "k8s_list_custom_resources", 
            resource: `${group}/${version}/${plural}`,
            namespace 
          };
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
    // Wait for resource condition
    {
      tool: {
        name: "k8s_wait",
        description: "Wait for a specific condition on a resource (like kubectl wait)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, job, etc.)",
            },
            name: {
              type: "string",
              description: "Name of the resource",
            },
            namespace: {
              type: "string",
              description: "Namespace of the resource",
              default: "default",
            },
            for: {
              type: "string",
              description: "Condition to wait for (e.g., 'condition=Ready', 'delete', 'jsonpath=...')",
            },
            timeout: {
              type: "number",
              description: "Timeout in seconds",
              default: 300,
            },
            labelSelector: {
              type: "string",
              description: "Label selector to wait for multiple resources",
            },
          },
          required: ["resource", "for"],
        },
      },
      handler: async ({ resource, name, namespace, for: waitFor, timeout, labelSelector }: { 
        resource: string; 
        name?: string;
        namespace?: string;
        for: string;
        timeout?: number;
        labelSelector?: string;
      }) => {
        try {
          const ns = namespace || "default";
          const waitTimeout = (timeout || 300) * 1000; // Convert to milliseconds
          const startTime = Date.now();
          const rawClient = k8sClient as any;
          
          // Parse the wait condition
          let conditionType: string | null = null;
          let conditionStatus = true;
          let isDelete = false;
          let jsonPath: string | null = null;
          let expectedValue: string | null = null;
          
          if (waitFor === "delete") {
            isDelete = true;
          } else if (waitFor.startsWith("condition=")) {
            const parts = waitFor.substring(10).split("=");
            conditionType = parts[0];
            conditionStatus = parts[1] ? parts[1].toLowerCase() === "true" : true;
          } else if (waitFor.startsWith("jsonpath=")) {
            const match = waitFor.match(/jsonpath=(\{[^}]+\})=(.+)/);
            if (match) {
              jsonPath = match[1];
              expectedValue = match[2];
            }
          }
          
          const checkInterval = 2000; // Check every 2 seconds
          
          while (Date.now() - startTime < waitTimeout) {
            try {
              if (isDelete) {
                // Check if resource is deleted
                if (name) {
                  try {
                    await rawClient.rawApiRequest(`/api/v1/namespaces/${ns}/${resource}s/${name}`);
                  } catch (e: any) {
                    if (e.statusCode === 404 || e.response?.statusCode === 404) {
                      return {
                        success: true,
                        message: `${resource}/${name} deleted`,
                        waited: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                      };
                    }
                    throw e;
                  }
                }
              } else if (conditionType) {
                // Check condition
                let result;
                if (name) {
                  result = await rawClient.rawApiRequest(`/api/v1/namespaces/${ns}/${resource}s/${name}`);
                } else if (labelSelector) {
                  const list = await rawClient.rawApiRequest(`/api/v1/namespaces/${ns}/${resource}s?labelSelector=${encodeURIComponent(labelSelector)}`);
                  if (!list.items || list.items.length === 0) {
                    await new Promise(r => setTimeout(r, checkInterval));
                    continue;
                  }
                  result = list.items[0]; // Check first matching resource
                }
                
                if (result) {
                  const conditions = result.status?.conditions || [];
                  const condition = conditions.find((c: any) => c.type === conditionType);
                  
                  if (condition && (condition.status === "True") === conditionStatus) {
                    return {
                      success: true,
                      message: `${resource}${name ? `/${name}` : "s"} condition ${conditionType}=${conditionStatus}`,
                      waited: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                    };
                  }
                }
              }
              
              // Wait before next check
              await new Promise(r => setTimeout(r, checkInterval));
            } catch (error) {
              // Continue waiting if resource not found yet
              await new Promise(r => setTimeout(r, checkInterval));
            }
          }
          
          // Timeout reached
          return {
            success: false,
            error: `Timeout after ${timeout || 300}s waiting for ${resource}${name ? `/${name}` : "s"} to be ${waitFor}`,
            waited: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_wait", resource: name, namespace };
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
    // Proxy - Start API proxy
    {
      tool: {
        name: "k8s_proxy",
        description: "Start a proxy server to the Kubernetes API (like kubectl proxy)",
        inputSchema: {
          type: "object",
          properties: {
            port: {
              type: "number",
              description: "Local port to listen on",
              default: 8001,
            },
            address: {
              type: "string",
              description: "IP address to listen on",
              default: "127.0.0.1",
            },
            apiPrefix: {
              type: "string",
              description: "API prefix path",
              default: "/",
            },
            staticDir: {
              type: "string",
              description: "Directory to serve static files from",
            },
            disableFilter: {
              type: "boolean",
              description: "Disable request filtering",
              default: false,
            },
          },
        },
      },
      handler: async ({ port, address, apiPrefix, staticDir, disableFilter }: { 
        port?: number;
        address?: string;
        apiPrefix?: string;
        staticDir?: string;
        disableFilter?: boolean;
      }) => {
        try {
          const proxyPort = port || 8001;
          const proxyAddress = address || "127.0.0.1";
          const prefix = apiPrefix || "/";
          
          // Get cluster info for the proxy URL
          const rawClient = k8sClient as any;
          const clusterInfo = await rawClient.rawApiRequest("/version");
          const serverUrl = clusterInfo?.serverAddress || "https://kubernetes.default.svc";
          
          // Generate kubectl proxy command
          let kubectlCmd = `kubectl proxy --port=${proxyPort} --address=${proxyAddress}`;
          if (apiPrefix && apiPrefix !== "/") {
            kubectlCmd += ` --api-prefix=${apiPrefix}`;
          }
          if (staticDir) {
            kubectlCmd += ` --www=${staticDir}`;
          }
          if (disableFilter) {
            kubectlCmd += " --disable-filter=true";
          }
          
          return {
            success: true,
            message: `Kubernetes API proxy configuration`,
            proxy: {
              localUrl: `http://${proxyAddress}:${proxyPort}`,
              apiPrefix: prefix,
              targetCluster: serverUrl,
              kubectlCommand: kubectlCmd,
              notes: [
                "Run the kubectl command above to start the proxy",
                "Then access the API at:",
                `  curl http://${proxyAddress}:${proxyPort}/api/v1/namespaces/default/pods`,
                "",
                "The proxy enables:",
                "  - Direct API access without authentication headers",
                "  - WebSocket support for exec/logs/port-forward",
                "  - Static file serving (if --www specified)",
              ],
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_proxy" };
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
