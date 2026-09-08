import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace, validatePort } from "../validators.js";
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

export function registerNetworkingTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_services",
        description: "List all services",
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
          const services = await k8sClient.listServices(namespace, { labelSelector, fieldSelector });
          const mapped = services.map((svc: k8s.V1Service) => ({
            name: svc.metadata?.name,
            namespace: svc.metadata?.namespace,
            type: svc.spec?.type,
            clusterIP: svc.spec?.clusterIP,
            externalIPs: svc.spec?.externalIPs,
            externalName: svc.spec?.externalName,
            ports: svc.spec?.ports?.map((p: k8s.V1ServicePort) => ({
              name: p.name,
              port: p.port,
              targetPort: p.targetPort,
              protocol: p.protocol,
              nodePort: p.nodePort,
            })),
            selector: svc.spec?.selector,
            sessionAffinity: svc.spec?.sessionAffinity,
            age: svc.metadata?.creationTimestamp,
            labels: svc.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            services: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_services", namespace };
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
    // Get Service
    {
      tool: {
        name: "k8s_get_service",
        description: "Get detailed information about a Service",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Service",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Service",
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
          validateResourceName(name, "service");
          const coreApi = k8sClient.getCoreV1Api();
          const [svcResult, endpointsResult] = await Promise.all([
            coreApi.readNamespacedService({ name, namespace: namespace || "default" }),
            coreApi.readNamespacedEndpoints({ name, namespace: namespace || "default" }).catch(() => null),
          ]);
          const svc = svcResult;

          const rawResult = {
            name: svc.metadata?.name,
            namespace: svc.metadata?.namespace,
            labels: svc.metadata?.labels,
            annotations: svc.metadata?.annotations,
            creationTimestamp: svc.metadata?.creationTimestamp,
            type: svc.spec?.type,
            clusterIP: svc.spec?.clusterIP,
            externalIPs: svc.spec?.externalIPs,
            externalName: svc.spec?.externalName,
            loadBalancerIP: svc.spec?.loadBalancerIP,
            selector: svc.spec?.selector,
            ports: svc.spec?.ports?.map((p: k8s.V1ServicePort) => ({
              name: p.name,
              port: p.port,
              targetPort: p.targetPort,
              protocol: p.protocol,
              nodePort: p.nodePort,
            })),
            sessionAffinity: svc.spec?.sessionAffinity,
            externalTrafficPolicy: svc.spec?.externalTrafficPolicy,
            healthCheckNodePort: svc.spec?.healthCheckNodePort,
            publishNotReadyAddresses: svc.spec?.publishNotReadyAddresses,
            status: {
              loadBalancer: svc.status?.loadBalancer?.ingress?.map((lb: k8s.V1LoadBalancerIngress) => ({
                ip: lb.ip,
                hostname: lb.hostname,
              })),
            },
            endpoints: endpointsResult?.subsets?.map((subset: k8s.V1EndpointSubset) => ({
              addresses: subset.addresses?.map((a: k8s.V1EndpointAddress) => ({
                ip: a.ip,
                hostname: a.hostname,
                nodeName: a.nodeName,
                targetRef: a.targetRef?.name,
              })),
              ports: subset.ports?.map((p: k8s.CoreV1EndpointPort) => ({
                name: p.name,
                port: p.port,
                protocol: p.protocol,
              })),
            })) || [],
          };

          return applyGetFormatting(rawResult, {
            kind: "Service",
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
              message: `Service "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_service", resource: name, namespace };
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
        name: "k8s_get_service_endpoints",
        description: "Get endpoints for a service",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the service",
            },
            namespace: {
              type: "string",
              description: "Namespace of the service",
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
          validateResourceName(name, "service");
          const coreApi = k8sClient.getCoreV1Api();
          const [service, endpoints] = await Promise.all([
            coreApi.readNamespacedService({ name, namespace: namespace || "default" }),
            coreApi.readNamespacedEndpoints({ name, namespace: namespace || "default" }).catch(() => null),
          ]);

          const rawResult = {
            service: {
              name: service.metadata?.name,
              namespace: service.metadata?.namespace,
              labels: service.metadata?.labels,
              annotations: service.metadata?.annotations,
              creationTimestamp: service.metadata?.creationTimestamp,
              selector: service.spec?.selector,
              ports: service.spec?.ports,
            },
            endpoints: endpoints?.subsets?.map((subset: k8s.V1EndpointSubset) => ({
              addresses: subset.addresses?.map((a: k8s.V1EndpointAddress) => ({
                ip: a.ip,
                hostname: a.hostname,
                nodeName: a.nodeName,
                targetRef: a.targetRef,
              })),
              notReadyAddresses: subset.notReadyAddresses?.map((a: k8s.V1EndpointAddress) => ({
                ip: a.ip,
                hostname: a.hostname,
              })),
              ports: subset.ports?.map((p: k8s.CoreV1EndpointPort) => ({
                name: p.name,
                port: p.port,
                protocol: p.protocol,
              })),
            })) || [],
            totalEndpoints: endpoints?.subsets?.reduce((sum: number, s: k8s.V1EndpointSubset) => 
              sum + (s.addresses?.length || 0), 0) || 0,
          };

          return applyGetFormatting(rawResult, {
            kind: "Endpoints",
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
              message: `Endpoints for service "${name}" not found in namespace "${namespace || "default"}"`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_service_endpoints", resource: name, namespace };
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
        name: "k8s_list_ingresses",
        description: "List all Ingresses",
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
          const ingresses = await k8sClient.listIngresses(namespace, { labelSelector, fieldSelector });
          const mapped = ingresses.map((ing: k8s.V1Ingress) => ({
            name: ing.metadata?.name,
            namespace: ing.metadata?.namespace,
            class: ing.spec?.ingressClassName,
            rules: ing.spec?.rules?.map((rule: k8s.V1IngressRule) => ({
              host: rule.host,
              paths: rule.http?.paths?.map((path: k8s.V1HTTPIngressPath) => ({
                path: path.path,
                pathType: path.pathType,
                serviceName: path.backend?.service?.name,
                servicePort: path.backend?.service?.port?.number || path.backend?.service?.port?.name,
              })),
            })),
            tls: ing.spec?.tls?.map((tls: k8s.V1IngressTLS) => ({
              hosts: tls.hosts,
              secretName: tls.secretName,
            })),
            loadBalancer: ing.status?.loadBalancer?.ingress?.map((lb: k8s.V1LoadBalancerIngress) => ({
              ip: lb.ip,
              hostname: lb.hostname,
            })),
            age: ing.metadata?.creationTimestamp,
            labels: ing.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            ingresses: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_ingresses", namespace };
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
        name: "k8s_list_network_policies",
        description: "List all NetworkPolicies",
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
          const netApi = k8sClient.getNetworkingV1Api();
          const response = namespace
            ? await netApi.listNamespacedNetworkPolicy({ namespace, labelSelector, fieldSelector })
            : await netApi.listNetworkPolicyForAllNamespaces({ labelSelector, fieldSelector });
          
          const mapped = response.items.map((np: k8s.V1NetworkPolicy) => ({
            name: np.metadata?.name,
            namespace: np.metadata?.namespace,
            podSelector: np.spec?.podSelector,
            policyTypes: np.spec?.policyTypes,
            ingressRules: np.spec?.ingress?.length || 0,
            egressRules: np.spec?.egress?.length || 0,
            age: np.metadata?.creationTimestamp,
            labels: np.metadata?.labels,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            networkPolicies: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_network_policies", namespace };
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
    // Get Ingress
    {
      tool: {
        name: "k8s_get_ingress",
        description: "Get detailed information about an Ingress",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Ingress",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Ingress",
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
          validateResourceName(name, "ingress");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const ing = await netApi.readNamespacedIngress({ name, namespace: namespace || "default" });

          const rawResult = {
            name: ing.metadata?.name,
            namespace: ing.metadata?.namespace,
            ingressClassName: ing.spec?.ingressClassName,
            rules: ing.spec?.rules?.map((rule: k8s.V1IngressRule) => ({
              host: rule.host,
              paths: rule.http?.paths?.map((path: k8s.V1HTTPIngressPath) => ({
                path: path.path,
                pathType: path.pathType,
                service: {
                  name: path.backend?.service?.name,
                  port: path.backend?.service?.port?.number || path.backend?.service?.port?.name,
                },
              })),
            })),
            tls: ing.spec?.tls?.map((tls: k8s.V1IngressTLS) => ({
              hosts: tls.hosts,
              secretName: tls.secretName,
            })),
            status: {
              loadBalancer: ing.status?.loadBalancer?.ingress?.map((lb: k8s.V1LoadBalancerIngress) => ({
                ip: lb.ip,
                hostname: lb.hostname,
              })),
            },
            annotations: ing.metadata?.annotations,
          };

          return applyGetFormatting(rawResult, {
            kind: "Ingress",
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
              namespace: namespace || "default",
              message: `Ingress '${name}' not found`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_ingress", resource: name, namespace };
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
    // Get NetworkPolicy
    {
      tool: {
        name: "k8s_get_network_policy",
        description: "Get detailed information about a NetworkPolicy",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the NetworkPolicy",
            },
            namespace: {
              type: "string",
              description: "Namespace of the NetworkPolicy",
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
          validateResourceName(name, "networkpolicy");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const result = await netApi.readNamespacedNetworkPolicy({ name, namespace: namespace || "default" });
          const np = result;

          const rawResult = {
            name: np.metadata?.name,
            namespace: np.metadata?.namespace,
            podSelector: np.spec?.podSelector,
            policyTypes: np.spec?.policyTypes,
            ingress: np.spec?.ingress?.map((rule: k8s.V1NetworkPolicyIngressRule) => ({
              from: (rule as any).from?.map((from: k8s.V1NetworkPolicyPeer) => ({
                podSelector: from.podSelector,
                namespaceSelector: from.namespaceSelector,
                ipBlock: from.ipBlock ? {
                  cidr: from.ipBlock.cidr,
                  except: from.ipBlock.except,
                } : undefined,
              })),
              ports: rule.ports?.map((port: k8s.V1NetworkPolicyPort) => ({
                protocol: port.protocol,
                port: port.port,
              })),
            })),
            egress: np.spec?.egress?.map((rule: k8s.V1NetworkPolicyEgressRule) => ({
              to: rule.to?.map((to: k8s.V1NetworkPolicyPeer) => ({
                podSelector: to.podSelector,
                namespaceSelector: to.namespaceSelector,
                ipBlock: to.ipBlock ? {
                  cidr: to.ipBlock.cidr,
                  except: to.ipBlock.except,
                } : undefined,
              })),
              ports: rule.ports?.map((port: k8s.V1NetworkPolicyPort) => ({
                protocol: port.protocol,
                port: port.port,
              })),
            })),
          };

          return applyGetFormatting(rawResult, {
            kind: "NetworkPolicy",
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
              namespace: namespace || "default",
              message: `NetworkPolicy '${name}' not found`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_network_policy", resource: name, namespace };
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
        name: "k8s_test_dns",
        description: "Test DNS resolution within the cluster",
        inputSchema: {
          type: "object",
          properties: {
            hostname: {
              type: "string",
              description: "Hostname to resolve",
            },
            namespace: {
              type: "string",
              description: "Namespace context for short names",
              default: "default",
            },
          },
          required: ["hostname"],
        },
      },
      handler: async ({ hostname, namespace }: { hostname: string; namespace?: string }) => {
        // Create a temporary pod to test DNS resolution
        const coreApi = k8sClient.getCoreV1Api();
        const testPodName = `dns-test-${Date.now()}`;
        const ns = namespace || "default";
        
        const pod: k8s.V1Pod = {
          apiVersion: "v1",
          kind: "Pod",
          metadata: {
            name: testPodName,
            namespace: ns,
          },
          spec: {
            restartPolicy: "Never",
            containers: [
              {
                name: "dns-test",
                image: "busybox:latest",
                command: ["nslookup", hostname],
              },
            ],
          },
        };

        try {
          await coreApi.createNamespacedPod({ namespace: ns, body: pod });
          
          // Wait for pod completion (simplified - in production use watch)
          await new Promise((resolve) => setTimeout(resolve, 5000));
          
          const podStatus = await coreApi.readNamespacedPod({ name: testPodName, namespace: ns });
          const logs = await coreApi.readNamespacedPodLog({ name: testPodName, namespace: ns });
          
          // Clean up
          await coreApi.deleteNamespacedPod({ name: testPodName, namespace: ns });
          
          const succeeded = podStatus.status?.phase === "Succeeded";
          
          return {
            hostname,
            namespace: ns,
            resolved: succeeded,
            logs: logs,
            message: succeeded 
              ? `DNS resolution for ${hostname} succeeded`
              : `DNS resolution for ${hostname} failed`,
          };
        } catch (error) {
          // Clean up on error
          try {
            await coreApi.deleteNamespacedPod({ name: testPodName, namespace: ns });
          } catch {}
          
          const context: ErrorContext = { operation: "k8s_test_dns", resource: hostname, namespace: ns };
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
        name: "k8s_service_topology",
        description: "Show service-to-pod mapping for visualization",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to analyze",
              default: "default",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const ns = namespace || "default";
          const coreApi = k8sClient.getCoreV1Api();
          
          const [services, pods] = await Promise.all([
            coreApi.listNamespacedService({ namespace: ns }),
            coreApi.listNamespacedPod({ namespace: ns }),
          ]);

          const topology = services.items.map((svc: k8s.V1Service) => {
            const selector = svc.spec?.selector || {};
            
            // Find matching pods
            const matchingPods = pods.items.filter((pod: k8s.V1Pod) => {
              const labels = pod.metadata?.labels || {};
              return Object.entries(selector).every(([key, value]) => labels[key] === value);
            });

            return {
              service: {
                name: svc.metadata?.name,
                type: svc.spec?.type,
                clusterIP: svc.spec?.clusterIP,
                selector: svc.spec?.selector,
              },
              endpoints: matchingPods.map((pod: k8s.V1Pod) => ({
                podName: pod.metadata?.name,
                podIP: pod.status?.podIP,
                status: pod.status?.phase,
                ready: pod.status?.containerStatuses?.every((c: k8s.V1ContainerStatus) => c.ready),
              })),
              endpointCount: matchingPods.length,
            };
          });

          return {
            namespace: ns,
            services: topology,
            totalServices: topology.length,
            servicesWithEndpoints: topology.filter((t) => t.endpointCount > 0).length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_service_topology", namespace };
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
    // Delete Service
    {
      tool: {
        name: "k8s_delete_service",
        description: "Delete a Service",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Service to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Service",
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
          validateResourceName(name, "service");

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "Service",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const coreApi = k8sClient.getCoreV1Api();
          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await coreApi.deleteNamespacedService({ name, namespace: ns, ...deleteParams });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Service ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "Service", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_service", resource: name, namespace: ns };
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
    // Delete Ingress
    {
      tool: {
        name: "k8s_delete_ingress",
        description: "Delete an Ingress",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Ingress to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Ingress",
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
          validateResourceName(name, "ingress");

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "Ingress",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await netApi.deleteNamespacedIngress({ name, namespace: ns, ...deleteParams });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Ingress ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "Ingress", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_ingress", resource: name, namespace: ns };
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
    // Create Service
    {
      tool: {
        name: "k8s_create_service",
        description: "Create a new Kubernetes Service",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Service",
            },
            namespace: {
              type: "string",
              description: "Namespace for the Service",
              default: "default",
            },
            type: {
              type: "string",
              description: "Service type (ClusterIP, NodePort, LoadBalancer, ExternalName)",
              enum: ["ClusterIP", "NodePort", "LoadBalancer", "ExternalName"],
              default: "ClusterIP",
            },
            selector: {
              type: "object",
              description: "Label selector for targeting pods (e.g., {app: 'nginx'})",
            },
            ports: {
              type: "array",
              description: "Service ports",
              items: {
                type: "object",
                properties: {
                  port: { type: "number" },
                  targetPort: { type: "number" },
                  protocol: { type: "string", default: "TCP" },
                  name: { type: "string" },
                },
              },
            },
            externalName: {
              type: "string",
              description: "External name for ExternalName type service",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "ports"],
        },
      },
      handler: async ({ name, namespace, type, selector, ports, externalName, dryRun }: { 
        name: string; 
        namespace?: string; 
        type?: string;
        selector?: Record<string, string>;
        ports: any[];
        externalName?: string;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "service");
          if (namespace) {
            validateNamespace(namespace);
          }
          // Validate ports
          for (const p of ports) {
            if (p.port) {
              validatePort(p.port);
            }
            if (p.targetPort && typeof p.targetPort === 'number') {
              validatePort(p.targetPort);
            }
          }
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const service: k8s.V1Service = {
            apiVersion: "v1",
            kind: "Service",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              type: type || "ClusterIP",
              selector: selector || {},
              ports: ports.map((p: any) => ({
                port: p.port,
                targetPort: p.targetPort || p.port,
                protocol: p.protocol || "TCP",
                name: p.name || `port-${p.port}`,
              })),
              ...(externalName && type === "ExternalName" ? { externalName } : {}),
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "Service",
              name,
              namespace: ns,
              manifest: service,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespacedService({ namespace: ns, body: service, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Service ${name} created in namespace ${ns}`,
            service: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              type: result.spec?.type,
              clusterIP: result.spec?.clusterIP,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_service", resource: name, namespace };
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
    // Expose - Create service from deployment/pod
    {
      tool: {
        name: "k8s_expose",
        description: "Expose a deployment or pod as a service (like kubectl expose)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (deployment, pod, replicaset, replicationcontroller)",
              enum: ["deployment", "pod", "replicaset", "replicationcontroller"],
            },
            name: {
              type: "string",
              description: "Name of the resource to expose",
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
              description: "Target port on pods (defaults to port)",
            },
            type: {
              type: "string",
              description: "Service type",
              enum: ["ClusterIP", "NodePort", "LoadBalancer"],
              default: "ClusterIP",
            },
            serviceName: {
              type: "string",
              description: "Name for the created service (defaults to resource name)",
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
        dryRun?: 'none' | 'client' | 'server';
      }) => {
        try {
          validateResourceName(name, resource);
          validatePort(port);
          if (targetPort) {
            validatePort(targetPort);
          }
          if (namespace) {
            validateNamespace(namespace);
          }
          const ns = namespace || "default";
          const svcName = serviceName || name;

          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          
          // Get the resource to extract its selector
          let selector: Record<string, string> = {};
          
          switch (resource.toLowerCase()) {
            case "deployment":
              const deploy = await appsApi.readNamespacedDeployment({ name, namespace: ns }, {});
              selector = deploy.spec?.selector?.matchLabels || {};
              break;
            case "pod":
              const pod = await coreApi.readNamespacedPod({ name, namespace: ns }, {});
              selector = pod.metadata?.labels || {};
              // Remove pod-specific labels that shouldn't be used as selectors
              delete selector["controller-uid"];
              delete selector["job-name"];
              break;
            case "replicaset":
              const rs = await appsApi.readNamespacedReplicaSet({ name, namespace: ns }, {});
              selector = rs.spec?.selector?.matchLabels || {};
              break;
            default:
              return {
                success: false,
                error: `Resource type '${resource}' not supported for expose`,
              };
          }
          
          if (Object.keys(selector).length === 0) {
            return {
              success: false,
              error: `No selector found for ${resource}/${name}`,
            };
          }
          
          // Create the service
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
              ports: [{
                port,
                targetPort: targetPort || port,
                protocol: "TCP",
              }],
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunMutation({
              operation: "Expose resource as service",
              kind: "Service",
              name: svcName,
              namespace: ns,
              patch: service,
              details: {
                resource,
                name,
                port,
                targetPort: targetPort || port,
                type: type || "ClusterIP",
              },
            });
          }
          
          const serverDryRunParam = dryRun === "server" ? "All" : undefined;
          const result = await coreApi.createNamespacedService({ namespace: ns, body: service, dryRun: serverDryRunParam });
          
          return {
            success: true,
            dryRun: dryRun === 'server' ? 'server' : (dryRun || 'none'),
            message: `Exposed ${resource}/${name} as service ${svcName}${dryRun === 'server' ? ' (server dry run)' : ''}`,
            service: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              type: result.spec?.type,
              clusterIP: result.spec?.clusterIP,
              selector,
              ports: [{ port, targetPort: targetPort || port }],
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_expose", resource: name, namespace };
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
    // Create Ingress
    {
      tool: {
        name: "k8s_create_ingress",
        description: "Create a new Kubernetes Ingress",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Ingress",
            },
            namespace: {
              type: "string",
              description: "Namespace for the Ingress",
              default: "default",
            },
            rules: {
              type: "array",
              description: "Ingress rules",
              items: {
                type: "object",
                properties: {
                  host: { type: "string" },
                  paths: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: { type: "string", default: "/" },
                        pathType: { type: "string", enum: ["Prefix", "Exact", "ImplementationSpecific"], default: "Prefix" },
                        serviceName: { type: "string" },
                        servicePort: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
            tls: {
              type: "array",
              description: "TLS configuration",
              items: {
                type: "object",
                properties: {
                  hosts: { type: "array", items: { type: "string" } },
                  secretName: { type: "string" },
                },
              },
            },
            annotations: {
              type: "object",
              description: "Ingress annotations (e.g., nginx.ingress.kubernetes.io/rewrite-target)",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "rules"],
        },
      },
      handler: async ({ name, namespace, rules, tls, annotations, dryRun }: { 
        name: string; 
        namespace?: string;
        rules: any[];
        tls?: any[];
        annotations?: Record<string, string>;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "ingress");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const ns = namespace || "default";
          
          const ingress: k8s.V1Ingress = {
            apiVersion: "networking.k8s.io/v1",
            kind: "Ingress",
            metadata: {
              name,
              namespace: ns,
              annotations,
            },
            spec: {
              rules: rules.map((rule: any) => ({
                host: rule.host,
                http: {
                  paths: rule.paths.map((p: any) => ({
                    path: p.path || "/",
                    pathType: p.pathType || "Prefix",
                    backend: {
                      service: {
                        name: p.serviceName,
                        port: {
                          number: p.servicePort,
                        },
                      },
                    },
                  })),
                },
              })),
              tls: tls?.map((t: any) => ({
                hosts: t.hosts,
                secretName: t.secretName,
              })),
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "Ingress",
              name,
              namespace: ns,
              manifest: ingress,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await netApi.createNamespacedIngress({ namespace: ns, body: ingress, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `Ingress ${name} created in namespace ${ns}`,
            ingress: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              rules: result.spec?.rules?.length,
              tls: result.spec?.tls?.length || 0,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_ingress", resource: name, namespace };
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
    // Create NetworkPolicy
    {
      tool: {
        name: "k8s_create_networkpolicy",
        description: "Create a Kubernetes NetworkPolicy to control traffic flow",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the NetworkPolicy",
            },
            namespace: {
              type: "string",
              description: "Namespace for the NetworkPolicy",
              default: "default",
            },
            podSelector: {
              type: "object",
              description: "Pod selector labels (empty = all pods in namespace)",
            },
            policyTypes: {
              type: "array",
              description: "Policy types (Ingress, Egress, or both)",
              items: { type: "string", enum: ["Ingress", "Egress"] },
              default: ["Ingress"],
            },
            ingress: {
              type: "array",
              description: "Ingress rules (allowed incoming traffic)",
              items: {
                type: "object",
                properties: {
                  from: { type: "array" },
                  ports: { type: "array" },
                },
              },
            },
            egress: {
              type: "array",
              description: "Egress rules (allowed outgoing traffic)",
              items: {
                type: "object",
                properties: {
                  to: { type: "array" },
                  ports: { type: "array" },
                },
              },
            },
            ...commonCreateQuerySchema,
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, podSelector, policyTypes, ingress, egress, dryRun }: { 
        name: string; 
        namespace?: string;
        podSelector?: Record<string, string>;
        policyTypes?: string[];
        ingress?: any[];
        egress?: any[];
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "networkpolicy");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const ns = namespace || "default";
          
          const networkPolicy: k8s.V1NetworkPolicy = {
            apiVersion: "networking.k8s.io/v1",
            kind: "NetworkPolicy",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              podSelector: {
                matchLabels: podSelector || {},
              },
              policyTypes: policyTypes || ["Ingress"],
              ingress: ingress || [],
              egress: egress || [],
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "NetworkPolicy",
              name,
              namespace: ns,
              manifest: networkPolicy,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await netApi.createNamespacedNetworkPolicy({ namespace: ns, body: networkPolicy, ...createParams }, {});
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `NetworkPolicy ${name} created in namespace ${ns}`,
            networkPolicy: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              podSelector: result.spec?.podSelector?.matchLabels,
              policyTypes: result.spec?.policyTypes,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_networkpolicy", resource: name, namespace };
          const classified = classifyError(error, context);
          
          // Add Calico/AKS specific suggestions
          const calicoSuggestions = [
            "For Calico on AKS, try a minimal NetworkPolicy with empty podSelector",
            "Example: { podSelector: {}, policyTypes: ['Ingress'] }",
            "Calico may require specific ingress/egress rule formats",
            "Check Calico network policy documentation for AKS",
            "Use kubectl describe networkpolicy <name> to see detailed errors"
          ];
          
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: [...(classified.suggestions || []), ...calicoSuggestions],
          };
        }
      },
    },
    // List Endpoints
    {
      tool: {
        name: "k8s_list_endpoints",
        description: "List Endpoints for services (like kubectl get endpoints)",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace (default: all namespaces)",
            },
            service: {
              type: "string",
              description: "Filter by service name",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, service, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        service?: string;
        labelSelector?: string;
        fieldSelector?: string;
        sortBy?: string;
        descending?: boolean;
        limit?: number;
      }) => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          let endpoints: k8s.V1Endpoints[] = [];
          
          if (service && namespace) {
            // Get specific endpoints for a service
            const ep = await coreApi.readNamespacedEndpoints({ name: service, namespace });
            endpoints = [ep];
          } else if (namespace) {
            const result = await coreApi.listNamespacedEndpoints({ namespace, labelSelector, fieldSelector });
            endpoints = result.items || [];
          } else {
            const result = await coreApi.listEndpointsForAllNamespaces({ labelSelector, fieldSelector });
            endpoints = result.items || [];
          }

          if (service && !namespace) {
            endpoints = endpoints.filter(ep => ep.metadata?.name === service);
          }
          
          const mapped = endpoints.map((ep: k8s.V1Endpoints) => ({
            name: ep.metadata?.name,
            namespace: ep.metadata?.namespace,
            service: ep.metadata?.name, // Endpoints name matches service name
            subsets: (ep.subsets || []).map((subset: any) => ({
              addresses: (subset.addresses || []).map((a: any) => ({
                ip: a.ip,
                hostname: a.hostname,
                nodeName: a.nodeName,
                targetRef: a.targetRef?.name,
              })),
              ports: (subset.ports || []).map((p: any) => ({
                port: p.port,
                name: p.name,
                protocol: p.protocol,
              })),
            })),
            labels: ep.metadata?.labels,
            age: ep.metadata?.creationTimestamp,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            endpoints: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_endpoints", namespace };
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
    // List EndpointSlices
    {
      tool: {
        name: "k8s_list_endpointslice",
        description: "List EndpointSlices (modern replacement for Endpoints, like kubectl get endpointslice)",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace (default: all namespaces)",
            },
            service: {
              type: "string",
              description: "Filter by service name (label selector)",
            },
            labelSelector: commonListQuerySchema.labelSelector,
            fieldSelector: commonListQuerySchema.fieldSelector,
            sortBy: commonListQuerySchema.sortBy,
            descending: commonListQuerySchema.descending,
            limit: commonListQuerySchema.limit,
          },
        },
      },
      handler: async ({ namespace, service, labelSelector, fieldSelector, sortBy, descending, limit }: {
        namespace?: string;
        service?: string;
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

          let path = namespace
            ? `/apis/discovery.k8s.io/v1/namespaces/${namespace}/endpointslices${qs}`
            : `/apis/discovery.k8s.io/v1/endpointslices${qs}`;
          
          const result = await rawClient.rawApiRequest(path);
          let slices = result.items || [];
          
          // Filter by service name if provided
          if (service) {
            slices = slices.filter((slice: any) => 
              slice.metadata?.labels?.["kubernetes.io/service-name"] === service
            );
          }
          
          const mapped = slices.map((slice: any) => ({
            name: slice.metadata?.name,
            namespace: slice.metadata?.namespace,
            service: slice.metadata?.labels?.["kubernetes.io/service-name"],
            addressType: slice.addressType,
            endpoints: (slice.endpoints || []).map((ep: any) => ({
              addresses: ep.addresses,
              conditions: ep.conditions,
              hostname: ep.hostname,
              nodeName: ep.nodeName,
              targetRef: ep.targetRef?.name,
            })),
            ports: (slice.ports || []).map((p: any) => ({
              port: p.port,
              name: p.name,
              protocol: p.protocol,
              appProtocol: p.appProtocol,
            })),
            labels: slice.metadata?.labels,
            age: slice.metadata?.creationTimestamp,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            endpointSlices: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_endpointslice", namespace };
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
    // List IngressClasses
    {
      tool: {
        name: "k8s_list_ingressclass",
        description: "List IngressClasses (like kubectl get ingressclass)",
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
          const rawClient = k8sClient as any;
          const queryParams = new URLSearchParams();
          if (labelSelector) queryParams.set("labelSelector", labelSelector);
          if (fieldSelector) queryParams.set("fieldSelector", fieldSelector);
          const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";

          const result = await rawClient.rawApiRequest(`/apis/networking.k8s.io/v1/ingressclasses${qs}`);
          
          const ingressClasses = result.items || [];
          
          const mapped = ingressClasses.map((ic: any) => ({
            name: ic.metadata?.name,
            controller: ic.spec?.controller,
            isDefault: ic.metadata?.annotations?.["ingressclass.kubernetes.io/is-default-class"] === "true",
            parameters: ic.spec?.parameters,
            apiGroup: ic.spec?.parameters?.apiGroup,
            kind: ic.spec?.parameters?.kind,
            labels: ic.metadata?.labels,
            age: ic.metadata?.creationTimestamp,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            ingressClasses: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_ingressclass" };
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
