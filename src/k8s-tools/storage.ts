import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import * as yaml from "js-yaml";
import { classifyError, validateYamlManifest, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace } from "../validators.js";
import { commonListQuerySchema, commonGetQuerySchema, applySortAndLimit, applyGetFormatting, isNotFoundError } from "../utils/query-helper.js";
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

export function registerStorageTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_pvs",
        description: "List all PersistentVolumes",
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
          const pvs = await k8sClient.listPVs({ labelSelector, fieldSelector });
          const mapped = pvs.map((pv: k8s.V1PersistentVolume) => ({
            name: pv.metadata?.name,
            capacity: pv.spec?.capacity?.storage,
            accessModes: pv.spec?.accessModes,
            reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
            status: pv.status?.phase,
            storageClass: pv.spec?.storageClassName,
            volumeMode: pv.spec?.volumeMode,
            source: getPVSource(pv.spec),
            claim: pv.spec?.claimRef ? {
              name: pv.spec.claimRef.name,
              namespace: pv.spec.claimRef.namespace,
            } : null,
            labels: pv.metadata?.labels,
            age: pv.metadata?.creationTimestamp,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            persistentVolumes: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_pvs" };
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
        name: "k8s_list_pvcs",
        description: "List all PersistentVolumeClaims",
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
          const pvcs = await k8sClient.listPVCs(namespace, { labelSelector, fieldSelector });
          const mapped = pvcs.map((pvc: k8s.V1PersistentVolumeClaim) => ({
            name: pvc.metadata?.name,
            namespace: pvc.metadata?.namespace,
            status: pvc.status?.phase,
            volume: pvc.spec?.volumeName,
            storageClass: pvc.spec?.storageClassName,
            accessModes: pvc.spec?.accessModes,
            capacity: pvc.status?.capacity?.storage,
            requestedStorage: pvc.spec?.resources?.requests?.storage,
            volumeMode: pvc.spec?.volumeMode,
            labels: pvc.metadata?.labels,
            age: pvc.metadata?.creationTimestamp,
            isBound: pvc.status?.phase === "Bound",
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            persistentVolumeClaims: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
            bound: queryResult.items.filter((p: any) => p.isBound).length,
            unbound: queryResult.items.filter((p: any) => !p.isBound).length,
            namespace: namespace || "all",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_pvcs", namespace };
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
        name: "k8s_list_storageclasses",
        description: "List all StorageClasses",
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
          const scs = await k8sClient.listStorageClasses({ labelSelector, fieldSelector });
          const mapped = scs.map((sc: k8s.V1StorageClass) => ({
            name: sc.metadata?.name,
            provisioner: sc.provisioner,
            reclaimPolicy: sc.reclaimPolicy,
            volumeBindingMode: sc.volumeBindingMode,
            allowVolumeExpansion: sc.allowVolumeExpansion,
            isDefault: sc.metadata?.annotations?.["storageclass.kubernetes.io/is-default-class"] === "true",
            parameters: sc.parameters,
            labels: sc.metadata?.labels,
            age: sc.metadata?.creationTimestamp,
          }));

          const queryResult = applySortAndLimit(mapped, { sortBy, descending, limit });

          return {
            storageClasses: queryResult.items,
            total: queryResult.total,
            returned: queryResult.returned,
            sortedBy: queryResult.sortedBy,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_storageclasses" };
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
    // Get PersistentVolume
    {
      tool: {
        name: "k8s_get_pv",
        description: "Get detailed information about a PersistentVolume",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PersistentVolume",
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
          validateResourceName(name, "persistentvolume");
          const coreApi = k8sClient.getCoreV1Api();
          const pv = await coreApi.readPersistentVolume({ name });

          const rawResult = {
            name: pv.metadata?.name,
            capacity: pv.spec?.capacity?.storage,
            accessModes: pv.spec?.accessModes,
            reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
            storageClassName: pv.spec?.storageClassName,
            volumeMode: pv.spec?.volumeMode,
            status: pv.status?.phase,
            claimRef: pv.spec?.claimRef ? {
              name: pv.spec.claimRef.name,
              namespace: pv.spec.claimRef.namespace,
              kind: pv.spec.claimRef.kind,
            } : null,
            source: getPVSource(pv.spec),
            nodeAffinity: pv.spec?.nodeAffinity,
            mountOptions: pv.spec?.mountOptions,
            volumeAttributes: pv.spec?.csi?.volumeAttributes,
            reason: pv.status?.reason,
            message: pv.status?.message,
            age: pv.metadata?.creationTimestamp,
          };

          return applyGetFormatting(rawResult, {
            kind: "PersistentVolume",
            name,
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              message: `PersistentVolume '${name}' not found`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_pv", resource: name };
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
    // Get StorageClass
    {
      tool: {
        name: "k8s_get_storageclass",
        description: "Get detailed information about a StorageClass",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the StorageClass",
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
          validateResourceName(name, "storageclass");
          const storageApi = (k8sClient as any).kc.makeApiClient(k8s.StorageV1Api);
          const sc = await storageApi.readStorageClass({ name });

          const rawResult = {
            name: sc.metadata?.name,
            provisioner: sc.provisioner,
            reclaimPolicy: sc.reclaimPolicy,
            volumeBindingMode: sc.volumeBindingMode,
            allowVolumeExpansion: sc.allowVolumeExpansion,
            isDefault: sc.metadata?.annotations?.["storageclass.kubernetes.io/is-default-class"] === "true",
            parameters: sc.parameters,
            mountOptions: sc.mountOptions,
            allowedTopologies: sc.allowedTopologies,
            age: sc.metadata?.creationTimestamp,
          };

          return applyGetFormatting(rawResult, {
            kind: "StorageClass",
            name,
            output,
            subpath,
          });
        } catch (error) {
          if (ignoreNotFound && isNotFoundError(error)) {
            return {
              found: false,
              name,
              message: `StorageClass '${name}' not found`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_storageclass", resource: name };
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
        name: "k8s_get_pvc_details",
        description: "Get detailed information about a PVC including events",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PVC",
            },
            namespace: {
              type: "string",
              description: "Namespace of the PVC",
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
          validateResourceName(name, "pvc");
          const coreApi = k8sClient.getCoreV1Api();
          const [pvc, events] = await Promise.all([
            coreApi.readNamespacedPersistentVolumeClaim({ name, namespace: namespace || "default" }),
            k8sClient.listEvents(namespace || "default", `involvedObject.name=${name}`),
          ]);

          const rawResult = {
            name: pvc.metadata?.name,
            namespace: pvc.metadata?.namespace,
            spec: {
              accessModes: pvc.spec?.accessModes,
              storageClassName: pvc.spec?.storageClassName,
              volumeName: pvc.spec?.volumeName,
              volumeMode: pvc.spec?.volumeMode,
              resources: pvc.spec?.resources,
              selector: pvc.spec?.selector,
            },
            status: {
              phase: pvc.status?.phase,
              accessModes: pvc.status?.accessModes,
              capacity: pvc.status?.capacity,
              conditions: pvc.status?.conditions?.map((c: k8s.V1PersistentVolumeClaimCondition) => ({
                type: c.type,
                status: c.status,
                reason: c.reason,
                message: c.message,
              })),
            },
            events: events.map((e: k8s.CoreV1Event) => ({
              type: e.type,
              reason: e.reason,
              message: e.message,
              count: e.count,
              firstTimestamp: e.firstTimestamp,
              lastTimestamp: e.lastTimestamp,
            })),
          };

          return applyGetFormatting(rawResult, {
            kind: "PersistentVolumeClaim",
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
              message: `PersistentVolumeClaim '${name}' not found`,
            };
          }
          const context: ErrorContext = { operation: "k8s_get_pvc_details", resource: name, namespace };
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
        name: "k8s_find_unbound_pvcs",
        description: "Find PVCs that are not bound to a PV",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to check (optional, all if not specified)",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const response = namespace
            ? await coreApi.listNamespacedPersistentVolumeClaim({ namespace })
            : await coreApi.listPersistentVolumeClaimForAllNamespaces({});

          const unboundPvcs = response.items.filter(
            (pvc: k8s.V1PersistentVolumeClaim) => pvc.status?.phase !== "Bound"
          );

          return {
            unboundPvcs: unboundPvcs.map((pvc: k8s.V1PersistentVolumeClaim) => ({
              name: pvc.metadata?.name,
              namespace: pvc.metadata?.namespace,
              status: pvc.status?.phase,
              capacity: pvc.spec?.resources?.requests?.storage,
              storageClass: pvc.spec?.storageClassName,
              age: pvc.metadata?.creationTimestamp,
            })),
            totalPvcs: response.items.length,
            unboundCount: unboundPvcs.length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_find_unbound_pvcs", namespace };
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
        name: "k8s_storage_summary",
        description: "Get cluster-wide storage summary",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const storageApi = (k8sClient as any).kc.makeApiClient(k8s.StorageV1Api);

          const [pvs, pvcs, storageClasses] = await Promise.all([
            coreApi.listPersistentVolume({}),
            coreApi.listPersistentVolumeClaimForAllNamespaces({}),
            storageApi.listStorageClass({}),
          ]);

          const totalCapacity = pvs.items.reduce(
            (sum: number, pv: k8s.V1PersistentVolume) =>
              sum + (parseInt(pv.spec?.capacity?.storage || "0") || 0),
            0
          );

          const usedCapacity = pvcs.items.reduce(
            (sum: number, pvc: k8s.V1PersistentVolumeClaim) =>
              sum + (parseInt(pvc.spec?.resources?.requests?.storage || "0") || 0),
            0
          );

          const boundPvcs = pvcs.items.filter(
            (pvc: k8s.V1PersistentVolumeClaim) => pvc.status?.phase === "Bound"
          ).length;

          return {
            persistentVolumes: {
              total: pvs.items.length,
              available: pvs.items.filter((pv: k8s.V1PersistentVolume) => pv.status?.phase === "Available").length,
              bound: pvs.items.filter((pv: k8s.V1PersistentVolume) => pv.status?.phase === "Bound").length,
              released: pvs.items.filter((pv: k8s.V1PersistentVolume) => pv.status?.phase === "Released").length,
              failed: pvs.items.filter((pv: k8s.V1PersistentVolume) => pv.status?.phase === "Failed").length,
            },
            persistentVolumeClaims: {
              total: pvcs.items.length,
              bound: boundPvcs,
              pending: pvcs.items.filter((pvc: k8s.V1PersistentVolumeClaim) => pvc.status?.phase === "Pending").length,
            },
            storageClasses: {
              total: storageClasses.items.length,
              default: storageClasses.items.filter(
                (sc: k8s.V1StorageClass) =>
                  sc.metadata?.annotations?.["storageclass.kubernetes.io/is-default-storageclass"] === "true"
              ).length,
            },
            capacity: {
              total: `${totalCapacity}Gi`,
              used: `${usedCapacity}Gi`,
              available: `${totalCapacity - usedCapacity}Gi`,
              utilizationPercent: totalCapacity > 0 ? ((usedCapacity / totalCapacity) * 100).toFixed(2) : "0",
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_storage_summary" };
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
    // Delete PVC
    {
      tool: {
        name: "k8s_delete_pvc",
        description: "Delete a PersistentVolumeClaim",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PVC to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the PVC",
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
          validateResourceName(name, "pvc");

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunDelete({
              kind: "PersistentVolumeClaim",
              name,
              namespace: ns,
              gracePeriodSeconds,
              propagationPolicy,
            });
          }

          const coreApi = k8sClient.getCoreV1Api();
          const deleteParams = buildServerDeleteParams({ dryRun, gracePeriodSeconds, propagationPolicy });
          await coreApi.deleteNamespacedPersistentVolumeClaim({ name, namespace: ns, ...deleteParams });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `PVC ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const handled = handleDeleteError(error, { kind: "PersistentVolumeClaim", name, namespace: ns, ignoreNotFound });
          if (handled) return handled;
          const context: ErrorContext = { operation: "k8s_delete_pvc", resource: name, namespace: ns };
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
    // Create PVC
    {
      tool: {
        name: "k8s_create_pvc",
        description: "Create a PersistentVolumeClaim (like kubectl create pvc or apply -f pvc.yaml)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PVC",
            },
            namespace: {
              type: "string",
              description: "Namespace for the PVC",
              default: "default",
            },
            storageClass: {
              type: "string",
              description: "StorageClass name (omit for default)",
            },
            size: {
              type: "string",
              description: "Storage size (e.g., '10Gi', '500Mi')",
            },
            accessModes: {
              type: "array",
              description: "Access modes",
              items: { type: "string", enum: ["ReadWriteOnce", "ReadOnlyMany", "ReadWriteMany", "ReadWriteOncePod"] },
              default: ["ReadWriteOnce"],
            },
            volumeName: {
              type: "string",
              description: "Specific PV to bind to (optional, for pre-bound PVCs)",
            },
            volumeMode: {
              type: "string",
              description: "Volume mode (Filesystem or Block)",
              enum: ["Filesystem", "Block"],
              default: "Filesystem",
            },
            labels: {
              type: "object",
              description: "Labels to add to the PVC",
            },
            annotations: {
              type: "object",
              description: "Annotations to add to the PVC",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "size"],
        },
      },
      handler: async ({ name, namespace, storageClass, size, accessModes, volumeName, volumeMode, labels, annotations, dryRun }: { 
        name: string;
        namespace?: string;
        storageClass?: string;
        size: string;
        accessModes?: string[];
        volumeName?: string;
        volumeMode?: string;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "pvc");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const pvc: k8s.V1PersistentVolumeClaim = {
            apiVersion: "v1",
            kind: "PersistentVolumeClaim",
            metadata: {
              name,
              namespace: ns,
              labels,
              annotations: storageClass ? { ...annotations, "volume.beta.kubernetes.io/storage-class": storageClass } : annotations,
            },
            spec: {
              accessModes: accessModes || ["ReadWriteOnce"],
              volumeMode: volumeMode || "Filesystem",
              resources: {
                requests: {
                  storage: size,
                },
              },
              storageClassName: storageClass,
              volumeName,
            },
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "PersistentVolumeClaim",
              name,
              namespace: ns,
              manifest: pvc,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createNamespacedPersistentVolumeClaim({ namespace: ns, body: pvc, ...createParams });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `PVC ${name} created in namespace ${ns}`,
            pvc: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              size,
              storageClass: result.spec?.storageClassName,
              accessModes: result.spec?.accessModes,
              phase: result.status?.phase,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_pvc", resource: name, namespace };
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
    // Create PV (cluster admin)
    {
      tool: {
        name: "k8s_create_pv",
        description: "Create a PersistentVolume (cluster admin operation, like kubectl create pv or apply -f pv.yaml)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PV",
            },
            capacity: {
              type: "string",
              description: "Storage capacity (e.g., '10Gi', '500Mi')",
            },
            accessModes: {
              type: "array",
              description: "Access modes",
              items: { type: "string", enum: ["ReadWriteOnce", "ReadOnlyMany", "ReadWriteMany", "ReadWriteOncePod"] },
              default: ["ReadWriteOnce"],
            },
            storageClass: {
              type: "string",
              description: "StorageClass name",
            },
            volumeMode: {
              type: "string",
              description: "Volume mode (Filesystem or Block)",
              enum: ["Filesystem", "Block"],
              default: "Filesystem",
            },
            reclaimPolicy: {
              type: "string",
              description: "Reclaim policy",
              enum: ["Retain", "Recycle", "Delete"],
              default: "Retain",
            },
            path: {
              type: "string",
              description: "Host path (for hostPath volumes)",
            },
            nfsServer: {
              type: "string",
              description: "NFS server (for NFS volumes)",
            },
            nfsPath: {
              type: "string",
              description: "NFS path (for NFS volumes)",
            },
            csiDriver: {
              type: "string",
              description: "CSI driver name (for CSI volumes)",
            },
            csiVolumeHandle: {
              type: "string",
              description: "CSI volume handle (for CSI volumes)",
            },
            nodeAffinity: {
              type: "object",
              description: "Node affinity for local volumes",
            },
            ...commonCreateQuerySchema,
          },
          required: ["name", "capacity"],
        },
      },
      handler: async ({ name, capacity, accessModes, storageClass, volumeMode, reclaimPolicy, path, nfsServer, nfsPath, csiDriver, csiVolumeHandle, nodeAffinity, dryRun }: { 
        name: string;
        capacity: string;
        accessModes?: string[];
        storageClass?: string;
        volumeMode?: string;
        reclaimPolicy?: string;
        path?: string;
        nfsServer?: string;
        nfsPath?: string;
        csiDriver?: string;
        csiVolumeHandle?: string;
        nodeAffinity?: any;
        dryRun?: string;
      }) => {
        try {
          validateResourceName(name, "pv");
          const coreApi = k8sClient.getCoreV1Api();
          
          // Build the PV spec based on volume type
          let pvSpec: k8s.V1PersistentVolumeSpec = {
            capacity: {
              storage: capacity,
            },
            accessModes: accessModes || ["ReadWriteOnce"],
            volumeMode: volumeMode || "Filesystem",
            persistentVolumeReclaimPolicy: reclaimPolicy || "Retain",
            storageClassName: storageClass,
          };
          
          // Add volume source based on provided parameters
          if (path) {
            (pvSpec as any).hostPath = { path };
          } else if (nfsServer && nfsPath) {
            (pvSpec as any).nfs = { server: nfsServer, path: nfsPath };
          } else if (csiDriver && csiVolumeHandle) {
            (pvSpec as any).csi = { driver: csiDriver, volumeHandle: csiVolumeHandle };
          } else {
            return {
              success: false,
              error: "Volume type not specified. Provide path (hostPath), nfsServer+nfsPath (NFS), or csiDriver+csiVolumeHandle (CSI)",
            };
          }
          
          if (nodeAffinity) {
            pvSpec.nodeAffinity = nodeAffinity;
          }
          
          const pv: k8s.V1PersistentVolume = {
            apiVersion: "v1",
            kind: "PersistentVolume",
            metadata: {
              name,
            },
            spec: pvSpec,
          };

          if (isClientDryRun(dryRun)) {
            return formatClientDryRunCreate({
              kind: "PersistentVolume",
              name,
              manifest: pv,
            });
          }

          const createParams = buildServerCreateParams({ dryRun });
          const result = await coreApi.createPersistentVolume({ body: pv, ...createParams });
          
          return {
            success: true,
            dryRun: dryRun || "none",
            message: `PersistentVolume ${name} created`,
            pv: {
              name: result.metadata?.name,
              capacity,
              accessModes: result.spec?.accessModes,
              storageClass: result.spec?.storageClassName,
              reclaimPolicy: result.spec?.persistentVolumeReclaimPolicy,
              phase: result.status?.phase,
              source: getPVSource(result.spec),
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_pv", resource: name };
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

function getPVSource(spec?: k8s.V1PersistentVolumeSpec): string {
  if (!spec) return "unknown";
  
  const sources = [
    "nfs", "hostPath", "awsElasticBlockStore", "gcePersistentDisk",
    "azureDisk", "azureFile", "csi", "fc", "iscsi", "local", "rbd",
    "vsphereVolume", "cinder", "cephfs", "fc", "flexVolume", "flocker",
    "glusterfs", "photonPersistentDisk", "portworxVolume", "quobyte",
    "scaleIO", "storageos", "vsphereVolume"
  ];
  
  for (const source of sources) {
    if ((spec as any)[source]) {
      return source;
    }
  }
  
  return "unknown";
}

function parseStorageSize(size: string): number {
  const units: Record<string, number> = {
    "Ki": 1 / (1024 * 1024),
    "Mi": 1 / 1024,
    "Gi": 1,
    "Ti": 1024,
    "Pi": 1024 * 1024,
    "K": 1 / (1000 * 1000 * 1000),
    "M": 1 / (1000 * 1000),
    "G": 1 / 1000,
    "T": 1,
    "P": 1000,
  };
  
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti|Pi|K|M|G|T|P)?$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || "Gi";
  
  return value * (units[unit] || 1);
}
