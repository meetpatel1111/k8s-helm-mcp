# K8s MCP Server - Complete Tool Reference

**Version: 0.26.2** | **Total Tools: 267**

This document provides comprehensive reference for all tools in the Kubernetes MCP Server, including tool catalogs, kubectl mappings, and natural language patterns. This server is optimized for use with **Claude Desktop**, **Claude Code**, **Codex**, **Windsurf**, **Antigravity**, and **Cursor**.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Complete Tool Catalog](#complete-tool-catalog)
3. [kubectl to MCP Tool Mapping](#kubectl-to-mcp-tool-mapping)
4. [Natural Language to Tool Mapping](#natural-language-to-tool-mapping)
5. [Protection Mode Classifications](#protection-mode-classifications)

---

## Quick Reference

### Protection Mode Tools

| Tool | Description |
|------|-------------|
| `k8s_toggle_protection_mode` | Toggle Infrastructure Protection Mode |
| `k8s_toggle_strict_protection_mode` | Toggle Strict Protection Mode (read-only) |
| `k8s_toggle_no_delete_mode` | Toggle No Delete Protection Mode |
| `k8s_toggle_all_protection_modes` | Master toggle for all protection modes |

### Most Common Tools

| Use Case | Tool |
|----------|------|
| List pods | `k8s_list_pods` |
| Get pod logs | `k8s_get_pod_logs` |
| Scale deployment | `k8s_scale_deployment` |
| Apply manifest | `k8s_apply_manifest` |
| Get cluster health | `k8s_cluster_health` |
| Check resource usage | `k8s_top_pod` / `k8s_top_node` |

---

## Complete Tool Catalog

### Server Management Tools

| Tool | Description | Key Features |
|------|-------------|--------------|
| `k8s_server_info` | Get comprehensive MCP server information and status | Returns server version, uptime, tool count, cluster info, error/request counts, protection mode status |
| `k8s_server_health` | Comprehensive health check with cluster connectivity test | Checks server health, cluster connectivity (optional deep check), circuit breaker status, protection modes |
| `k8s_server_metrics` | Get detailed tool usage metrics | Returns per-tool call counts, error rates, average response times, last called timestamps |
| `k8s_server_stop` | Shut down the MCP server gracefully | Programmatic termination of the server process with confirmation |

### Cluster & Context Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_contexts` | List all available Kubernetes contexts from kubeconfig | - |
| `k8s_switch_context` | Switch to a different Kubernetes context | `context` (required) |
| `k8s_cluster_info` | Display cluster info (API server addresses) | - |
| `k8s_cluster_version` | Get Kubernetes cluster version information | `short?: boolean` |
| `k8s_component_status` | Get Kubernetes component statuses (scheduler, controller-manager, etcd) | - |
| `k8s_cluster_health` | Get comprehensive cluster health overview (nodes, pods, components) | - |
| `k8s_health_score` | Calculate cluster health score based on various factors | - |
| `k8s_api_latency_check` | Check API server latency and connectivity | - |
| `k8s_api_resources` | List available API resources with filtering options | `namespaced?: boolean`, `verbs?: string[]`, `apiGroup?: string` |
| `k8s_api_versions` | List available API versions | - |
| `k8s_config_view` | View merged kubeconfig settings | `raw?: boolean` |
| `k8s_config_set_namespace` | Set the default namespace for the current context | `namespace` (required) |
| `k8s_config_set` | Set a kubeconfig value (cluster, context, or user property) | `property`, `value` |
| `k8s_config_unset` | Remove a kubeconfig property | `property` |
| `k8s_config_delete_context` | Delete a context from kubeconfig | `context` |
| `k8s_config_rename_context` | Rename a context in kubeconfig | `oldName`, `newName` |
| `k8s_list_namespaces` | List all namespaces in the cluster | - |
| `k8s_create_namespace` | Create a new namespace | `name`, `labels?: object` |
| `k8s_delete_namespace` | Delete a namespace | `name`, `force?: boolean` |
| `k8s_get_namespace` | Get detailed information about a namespace | `name?` |

### Node Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_nodes` | List all nodes in the cluster with status and resource information | - |
| `k8s_get_node` | Get detailed information about a specific node | `name` (required) |
| `k8s_cordon_node` | Mark a node as unschedulable (cordon) | `name` |
| `k8s_uncordon_node` | Mark a node as schedulable (uncordon) | `name` |
| `k8s_drain_node` | Drain a node by cordoning and evicting all pods | `name`, `force?: boolean`, `gracePeriodSeconds?: number` |
| `k8s_add_node_label` | Add or update a label on a node | `name`, `key`, `value` |
| `k8s_remove_node_label` | Remove a label from a node | `name`, `key` |
| `k8s_add_node_taint` | Add a taint to a node | `name`, `key`, `effect` (NoSchedule/PreferNoSchedule/NoExecute), `value?` |
| `k8s_remove_node_taint` | Remove a taint from a node | `name`, `key`, `effect?` |
| `k8s_debug_node` | Debug a node by creating a privileged debug pod on it | `node`, `image?`, `namespace?`, `command?` |
| `k8s_node_pressure_status` | Check for node pressure conditions (Memory, Disk, PID) | `name?` |
| `k8s_get_node_metrics` | Get node metrics (CPU/Memory) - requires metrics-server | `name?` |
| `k8s_top_node` | Display resource usage (CPU/Memory) for nodes | `name?` |

### Pod Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_pods` | List pods in a namespace or across all namespaces | `namespace?`, `labelSelector?`, `fieldSelector?` |
| `k8s_get_pod` | Get detailed information about a specific pod | `name` (required), `namespace?` |
| `k8s_delete_pod` | Delete a pod | `name`, `namespace?`, `gracePeriodSeconds?`, `force?: boolean` |
| `k8s_get_pod_logs` | Get logs from pod, deployment, statefulset, daemonset, job, or service | `name?`, `namespace?`, `container?`, `tailLines?`, `follow?: boolean`, `previous?: boolean`, `since?`, `timestamps?: boolean` |
| `k8s_stream_logs` | Stream pod logs in real-time (returns stream info) | `pod`, `namespace`, `container?`, `follow?: boolean`, `tailLines?` |
| `k8s_pod_log_search` | Search for patterns in pod logs across multiple pods | `pattern`, `namespace?`, `labelSelector?`, `maxPods?`, `tailLines?` |
| `k8s_exec_pod` | Execute command in a pod, deployment, service, or job | `resource` (pod name or deploy/svc/job format), `namespace?`, `command?`, `container?`, `stdin?: boolean`, `tty?: boolean` |
| `k8s_attach_pod` | Attach to running pod (returns attach info for WebSocket) | `pod`, `namespace`, `container?`, `stdin?: boolean`, `stdout?: boolean` |
| `k8s_port_forward` | Set up port forwarding to pod, deployment, or service | `resource`, `ports` (e.g., ["8080:80"]), `namespace?` |
| `k8s_cp` | Copy files and directories to and from containers | `source`, `destination`, `container?`, `namespace?` |
| `k8s_get_pod_events` | Get events for a specific pod | `name` (required), `namespace?` |
| `k8s_find_unhealthy_pods` | Find pods not in Running state or with issues | `namespace?` |
| `k8s_find_crashloop_pods` | Find pods in CrashLoopBackOff state | `namespace?` |
| `k8s_restart_pod` | Restart a pod by deleting it (will be recreated if part of controller) | `name`, `namespace?` |
| `k8s_debug_pod` | Create ephemeral debug container in running pod | `name`, `namespace?`, `image?`, `command?`, `target?` |
| `k8s_debug_scheduling` | Debug why a pod is stuck in Pending state | `name`, `namespace?` |
| `k8s_analyze_pod_failure` | AI-style diagnosis of why a pod is failing | `name`, `namespace?` |
| `k8s_get_pod_metrics` | Get pod metrics (CPU/Memory) - requires metrics-server | `name?`, `namespace?` |
| `k8s_top_pod` | Display resource usage for pods | `name?`, `namespace?`, `allNamespaces?: boolean`, `containers?: boolean`, `sortBy?: "cpu" \| "memory"` |
| `k8s_run` | Run a pod imperatively (like kubectl run) | `image` (required), `name?`, `namespace?`, `command?`, `args?`, `env?`, `port?`, `labels?`, `dryRun?` |
| `k8s_bulk_delete_pods` | Delete multiple pods matching criteria | `namespace` (required), `labelSelector?`, `status?`, `dryRun?: boolean` |
| `k8s_check_privileged_pods` | Find pods running with privileged security contexts | `namespace?` |

### Workload Management

#### Deployments

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_deployments` | List all deployments with status and replica info | `namespace?` |
| `k8s_get_deployment` | Get detailed information about a deployment | `name` (required), `namespace?` |
| `k8s_create_deployment` | Create a deployment imperatively | `name`, `image` (required), `namespace?`, `replicas?`, `port?`, `env?`, `labels?` |
| `k8s_delete_deployment` | Delete a deployment | `name`, `namespace?`, `gracePeriodSeconds?`, `force?: boolean` |
| `k8s_scale_deployment` | Scale a deployment to specific number of replicas | `name` (required), `replicas` (required), `namespace?` |
| `k8s_restart_deployment` | Perform rolling restart of a deployment | `name`, `namespace?` |
| `k8s_rollback_deployment` | Rollback deployment to previous revision | `name`, `namespace?`, `revision?` |
| `k8s_set_image` | Update container image in a deployment | `deployment` (required), `image` (required), `container?`, `namespace?` |
| `k8s_deployment_rollout_status` | Check rollout status of a deployment | `name` (required), `namespace?` |
| `k8s_rollout_history` | View rollout history for a deployment | `name`, `namespace?` |
| `k8s_rollout_pause` | Pause a deployment rollout | `deployment`, `namespace?` |
| `k8s_rollout_resume` | Resume a paused deployment rollout | `deployment`, `namespace?` |
| `k8s_rollout_undo` | Rollback deployment to previous revision | `name`, `namespace?`, `revision?` |
| `k8s_autoscale` | Create a HorizontalPodAutoscaler for a deployment | `deployment` (required), `name`, `minReplicas?`, `maxReplicas?`, `cpuPercent?`, `memoryPercent?`, `namespace?` |
| `k8s_get_hpa` | Get detailed information about an HPA | `name` (required), `namespace?` |
| `k8s_delete_hpa` | Delete a HorizontalPodAutoscaler | `name`, `namespace?` |
| `k8s_list_hpa` | List all HorizontalPodAutoscalers | `namespace?` |

#### StatefulSets

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_statefulsets` | List all StatefulSets | `namespace?` |
| `k8s_get_statefulset` | Get detailed information about a StatefulSet | `name` (required), `namespace?` |
| `k8s_create_statefulset` | Create a StatefulSet with persistent storage | `name`, `image` (required), `serviceName` (required), `namespace?`, `replicas?`, `port?`, `storageSize?`, `storageClass?`, `env?` |
| `k8s_delete_statefulset` | Delete a StatefulSet | `name`, `namespace?`, `gracePeriodSeconds?`, `force?: boolean` |
| `k8s_restart_statefulset` | Restart a StatefulSet | `name`, `namespace?` |
| `k8s_scale` | Scale deployments, replicasets, or statefulsets | `resource`, `name`, `replicas` (required), `namespace?`, `currentReplicas?` |

#### DaemonSets

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_daemonsets` | List all DaemonSets | `namespace?` |
| `k8s_get_daemonset` | Get detailed information about a DaemonSet | `name` (required), `namespace?` |
| `k8s_create_daemonset` | Create a DaemonSet to run pods on all nodes | `name`, `image` (required), `namespace?`, `command?`, `env?`, `port?`, `nodeSelector?`, `hostNetwork?: boolean`, `hostPID?: boolean` |
| `k8s_delete_daemonset` | Delete a DaemonSet | `name`, `namespace?` |
| `k8s_restart_daemonset` | Restart a DaemonSet | `name`, `namespace?` |

#### ReplicaSets

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_replicasets` | List all ReplicaSets | `namespace?` |
| `k8s_get_replicaset` | Get detailed information about a ReplicaSet | `name` (required), `namespace?` |
| `k8s_delete_replicaset` | Delete a ReplicaSet | `name`, `namespace?`, `cascade?: boolean` |

#### Jobs & CronJobs

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_jobs` | List all Jobs | `namespace?` |
| `k8s_get_job` | Get detailed information about a Job | `name` (required), `namespace?` |
| `k8s_create_job` | Create a job imperatively | `name`, `image` (required), `namespace?`, `command?`, `completions?`, `parallelism?`, `restartPolicy?` |
| `k8s_delete_job` | Delete a Job | `name`, `namespace?`, `cascade?: boolean` |
| `k8s_trigger_job` | Manually trigger a CronJob to create a Job | `name`, `namespace?` |
| `k8s_list_cronjobs` | List all CronJobs | `namespace?` |
| `k8s_get_cronjob` | Get detailed information about a CronJob | `name` (required), `namespace?` |
| `k8s_create_cronjob` | Create a cronjob imperatively | `name`, `image` (required), `schedule` (cron expression), `namespace?`, `command?`, `restartPolicy?`, `suspend?: boolean` |
| `k8s_delete_cronjob` | Delete a CronJob | `name`, `namespace?` |

### Networking & Services

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_services` | List all services in a namespace or cluster-wide | `namespace?` |
| `k8s_get_service` | Get detailed information about a Service | `name` (required), `namespace?` |
| `k8s_create_service` | Create a new Kubernetes Service | `name`, `ports` (required), `namespace?`, `selector?`, `type?` (ClusterIP/NodePort/LoadBalancer/ExternalName), `externalName?` |
| `k8s_delete_service` | Delete a Service | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_expose` | Expose a deployment or pod as a service | `resource` (deployment/pod), `name`, `port` (required), `namespace?`, `targetPort?`, `type?`, `serviceName?` |
| `k8s_get_service_endpoints` | Get endpoints for a service | `name` (required), `namespace?` |
| `k8s_list_endpoints` | List Endpoints for services | `namespace?`, `service?` |
| `k8s_list_endpointslice` | List EndpointSlices (modern replacement for Endpoints) | `namespace?`, `service?` |
| `k8s_list_ingresses` | List all Ingresses | `namespace?` |
| `k8s_get_ingress` | Get detailed information about an Ingress | `name` (required), `namespace?` |
| `k8s_create_ingress` | Create a new Kubernetes Ingress | `name`, `rules` (required), `namespace?`, `annotations?`, `tls?` |
| `k8s_delete_ingress` | Delete an Ingress | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_list_ingressclass` | List IngressClasses | - |
| `k8s_list_network_policies` | List all NetworkPolicies | `namespace?` |
| `k8s_get_network_policy` | Get detailed information about a NetworkPolicy | `name` (required), `namespace?` |
| `k8s_create_networkpolicy` | Create a Kubernetes NetworkPolicy to control traffic flow | `name`, `podSelector?`, `policyTypes?` (Ingress/Egress), `ingress?`, `egress?`, `namespace?` |
| `k8s_delete_networkpolicy` | Delete a NetworkPolicy | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_test_dns` | Test DNS resolution within the cluster | `hostname` (required), `namespace?` |
| `k8s_service_topology` | Show service-to-pod mapping for visualization | `namespace?` |

### Storage Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_pvs` | List all PersistentVolumes in the cluster | - |
| `k8s_get_pv` | Get detailed information about a PersistentVolume | `name` (required) |
| `k8s_create_pv` | Create a PersistentVolume (cluster admin operation) | `name`, `capacity` (required), `accessModes?`, `reclaimPolicy?`, `storageClass?`, `path?`, `nfsServer?`, `nfsPath?`, `csiDriver?`, `csiVolumeHandle?` |
| `k8s_delete_pv` | Delete a PersistentVolume | `name`, `gracePeriodSeconds?` |
| `k8s_list_pvcs` | List all PersistentVolumeClaims | `namespace?` |
| `k8s_get_pvc_details` | Get detailed information about a PVC including events | `name` (required), `namespace?` |
| `k8s_create_pvc` | Create a PersistentVolumeClaim | `name`, `size` (required), `namespace?`, `accessModes?`, `storageClass?`, `volumeName?`, `volumeMode?` |
| `k8s_delete_pvc` | Delete a PVC | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_find_unbound_pvcs` | Find PVCs that are not bound to a PV | `namespace?` |
| `k8s_storage_summary` | Get cluster-wide storage summary | - |
| `k8s_list_storageclasses` | List all StorageClasses | - |
| `k8s_get_storageclass` | Get detailed information about a StorageClass | `name` (required) |
| `k8s_delete_storageclass` | Delete a StorageClass | `name`, `gracePeriodSeconds?` |

### Security & RBAC

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_serviceaccounts` | List all ServiceAccounts | `namespace?` |
| `k8s_get_serviceaccount` | Get detailed information about a ServiceAccount | `name` (required), `namespace?` |
| `k8s_create_serviceaccount` | Create a Kubernetes ServiceAccount | `name`, `namespace?`, `labels?`, `annotations?`, `automountToken?: boolean` |
| `k8s_delete_serviceaccount` | Delete a ServiceAccount | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_list_roles` | List all Roles | `namespace?` |
| `k8s_get_role` | Get detailed information about a Role | `name` (required), `namespace?` |
| `k8s_create_role` | Create a Kubernetes Role (namespaced permissions) | `name`, `rules` (required), `namespace?`, `labels?`, `annotations?` |
| `k8s_delete_role` | Delete a Role | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_list_rolebindings` | List all RoleBindings | `namespace?` |
| `k8s_get_rolebinding` | Get detailed information about a RoleBinding | `name` (required), `namespace?` |
| `k8s_create_rolebinding` | Create a Kubernetes RoleBinding | `name`, `roleName` (required), `subjects` (required), `namespace?`, `roleKind?` (Role/ClusterRole) |
| `k8s_delete_rolebinding` | Delete a RoleBinding | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_list_clusterroles` | List all ClusterRoles | - |
| `k8s_get_clusterrole` | Get detailed information about a ClusterRole | `name` (required) |
| `k8s_create_clusterrole` | Create a Kubernetes ClusterRole (cluster-wide permissions) | `name`, `rules` (required), `labels?`, `annotations?`, `aggregationRule?` |
| `k8s_delete_clusterrole` | Delete a ClusterRole | `name`, `gracePeriodSeconds?` |
| `k8s_list_clusterrolebindings` | List all ClusterRoleBindings | - |
| `k8s_get_clusterrolebinding` | Get detailed information about a ClusterRoleBinding | `name` (required) |
| `k8s_create_clusterrolebinding` | Create a Kubernetes ClusterRoleBinding | `name`, `clusterRoleName` (required), `subjects` (required), `labels?` |
| `k8s_delete_clusterrolebinding` | Delete a ClusterRoleBinding | `name`, `gracePeriodSeconds?` |
| `k8s_auth_can_i` | Check if you can perform an action | `verb` (required), `resource` (required), `namespace?`, `resourceName?`, `subresource?`, `asUser?`, `asServiceAccount?` |
| `k8s_auth_reconcile` | Reconcile rules for RBAC resources | `manifest` (required), `dryRun?: boolean`, `removeExtraSubjects?: boolean`, `removeExtraPermissions?: boolean` |
| `k8s_get_rbac_summary` | Get RBAC summary for a user or service account | `kind` (User/Group/ServiceAccount), `name` (required), `namespace?` |
| `k8s_certificate_approve` | Approve a Certificate Signing Request | `name` (required), `force?: boolean` |
| `k8s_certificate_deny` | Deny a Certificate Signing Request | `name` (required), `force?: boolean` |
| `k8s_list_csr` | List Certificate Signing Requests | - |
| `k8s_delete_csr` | Delete a CSR | `name`, `gracePeriodSeconds?` |
| `k8s_check_privileged_pods` | Find pods running with privileged security contexts | `namespace?` |
| `k8s_list_runtimeclasses` | List RuntimeClasses in the cluster | - |
| `k8s_delete_runtimeclass` | Delete a RuntimeClass | `name`, `gracePeriodSeconds?` |

### Configuration & Secrets

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_configmaps` | List all ConfigMaps | `namespace?` |
| `k8s_get_configmap` | Get detailed ConfigMap data | `name` (required), `namespace?` |
| `k8s_create_configmap` | Create a Kubernetes ConfigMap | `name`, `namespace?`, `data?` (key-value pairs), `fromFile?`, `fromLiteral?`, `immutable?: boolean` |
| `k8s_delete_configmap` | Delete a ConfigMap | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_list_secrets` | List all Secrets (values are masked) | `namespace?`, `type?` (e.g., kubernetes.io/tls) |
| `k8s_get_secret` | Get detailed information about a Secret | `name` (required), `namespace?`, `decode?: boolean` |
| `k8s_create_secret` | Create a Kubernetes Secret (generic, TLS, or docker-registry) | `name`, `type?` (Opaque/TLS/dockerconfigjson), `namespace?`, `data?`, `stringData?`, `dockerServer?`, `dockerUsername?`, `dockerPassword?`, `cert?`, `key?`, `immutable?: boolean` |
| `k8s_delete_secret` | Delete a Secret | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_create_resource_quota` | Create a ResourceQuota to limit resource consumption | `name`, `hard` (required), `namespace?`, `scopes?`, `scopeSelector?` |
| `k8s_delete_resourcequota` | Delete a ResourceQuota | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_get_resource_quotas` | List ResourceQuotas per namespace | `namespace?` |
| `k8s_create_limit_range` | Create a LimitRange to set default resource limits | `name`, `limits` (required), `namespace?` |
| `k8s_delete_limitrange` | Delete a LimitRange | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_get_limit_ranges` | List LimitRanges per namespace | `namespace?` |
| `k8s_create_pdb` | Create a PodDisruptionBudget for high availability | `name`, `selector` (required), `minAvailable?`, `maxUnavailable?`, `namespace?` |
| `k8s_delete_pdb` | Delete a PodDisruptionBudget | `name`, `namespace?`, `gracePeriodSeconds?` |
| `k8s_list_pod_disruption_budgets` | List PDBs for protecting pods during disruptions | `namespace?` |
| `k8s_create_priorityclass` | Create a PriorityClass | `name`, `value` (required), `description?`, `globalDefault?: boolean`, `preemptionPolicy?` |

### Monitoring & Observability

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_list_events` | List cluster events with filtering options | `namespace?`, `fieldSelector?`, `type?` (Normal/Warning) |
| `k8s_get_pod_events` | Get events for a specific pod | `name` (required), `namespace?` |
| `k8s_cluster_health` | Get comprehensive cluster health overview including nodes, pods, components | - |
| `k8s_health_score` | Calculate cluster health score based on various factors (0-100) | - |
| `k8s_find_unhealthy_pods` | Find pods that are not in Running state or have issues | `namespace?` |
| `k8s_find_crashloop_pods` | Find pods in CrashLoopBackOff state | `namespace?` |
| `k8s_restart_report` | Report on container restarts across the cluster | `namespace?`, `minRestarts?` |
| `k8s_find_orphaned_resources` | Find resources that may be orphaned or unused | `namespace?` |
| `k8s_resource_age_report` | Find old, stale, or long-running resources | `namespace?`, `olderThanDays?`, `resourceTypes?` |
| `k8s_container_image_report` | Report on all container images used in the cluster | `namespace?`, `filter?` |
| `k8s_suggest_optimizations` | Analyze resources and suggest optimizations | `namespace?` |
| `k8s_analyze_pod_failure` | AI-style diagnosis of why a pod is failing | `name`, `namespace?` |
| `k8s_incident_snapshot` | Collect SRE triage data (Pods, Events, Rollouts, Nodes) for rapid incident response | `namespace?`, `limit?`, `includeNodes?` |
| `k8s_changes_since` | Get time-windowed diff of cluster resource changes with attribution | `since` (duration), `namespace?`, `resourceTypes?` |
| `k8s_get_pod_metrics` | Get pod metrics (CPU/Memory) - requires metrics-server | `name?`, `namespace?` |
| `k8s_get_node_metrics` | Get node metrics (CPU/Memory) - requires metrics-server | `name?` |
| `k8s_top_pod` | Display resource usage (CPU/Memory) for pods | `name?`, `namespace?`, `allNamespaces?: boolean`, `containers?: boolean`, `sortBy?` |
| `k8s_top_node` | Display resource usage (CPU/Memory) for nodes | `name?` |

### Helm Tools

#### Release Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_helm_list` | List Helm releases with filtering options | `namespace?`, `allNamespaces?: boolean`, `status?`, `filter?`, `selector?` |
| `k8s_helm_status` | Get status of a Helm release | `release` (required), `namespace?`, `revision?`, `showResources?: boolean`, `showDesc?: boolean` |
| `k8s_helm_history` | Get release history of a Helm chart | `release` (required), `namespace?`, `max?` |
| `k8s_helm_get_manifest` | Get the manifest of a named release | `release` (required), `namespace?`, `revision?` |
| `k8s_helm_get_notes` | Get the notes of a named release | `release` (required), `namespace?`, `revision?` |
| `k8s_helm_get_hooks` | Get the hooks of a named release | `release` (required), `namespace?`, `revision?` |
| `k8s_helm_get_all` | Get all information about a release | `release` (required), `namespace?`, `revision?` |
| `k8s_helm_get_metadata` | Fetch metadata for a Helm release | `release` (required), `namespace?`, `revision?` |
| `k8s_helm_values` | Get the values of a Helm release | `release` (required), `namespace?`, `revision?`, `allValues?: boolean` |
| `k8s_helm_install` | Install a Helm chart into Kubernetes | `chart` (required), `release?`, `namespace?`, `values?`, `set?`, `version?`, `wait?: boolean`, `waitForJobs?: boolean` |
| `k8s_helm_upgrade` | Upgrade a Helm release to a new version | `release` (required), `chart` (required), `namespace?`, `values?`, `set?`, `wait?: boolean`, `install?: boolean`, `atomic?: boolean` |
| `k8s_helm_uninstall` | Uninstall a Helm release | `release` (required), `namespace?`, `wait?: boolean`, `dryRun?: boolean`, `keepHistory?: boolean` |
| `k8s_helm_rollback` | Rollback to a previous revision | `release` (required), `namespace?`, `revision?`, `wait?: boolean`, `cleanupOnFail?: boolean` |
| `k8s_helm_test` | Run tests for a Helm release | `release` (required), `namespace?`, `timeout?`, `logs?: boolean`, `filter?` |

#### Chart Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_helm_create` | Create a new Helm chart directory with common files | `name` (required), `starter?` |
| `k8s_helm_package` | Package a Helm chart into a versioned chart archive | `chartPath` (required), `destination?`, `version?`, `appVersion?`, `sign?: boolean`, `key?`, `dependencyUpdate?: boolean` |
| `k8s_helm_lint` | Run tests to examine a Helm chart and identify possible issues | `chart` (required), `values?`, `set?`, `strict?: boolean`, `quiet?: boolean`, `kubeVersion?`, `withSubcharts?: boolean` |
| `k8s_helm_verify` | Verify that a chart has been signed and is valid | `chartPath` (required), `keyring?` |
| `k8s_helm_template` | Locally render templates for a Helm chart without installing | `chart` (required), `release?`, `namespace?`, `values?`, `set?`, `version?`, `includeCRDs?: boolean`, `skipTests?: boolean`, `outputDir?` |
| `k8s_helm_pull` | Download/pull a Helm chart from a repository | `chart` (required), `repo?`, `version?`, `destination?`, `untar?: boolean`, `verify?: boolean`, `insecureSkipTlsVerify?: boolean` |
| `k8s_helm_show` | Show information about a Helm chart | `chart` (required), `info?` (chart/values/readme/all/crds), `repo?`, `version?`, `jsonpath?` |

#### Repository Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_helm_repo_list` | List configured Helm chart repositories | `output?` (table/json/yaml) |
| `k8s_helm_repo_add` | Add a Helm chart repository | `name` (required), `url` (required), `username?`, `password?`, `forceUpdate?: boolean`, `insecureSkipTlsVerify?: boolean` |
| `k8s_helm_repo_remove` | Remove a Helm chart repository | `name` (required) |
| `k8s_helm_repo_update` | Update Helm chart repositories (get latest charts) | `repo?`, `timeout?` |
| `k8s_helm_repo_index` | Generate an index file from packaged charts | `directory` (required), `url?`, `merge?`, `json?: boolean` |
| `k8s_helm_search` | Search for Helm charts in Artifact Hub or local repos | `keyword` (required), `source?` (hub/repo), `version?`, `regexp?: boolean`, `output?`, `maxResults?`, `versions?: boolean` |
| `k8s_helm_dependency` | Manage Helm chart dependencies (list, update, build) | `chart` (required), `command` (list/update/build) |

#### Registry & Plugin

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_helm_registry_login` | Login to an OCI registry for Helm charts | `host` (required), `username?`, `password?`, `insecure?: boolean` |
| `k8s_helm_registry_logout` | Logout from an OCI registry | `host` (required) |
| `k8s_helm_push` | Push a chart to an OCI registry or remote URL | `chart` (required), `remote` (required), `username?`, `password?`, `insecureSkipTlsVerify?: boolean` |
| `k8s_helm_plugin_list` | List installed Helm plugins | `type?` |
| `k8s_helm_plugin_install` | Install a Helm plugin | `path` (required), `version?`, `verify?: boolean`, `insecureSkipTlsVerify?: boolean` |
| `k8s_helm_plugin_uninstall` | Uninstall a Helm plugin | `name` (required) |
| `k8s_helm_plugin_update` | Update Helm plugins | `name?` |
| `k8s_helm_plugin_package` | Package a Helm plugin directory into a plugin archive | `path` (required), `destination?`, `sign?: boolean`, `key?`, `passphraseFile?` |
| `k8s_helm_plugin_verify` | Verify that a Helm plugin has been signed and is valid | `path` (required), `keyring?` |
| `k8s_helm_env` | Display Helm environment information | - |
| `k8s_helm_version` | Display Helm version information | `short?: boolean` |

### Advanced & Diagnostic Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `k8s_apply_manifest` | Apply a Kubernetes manifest (YAML or JSON) | `manifest` (required), `namespace?` |
| `k8s_delete` | Delete resources with selectors and options | `resource?`, `name?`, `namespace?`, `labelSelector?`, `fieldSelector?`, `all?: boolean`, `dryRun?: boolean`, `force?: boolean`, `gracePeriodSeconds?` |
| `k8s_replace` | Replace a resource (destructive operation) | `manifest` (required), `cascade?`, `force?: boolean`, `namespace?` |
| `k8s_patch` | Patch any Kubernetes resource | `resource`, `name`, `patch` (required), `namespace?`, `patchType?` (strategic/merge/json) |
| `k8s_edit` | Get a resource for editing and apply changes | `resource`, `name`, `namespace?`, `manifest?` |
| `k8s_diff` | Diff a file or manifest against live configuration | `manifest?`, `resource?`, `name?`, `namespace?` |
| `k8s_get_resource_yaml` | Get raw YAML of a resource | `kind` (required), `name` (required), `namespace?` |
| `k8s_export_resource` | Export a resource as YAML | `kind` (required), `name` (required), `namespace?` |
| `k8s_validate_manifest` | Validate a Kubernetes manifest without applying it | `manifest` (required) |
| `k8s_convert` | Convert a manifest between different API versions | `manifest` (required), `outputVersion` (required) |
| `k8s_wait` | Wait for a specific condition on a resource | `resource` (required), `for` (required), `name?`, `namespace?`, `labelSelector?`, `timeout?` |
| `k8s_watch` | Watch resources for changes in real-time | `resource` (required), `name?`, `namespace?`, `labelSelector?`, `fieldSelector?` |
| `k8s_quick_deploy` | Quick deploy using template with custom parameters | `template` (required), `name`, `image` (required), `namespace?`, `replicas?`, `resources?` |
| `k8s_raw_api_query` | Execute a raw API query against the Kubernetes API server | `path` (required) |
| `k8s_proxy` | Start a proxy server to the Kubernetes API | `port?`, `address?`, `apiPrefix?`, `staticDir?`, `disableFilter?: boolean` |
| `k8s_list_crd` | List Custom Resource Definitions (CRDs) | - |
| `k8s_get_custom_resource` | Get a specific custom resource | `group`, `version`, `plural`, `name`, `namespace` (all required) |
| `k8s_list_custom_resources` | List custom resources by their API group | `group`, `version`, `plural` (all required), `namespace?` |
| `k8s_list_leases` | List Lease objects (coordination API) | `namespace?` |
| `k8s_delete_lease` | Delete a Lease | `name`, `namespace?`, `gracePeriodSeconds?` |

---

## kubectl to MCP Tool Mapping

### Config and Context

| kubectl Command | MCP Tool | Parameters |
|-----------------|----------|------------|
| `kubectl config view` | `k8s_config_view` | - |
| `kubectl config delete-context` | `k8s_config_delete_context` | `context` |
| `kubectl config rename-context` | `k8s_config_rename_context` | `oldName`, `newName` |
| `kubectl config set-context` | `k8s_config_set_namespace` | `namespace` |
| `kubectl cluster-info` | `k8s_cluster_info` | - |
| `kubectl version` | `k8s_version` | `short?: boolean` |
| `kubectl get contexts` | `k8s_list_contexts` | - |
| `kubectl config use-context` | `k8s_switch_context` | `context` |
| `kubectl create ns my-ns` | `k8s_create_namespace` | `name` |
| `kubectl delete ns my-ns` | `k8s_delete_namespace` | `name` |
| `kubectl get ns my-ns` | `k8s_get_namespace` | `name?` |

### Creating Resources

| kubectl Command | MCP Tool | Parameters |
|-----------------|----------|------------|
| `kubectl run nginx --image=nginx` | `k8s_run` | `image`, `name?`, `namespace?` |
| `kubectl run --dry-run=client` | `k8s_run` | `dryRun: "client"` |
| `kubectl apply -f manifest.yaml` | `k8s_apply_manifest` | `manifest` |
| `kubectl create deployment` | `k8s_create_deployment` | `name`, `image`, `replicas?` |
| `kubectl create job` | `k8s_create_job` | `name`, `image`, `command?` |
| `kubectl create cronjob` | `k8s_create_cronjob` | `name`, `image`, `schedule` |
| `kubectl create pvc` | `k8s_create_pvc` | `name`, `size`, `storageClass?` |
| `kubectl create pv` | `k8s_create_pv` | `name`, `capacity`, `path?` |
| `kubectl create service` | `k8s_create_service` | `name`, `type`, `port`, `selector` |
| `kubectl create ingress` | `k8s_create_ingress` | `name`, `rules`, `tls?` |
| `kubectl create configmap` | `k8s_create_configmap` | `name`, `data` |
| `kubectl create secret` | `k8s_create_secret` | `name`, `type`, `data` |
| `kubectl create serviceaccount` | `k8s_create_serviceaccount` | `name` |
| `kubectl create role` | `k8s_create_role` | `name`, `resources`, `verbs` |
| `kubectl create clusterrole` | `k8s_create_clusterrole` | `name`, `resources`, `verbs` |
| `kubectl create rolebinding` | `k8s_create_rolebinding` | `name`, `role`, `user?` |
| `kubectl create clusterrolebinding` | `k8s_create_clusterrolebinding` | `name`, `clusterrole`, `user?` |
| `kubectl create networkpolicy` | `k8s_create_networkpolicy` | `name`, `podSelector` |
| `kubectl create quota` | `k8s_create_resource_quota` | `name`, `hard` |
| `kubectl create pdb` | `k8s_create_pdb` | `name`, `selector` |
| `kubectl create priorityclass` | `k8s_create_priorityclass` | `name`, `value` |

### Viewing Resources

| kubectl Command | MCP Tool | Parameters |
|-----------------|----------|------------|
| `kubectl get pods` | `k8s_list_pods` | `namespace?`, `labelSelector?` |
| `kubectl get pods -o wide` | `k8s_list_pods` | (detailed info) |
| `kubectl get pods --show-labels` | `k8s_get_with_labels` | `resource: "pods"` |
| `kubectl get pods -l app=nginx` | `k8s_list_pods` | `labelSelector: "app=nginx"` |
| `kubectl get pods --sort-by=.metadata.name` | `k8s_get_sorted` | `sortBy: ".metadata.name"` |
| `kubectl get pods -o jsonpath='{...}'` | `k8s_get_jsonpath` | `jsonpath: "{...}"` |
| `kubectl describe pod my-pod` | `k8s_describe_pod` | `name`, `namespace?` |
| `kubectl explain pod` | `k8s_explain` | `resource: "pod"` |
| `kubectl api-resources` | `k8s_api_resources` | - |
| `kubectl api-versions` | `k8s_api_versions` | - |
| `kubectl top pod` | `k8s_top_pod` | `namespace?`, `name?` |
| `kubectl top node` | `k8s_top_node` | `name?` |

### Updating Resources

| kubectl Command | MCP Tool | Parameters |
|-----------------|----------|------------|
| `kubectl set image deployment/nginx nginx=nginx:v2` | `k8s_set_image` | `deployment`, `container`, `image` |
| `kubectl scale --replicas=3 deployment/nginx` | `k8s_scale` | `resource`, `name`, `replicas` |
| `kubectl rollout history deployment/nginx` | `k8s_rollout_history` | `deployment` |
| `kubectl rollout undo deployment/nginx` | `k8s_rollout_undo` | `deployment`, `toRevision?` |
| `kubectl rollout status deployment/nginx` | `k8s_deployment_rollout_status` | `deployment` |
| `kubectl rollout restart deployment/nginx` | `k8s_restart_deployment` | `deployment` |
| `kubectl expose deployment nginx --port=80` | `k8s_expose` | `resource`, `name`, `port` |
| `kubectl autoscale deployment foo --min=2 --max=10` | `k8s_autoscale` | `deployment`, `minReplicas`, `maxReplicas` |
| `kubectl label pods my-pod app=nginx` | `k8s_label` | `resource`, `name`, `labels` |
| `kubectl annotate pods my-pod desc=test` | `k8s_annotate` | `resource`, `name`, `annotations` |
| `kubectl patch pod my-pod -p '{...}'` | `k8s_patch` | `resource`, `name`, `patch` |
| `kubectl diff -f pod.json` | `k8s_diff` | `manifest` |
| `kubectl edit pod my-pod` | `k8s_edit` | `resource`, `name` |
| `kubectl replace -f pod.yaml` | `k8s_replace` | `manifest` |
| `kubectl convert -f pod.yaml --output-version=apps/v1` | `k8s_convert` | `manifest`, `outputVersion` |
| `kubectl wait --for=condition=ready pod/my-pod` | `k8s_wait` | `resource`, `name`, `for` |
| `kubectl rollout pause deployment/nginx` | `k8s_rollout_pause` | `deployment` |
| `kubectl rollout resume deployment/nginx` | `k8s_rollout_resume` | `deployment` |

### Deleting Resources

| kubectl Command | MCP Tool | Parameters |
|-----------------|----------|------------|
| `kubectl delete pod my-pod` | `k8s_delete` | `resource`, `name` |
| `kubectl delete deployment nginx` | `k8s_delete_deployment` | `name`, `namespace?` |
| `kubectl delete service nginx` | `k8s_delete_service` | `name`, `namespace?` |
| `kubectl delete configmap my-config` | `k8s_delete_configmap` | `name`, `namespace?` |
| `kubectl delete secret my-secret` | `k8s_delete_secret` | `name`, `namespace?` |
| `kubectl delete pvc my-pvc` | `k8s_delete_pvc` | `name`, `namespace?` |
| `kubectl delete pod my-pod --now` | `k8s_delete` | `now: true` |
| `kubectl delete -f pod.yaml` | `k8s_delete` | `manifest` |
| `kubectl delete pods -l app=nginx` | `k8s_delete` | `resource`, `labelSelector` |
| `kubectl delete pods --all` | `k8s_delete` | `resource`, `all: true` |
| `kubectl delete --dry-run` | `k8s_delete` | `dryRun: true` |

### Interacting with Running Pods

| kubectl Command | MCP Tool | Parameters |
|-----------------|----------|------------|
| `kubectl logs my-pod` | `k8s_get_logs` | `name`, `tailLines?` |
| `kubectl logs my-pod -c container` | `k8s_get_logs` | `name`, `container` |
| `kubectl logs my-pod --previous` | `k8s_get_logs` | `name`, `previous: true` |
| `kubectl logs -l app=nginx` | `k8s_get_logs` | `labelSelector` |
| `kubectl logs my-pod -f` | `k8s_get_logs` | `name`, `follow: true` |
| `kubectl exec my-pod -- ls /` | `k8s_exec_pod` | `pod`, `command` |
| `kubectl exec -it my-pod -- /bin/sh` | `k8s_exec_pod` | `pod`, `command`, `stdin: true` |
| `kubectl port-forward my-pod 5000:6000` | `k8s_port_forward` | `pod`, `ports` |
| `kubectl debug my-pod -it --image=busybox` | `k8s_debug_pod` | `name`, `image` |
| `kubectl debug node/my-node -it` | `k8s_debug_node` | `node`, `image?` |
| `kubectl cp local.txt pod:/remote.txt` | `k8s_cp` | `source`, `destination` |

### Interacting with Nodes

| kubectl Command | MCP Tool | Parameters |
|-----------------|----------|------------|
| `kubectl get nodes` | `k8s_list_nodes` | - |
| `kubectl describe node my-node` | `k8s_describe_node` | `name` |
| `kubectl cordon my-node` | `k8s_cordon_node` | `node` |
| `kubectl uncordon my-node` | `k8s_uncordon_node` | `node` |
| `kubectl drain my-node` | `k8s_drain_node` | `node` |
| `kubectl taint node my-node key=value:NoSchedule` | `k8s_taint_node` | `node`, `taint` |
| `kubectl label node my-node env=prod` | `k8s_label_node` | `node`, `labels` |

### Debugging and Advanced

| kubectl Command | MCP Tool | Parameters |
|-----------------|----------|------------|
| `kubectl get events` | `k8s_list_events` | `fieldSelector?` |
| `kubectl get --raw /api/v1/...` | `k8s_raw_api_query` | `path` |
| `kubectl auth can-i create pods` | `k8s_auth_can_i` | `verb`, `resource` |
| `kubectl certificate approve csr-name` | `k8s_certificate_approve` | `name` |
| `kubectl certificate deny csr-name` | `k8s_certificate_deny` | `name` |
| `kubectl certificate list` | `k8s_list_csr` | - |
| `kubectl proxy` | `k8s_proxy` | `port?`, `address?` |

---

## Natural Language to Tool Mapping

### Common Query Patterns

#### Listing Resources

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show me all pods" | `k8s_list_pods` | namespace (optional) |
| "List deployments in production" | `k8s_list_deployments` | namespace="production" |
| "What services are running?" | `k8s_list_services` | namespace (optional) |
| "Show all nodes" | `k8s_list_nodes` | - |
| "Display all namespaces" | `k8s_list_namespaces` | - |
| "List jobs in staging" | `k8s_list_jobs` | namespace="staging" |
| "Show cronjobs" | `k8s_list_cronjobs` | namespace (optional) |
| "List statefulsets" | `k8s_list_statefulsets` | namespace (optional) |
| "Show daemonsets" | `k8s_list_daemonsets` | namespace (optional) |

#### Getting Details

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Get details for pod my-pod" | `k8s_get_pod` | name="my-pod", namespace |
| "Describe deployment my-deploy" | `k8s_get_deployment` | name="my-deploy", namespace |
| "Show service my-service" | `k8s_get_service` | name="my-service", namespace |
| "Get node info for node-1" | `k8s_get_node` | name="node-1" |
| "Describe pod failure" | `k8s_analyze_pod_failure` | name, namespace |
| "Get pod events" | `k8s_get_pod_events` | name, namespace |

#### Resource Status & Health

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show failing pods" | `k8s_find_crashloop_pods` | namespace (optional) |
| "Find unhealthy pods" | `k8s_find_unhealthy_pods` | namespace (optional) |
| "Cluster health check" | `k8s_cluster_health` | - |
| "Health score" | `k8s_health_score` | - |
| "Show events" | `k8s_list_events` | namespace (optional), type="Warning" |
| "Find pods in CrashLoopBackOff" | `k8s_find_crashloop_pods` | namespace (optional) |

#### Resource Usage (Metrics)

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show pod resource usage" | `k8s_top_pod` | namespace (optional) |
| "Top pods by CPU" | `k8s_top_pod` | namespace, sortBy="cpu" |
| "Top pods by memory" | `k8s_top_pod` | namespace, sortBy="memory" |
| "Show node resource usage" | `k8s_top_node` | - |
| "Get pod metrics" | `k8s_get_pod_metrics` | namespace, name (optional) |
| "Get node metrics" | `k8s_get_node_metrics` | name (optional) |

#### Logs

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show logs for pod my-pod" | `k8s_get_pod_logs` | name="my-pod", namespace |
| "Get last 100 lines of logs" | `k8s_get_pod_logs` | name, namespace, tailLines=100 |
| "Follow pod logs" | `k8s_get_pod_logs` | name, namespace, follow=true |
| "Stream logs" | `k8s_stream_logs` | pod, namespace, follow=true |

#### Scaling & Management

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Scale deployment to 5 replicas" | `k8s_scale_deployment` | name, namespace, replicas=5 |
| "Restart deployment" | `k8s_restart_deployment` | name, namespace |
| "Rollback deployment" | `k8s_rollback_deployment` | name, namespace |
| "Delete pod my-pod" | `k8s_delete_pod` | name, namespace |
| "Restart pod" | `k8s_restart_pod` | name, namespace |

#### Configuration

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Apply this YAML" | `k8s_apply_manifest` | manifest (YAML string) |
| "Validate manifest" | `k8s_validate_manifest` | manifest (YAML string) |
| "Export deployment as YAML" | `k8s_export_resource` | kind="Deployment", name, namespace |
| "Edit deployment" | `k8s_edit` | resource="deployment", name, namespace |
| "Create namespace" | `k8s_create_namespace` | name |
| "Delete namespace" | `k8s_delete_namespace` | name |

#### Networking

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "List ingresses" | `k8s_list_ingresses` | namespace (optional) |
| "Show network policies" | `k8s_list_network_policies` | namespace (optional) |
| "Test DNS resolution" | `k8s_test_dns` | hostname, namespace |
| "Show service topology" | `k8s_service_topology` | namespace (optional) |

#### Storage

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "List PVCs" | `k8s_list_pvcs` | namespace (optional) |
| "Show PVs" | `k8s_list_pvs` | - |
| "List storage classes" | `k8s_list_storageclasses` | - |
| "Find unbound PVCs" | `k8s_find_unbound_pvcs` | namespace (optional) |

#### Security & RBAC

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "List service accounts" | `k8s_list_serviceaccounts` | namespace (optional) |
| "Show roles" | `k8s_list_roles` | namespace (optional) |
| "List cluster roles" | `k8s_list_clusterroles` | - |
| "Show secrets" | `k8s_list_secrets` | namespace (optional) |
| "Check for privileged pods" | `k8s_check_privileged_pods` | namespace (optional) |

#### Context & Cluster

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show current context" | `k8s_list_contexts` | - |
| "Switch context" | `k8s_switch_context` | context |
| "Cluster version" | `k8s_cluster_version` | - |
| "Component status" | `k8s_component_status` | - |
| "API latency check" | `k8s_api_latency_check` | - |

#### Advanced Operations

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Bulk delete pods with label" | `k8s_bulk_delete_pods` | namespace, labelSelector |
| "Explain pod resource" | `k8s_explain` | resource="pod", field (optional) |
| "API resources" | `k8s_api_resources` | namespaced, verbs |
| "Analyze pod failure" | `k8s_analyze_pod_failure` | name, namespace |
| "Optimization suggestions" | `k8s_suggest_optimizations` | namespace (optional) |
| "Find orphaned resources" | `k8s_find_orphaned_resources` | namespace (optional) |

---

## Intent Recognition Guidelines

### Resource Type Detection

- **Pods**: pod, pods, container, containers
- **Deployments**: deployment, deployments, deploy, app
- **Services**: service, services, svc
- **Nodes**: node, nodes, worker, workers, machine
- **Namespaces**: namespace, namespaces, ns, space
- **Jobs**: job, jobs, task, tasks
- **CronJobs**: cronjob, cronjobs, cron, schedule
- **StatefulSets**: statefulset, statefulsets, sts
- **DaemonSets**: daemonset, daemonsets, ds

### Action Detection

- **List/Show/Display**: Use `list_*` tools
- **Get/Describe/Details**: Use `get_*` tools
- **Delete/Remove/Kill**: Use `delete_*` tools
- **Scale**: Use `scale_deployment`
- **Restart**: Use `restart_deployment` or `restart_pod`
- **Logs**: Use `get_pod_logs` or `stream_logs`
- **Apply/Create**: Use `apply_manifest` or `create_*` tools
- **Validate/Check**: Use `validate_manifest` or health tools

### Status Detection

- **Failing/Error/Crash**: Use `find_crashloop_pods`, `find_unhealthy_pods`
- **Running/Ready/Healthy**: Check status in list results
- **Pending/Starting**: Check status in list results
- **Terminated/Completed**: Check status in list results

### Namespace Detection

- Look for patterns: "in [namespace]", "for [namespace]", "namespace [namespace]"
- Default to "default" if not specified
- Use "all namespaces" if user says "all" or "every"

---

## Protection Mode Classifications

### Read-Only Tools (Allowed in Strict Protection Mode)

All `list`, `get`, `describe`, `logs`, `events`, `watch`, `search`, `status`, `history`, `export`, `validate`, `diff`, `template`, `lint` operations are read-only.

### Destructive Tools (Blocked by Infrastructure Protection)

All `delete`, `uninstall`, `drain`, `cordon`, `replace`, `rollback` operations are destructive.

### Deletion Tools (Blocked by No Delete Protection Mode)

All tools starting with `k8s_delete_`, `k8s_bulk_delete_`, `k8s_helm_uninstall`, `k8s_helm_plugin_uninstall` are deletion operations.

---

## Tool Categories Summary

| Category | Tool Count |
|----------|------------|
| Protection Mode Tools | 4 |
| Server Management | 3 |
| Cluster & Context | 20 |
| Node Management | 13 |
| Pod Management | 22 |
| Workload Management | 30 |
| Networking & Services | 17 |
| Storage Management | 11 |
| Security & RBAC | 28 |
| Configuration & Secrets | 14 |
| Monitoring & Observability | 15 |
| Helm Tools | 40 |
| "List deployments in production" | `k8s_list_deployments` | namespace="production" |
| "What services are running?" | `k8s_list_services` | namespace (optional) |
| "Show all nodes" | `k8s_list_nodes` | - |
| "Display all namespaces" | `k8s_list_namespaces` | - |
| "List jobs in staging" | `k8s_list_jobs` | namespace="staging" |
| "Show cronjobs" | `k8s_list_cronjobs` | namespace (optional) |
| "List statefulsets" | `k8s_list_statefulsets` | namespace (optional) |
| "Show daemonsets" | `k8s_list_daemonsets` | namespace (optional) |

#### Getting Details

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Get details for pod my-pod" | `k8s_get_pod` | name="my-pod", namespace |
| "Describe deployment my-deploy" | `k8s_get_deployment` | name="my-deploy", namespace |
| "Show service my-service" | `k8s_get_service` | name="my-service", namespace |
| "Get node info for node-1" | `k8s_get_node` | name="node-1" |
| "Describe pod failure" | `k8s_analyze_pod_failure` | name, namespace |
| "Get pod events" | `k8s_get_pod_events` | name, namespace |

#### Resource Status & Health

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show failing pods" | `k8s_find_crashloop_pods` | namespace (optional) |
| "Find unhealthy pods" | `k8s_find_unhealthy_pods` | namespace (optional) |
| "Cluster health check" | `k8s_cluster_health` | - |
| "Health score" | `k8s_health_score` | - |
| "Show events" | `k8s_list_events` | namespace (optional), type="Warning" |
| "Find pods in CrashLoopBackOff" | `k8s_find_crashloop_pods` | namespace (optional) |

#### Resource Usage (Metrics)

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show pod resource usage" | `k8s_top_pod` | namespace (optional) |
| "Top pods by CPU" | `k8s_top_pod` | namespace, sortBy="cpu" |
| "Top pods by memory" | `k8s_top_pod` | namespace, sortBy="memory" |
| "Show node resource usage" | `k8s_top_node` | - |
| "Get pod metrics" | `k8s_get_pod_metrics` | namespace, name (optional) |
| "Get node metrics" | `k8s_get_node_metrics` | name (optional) |

#### Logs

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show logs for pod my-pod" | `k8s_get_pod_logs` | name="my-pod", namespace |
| "Get last 100 lines of logs" | `k8s_get_pod_logs` | name, namespace, tailLines=100 |
| "Follow pod logs" | `k8s_get_pod_logs` | name, namespace, follow=true |
| "Stream logs" | `k8s_stream_logs` | pod, namespace, follow=true |

#### Scaling & Management

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Scale deployment to 5 replicas" | `k8s_scale_deployment` | name, namespace, replicas=5 |
| "Restart deployment" | `k8s_restart_deployment` | name, namespace |
| "Rollback deployment" | `k8s_rollback_deployment` | name, namespace |
| "Delete pod my-pod" | `k8s_delete_pod` | name, namespace |
| "Restart pod" | `k8s_restart_pod` | name, namespace |

#### Configuration

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Apply this YAML" | `k8s_apply_manifest` | manifest (YAML string) |
| "Validate manifest" | `k8s_validate_manifest` | manifest (YAML string) |
| "Export deployment as YAML" | `k8s_export_resource` | kind="Deployment", name, namespace |
| "Edit deployment" | `k8s_edit` | resource="deployment", name, namespace |
| "Create namespace" | `k8s_create_namespace` | name |
| "Delete namespace" | `k8s_delete_namespace` | name |

#### Networking

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "List ingresses" | `k8s_list_ingresses` | namespace (optional) |
| "Show network policies" | `k8s_list_network_policies` | namespace (optional) |
| "Test DNS resolution" | `k8s_test_dns` | hostname, namespace |
| "Show service topology" | `k8s_service_topology` | namespace (optional) |

#### Storage

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "List PVCs" | `k8s_list_pvcs` | namespace (optional) |
| "Show PVs" | `k8s_list_pvs` | - |
| "List storage classes" | `k8s_list_storageclasses` | - |
| "Find unbound PVCs" | `k8s_find_unbound_pvcs` | namespace (optional) |

#### Security & RBAC

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "List service accounts" | `k8s_list_serviceaccounts` | namespace (optional) |
| "Show roles" | `k8s_list_roles` | namespace (optional) |
| "List cluster roles" | `k8s_list_clusterroles` | - |
| "Show secrets" | `k8s_list_secrets` | namespace (optional) |
| "Check for privileged pods" | `k8s_check_privileged_pods` | namespace (optional) |

#### Context & Cluster

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Show current context" | `k8s_list_contexts` | - |
| "Switch context" | `k8s_switch_context` | context |
| "Cluster version" | `k8s_cluster_version` | - |
| "Component status" | `k8s_component_status` | - |
| "API latency check" | `k8s_api_latency_check` | - |

#### Advanced Operations

| User Query Pattern | Tool | Key Parameters |
|-------------------|------|----------------|
| "Bulk delete pods with label" | `k8s_bulk_delete_pods` | namespace, labelSelector |
| "Explain pod resource" | `k8s_explain` | resource="pod", field (optional) |
| "API resources" | `k8s_api_resources` | namespaced, verbs |
| "Analyze pod failure" | `k8s_analyze_pod_failure` | name, namespace |
| "Optimization suggestions" | `k8s_suggest_optimizations` | namespace (optional) |
| "Find orphaned resources" | `k8s_find_orphaned_resources` | namespace (optional) |

---

## Intent Recognition Guidelines

### Resource Type Detection

- **Pods**: pod, pods, container, containers
- **Deployments**: deployment, deployments, deploy, app
- **Services**: service, services, svc
- **Nodes**: node, nodes, worker, workers, machine
- **Namespaces**: namespace, namespaces, ns, space
- **Jobs**: job, jobs, task, tasks
- **CronJobs**: cronjob, cronjobs, cron, schedule
- **StatefulSets**: statefulset, statefulsets, sts
- **DaemonSets**: daemonset, daemonsets, ds

### Action Detection

- **List/Show/Display**: Use `list_*` tools
- **Get/Describe/Details**: Use `get_*` tools
- **Delete/Remove/Kill**: Use `delete_*` tools
- **Scale**: Use `scale_deployment`
- **Restart**: Use `restart_deployment` or `restart_pod`
- **Logs**: Use `get_pod_logs` or `stream_logs`
- **Apply/Create**: Use `apply_manifest` or `create_*` tools
- **Validate/Check**: Use `validate_manifest` or health tools

### Status Detection

- **Failing/Error/Crash**: Use `find_crashloop_pods`, `find_unhealthy_pods`
- **Running/Ready/Healthy**: Check status in list results
- **Pending/Starting**: Check status in list results
- **Terminated/Completed**: Check status in list results

### Namespace Detection

- Look for patterns: "in [namespace]", "for [namespace]", "namespace [namespace]"
- Default to "default" if not specified
- Use "all namespaces" if user says "all" or "every"

---

## Protection Mode Classifications

### Read-Only Tools (Allowed in Strict Protection Mode)

All `list`, `get`, `describe`, `logs`, `events`, `watch`, `search`, `status`, `history`, `export`, `validate`, `diff`, `template`, `lint` operations are read-only.

### Destructive Tools (Blocked by Infrastructure Protection)

All `delete`, `uninstall`, `drain`, `cordon`, `replace`, `rollback` operations are destructive.

### Deletion Tools (Blocked by No Delete Protection Mode)

All tools starting with `k8s_delete_`, `k8s_bulk_delete_`, `k8s_helm_uninstall`, `k8s_helm_plugin_uninstall` are deletion operations.

---

## Tool Categories Summary

| Category | Tool Count |
|----------|------------|
| Protection Mode Tools | 4 |
| Server Management | 3 |
| Cluster & Context | 20 |
| Node Management | 13 |
| Pod Management | 22 |
| Workload Management | 30 |
| Networking & Services | 17 |
| Storage Management | 11 |
| Security & RBAC | 28 |
| Configuration & Secrets | 14 |
| Monitoring & Observability | 17 |
| Helm Tools | 40 |
| Advanced & Diagnostic | 44 |
| **Total** | **268** |

---

*Generated for k8s-helm-mcp v0.28.0*

---

## Project Documentation

| Document | Description |
|----------|-------------|
| **[README.md](README.md)** | Main documentation - Quick start, features, and examples |
| **[TOOLS_REFERENCE.md](TOOLS_REFERENCE.md)** | Complete tool reference with kubectl mappings and parameter details |
| **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** | Detailed API schemas and input/output examples |
| **[SECURITY.md](SECURITY.md)** | Security features, input sanitization, and secret scrubbing |
| **[PERFORMANCE_COMPARISON.md](PERFORMANCE_COMPARISON.md)** | Benchmarks and performance optimization details |
| **[CLOUD_PROVIDER_LIMITATIONS.md](CLOUD_PROVIDER_LIMITATIONS.md)** | Cloud provider specific limitations (AKS, GKE, EKS) |
| **[METRICS_SERVER.md](METRICS_SERVER.md)** | Metrics-server installation and configuration |
| **[DOCKER_DESKTOP_GUIDE.md](DOCKER_DESKTOP_GUIDE.md)** | Docker Desktop Kubernetes setup guide |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Contribution guidelines and development setup |
| **[CHANGELOG.md](CHANGELOG.md)** | Release history and notable changes |
| **[PRIVATE_REGISTRY_GUIDE.md](PRIVATE_REGISTRY_GUIDE.md)** | Private Helm and Docker registry configuration |
