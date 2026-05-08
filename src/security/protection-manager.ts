/**
 * Protection Manager
 * 
 * Handles Infrastructure Protection, Strict Protection, and No-Delete modes.
 * Centralizes the logic for blocking destructive or unauthorized operations.
 */

export class ProtectionManager {
  private infraProtectionEnabled: boolean = true;
  private strictProtectionEnabled: boolean = false;
  private noDeleteProtectionEnabled: boolean = false;

  // Strict Protection Mode - blocks ALL non-read-only operations
  private static readonly READ_ONLY_TOOLS = new Set([
    "k8s_list_contexts", "k8s_cluster_version", "k8s_component_status",
    "k8s_cluster_health", "k8s_list_namespaces", "k8s_api_latency_check",
    "k8s_cluster_info", "k8s_version", "k8s_api_versions", "k8s_api_resources",
    "k8s_list_nodes", "k8s_get_node", "k8s_node_pressure_status",
    "k8s_list_pods", "k8s_get_pod", "k8s_describe_pod", "k8s_get_pod_events",
    "k8s_get_logs", "k8s_find_unhealthy_pods", "k8s_find_crashloop_pods",
    "k8s_list_deployments", "k8s_get_deployment", "k8s_deployment_rollout_status",
    "k8s_list_replicasets", "k8s_get_replicaset",
    "k8s_list_statefulsets", "k8s_get_statefulset",
    "k8s_list_daemonsets", "k8s_get_daemonset",
    "k8s_list_jobs", "k8s_get_job", "k8s_list_cronjobs", "k8s_get_cronjob",
    "k8s_list_services", "k8s_get_service", "k8s_get_service_endpoints",
    "k8s_list_ingresses", "k8s_get_ingress", "k8s_list_network_policies",
    "k8s_list_pvs", "k8s_get_pv", "k8s_list_pvcs", "k8s_get_pvc_details",
    "k8s_list_storageclasses", "k8s_get_storageclass",
    "k8s_list_configmaps", "k8s_get_configmap",
    "k8s_list_secrets", "k8s_get_secret",
    "k8s_list_serviceaccounts", "k8s_get_serviceaccount",
    "k8s_list_roles", "k8s_get_role", "k8s_list_clusterroles", "k8s_get_clusterrole",
    "k8s_list_rolebindings", "k8s_get_rolebinding",
    "k8s_list_clusterrolebindings", "k8s_get_clusterrolebinding",
    "k8s_get_rbac_summary", "k8s_list_events", "k8s_get_resource_quotas",
    "k8s_get_limit_ranges", "k8s_health_score", "k8s_get_pod_metrics",
    "k8s_get_node_metrics", "k8s_top_pod", "k8s_top_node",
    "k8s_list_pod_disruption_budgets", "k8s_suggest_optimizations",
    "k8s_list_endpoints", "k8s_list_endpointslice",
    "k8s_list_crd", "k8s_list_custom_resources",
    "k8s_rollout_history", "k8s_explain",
    "k8s_check_privileged_pods", "k8s_auth_can_i",
    "k8s_find_orphaned_resources", "k8s_find_unbound_pvcs",
    "k8s_storage_summary", "k8s_service_topology",
    "k8s_analyze_pod_failure", "k8s_debug_scheduling",
    "k8s_list_hpa", "k8s_get_hpa",
    "k8s_watch", "k8s_config_set", "k8s_config_unset",
    "k8s_pod_log_search",
    // Missing core read-only tools
    "k8s_api_resources", "k8s_api_versions", "k8s_apply_view_last_applied",
    "k8s_batch_get_resources", "k8s_cache_stats", "k8s_cluster_info_dump",
    "k8s_config_view", "k8s_container_image_report", "k8s_diff",
    "k8s_export_resource", "k8s_get_custom_columns", "k8s_get_custom_resource",
    "k8s_get_deployment_templates", "k8s_get_go_template", "k8s_get_jsonpath",
    "k8s_get_network_policy", "k8s_get_resource_yaml", "k8s_get_sorted",
    "k8s_get_with_labels", "k8s_kustomize_build", "k8s_list_csr",
    "k8s_list_ingressclass", "k8s_list_kubeconfigs", "k8s_list_leases",
    "k8s_list_runtimeclasses", "k8s_namespace_summary", "k8s_resource_age_report",
    "k8s_resource_comparison", "k8s_restart_report", "k8s_stream_logs",
    "k8s_validate_manifest",
    // Helm read-only tools
    "k8s_helm_list", "k8s_helm_status", "k8s_helm_history",
    "k8s_helm_get_manifest", "k8s_helm_get_notes", "k8s_helm_get_hooks",
    "k8s_helm_get_all", "k8s_helm_get_metadata", "k8s_helm_values",
    "k8s_helm_repo_list", "k8s_helm_search", "k8s_helm_show",
    "k8s_helm_template", "k8s_helm_env", "k8s_helm_version",
    "k8s_helm_plugin_list", "k8s_helm_verify", "k8s_helm_lint",
    // Server tools
    "k8s_server_info", "k8s_server_health", "k8s_server_metrics", "k8s_server_stop",
    "k8s_toggle_protection_mode", "k8s_toggle_strict_protection_mode", "k8s_toggle_no_delete_mode",
    "k8s_toggle_all_protection_modes",
    // SRE tools
    "k8s_incident_snapshot",
    "k8s_changes_since",
    "k8s_blast_radius",
    "k8s_workload_diff",
    "k8s_silent_killers",
  ]);

  // Infrastructure Protection Mode - blocks destructive operations
  private static readonly DESTRUCTIVE_TOOLS = new Set([
    // Deletion operations
    "k8s_delete_pod", "k8s_bulk_delete_pods", "k8s_delete", "k8s_delete_namespace",
    "k8s_delete_deployment", "k8s_delete_statefulset", "k8s_delete_daemonset",
    "k8s_delete_replicaset", "k8s_delete_job", "k8s_delete_cronjob",
    "k8s_delete_service", "k8s_delete_ingress", "k8s_delete_configmap",
    "k8s_delete_secret", "k8s_delete_pvc", "k8s_delete_serviceaccount",
    "k8s_delete_role", "k8s_delete_clusterrole", "k8s_delete_rolebinding",
    "k8s_delete_clusterrolebinding", "k8s_delete_hpa", "k8s_delete_networkpolicy",
    "k8s_delete_resourcequota", "k8s_delete_limitrange", "k8s_delete_storageclass",
    "k8s_delete_pv", "k8s_delete_pdb", "k8s_delete_runtimeclass",
    "k8s_delete_lease", "k8s_delete_csr", "k8s_delete_ingressclass",
    // Node operations that affect scheduling
    "k8s_drain_node", "k8s_cordon_node", "k8s_uncordon_node",
    "k8s_add_node_taint", "k8s_remove_node_taint",
    // Scaling operations that could cause issues
    "k8s_scale_deployment", "k8s_scale", "k8s_autoscale",
    // Resource modifications
    "k8s_patch", "k8s_label", "k8s_annotate", "k8s_set_image", "k8s_edit",
    // Rollout operations
    "k8s_restart_deployment", "k8s_rollback_deployment", "k8s_rollout_undo",
    "k8s_rollout_pause", "k8s_rollout_resume", "k8s_restart_statefulset",
    "k8s_restart_daemonset",
    // Creation operations that could be risky
    "k8s_apply_manifest", "k8s_create_deployment", "k8s_create_job",
    "k8s_create_cronjob", "k8s_create_service", "k8s_create_ingress",
    "k8s_create_networkpolicy", "k8s_create_configmap", "k8s_create_secret",
    "k8s_create_serviceaccount", "k8s_create_role", "k8s_create_rolebinding",
    "k8s_create_clusterrole", "k8s_create_clusterrolebinding",
    "k8s_create_resource_quota", "k8s_create_limit_range", "k8s_create_namespace",
    "k8s_create_priorityclass", "k8s_expose", "k8s_run", "k8s_quick_deploy",
    // Helm destructive operations
    "k8s_helm_install", "k8s_helm_upgrade", "k8s_helm_uninstall",
    "k8s_helm_rollback", "k8s_helm_test", "k8s_helm_create",
    "k8s_helm_package", "k8s_helm_push", "k8s_helm_repo_add",
    "k8s_helm_repo_remove", "k8s_helm_repo_update", "k8s_helm_repo_index",
    "k8s_helm_dependency", "k8s_helm_plugin_install", "k8s_helm_plugin_uninstall",
    "k8s_helm_plugin_update", "k8s_helm_plugin_package", "k8s_helm_registry_login",
    "k8s_helm_registry_logout", "k8s_helm_pull",
    // Missing destructive/risky tools
    "k8s_add_kubeconfig", "k8s_add_node_label", "k8s_apply_set_last_applied",
    "k8s_attach", "k8s_attach_pod", "k8s_auth_reconcile", "k8s_cache_clear",
    "k8s_certificate_approve", "k8s_certificate_deny", "k8s_config_delete_context",
    "k8s_config_rename_context", "k8s_config_set_namespace", "k8s_convert",
    "k8s_cp", "k8s_create_daemonset", "k8s_create_pdb", "k8s_create_pv",
    "k8s_create_pvc", "k8s_create_statefulset", "k8s_debug_node", "k8s_debug_pod",
    "k8s_exec_pod", "k8s_helm_plugin_verify", "k8s_kubectl", "k8s_port_forward",
    "k8s_proxy", "k8s_raw_api_query", "k8s_remove_node_label", "k8s_replace",
    "k8s_restart_pod", "k8s_switch_context", "k8s_switch_kubeconfig",
    "k8s_test_dns", "k8s_trigger_job", "k8s_wait",
  ]);

  // No Delete Protection Mode - only blocks deletion operations
  private static readonly DELETION_TOOLS = new Set([
    // Kubernetes resource deletions
    "k8s_delete_pod", "k8s_bulk_delete_pods", "k8s_delete", "k8s_delete_namespace",
    "k8s_delete_deployment", "k8s_delete_statefulset", "k8s_delete_daemonset",
    "k8s_delete_replicaset", "k8s_delete_job", "k8s_delete_cronjob",
    "k8s_delete_service", "k8s_delete_ingress", "k8s_delete_configmap",
    "k8s_delete_secret", "k8s_delete_pvc", "k8s_delete_serviceaccount",
    "k8s_delete_role", "k8s_delete_clusterrole", "k8s_delete_rolebinding",
    "k8s_delete_clusterrolebinding", "k8s_delete_hpa", "k8s_delete_networkpolicy",
    "k8s_delete_resourcequota", "k8s_delete_limitrange", "k8s_delete_storageclass",
    "k8s_delete_pv", "k8s_delete_pdb", "k8s_delete_runtimeclass",
    "k8s_delete_lease", "k8s_delete_csr", "k8s_delete_ingressclass",
    // Helm deletions
    "k8s_helm_uninstall", "k8s_helm_plugin_uninstall",
    // Missing deletion operations
    "k8s_config_delete_context", "k8s_remove_node_label", "k8s_cache_clear",
  ]);

  constructor(config: {
    infraProtectionEnabled?: boolean;
    strictProtectionEnabled?: boolean;
    noDeleteProtectionEnabled?: boolean;
  }) {
    this.infraProtectionEnabled = config.infraProtectionEnabled ?? true;
    this.strictProtectionEnabled = config.strictProtectionEnabled ?? false;
    this.noDeleteProtectionEnabled = config.noDeleteProtectionEnabled ?? false;
  }

  /**
   * Check if a tool call is allowed under the current protection modes.
   * Throws an error if the operation is blocked.
   */
  public validateOperation(toolName: string): void {
    const isDestructive = ProtectionManager.DESTRUCTIVE_TOOLS.has(toolName);
    const isReadOnly = ProtectionManager.READ_ONLY_TOOLS.has(toolName);
    const isDeletion = ProtectionManager.DELETION_TOOLS.has(toolName);

    if (this.infraProtectionEnabled && isDestructive) {
      throw new Error(`Tool '${toolName}' is blocked by Infrastructure Protection Mode. ` +
        `This is a destructive operation that could impact cluster stability.`);
    }

    if (this.strictProtectionEnabled && !isReadOnly) {
      throw new Error(`Tool '${toolName}' is blocked by Strict Protection Mode. ` +
        `Only read-only/list operations are allowed.`);
    }

    if (this.noDeleteProtectionEnabled && isDeletion) {
      throw new Error(`Tool '${toolName}' is blocked by No Delete Protection Mode. ` +
        `Deletion of resources is currently restricted.`);
    }
  }

  // Getters and Setters for the modes
  public isInfraProtectionEnabled(): boolean { return this.infraProtectionEnabled; }
  public isStrictProtectionEnabled(): boolean { return this.strictProtectionEnabled; }
  public isNoDeleteProtectionEnabled(): boolean { return this.noDeleteProtectionEnabled; }

  public setInfraProtection(enabled: boolean): void { this.infraProtectionEnabled = enabled; }
  public setStrictProtection(enabled: boolean): void { this.strictProtectionEnabled = enabled; }
  public setNoDeleteProtection(enabled: boolean): void { this.noDeleteProtectionEnabled = enabled; }

  public isReadOnlyTool(toolName: string): boolean { return ProtectionManager.READ_ONLY_TOOLS.has(toolName); }
  public isDestructiveTool(toolName: string): boolean { return ProtectionManager.DESTRUCTIVE_TOOLS.has(toolName); }
  public isDeletionTool(toolName: string): boolean { return ProtectionManager.DELETION_TOOLS.has(toolName); }

  public getReadOnlyToolsCount(): number { return ProtectionManager.READ_ONLY_TOOLS.size; }
  public getDeletionToolsCount(): number { return ProtectionManager.DELETION_TOOLS.size; }
  public getDestructiveToolsCount(): number { return ProtectionManager.DESTRUCTIVE_TOOLS.size; }
}
