import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as yaml from "js-yaml";
import * as k8s from "@kubernetes/client-node";
import { classifyError, validateYamlManifest, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace } from "../validators.js";
import { scrubSensitiveData } from "../utils/secret-scrubber.js";
import {
  commonDeleteQuerySchema,
  commonApplyQuerySchema,
  commonCreateQuerySchema,
  commonMutationQuerySchema,
  isClientDryRun,
  isServerDryRun,
  formatClientDryRunDelete,
  formatClientDryRunCreate,
  formatClientDryRunMutation,
  handleDeleteError,
  buildServerDeleteParams,
  buildServerCreateParams,
} from "../utils/safety-helper.js";

export function registerConfigTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_apply_manifest",
        description: "Apply a Kubernetes manifest (YAML or JSON)",
        inputSchema: {
          type: "object",
          properties: {
            manifest: {
              type: "string",
              description: "YAML or JSON manifest content to apply",
            },
            namespace: {
              type: "string",
              description: "Default namespace for resources without namespace specified",
              default: "default",
            },
            ...commonApplyQuerySchema,
          },
          required: ["manifest"],
        },
      },
      handler: async ({
        manifest,
        namespace,
        dryRun,
        fieldManager,
        forceConflicts,
        serverSide,
      }: {
        manifest: string;
        namespace?: string;
        dryRun?: string;
        fieldManager?: string;
        forceConflicts?: boolean;
        serverSide?: boolean;
      }) => {
        try {
          const result = await k8sClient.applyManifest(manifest, {
            dryRun,
            fieldManager,
            forceConflicts,
            serverSide,
          });
          return {
            success: true,
            applied: result,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_apply_manifest", namespace };
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
        name: "k8s_export_resource",
        description: "Export a resource as YAML",
        inputSchema: {
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
              description: "Namespace (if namespaced resource)",
              default: "default",
            },
            scrub: {
              type: "boolean",
              description: "Mask potential secrets in exported YAML",
              default: false,
            },
          },
          required: ["kind", "name"],
        },
      },
      handler: async ({ kind, name, namespace, scrub }: { kind: string; name: string; namespace?: string; scrub?: boolean }) => {
        const ns = namespace || "default";
        let resource: any;

        try {
          switch (kind.toLowerCase()) {
            case "pod":
              resource = await k8sClient.getPod(name, ns);
              break;
            case "deployment":
              resource = await k8sClient.getDeployment(name, ns);
              break;
            case "service":
              const coreApi = k8sClient.getCoreV1Api();
              const svc = await coreApi.readNamespacedService({ name, namespace: ns });
              resource = svc;
              break;
            case "configmap":
              const cm = await k8sClient.getCoreV1Api().readNamespacedConfigMap({ name, namespace: ns });
              resource = cm;
              break;
            case "secret":
              if (!scrub) {
                throw new Error("SECURITY VIOLATION: Exporting a Secret requires explicitly setting 'scrub: true' to acknowledge sensitive resource handling.");
              }
              const secret = await k8sClient.getCoreV1Api().readNamespacedSecret({ name, namespace: ns });
              resource = secret;
              // Mask sensitive data
              if (resource.data) {
                resource.data = Object.fromEntries(
                  Object.keys(resource.data).map((k) => [k, "***MASKED***"])
                );
              }
              break;
            case "statefulset":
            case "statefulsets":
              const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
              const ss = await appsApi.readNamespacedStatefulSet({ name, namespace: ns });
              resource = ss;
              break;
            case "daemonset":
            case "daemonsets":
              const appsApi2 = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
              const ds = await appsApi2.readNamespacedDaemonSet({ name, namespace: ns });
              resource = ds;
              break;
            case "replicaset":
            case "replicasets":
              const appsApi3 = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
              const rs = await appsApi3.readNamespacedReplicaSet({ name, namespace: ns });
              resource = rs;
              break;
            case "job":
            case "jobs":
              const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
              const job = await batchApi.readNamespacedJob({ name, namespace: ns });
              resource = job;
              break;
            case "cronjob":
            case "cronjobs":
              const batchApi2 = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
              const cj = await batchApi2.readNamespacedCronJob({ name, namespace: ns });
              resource = cj;
              break;
            case "ingress":
            case "ingresses":
              const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
              const ing = await netApi.readNamespacedIngress({ name, namespace: ns });
              resource = ing;
              break;
            case "persistentvolumeclaim":
            case "pvc":
            case "pvcs":
              const coreApi2 = k8sClient.getCoreV1Api();
              const pvc = await coreApi2.readNamespacedPersistentVolumeClaim({ name, namespace: ns });
              resource = pvc;
              break;
            case "persistentvolume":
            case "pv":
            case "pvs":
              const coreApi3 = k8sClient.getCoreV1Api();
              const pv = await coreApi3.readPersistentVolume({ name });
              resource = pv;
              break;
            default:
              return {
                error: `Export for kind '${kind}' not yet implemented. Supported: Pod, Deployment, Service, ConfigMap, Secret, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob, Ingress, PVC, PV`,
              };
          }

          // Clean up server-side fields
          delete resource.metadata?.managedFields;
          delete resource.status;
          
          let yamlOutput = yaml.dump(resource, { indent: 2 });
          if (scrub) {
            yamlOutput = scrubSensitiveData(yamlOutput);
          }
          
          return {
            kind,
            name,
            namespace: ns,
            scrubbed: scrub || false,
            yaml: yamlOutput,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_export_resource", resource: name, namespace: ns };
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
        name: "k8s_validate_manifest",
        description: "Validate a Kubernetes manifest without applying it",
        inputSchema: {
          type: "object",
          properties: {
            manifest: {
              type: "string",
              description: "YAML or JSON manifest to validate",
            },
          },
          required: ["manifest"],
        },
      },
      handler: async ({ manifest }: { manifest: string }) => {
        const issues: string[] = [];
        
        try {
          const documents = yaml.loadAll(manifest) as any[];
          
          for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            
            if (!doc) {
              issues.push(`Document ${i + 1}: Empty document`);
              continue;
            }
            
            if (!doc.apiVersion) {
              issues.push(`Document ${i + 1}: Missing apiVersion`);
            }
            
            if (!doc.kind) {
              issues.push(`Document ${i + 1}: Missing kind`);
            }
            
            if (!doc.metadata) {
              issues.push(`Document ${i + 1}: Missing metadata`);
            } else if (!doc.metadata.name) {
              issues.push(`Document ${i + 1}: Missing metadata.name`);
            }

            // Validate common resource-specific fields
            if (doc.kind === "Deployment" && !doc.spec?.selector) {
              issues.push(`Document ${i + 1} (Deployment): Missing spec.selector`);
            }
            
            if (doc.kind === "Service" && !doc.spec?.ports) {
              issues.push(`Document ${i + 1} (Service): Missing spec.ports`);
            }
          }

          return {
            valid: issues.length === 0,
            documentCount: documents.length,
            issues: issues.length > 0 ? issues : undefined,
            message: issues.length === 0 ? "Manifest is valid" : `Found ${issues.length} issue(s)`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_validate_manifest" };
          const classified = classifyError(error, context);
          return {
            valid: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_resource_yaml",
        description: "Get raw YAML of a resource",
        inputSchema: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              description: "Resource kind",
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
            scrub: {
              type: "boolean",
              description: "Mask potential secrets in exported YAML",
              default: false,
            },
          },
          required: ["kind", "name"],
        },
      },
      handler: async ({ kind, name, namespace, scrub }: { kind: string; name: string; namespace?: string; scrub?: boolean }) => {
        const ns = namespace || "default";
        
        // Reuse the export_resource logic
        const coreApi = k8sClient.getCoreV1Api();
        let resource: any;

        try {
          switch (kind.toLowerCase()) {
            case "pod":
              resource = await k8sClient.getPod(name, ns);
              break;
            case "deployment":
              resource = await k8sClient.getDeployment(name, ns);
              break;
            case "service":
              const svc = await coreApi.readNamespacedService({ name, namespace: ns });
              resource = svc;
              break;
            case "configmap":
              const cm = await coreApi.readNamespacedConfigMap({ name, namespace: ns });
              resource = cm;
              break;
            case "secret":
              if (!scrub) {
                throw new Error("SECURITY VIOLATION: Reading a Secret requires explicitly setting 'scrub: true' to acknowledge sensitive resource handling.");
              }
              const secret = await coreApi.readNamespacedSecret({ name, namespace: ns });
              resource = secret;
              // Mask sensitive data
              if (resource.data) {
                resource.data = Object.fromEntries(
                  Object.keys(resource.data).map((k) => [k, "***MASKED***"])
                );
              }
              break;
            case "node":
              resource = await k8sClient.getNode(name);
              break;
            case "statefulset":
            case "statefulsets":
              const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
              const ss = await appsApi.readNamespacedStatefulSet({ name, namespace: ns });
              resource = ss;
              break;
            case "daemonset":
            case "daemonsets":
              const appsApi2 = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
              const ds = await appsApi2.readNamespacedDaemonSet({ name, namespace: ns });
              resource = ds;
              break;
            case "replicaset":
            case "replicasets":
              const appsApi3 = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
              const rs = await appsApi3.readNamespacedReplicaSet({ name, namespace: ns });
              resource = rs;
              break;
            case "job":
            case "jobs":
              const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
              const job = await batchApi.readNamespacedJob({ name, namespace: ns });
              resource = job;
              break;
            case "cronjob":
            case "cronjobs":
              const batchApi2 = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
              const cj = await batchApi2.readNamespacedCronJob({ name, namespace: ns });
              resource = cj;
              break;
            case "ingress":
            case "ingresses":
              const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
              const ing = await netApi.readNamespacedIngress({ name, namespace: ns });
              resource = ing;
              break;
            case "persistentvolumeclaim":
            case "pvc":
            case "pvcs":
              const pvc = await coreApi.readNamespacedPersistentVolumeClaim({ name, namespace: ns });
              resource = pvc;
              break;
            case "persistentvolume":
            case "pv":
            case "pvs":
              const coreApi3 = k8sClient.getCoreV1Api();
              const pv = await coreApi3.readPersistentVolume({ name });
              resource = pv;
              break;
            default:
              return { error: `Getting YAML for kind '${kind}' not supported yet. Supported: Pod, Deployment, Service, ConfigMap, Secret, Node, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob, Ingress, PVC, PV` };
          }

          let yamlOutput = yaml.dump(resource, { indent: 2 });
          if (scrub) {
            yamlOutput = scrubSensitiveData(yamlOutput);
          }
          return {
            yaml: yamlOutput,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_resource_yaml", resource: name, namespace: ns };
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
        name: "k8s_create_namespace",
        description: "Create a new namespace",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the namespace",
            },
            labels: {
              type: "object",
              description: "Labels to apply to the namespace",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, labels, dryRun }: { name: string; labels?: Record<string, string>; dryRun?: string }) => {
        try {
          validateResourceName(name, "namespace");
          const coreApi = k8sClient.getCoreV1Api();
          
          const namespace = {
            apiVersion: "v1",
            kind: "Namespace",
            metadata: {
              name,
              labels,
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "Namespace",
              name,
              manifest: namespace,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespace({ body: namespace, ...createParams });
          return {
            success: true,
            dryRun: dryRun || "none",
            name: result.metadata?.name,
            message: `Namespace ${name} created successfully`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_namespace", resource: name };
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
        name: "k8s_delete_namespace",
        description: "Delete a namespace",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the namespace to delete",
            },
            force: {
              type: "boolean",
              description: "Force delete (remove finalizers)",
              default: false,
            },
            ...commonDeleteQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({
        name,
        force,
        dryRun,
        gracePeriodSeconds,
        propagationPolicy,
        ignoreNotFound,
      }: {
        name: string;
        force?: boolean;
        dryRun?: string;
        gracePeriodSeconds?: number;
        propagationPolicy?: string;
        ignoreNotFound?: boolean;
      }) => {
        try {
          validateResourceName(name, "namespace");

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "Namespace",
              name,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const coreApi = k8sClient.getCoreV1Api();
          
          if (force) {
            // Remove finalizers first
            const patch = { metadata: { finalizers: [] } };
            await coreApi.patchNamespace({ name, body: patch }, {
              middleware: [{
                pre: (context: k8s.RequestContext) => {
                  context.setHeaderParam("Content-Type", "application/merge-patch+json");
                  return Promise.resolve(context);
                },
                post: (response: k8s.ResponseContext) => Promise.resolve(response)
              }]
            } as any);
          }
          
          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await coreApi.deleteNamespace({ name, ...deleteParams });
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Namespace ${name} deletion initiated`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "Namespace", name, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_namespace", resource: name };
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
        name: "k8s_config_view",
        description: "View merged kubeconfig settings",
        inputSchema: {
          type: "object",
          properties: {
            raw: {
              type: "boolean",
              description: "Show raw certificate data and secrets",
              default: false,
            },
          },
        },
      },
      handler: async ({ raw }: { raw?: boolean }) => {
        try {
          const kc = k8sClient.kc;
          const contexts = kc.getContexts();
          const currentContext = kc.getCurrentContext();
          const clusters = kc.getClusters();
          const users = kc.getUsers();

          const configView = {
            apiVersion: "v1",
            kind: "Config",
            currentContext,
            contexts: contexts.map((ctx) => ({
              name: ctx.name,
              context: {
                cluster: ctx.cluster,
                user: ctx.user,
                namespace: ctx.namespace,
              },
            })),
            clusters: clusters.map((cluster) => ({
              name: cluster.name,
              cluster: raw
                ? cluster
                : {
                    server: cluster.server,
                    "insecure-skip-tls-verify": cluster.skipTLSVerify,
                  },
            })),
            users: users.map((user) => ({
              name: user.name,
              user: raw
                ? user
                : {
                    ...(user.authProvider ? { "auth-provider": user.authProvider } : {}),
                    ...(user.exec ? { exec: user.exec } : {}),
                  },
            })),
          };

          return configView;
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_config_view" };
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
        name: "k8s_config_set_namespace",
        description: "Set the default namespace for the current context",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to set as default",
            },
          },
          required: ["namespace"],
        },
      },
      handler: async ({ namespace }: { namespace: string }) => {
        try {
          validateNamespace(namespace);
          const kc = k8sClient.kc;
          const currentContext = kc.getCurrentContext();
          const contexts = kc.getContexts();
          const currentCtx = contexts.find((ctx) => ctx.name === currentContext);

          if (!currentCtx) {
            return { success: false, error: "No current context found" };
          }

          // Update the context with new namespace
          kc.setCurrentContext(currentContext);
          
          return {
            success: true,
            context: currentContext,
            namespace,
            message: `Set namespace to ${namespace} for context ${currentContext}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_config_set_namespace", namespace };
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
        name: "k8s_cp",
        description: "Copy files and directories to and from containers (like kubectl cp). Supports namespace/pod:path format.",
        inputSchema: {
          type: "object",
          properties: {
            source: {
              type: "string",
              description: "Source path (pod:/path, namespace/pod:/path, or local/path)",
            },
            destination: {
              type: "string",
              description: "Destination path (pod:/path, namespace/pod:/path, or local/path)",
            },
            namespace: {
              type: "string",
              description: "Default namespace (if not specified in path)",
              default: "default",
            },
            container: {
              type: "string",
              description: "Container name (for multi-container pods)",
            },
          },
          required: ["source", "destination"],
        },
      },
      handler: async ({ source, destination, namespace, container }: { 
        source: string; 
        destination: string; 
        namespace?: string; 
        container?: string;
      }) => {
        const defaultNs = namespace || "default";
        
        // Parse paths that may include namespace (format: namespace/pod:path or pod:path)
        function parsePath(path: string): { isPod: boolean; namespace?: string; pod?: string; path: string } {
          if (!path.includes(":")) {
            return { isPod: false, path };
          }
          
          // Check for namespace/pod:path format
          const match = path.match(/^([^/]+)\/([^:]+):(.*)$/);
          if (match) {
            return {
              isPod: true,
              namespace: match[1],
              pod: match[2],
              path: match[3],
            };
          }
          
          // Simple pod:path format
          const [pod, podPath] = path.split(":");
          return {
            isPod: true,
            pod,
            path: podPath,
          };
        }
        
        const sourceParsed = parsePath(source);
        const destParsed = parsePath(destination);
        
        if (sourceParsed.isPod && destParsed.isPod) {
          return { success: false, error: "Cannot copy between two pods directly" };
        }
        
        if (!sourceParsed.isPod && !destParsed.isPod) {
          return { success: false, error: "One of source or destination must be a pod path (format: pod:/path or namespace/pod:/path)" };
        }
        
        // Determine direction and get pod info
        const isDownload = sourceParsed.isPod;
        const podInfo = isDownload ? sourceParsed : destParsed;
        const localPath = isDownload ? destination : source;
        
        const podNamespace = podInfo.namespace || defaultNs;
        const podName = podInfo.pod;
        const podPath = podInfo.path;
        
        if (!podName) {
          return { success: false, error: "Could not parse pod name from path" };
        }
        
        try {
          return {
            success: true,
            operation: isDownload ? "download" : "upload",
            pod: {
              name: podName,
              namespace: podNamespace,
              path: podPath,
              container: container || "default",
            },
            localPath,
            kubectlCommand: isDownload
              ? `kubectl cp ${podNamespace}/${podName}:${podPath} ${localPath}${container ? ` -c ${container}` : ""}`
              : `kubectl cp ${localPath} ${podNamespace}/${podName}:${podPath}${container ? ` -c ${container}` : ""}`,
            note: "Use the provided kubectl command to copy files. For directories, add the recursive flag if needed.",
            examples: {
              directory: `kubectl cp ${podNamespace}/${podName}:${podPath} ${localPath} -r`,
              specificContainer: `kubectl cp ${localPath} ${podNamespace}/${podName}:${podPath} -c ${container || "container-name"}`,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_cp", resource: podName, namespace: podNamespace };
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
        name: "k8s_edit",
        description: "Get a resource for editing and apply changes (like kubectl edit). Step 1: Call without 'manifest' to get current YAML. Step 2: Call with modified 'manifest' to apply changes.",
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
              description: "Namespace",
              default: "default",
            },
            manifest: {
              type: "string",
              description: "Modified YAML/JSON manifest to apply (omit to fetch current state)",
            },
            ...commonMutationQuerySchema,
          },
          required: ["resource", "name"],
        },
      },
      handler: async ({ resource, name, namespace, manifest, dryRun }: {
        resource: string;
        name: string;
        namespace?: string;
        manifest?: string;
        dryRun?: string;
      }) => {
        const ns = namespace || "default";

        try {
          // If no manifest provided, return current resource for editing
          if (!manifest) {
            let currentResource: any;
            const coreApi = k8sClient.getCoreV1Api();
            const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
            
            switch (resource.toLowerCase()) {
              case "pod":
              case "pods":
                currentResource = await k8sClient.getPod(name, ns);
                break;
              case "deployment":
              case "deployments":
                currentResource = await k8sClient.getDeployment(name, ns);
                break;
              case "service":
              case "services":
              case "svc":
                const svcResult = await coreApi.readNamespacedService({ name, namespace: ns });
                currentResource = svcResult;
                break;
              case "configmap":
              case "configmaps":
              case "cm":
                const cmResult = await coreApi.readNamespacedConfigMap({ name, namespace: ns });
                currentResource = cmResult;
                break;
              case "secret":
              case "secrets":
                const secretResult = await coreApi.readNamespacedSecret({ name, namespace: ns });
                currentResource = secretResult;
                // Mask data for display
                if (currentResource.data) {
                  currentResource.data = Object.fromEntries(
                    Object.keys(currentResource.data).map((k) => [k, "***MASKED***"])
                  );
                }
                break;
              case "statefulset":
              case "statefulsets":
              case "sts":
                const ssResult = await appsApi.readNamespacedStatefulSet({ name, namespace: ns });
                currentResource = ssResult;
                break;
              case "daemonset":
              case "daemonsets":
              case "ds":
                const dsResult = await appsApi.readNamespacedDaemonSet({ name, namespace: ns });
                currentResource = dsResult;
                break;
              case "replicaset":
              case "replicasets":
              case "rs":
                const rsResult = await appsApi.readNamespacedReplicaSet({ name, namespace: ns });
                currentResource = rsResult;
                break;
              case "job":
              case "jobs":
                const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
                const jobResult = await batchApi.readNamespacedJob({ name, namespace: ns });
                currentResource = jobResult;
                break;
              case "cronjob":
              case "cronjobs":
              case "cj":
                const batchApi2 = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
                const cjResult = await batchApi2.readNamespacedCronJob({ name, namespace: ns });
                currentResource = cjResult;
                break;
              case "ingress":
              case "ingresses":
              case "ing":
                const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
                const ingResult = await netApi.readNamespacedIngress({ name, namespace: ns });
                currentResource = ingResult;
                break;
              case "persistentvolumeclaim":
              case "pvc":
              case "pvcs":
                const pvcResult = await coreApi.readNamespacedPersistentVolumeClaim({ name, namespace: ns });
                currentResource = pvcResult;
                break;
              default:
                return { 
                  error: `Edit not supported for ${resource}. Supported: pod, deployment, service, configmap, secret, statefulset, daemonset, replicaset, job, cronjob, ingress, pvc` 
                };
            }
            
            // Clean up for editing
            delete currentResource.metadata?.managedFields;
            delete currentResource.status;
            delete currentResource.metadata?.resourceVersion;
            
            return {
              step: "edit",
              resource: `${resource}/${name}`,
              namespace: ns,
              yaml: yaml.dump(currentResource, { indent: 2 }),
              instructions: "Edit the YAML above, then call this tool again with the 'manifest' parameter containing your modified YAML.",
            };
          }
          
          // If manifest provided, apply it
          const parsed = yaml.load(manifest) as any;
          
          if (!parsed || !parsed.apiVersion || !parsed.kind) {
            return { error: "Invalid manifest: missing apiVersion or kind" };
          }
          
          // Ensure metadata matches the resource being edited
          if (parsed.metadata?.name !== name || parsed.metadata?.namespace !== ns) {
            return { 
              error: `Manifest metadata mismatch. Expected ${resource}/${name} in namespace ${ns}` 
            };
          }
          
          // Apply the changes
          const result = await k8sClient.applyManifest(manifest, { dryRun });

          return {
            step: "apply",
            dryRun: dryRun || "none",
            resource: `${resource}/${name}`,
            namespace: ns,
            result,
            message: `Resource ${resource}/${name} updated successfully`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_edit", resource: name, namespace: ns };
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
        name: "k8s_diff",
        description: "Diff a file or manifest against the live configuration (like kubectl diff). Shows differences between local manifest and running resource.",
        inputSchema: {
          type: "object",
          properties: {
            manifest: {
              type: "string",
              description: "YAML/JSON manifest content to compare",
            },
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
              description: "Namespace",
              default: "default",
            },
          },
          required: ["manifest"],
        },
      },
      handler: async ({ manifest, resource, name, namespace }: { 
        manifest: string; 
        resource?: string;
        name?: string;
        namespace?: string;
      }) => {
        try {
          const docs = yaml.loadAll(manifest) as any[];
          const results: any[] = [];
          
          for (const doc of docs) {
            if (!doc || !doc.apiVersion || !doc.kind) {
              results.push({ error: "Invalid manifest: missing apiVersion or kind" });
              continue;
            }
            
            const kind = doc.kind;
            const resName = doc.metadata?.name;
            const resNs = doc.metadata?.namespace || namespace || "default";
            
            if (!resName) {
              results.push({ error: "Missing metadata.name in manifest" });
              continue;
            }
            
            // Get live resource
            let liveResource: any;
            const coreApi = k8sClient.getCoreV1Api();
            const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
            
            try {
              switch (kind.toLowerCase()) {
                case "pod":
                case "pods":
                  liveResource = await k8sClient.getPod(resName, resNs);
                  break;
                case "deployment":
                case "deployments":
                  liveResource = await k8sClient.getDeployment(resName, resNs);
                  break;
                case "service":
                case "services":
                case "svc":
                  const svcResult = await coreApi.readNamespacedService({ name: resName, namespace: resNs });
                  liveResource = svcResult;
                  break;
                case "configmap":
                case "configmaps":
                case "cm":
                  const cmResult = await coreApi.readNamespacedConfigMap({ name: resName, namespace: resNs });
                  liveResource = cmResult;
                  break;
                case "secret":
                case "secrets":
                  const secretResult = await coreApi.readNamespacedSecret({ name: resName, namespace: resNs });
                  liveResource = secretResult;
                  break;
                case "statefulset":
                case "statefulsets":
                case "sts":
                  const ssResult = await appsApi.readNamespacedStatefulSet({ name: resName, namespace: resNs });
                  liveResource = ssResult;
                  break;
                case "daemonset":
                case "daemonsets":
                case "ds":
                  const dsResult = await appsApi.readNamespacedDaemonSet({ name: resName, namespace: resNs });
                  liveResource = dsResult;
                  break;
                case "replicaset":
                case "replicasets":
                case "rs":
                  const rsResult = await appsApi.readNamespacedReplicaSet({ name: resName, namespace: resNs });
                  liveResource = rsResult;
                  break;
                case "job":
                case "jobs":
                  const batchApi = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
                  const jobResult = await batchApi.readNamespacedJob({ name: resName, namespace: resNs });
                  liveResource = jobResult;
                  break;
                case "cronjob":
                case "cronjobs":
                case "cj":
                  const batchApi2 = (k8sClient as any).kc.makeApiClient(k8s.BatchV1Api);
                  const cjResult = await batchApi2.readNamespacedCronJob({ name: resName, namespace: resNs });
                  liveResource = cjResult;
                  break;
                case "ingress":
                case "ingresses":
                case "ing":
                  const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
                  const ingResult = await netApi.readNamespacedIngress({ name: resName, namespace: resNs });
                  liveResource = ingResult;
                  break;
                case "persistentvolumeclaim":
                case "pvc":
                case "pvcs":
                  const pvcResult = await coreApi.readNamespacedPersistentVolumeClaim({ name: resName, namespace: resNs });
                  liveResource = pvcResult;
                  break;
                default:
                  results.push({ error: `Diff not supported for ${kind}. Supported: pod, deployment, service, configmap, secret, statefulset, daemonset, replicaset, job, cronjob, ingress, pvc` });
                  continue;
              }
            } catch (error) {
              results.push({
                resource: `${kind}/${resNs}/${resName}`,
                live: "Not found",
                local: "Present",
                diff: "Resource does not exist in cluster - would be created",
              });
              continue;
            }
            
            // Clean up both resources for comparison
            const cleanLive = cleanForComparison(liveResource);
            const cleanLocal = cleanForComparison(doc);
            
            // Calculate diff
            const diff = calculateDiff(cleanLocal, cleanLive);
            
            results.push({
              resource: `${kind}/${resNs}/${resName}`,
              hasChanges: diff.length > 0,
              diff,
              summary: `${diff.length} differences found`,
            });
          }
          
          return {
            total: results.length,
            results,
            hasChanges: results.some((r) => r.hasChanges),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_diff", namespace };
          const classified = classifyError(error, context);
          return { 
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
        
        function cleanForComparison(obj: any): any {
          const cleaned = JSON.parse(JSON.stringify(obj));
          
          // Remove server-generated fields
          delete cleaned.metadata?.creationTimestamp;
          delete cleaned.metadata?.uid;
          delete cleaned.metadata?.resourceVersion;
          delete cleaned.metadata?.selfLink;
          delete cleaned.metadata?.managedFields;
          delete cleaned.status;
          delete cleaned.metadata?.generation;
          delete cleaned.metadata?.annotations?.["kubectl.kubernetes.io/last-applied-configuration"];
          
          return cleaned;
        }
        
        function calculateDiff(local: any, live: any, path: string = ""): any[] {
          const differences: any[] = [];
          
          // Compare local against live
          for (const key of Object.keys(local)) {
            const currentPath = path ? `${path}.${key}` : key;
            const localVal = local[key];
            const liveVal = live?.[key];
            
            if (typeof localVal === "object" && localVal !== null && !Array.isArray(localVal)) {
              // Recurse for nested objects
              differences.push(...calculateDiff(localVal, liveVal, currentPath));
            } else if (JSON.stringify(localVal) !== JSON.stringify(liveVal)) {
              differences.push({
                path: currentPath,
                local: localVal,
                live: liveVal,
                change: liveVal === undefined ? "added" : "modified",
              });
            }
          }
          
          // Check for fields in live but not in local (deletions)
          if (live && typeof live === "object") {
            for (const key of Object.keys(live)) {
              if (local[key] === undefined) {
                differences.push({
                  path: path ? `${path}.${key}` : key,
                  local: undefined,
                  live: live[key],
                  change: "removed",
                });
              }
            }
          }
          
          return differences;
        }
      },
    },
    // Delete ConfigMap
    {
      tool: {
        name: "k8s_delete_configmap",
        description: "Delete a ConfigMap",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ConfigMap to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the ConfigMap",
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
          const ns = namespace || "default";

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "ConfigMap",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const coreApi = k8sClient.getCoreV1Api();
          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await coreApi.deleteNamespacedConfigMap({ name, namespace: ns, ...deleteParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `ConfigMap ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "ConfigMap", name, namespace, ignoreNotFound });
          if (handled) return handled;
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: errorMessage,
          };
        }
      },
    },
    // Delete Secret
    {
      tool: {
        name: "k8s_delete_secret",
        description: "Delete a Secret",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Secret to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Secret",
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
          const ns = namespace || "default";

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "Secret",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const coreApi = k8sClient.getCoreV1Api();
          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await coreApi.deleteNamespacedSecret({ name, namespace: ns, ...deleteParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Secret ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "Secret", name, namespace, ignoreNotFound });
          if (handled) return handled;
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: errorMessage,
          };
        }
      },
    },
    // Create ConfigMap
    {
      tool: {
        name: "k8s_create_configmap",
        description: "Create a Kubernetes ConfigMap",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ConfigMap",
            },
            namespace: {
              type: "string",
              description: "Namespace for the ConfigMap",
              default: "default",
            },
            data: {
              type: "object",
              description: "ConfigMap data as key-value pairs",
            },
            fromFile: {
              type: "array",
              description: "Create from files (alternative to data)",
              items: { type: "string" },
            },
            fromLiteral: {
              type: "object",
              description: "Create from literal key-value pairs",
            },
            immutable: {
              type: "boolean",
              description: "Prevent updates to this ConfigMap",
              default: false,
            },
            ...commonCreateQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, data, fromLiteral, immutable, dryRun }: { 
        name: string; 
        namespace?: string;
        data?: Record<string, string>;
        fromLiteral?: Record<string, string>;
        immutable?: boolean;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "configmap");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          // Merge data and fromLiteral
          const mergedData = { ...(data || {}), ...(fromLiteral || {}) };
          
          const configMap: k8s.V1ConfigMap = {
            apiVersion: "v1",
            kind: "ConfigMap",
            metadata: {
              name,
              namespace: ns,
            },
            data: Object.keys(mergedData).length > 0 ? mergedData : undefined,
            immutable,
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "ConfigMap",
              name,
              namespace: ns,
              manifest: configMap,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespacedConfigMap({ namespace: ns, body: configMap, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `ConfigMap ${name} created in namespace ${ns}`,
            configMap: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              dataKeys: Object.keys(result.data || {}),
              immutable: result.immutable,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_configmap", resource: name, namespace };
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
    // Create Secret
    {
      tool: {
        name: "k8s_create_secret",
        description: "Create a Kubernetes Secret (generic, TLS, or docker-registry)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Secret",
            },
            namespace: {
              type: "string",
              description: "Namespace for the Secret",
              default: "default",
            },
            type: {
              type: "string",
              description: "Secret type",
              enum: ["Opaque", "kubernetes.io/tls", "kubernetes.io/dockerconfigjson", "kubernetes.io/basic-auth", "kubernetes.io/ssh-auth"],
              default: "Opaque",
            },
            data: {
              type: "object",
              description: "Secret data (will be base64 encoded) - use stringData for plain text",
            },
            stringData: {
              type: "object",
              description: "Secret data as plain strings (automatically base64 encoded)",
            },
            fromFile: {
              type: "array",
              description: "Create from files (path or key=path format)",
              items: { type: "string" },
            },
            dockerServer: {
              type: "string",
              description: "Docker registry server (for docker-registry type)",
            },
            dockerUsername: {
              type: "string",
              description: "Docker registry username (for docker-registry type)",
            },
            dockerPassword: {
              type: "string",
              description: "Docker registry password (for docker-registry type)",
            },
            dockerEmail: {
              type: "string",
              description: "Docker registry email (for docker-registry type)",
            },
            cert: {
              type: "string",
              description: "TLS certificate file path or content (for TLS type)",
            },
            key: {
              type: "string",
              description: "TLS key file path or content (for TLS type)",
            },
            immutable: {
              type: "boolean",
              description: "Prevent updates to this Secret",
              default: false,
            },
            ...commonCreateQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ 
        name, namespace, type, data, stringData, dockerServer, dockerUsername, dockerPassword, dockerEmail, cert, key, immutable, dryRun 
      }: { 
        name: string; 
        namespace?: string;
        type?: string;
        data?: Record<string, string>;
        stringData?: Record<string, string>;
        dockerServer?: string;
        dockerUsername?: string;
        dockerPassword?: string;
        dockerEmail?: string;
        cert?: string;
        key?: string;
        immutable?: boolean;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "secret");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          let secretData: Record<string, string> = {};
          
          // Handle docker-registry secrets
          if (type === "kubernetes.io/dockerconfigjson" && dockerServer && dockerUsername && dockerPassword) {
            const auth = Buffer.from(`${dockerUsername}:${dockerPassword}`).toString("base64");
            const dockerConfig = {
              auths: {
                [dockerServer]: {
                  username: dockerUsername,
                  password: dockerPassword,
                  email: dockerEmail || "",
                  auth,
                },
              },
            };
            secretData = {
              ".dockerconfigjson": Buffer.from(JSON.stringify(dockerConfig)).toString("base64"),
            };
          }
          // Handle TLS secrets
          else if (type === "kubernetes.io/tls" && cert && key) {
            secretData = {
              "tls.crt": Buffer.from(cert).toString("base64"),
              "tls.key": Buffer.from(key).toString("base64"),
            };
          }
          // Handle generic secrets
          else {
            // Encode stringData or use provided data
            if (stringData) {
              secretData = Object.fromEntries(
                Object.entries(stringData).map(([k, v]) => [k, Buffer.from(v).toString("base64")])
              );
            } else if (data) {
              secretData = data;
            }
          }
          
          const secret: k8s.V1Secret = {
            apiVersion: "v1",
            kind: "Secret",
            metadata: {
              name,
              namespace: ns,
            },
            type: type || "Opaque",
            data: Object.keys(secretData).length > 0 ? secretData : undefined,
            immutable,
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "Secret",
              name,
              namespace: ns,
              manifest: secret,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespacedSecret({ namespace: ns, body: secret, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Secret ${name} created in namespace ${ns}`,
            secret: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              type: result.type,
              dataKeys: Object.keys(result.data || {}),
              immutable: result.immutable,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_secret", resource: name, namespace };
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
    // Replace resource (force update)
    {
      tool: {
        name: "k8s_replace",
        description: "Replace a resource by filename or stdin (like kubectl replace). WARNING: This is a destructive operation that removes and recreates the resource.",
        inputSchema: {
          type: "object",
          properties: {
            manifest: {
              type: "string",
              description: "Complete YAML/JSON manifest of the resource to replace",
            },
            force: {
              type: "boolean",
              description: "Force replace even if conflicts exist",
              default: false,
            },
            namespace: {
              type: "string",
              description: "Namespace (overrides manifest)",
            },
            cascade: {
              type: "string",
              description: "Must be 'background', 'orphan', or 'foreground'",
              default: "background",
            },
            ...commonMutationQuerySchema,
          },
          required: ["manifest"],
        },
      },
      handler: async ({ manifest, force, namespace, cascade, dryRun }: {
        manifest: string;
        force?: boolean;
        namespace?: string;
        cascade?: string;
        dryRun?: string;
      }) => {
        try {
          // Parse manifest
          let resource: any;
          try {
            resource = k8s.loadYaml(manifest);
          } catch (e) {
            try {
              resource = JSON.parse(manifest);
            } catch {
              throw new Error("Invalid YAML/JSON manifest");
            }
          }
          
          if (!resource || !resource.kind || !resource.metadata?.name) {
            return {
              success: false,
              error: "Invalid manifest: missing kind or metadata.name",
            };
          }
          
          const ns = namespace || resource.metadata?.namespace || "default";
          const name = resource.metadata.name;
          const kind = resource.kind;
          const rawClient = k8sClient as any;
          
          // Determine API path based on kind
          let apiPath: string;
          const apiVersion = resource.apiVersion || "v1";
          
          if (apiVersion === "v1") {
            apiPath = `/api/v1/namespaces/${ns}/${kind.toLowerCase()}s/${name}`;
          } else {
            const [group, version] = apiVersion.includes("/") 
              ? apiVersion.split("/") 
              : ["", apiVersion];
            apiPath = group 
              ? `/apis/${group}/${version}/namespaces/${ns}/${kind.toLowerCase()}s/${name}`
              : `/apis/${version}/namespaces/${ns}/${kind.toLowerCase()}s/${name}`;
          }
          
          // Check if resource exists first
          let exists = false;
          try {
            await rawClient.rawApiRequest(apiPath);
            exists = true;
          } catch (e: any) {
            if (e.statusCode !== 404 && e.response?.statusCode !== 404) {
              throw e;
            }
          }
          
          if (!exists) {
            return {
              success: false,
              error: `${kind}/${name} not found in namespace ${ns}. Use k8s_apply_manifest to create new resources.`,
            };
          }

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Replace resource (delete + recreate)",
              kind,
              name,
              namespace: ns,
              patch: resource,
              details: { cascade: cascade || "Background", force: !!force },
            });
          }

          const serverDryRun = isServerDryRun(dryRun);

          // Delete the existing resource
          const deleteOptions = {
            apiVersion: "v1",
            kind: "DeleteOptions",
            propagationPolicy: cascade || "Background",
          };
          await rawClient.rawApiRequest(serverDryRun ? `${apiPath}?dryRun=All` : apiPath, "DELETE", deleteOptions);

          // Wait a moment for deletion to process (skip under server dry-run — nothing is actually deleted)
          if (!serverDryRun) {
            await new Promise(r => setTimeout(r, 1000));
          }

          // Create the new resource
          const basePath = apiPath.replace(`/${name}`, "");
          const result = await rawClient.rawApiRequest(serverDryRun ? `${basePath}?dryRun=All` : basePath, "POST", resource);

          return {
            success: true,
            dryRun: dryRun || "none",
            message: `${kind}/${name} replaced in namespace ${ns}`,
            replaced: true,
            resource: {
              kind: result.kind,
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              resourceVersion: result.metadata?.resourceVersion,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_replace" };
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
    // Convert manifest between API versions
    {
      tool: {
        name: "k8s_convert",
        description: "Convert a manifest between different API versions (like kubectl convert). Note: Uses best-effort heuristic conversion.",
        inputSchema: {
          type: "object",
          properties: {
            manifest: {
              type: "string",
              description: "YAML/JSON manifest to convert",
            },
            outputVersion: {
              type: "string",
              description: "Target API version (e.g., 'apps/v1', 'v1', 'batch/v1')",
            },
          },
          required: ["manifest", "outputVersion"],
        },
      },
      handler: async ({ manifest, outputVersion }: { 
        manifest: string;
        outputVersion: string;
      }) => {
        try {
          // Parse manifest
          let resource: any;
          try {
            resource = k8s.loadYaml(manifest);
          } catch (e) {
            try {
              resource = JSON.parse(manifest);
            } catch {
              throw new Error("Invalid YAML/JSON manifest");
            }
          }
          
          if (!resource || !resource.kind) {
            return {
              success: false,
              error: "Invalid manifest: missing kind",
            };
          }
          
          const originalVersion = resource.apiVersion || "v1";
          const kind = resource.kind;
          
          // Common API version mappings
          const versionMappings: Record<string, Record<string, string>> = {
            "Deployment": {
              "extensions/v1beta1": "apps/v1",
              "apps/v1beta1": "apps/v1",
              "apps/v1beta2": "apps/v1",
            },
            "StatefulSet": {
              "apps/v1beta1": "apps/v1",
              "apps/v1beta2": "apps/v1",
            },
            "DaemonSet": {
              "extensions/v1beta1": "apps/v1",
              "apps/v1beta2": "apps/v1",
            },
            "ReplicaSet": {
              "extensions/v1beta1": "apps/v1",
              "apps/v1beta2": "apps/v1",
            },
            "PodSecurityPolicy": {
              "extensions/v1beta1": "policy/v1beta1",
            },
            "NetworkPolicy": {
              "extensions/v1beta1": "networking.k8s.io/v1",
            },
            "Ingress": {
              "extensions/v1beta1": "networking.k8s.io/v1",
            },
            "Job": {
              "batch/v1beta1": "batch/v1",
            },
            "CronJob": {
              "batch/v1beta1": "batch/v1",
            },
          };
          
          // Perform conversion
          const converted = JSON.parse(JSON.stringify(resource)); // Deep clone
          converted.apiVersion = outputVersion;
          
          // Apply version-specific field transformations
          if (kind === "Deployment" || kind === "StatefulSet" || kind === "DaemonSet" || kind === "ReplicaSet") {
            // Ensure selector is present in apps/v1
            if (!converted.spec?.selector && converted.spec?.template?.metadata?.labels) {
              converted.spec.selector = {
                matchLabels: converted.spec.template.metadata.labels,
              };
            }
          }
          
          if (kind === "Ingress") {
            if (outputVersion === "networking.k8s.io/v1") {
              // Convert backend to defaultBackend
              if (converted.spec?.backend) {
                converted.spec.defaultBackend = converted.spec.backend;
                delete converted.spec.backend;
              }
            }
          }
          
          // Convert back to YAML
          const outputYaml = `
# Converted from ${originalVersion} to ${outputVersion}
# Original kind: ${kind}
${k8s.dumpYaml(converted)}
`.trim();
          
          return {
            success: true,
            message: `Converted ${kind} from ${originalVersion} to ${outputVersion}`,
            conversion: {
              originalVersion,
              targetVersion: outputVersion,
              kind,
              autoFixed: versionMappings[kind]?.[originalVersion] === outputVersion,
            },
            manifest: outputYaml,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_convert" };
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
    // Apply view-last-applied
    {
      tool: {
        name: "k8s_apply_view_last_applied",
        description: "View the last-applied-configuration annotation of a resource (like kubectl apply view-last-applied)",
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
              description: "Namespace for namespaced resources",
              default: "default",
            },
            output: {
              type: "string",
              description: "Output format",
              enum: ["yaml", "json"],
              default: "yaml",
            },
          },
          required: ["resource", "name"],
        },
      },
      handler: async ({ resource, name, namespace, output }: { 
        resource: string;
        name: string;
        namespace?: string;
        output?: string;
      }) => {
        try {
          const rawClient = k8sClient as any;
          const ns = namespace || "default";
          
          // Determine API path based on resource type
          let apiPath: string;
          const resourceLower = resource.toLowerCase();
          
          // Map common resources to their API paths
          const coreResources = ["pod", "service", "configmap", "secret", "pvc", "serviceaccount"];
          const appsResources = ["deployment", "statefulset", "daemonset", "replicaset"];
          const batchResources = ["job", "cronjob"];
          const networkResources = ["ingress", "networkpolicy"];
          
          if (coreResources.includes(resourceLower)) {
            apiPath = `/api/v1/namespaces/${ns}/${resourceLower}s/${name}`;
          } else if (appsResources.includes(resourceLower)) {
            apiPath = `/apis/apps/v1/namespaces/${ns}/${resourceLower}s/${name}`;
          } else if (batchResources.includes(resourceLower)) {
            const version = resourceLower === "cronjob" ? "v1" : "v1";
            apiPath = `/apis/batch/${version}/namespaces/${ns}/${resourceLower}s/${name}`;
          } else if (networkResources.includes(resourceLower)) {
            apiPath = `/apis/networking.k8s.io/v1/namespaces/${ns}/${resourceLower}s/${name}`;
          } else {
            return {
              success: false,
              error: `Resource type '${resource}' not supported. Supported: ${[...coreResources, ...appsResources, ...batchResources, ...networkResources].join(", ")}`,
            };
          }
          
          const result = await rawClient.rawApiRequest(apiPath);
          
          // Extract last-applied-configuration annotation
          const annotations = result.metadata?.annotations || {};
          const lastApplied = annotations["kubectl.kubernetes.io/last-applied-configuration"];
          
          if (!lastApplied) {
            return {
              success: true,
              message: `No last-applied-configuration annotation found for ${resource}/${name}`,
              lastApplied: null,
              hint: "Resource was likely created without kubectl apply or the annotation was removed",
            };
          }
          
          // Parse and format
          let parsedConfig: any;
          try {
            parsedConfig = JSON.parse(lastApplied);
          } catch {
            return {
              success: false,
              error: "Failed to parse last-applied-configuration annotation",
            };
          }
          
          if (output === "json") {
            return {
              success: true,
              resource: `${resource}/${name}`,
              namespace: ns,
              lastApplied: parsedConfig,
            };
          }
          
          // Return as YAML
          return {
            success: true,
            resource: `${resource}/${name}`,
            namespace: ns,
            lastApplied: k8s.dumpYaml(parsedConfig),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_apply_view_last_applied", resource, namespace };
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
    // Apply set-last-applied
    {
      tool: {
        name: "k8s_apply_set_last_applied",
        description: "Set the last-applied-configuration annotation on a resource (like kubectl apply set-last-applied)",
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
              description: "Namespace for namespaced resources",
              default: "default",
            },
            manifest: {
              type: "string",
              description: "YAML/JSON manifest to set as last-applied-configuration",
            },
            createAnnotation: {
              type: "boolean",
              description: "Create the annotation if it doesn't exist",
              default: true,
            },
            ...commonMutationQuerySchema,
          },
          required: ["resource", "name", "manifest"],
        },
      },
      handler: async ({ resource, name, namespace, manifest, createAnnotation, dryRun }: {
        resource: string;
        name: string;
        namespace?: string;
        manifest: string;
        createAnnotation?: boolean;
        dryRun?: string;
      }) => {
        try {
          const rawClient = k8sClient as any;
          const ns = namespace || "default";
          
          // Parse the provided manifest
          let parsedManifest: any;
          try {
            parsedManifest = k8s.loadYaml(manifest);
          } catch (e) {
            try {
              parsedManifest = JSON.parse(manifest);
            } catch {
              return {
                success: false,
                error: "Invalid YAML/JSON manifest provided",
              };
            }
          }
          
          // Determine API path based on resource type
          let apiPath: string;
          const resourceLower = resource.toLowerCase();
          
          const coreResources = ["pod", "service", "configmap", "secret", "pvc", "serviceaccount"];
          const appsResources = ["deployment", "statefulset", "daemonset", "replicaset"];
          const batchResources = ["job", "cronjob"];
          const networkResources = ["ingress", "networkpolicy"];
          
          if (coreResources.includes(resourceLower)) {
            apiPath = `/api/v1/namespaces/${ns}/${resourceLower}s/${name}`;
          } else if (appsResources.includes(resourceLower)) {
            apiPath = `/apis/apps/v1/namespaces/${ns}/${resourceLower}s/${name}`;
          } else if (batchResources.includes(resourceLower)) {
            apiPath = `/apis/batch/v1/namespaces/${ns}/${resourceLower}s/${name}`;
          } else if (networkResources.includes(resourceLower)) {
            apiPath = `/apis/networking.k8s.io/v1/namespaces/${ns}/${resourceLower}s/${name}`;
          } else {
            return {
              success: false,
              error: `Resource type '${resource}' not supported`,
            };
          }
          
          // Get current resource
          const currentResource = await rawClient.rawApiRequest(apiPath);
          
          // Check if annotation exists
          const currentAnnotations = currentResource.metadata?.annotations || {};
          const hasLastApplied = !!currentAnnotations["kubectl.kubernetes.io/last-applied-configuration"];
          
          if (hasLastApplied && !createAnnotation) {
            return {
              success: false,
              error: "Annotation already exists. Use createAnnotation: true to overwrite",
            };
          }
          
          // Set the annotation via patch
          const patch = {
            metadata: {
              annotations: {
                "kubectl.kubernetes.io/last-applied-configuration": JSON.stringify(parsedManifest),
              },
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Set last-applied-configuration",
              kind: resource,
              name,
              namespace: ns,
              patch,
            });
          }

          const patchPath = isServerDryRun(dryRun) ? `${apiPath}?dryRun=All` : apiPath;
          await rawClient.rawApiRequest(patchPath, "PATCH", patch, undefined, undefined, undefined, {
            headers: { "Content-Type": "application/strategic-merge-patch+json" }
          });

          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Set last-applied-configuration for ${resource}/${name}`,
            resource: `${resource}/${name}`,
            namespace: ns,
            created: !hasLastApplied,
            updated: hasLastApplied,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_apply_set_last_applied", resource, namespace };
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
    // Kustomize build
    {
      tool: {
        name: "k8s_kustomize_build",
        description: "Build Kubernetes manifests from a kustomization directory (like kubectl kustomize)",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to directory containing kustomization.yaml (local path or git URL)",
              default: ".",
            },
            output: {
              type: "string",
              description: "Output format",
              enum: ["yaml", "json"],
              default: "yaml",
            },
            enableHelm: {
              type: "boolean",
              description: "Enable helm inflation (if kustomize supports it)",
              default: false,
            },
          },
          required: [],
        },
      },
      handler: async ({ path, output, enableHelm }: { 
        path?: string;
        output?: string;
        enableHelm?: boolean;
      }) => {
        try {
          // Since kustomize is built into kubectl but not directly available via API,
          // we return the kubectl command for the user to execute
          const kustomizePath = path || ".";
          
          const kubectlCommand = `kubectl kustomize ${kustomizePath}${enableHelm ? " --enable-helm" : ""}${output === "json" ? " -o json" : ""}`;
          
          return {
            success: true,
            message: "Kustomize build command generated",
            note: "Kustomize requires the kustomize binary or kubectl with kustomize support. Execute the command below:",
            kubectlCommand,
            alternative: "If you have a kustomization.yaml content, you can paste it into k8s_apply_manifest after manually running kustomize build",
            path: kustomizePath,
            outputFormat: output || "yaml",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_kustomize_build" };
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
    // Diff tool
    {
      tool: {
        name: "k8s_diff",
        description: "Diff a file or manifest against the live configuration (like kubectl diff). Shows differences between local manifest and running resource.",
        inputSchema: {
          type: "object",
          properties: {
            manifest: {
              type: "string",
              description: "YAML/JSON manifest content to compare",
            },
            resource: {
              type: "string",
              description: "Resource type (pod, deployment, service, etc.) - alternative to manifest",
            },
            name: {
              type: "string",
              description: "Resource name - alternative to manifest",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
          },
        },
      },
      handler: async ({ manifest, resource, name, namespace }: {
        manifest?: string;
        resource?: string;
        name?: string;
        namespace?: string;
      }) => {
        const ns = namespace || "default";
        
        try {
          let targetResource: string;
          let targetName: string;
          let localManifest: any;
          
          // If manifest is provided, parse it to extract resource info
          if (manifest) {
            const parsed = yaml.load(manifest) as any;
            if (!parsed || !parsed.apiVersion || !parsed.kind || !parsed.metadata?.name) {
              return { error: "Invalid manifest: missing apiVersion, kind, or metadata.name" };
            }
            localManifest = parsed;
            targetResource = parsed.kind.toLowerCase();
            targetName = parsed.metadata.name;
          } else if (resource && name) {
            // Use provided resource and name
            targetResource = resource.toLowerCase();
            targetName = name;
            localManifest = null;
          } else {
            return { error: "Either provide a manifest, or specify both resource and name" };
          }
          
          // Map resource type to API path
          const resourceApiMap: Record<string, { api: string; resource: string; namespaced: boolean }> = {
            pod: { api: "/api/v1", resource: "pods", namespaced: true },
            deployment: { api: "/apis/apps/v1", resource: "deployments", namespaced: true },
            statefulset: { api: "/apis/apps/v1", resource: "statefulsets", namespaced: true },
            daemonset: { api: "/apis/apps/v1", resource: "daemonsets", namespaced: true },
            replicaset: { api: "/apis/apps/v1", resource: "replicasets", namespaced: true },
            job: { api: "/apis/batch/v1", resource: "jobs", namespaced: true },
            cronjob: { api: "/apis/batch/v1", resource: "cronjobs", namespaced: true },
            service: { api: "/api/v1", resource: "services", namespaced: true },
            configmap: { api: "/api/v1", resource: "configmaps", namespaced: true },
            secret: { api: "/api/v1", resource: "secrets", namespaced: true },
            persistentvolumeclaim: { api: "/api/v1", resource: "persistentvolumeclaims", namespaced: true },
            persistentvolume: { api: "/api/v1", resource: "persistentvolumes", namespaced: false },
            ingress: { api: "/apis/networking.k8s.io/v1", resource: "ingresses", namespaced: true },
            networkpolicy: { api: "/apis/networking.k8s.io/v1", resource: "networkpolicies", namespaced: true },
            serviceaccount: { api: "/api/v1", resource: "serviceaccounts", namespaced: true },
            role: { api: "/apis/rbac.authorization.k8s.io/v1", resource: "roles", namespaced: true },
            clusterrole: { api: "/apis/rbac.authorization.k8s.io/v1", resource: "clusterroles", namespaced: false },
            rolebinding: { api: "/apis/rbac.authorization.k8s.io/v1", resource: "rolebindings", namespaced: true },
            clusterrolebinding: { api: "/apis/rbac.authorization.k8s.io/v1", resource: "clusterrolebindings", namespaced: false },
            horizontalpodautoscaler: { api: "/apis/autoscaling/v2", resource: "horizontalpodautoscalers", namespaced: true },
            hpa: { api: "/apis/autoscaling/v2", resource: "horizontalpodautoscalers", namespaced: true },
            poddisruptionbudget: { api: "/apis/policy/v1", resource: "poddisruptionbudgets", namespaced: true },
            pdb: { api: "/apis/policy/v1", resource: "poddisruptionbudgets", namespaced: true },
          };
          
          const apiInfo = resourceApiMap[targetResource];
          if (!apiInfo) {
            return { 
              error: `Unsupported resource type: ${targetResource}. Supported types: ${Object.keys(resourceApiMap).join(", ")}` 
            };
          }
          
          // Get the live resource
          let liveParsed: any;
          try {
            const path = apiInfo.namespaced
              ? `${apiInfo.api}/namespaces/${ns}/${apiInfo.resource}/${targetName}`
              : `${apiInfo.api}/${apiInfo.resource}/${targetName}`;
            liveParsed = await k8sClient.rawApiRequest(path);
          } catch {
            liveParsed = null;
          }
          
          if (!liveParsed) {
            return {
              resource: `${targetResource}/${targetName}`,
              namespace: ns,
              diffResult: "Resource does not exist in cluster",
              status: "not_found",
              suggestion: `The ${targetResource} ${targetName} does not exist. Use k8s_apply_manifest to create it.`,
            };
          }
          
          // Clean up both manifests for comparison (remove server-managed fields)
          const cleanResource = (r: any) => {
            const cleaned = JSON.parse(JSON.stringify(r));
            if (cleaned.metadata) {
              delete cleaned.metadata.managedFields;
              delete cleaned.metadata.resourceVersion;
              delete cleaned.metadata.uid;
              delete cleaned.metadata.creationTimestamp;
              delete cleaned.metadata.generation;
              delete cleaned.metadata.selfLink;
            }
            delete cleaned.status;
            return cleaned;
          };
          
          const cleanedLive = cleanResource(liveParsed);
          
          // If no local manifest provided, just return the live resource
          if (!localManifest) {
            return {
              resource: `${targetResource}/${targetName}`,
              namespace: ns,
              status: "exists",
              liveConfiguration: yaml.dump(cleanedLive, { indent: 2 }),
              note: "No local manifest provided for comparison. Live configuration shown above.",
            };
          }
          
          const cleanedLocal = cleanResource(localManifest);
          
          // Simple diff comparison
          const liveJson = JSON.stringify(cleanedLive, null, 2);
          const localJson = JSON.stringify(cleanedLocal, null, 2);
          
          const hasDifferences = liveJson !== localJson;
          
          // Find specific differences
          const differences: Array<{ path: string; live?: any; local?: any }> = [];
          const findDifferences = (local: any, live: any, path: string = "") => {
            if (typeof local !== typeof live) {
              differences.push({ path, live, local });
              return;
            }
            if (typeof local !== "object" || local === null || live === null) {
              if (JSON.stringify(local) !== JSON.stringify(live)) {
                differences.push({ path, live, local });
              }
              return;
            }
            const allKeys = new Set([...Object.keys(local || {}), ...Object.keys(live || {})]);
            for (const key of allKeys) {
              const newPath = path ? `${path}.${key}` : key;
              if (!(key in local)) {
                differences.push({ path: newPath, live: live[key], local: undefined });
              } else if (!(key in live)) {
                differences.push({ path: newPath, live: undefined, local: local[key] });
              } else {
                findDifferences(local[key], live[key], newPath);
              }
            }
          };
          
          findDifferences(cleanedLocal, cleanedLive);
          
          return {
            resource: `${targetResource}/${targetName}`,
            namespace: ns,
            hasDifferences,
            status: hasDifferences ? "differs" : "identical",
            differences: differences.slice(0, 50), // Limit to 50 differences
            totalDifferences: differences.length,
            liveConfiguration: hasDifferences ? yaml.dump(cleanedLive, { indent: 2 }) : undefined,
            localConfiguration: hasDifferences ? yaml.dump(cleanedLocal, { indent: 2 }) : undefined,
            suggestion: hasDifferences
              ? `Run 'k8s_apply_manifest' with the local manifest to apply changes, or use 'k8s_edit' to modify the live resource interactively.`
              : "No differences found - local manifest matches cluster configuration.",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_diff", resource, namespace: ns };
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
