# API Documentation

This document provides auto-generated API documentation for all Kubernetes and Helm tools.

**Generated:** 2026-05-08T11:35:05.909Z

## Summary

- **Total Tools:** 269
- **Categories:** 35
- **Kubernetes Tools:** 16 categories
- **Helm Tools:** 19 categories

## Table of Contents

- [Cluster Tools](#cluster-tools) (18 tools)
- [Config Tools](#config-tools) (20 tools)
- [Diagnostics Tools](#diagnostics-tools) (6 tools)
- [Monitoring Tools](#monitoring-tools) (14 tools)
- [Networking Tools](#networking-tools) (18 tools)
- [Nodes Tools](#nodes-tools) (10 tools)
- [Pod Tools](#pod-tools) (13 tools)
- [Security Tools](#security-tools) (31 tools)
- [Storage Tools](#storage-tools) (11 tools)
- [Templates Tools](#templates-tools) (2 tools)
- [WebSocket Tools](#websocket-tools) (5 tools)
- [Workloads Tools](#workloads-tools) (43 tools)
- [Multi-Cluster Tools](#multi-cluster-tools) (3 tools)
- [SRE Tools](#sre-tools) (5 tools)
- [Advanced Tools](#advanced-tools) (23 tools)
- [Server Management](#server-management) (8 tools)
- [Helm Chart Management](#helm-chart-management) (5 tools)
- [Helm Chart Template](#helm-chart-template) (1 tools)
- [Helm Dependency Management](#helm-dependency-management) (1 tools)
- [Helm Environment](#helm-environment) (2 tools)
- [Helm Plugin Management](#helm-plugin-management) (6 tools)
- [Helm Registry Management](#helm-registry-management) (3 tools)
- [Helm Release Get Info](#helm-release-get-info) (5 tools)
- [Helm Release Get Values](#helm-release-get-values) (1 tools)
- [Helm Release History](#helm-release-history) (1 tools)
- [Helm Release Install](#helm-release-install) (1 tools)
- [Helm Release List](#helm-release-list) (1 tools)
- [Helm Release Rollback](#helm-release-rollback) (1 tools)
- [Helm Release Status](#helm-release-status) (1 tools)
- [Helm Release Test](#helm-release-test) (1 tools)
- [Helm Release Uninstall](#helm-release-uninstall) (1 tools)
- [Helm Release Upgrade](#helm-release-upgrade) (1 tools)
- [Helm Repo Management](#helm-repo-management) (5 tools)
- [Helm Search Hub](#helm-search-hub) (1 tools)
- [Helm Show Chart](#helm-show-chart) (1 tools)

## Cluster Tools

Kubernetes cluster management and context operations

**Total Tools:** 18

### k8s_list_contexts

List all available Kubernetes contexts from kubeconfig

**Parameters:** None

### k8s_switch_context

Switch to a different Kubernetes context

**Parameters:**

- **context** (string, required): Name of the context to switch to

### k8s_cluster_version

Get Kubernetes cluster version information

**Parameters:** None

### k8s_component_status

Get Kubernetes component statuses (scheduler, controller-manager, etcd)

**Parameters:** None

### k8s_cluster_health

Get comprehensive cluster health overview including nodes, pods, and components

**Parameters:** None

### k8s_list_namespaces

List all namespaces in the cluster

**Parameters:** None

### k8s_api_latency_check

Check API server latency and connectivity

**Parameters:** None

### k8s_cluster_info

Display cluster info (like kubectl cluster-info)

**Parameters:** None

### k8s_version

Show kubectl and cluster version information (like kubectl version)

**Parameters:**

- **short** (booleanoptional) (default: false): Print only the version number
- **output** (stringoptional) (default: "json") [enum: json, yaml]: Output format

### k8s_cluster_info_dump

Dump cluster state for debugging (like kubectl cluster-info dump). Collects information about nodes, pods, services, events, and configuration.

**Parameters:**

- **namespaces** (arrayoptional): Namespaces to dump (defaults to all namespaces if not specified)
  Items: string
- **outputDirectory** (stringoptional): Output directory path (optional, returns data directly if not specified)

### k8s_api_versions

List available API versions (like kubectl api-versions)

**Parameters:** None

### k8s_create_priorityclass

Create a PriorityClass (like kubectl create priorityclass)

**Parameters:**

- **name** (string, required): Name of the PriorityClass
- **value** (number, required): Priority value (higher = more priority, can be negative)
- **description** (stringoptional): Description of the PriorityClass
- **globalDefault** (booleanoptional) (default: false): Set as global default priority class
- **preemptionPolicy** (stringoptional) (default: "PreemptLowerPriority") [enum: Never, PreemptLowerPriority]: Preemption policy (Never or PreemptLowerPriority)

### k8s_config_delete_context

Delete a context from kubeconfig (like kubectl config delete-context)

**Parameters:**

- **context** (string, required): Name of the context to delete

### k8s_config_rename_context

Rename a context in kubeconfig (like kubectl config rename-context)

**Parameters:**

- **oldName** (string, required): Current name of the context
- **newName** (string, required): New name for the context

### k8s_list_runtimeclasses

List RuntimeClasses in the cluster (like kubectl get runtimeclass)

**Parameters:** None

### k8s_list_leases

List Lease objects (coordination API, like kubectl get lease)

**Parameters:**

- **namespace** (stringoptional): Namespace (default: all namespaces)

### k8s_config_set

Set a kubeconfig value (like kubectl config set). Sets a cluster, context, or user property.

**Parameters:**

- **property** (string, required): Property path to set (e.g., 'clusters.my-cluster.server', 'contexts.my-context.namespace', 'users.my-user.token')
- **value** (string, required): Value to set

### k8s_config_unset

Remove a kubeconfig property (like kubectl config unset). Removes a cluster, context, or user property.

**Parameters:**

- **property** (string, required): Property path to unset (e.g., 'clusters.my-cluster.server', 'contexts.my-context.namespace', 'users.my-user.token')

## Config Tools

Kubeconfig management and configuration operations

**Total Tools:** 20

### k8s_apply_manifest

Apply a Kubernetes manifest (YAML or JSON)

**Parameters:**

- **manifest** (string, required): YAML or JSON manifest content to apply
- **namespace** (stringoptional) (default: "default"): Default namespace for resources without namespace specified

### k8s_export_resource

Export a resource as YAML

**Parameters:**

- **kind** (string, required): Resource kind (e.g., Pod, Deployment, Service)
- **name** (string, required): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace (if namespaced resource)
- **scrub** (booleanoptional) (default: false): Mask potential secrets in exported YAML

### k8s_validate_manifest

Validate a Kubernetes manifest without applying it

**Parameters:**

- **manifest** (string, required): YAML or JSON manifest to validate

### k8s_get_resource_yaml

Get raw YAML of a resource

**Parameters:**

- **kind** (string, required): Resource kind
- **name** (string, required): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace
- **scrub** (booleanoptional) (default: false): Mask potential secrets in exported YAML

### k8s_create_namespace

Create a new namespace

**Parameters:**

- **name** (string, required): Name of the namespace
- **labels** (objectoptional): Labels to apply to the namespace

### k8s_delete_namespace

Delete a namespace

**Parameters:**

- **name** (string, required): Name of the namespace to delete
- **force** (booleanoptional) (default: false): Force delete (remove finalizers)

### k8s_config_view

View merged kubeconfig settings

**Parameters:**

- **raw** (booleanoptional) (default: false): Show raw certificate data and secrets

### k8s_config_set_namespace

Set the default namespace for the current context

**Parameters:**

- **namespace** (string, required): Namespace to set as default

### k8s_cp

Copy files and directories to and from containers (like kubectl cp). Supports namespace/pod:path format.

**Parameters:**

- **source** (string, required): Source path (pod:/path, namespace/pod:/path, or local/path)
- **destination** (string, required): Destination path (pod:/path, namespace/pod:/path, or local/path)
- **namespace** (stringoptional) (default: "default"): Default namespace (if not specified in path)
- **container** (stringoptional): Container name (for multi-container pods)

### k8s_edit

Get a resource for editing and apply changes (like kubectl edit). Step 1: Call without 'manifest' to get current YAML. Step 2: Call with modified 'manifest' to apply changes.

**Parameters:**

- **resource** (string, required): Resource type (pod, deployment, service, configmap, etc.)
- **name** (string, required): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace
- **manifest** (stringoptional): Modified YAML/JSON manifest to apply (omit to fetch current state)

### k8s_diff

Diff a file or manifest against the live configuration (like kubectl diff). Shows differences between local manifest and running resource.

**Parameters:**

- **manifest** (string, required): YAML/JSON manifest content to compare
- **resource** (stringoptional): Resource type (pod, deployment, service, etc.)
- **name** (stringoptional): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace

### k8s_delete_configmap

Delete a ConfigMap

**Parameters:**

- **name** (string, required): Name of the ConfigMap to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the ConfigMap
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_delete_secret

Delete a Secret

**Parameters:**

- **name** (string, required): Name of the Secret to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the Secret
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_create_configmap

Create a Kubernetes ConfigMap

**Parameters:**

- **name** (string, required): Name of the ConfigMap
- **namespace** (stringoptional) (default: "default"): Namespace for the ConfigMap
- **data** (objectoptional): ConfigMap data as key-value pairs
- **fromFile** (arrayoptional): Create from files (alternative to data)
  Items: string
- **fromLiteral** (objectoptional): Create from literal key-value pairs
- **immutable** (booleanoptional) (default: false): Prevent updates to this ConfigMap

### k8s_create_secret

Create a Kubernetes Secret (generic, TLS, or docker-registry)

**Parameters:**

- **name** (string, required): Name of the Secret
- **namespace** (stringoptional) (default: "default"): Namespace for the Secret
- **type** (stringoptional) (default: "Opaque") [enum: Opaque, kubernetes.io/tls, kubernetes.io/dockerconfigjson, kubernetes.io/basic-auth, kubernetes.io/ssh-auth]: Secret type
- **data** (objectoptional): Secret data (will be base64 encoded) - use stringData for plain text
- **stringData** (objectoptional): Secret data as plain strings (automatically base64 encoded)
- **fromFile** (arrayoptional): Create from files (path or key=path format)
  Items: string
- **dockerServer** (stringoptional): Docker registry server (for docker-registry type)
- **dockerUsername** (stringoptional): Docker registry username (for docker-registry type)
- **dockerPassword** (stringoptional): Docker registry password (for docker-registry type)
- **dockerEmail** (stringoptional): Docker registry email (for docker-registry type)
- **cert** (stringoptional): TLS certificate file path or content (for TLS type)
- **key** (stringoptional): TLS key file path or content (for TLS type)
- **immutable** (booleanoptional) (default: false): Prevent updates to this Secret

### k8s_replace

Replace a resource by filename or stdin (like kubectl replace). WARNING: This is a destructive operation that removes and recreates the resource.

**Parameters:**

- **manifest** (string, required): Complete YAML/JSON manifest of the resource to replace
- **force** (booleanoptional) (default: false): Force replace even if conflicts exist
- **namespace** (stringoptional): Namespace (overrides manifest)
- **cascade** (stringoptional) (default: "background"): Must be 'background', 'orphan', or 'foreground'

### k8s_convert

Convert a manifest between different API versions (like kubectl convert). Note: Uses best-effort heuristic conversion.

**Parameters:**

- **manifest** (string, required): YAML/JSON manifest to convert
- **outputVersion** (string, required): Target API version (e.g., 'apps/v1', 'v1', 'batch/v1')

### k8s_apply_view_last_applied

View the last-applied-configuration annotation of a resource (like kubectl apply view-last-applied)

**Parameters:**

- **resource** (string, required): Resource type (pod, deployment, service, etc.)
- **name** (string, required): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace for namespaced resources
- **output** (stringoptional) (default: "yaml") [enum: yaml, json]: Output format

### k8s_apply_set_last_applied

Set the last-applied-configuration annotation on a resource (like kubectl apply set-last-applied)

**Parameters:**

- **resource** (string, required): Resource type (pod, deployment, service, etc.)
- **name** (string, required): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace for namespaced resources
- **manifest** (string, required): YAML/JSON manifest to set as last-applied-configuration
- **createAnnotation** (booleanoptional) (default: true): Create the annotation if it doesn't exist

### k8s_kustomize_build

Build Kubernetes manifests from a kustomization directory (like kubectl kustomize)

**Parameters:**

- **path** (stringoptional) (default: "."): Path to directory containing kustomization.yaml (local path or git URL)
- **output** (stringoptional) (default: "yaml") [enum: yaml, json]: Output format
- **enableHelm** (booleanoptional) (default: false): Enable helm inflation (if kustomize supports it)

## Diagnostics Tools

Cluster health checks and diagnostic utilities

**Total Tools:** 6

### k8s_namespace_summary

Get a comprehensive summary of all resources in a namespace - pods, deployments, services, configmaps, secrets, jobs, and resource usage at a glance

**Parameters:**

- **namespace** (stringoptional) (default: "default"): Namespace to summarize

### k8s_resource_age_report

Find old, stale, or long-running resources. Helps identify resources that may need cleanup or attention.

**Parameters:**

- **namespace** (stringoptional): Namespace to check (default: all namespaces)
- **olderThanDays** (numberoptional) (default: 30): Show resources older than N days
- **resourceTypes** (arrayoptional): Resource types to check (default: pods, jobs, deployments)
  Items: string

### k8s_pod_log_search

Search for patterns in pod logs across multiple pods. Useful for finding errors, exceptions, or specific messages.

**Parameters:**

- **pattern** (string, required): Text pattern to search for in logs (case-insensitive)
- **namespace** (stringoptional) (default: "default"): Namespace to search in
- **labelSelector** (stringoptional): Label selector to filter pods (e.g., app=nginx)
- **tailLines** (numberoptional) (default: 500): Number of recent log lines to search per pod
- **maxPods** (numberoptional) (default: 20): Maximum number of pods to search
- **scrub** (booleanoptional) (default: false): Mask potential secrets in matched log lines (passwords, tokens, emails, IPs)

### k8s_resource_comparison

Compare resource counts and status across two namespaces. Useful for verifying staging/production parity.

**Parameters:**

- **namespace1** (string, required): First namespace to compare
- **namespace2** (string, required): Second namespace to compare

### k8s_container_image_report

Report on all container images used in the cluster. Helps audit image versions, find outdated images, and identify tag usage.

**Parameters:**

- **namespace** (stringoptional): Namespace to scan (default: all namespaces)
- **filter** (stringoptional): Filter images by name pattern (e.g., 'nginx', 'myregistry.io')

### k8s_restart_report

Report on container restarts across the cluster. Identifies containers that are frequently restarting.

**Parameters:**

- **namespace** (stringoptional): Namespace to check (default: all namespaces)
- **minRestarts** (numberoptional) (default: 1): Minimum restart count to include

## Monitoring Tools

Resource monitoring and metrics collection

**Total Tools:** 14

### k8s_list_events

List cluster events

**Parameters:**

- **namespace** (stringoptional): Namespace to filter
- **fieldSelector** (stringoptional): Field selector (e.g., reason=FailedScheduling)
- **type** (stringoptional): Event type filter (Normal, Warning)

### k8s_get_resource_quotas

List ResourceQuotas per namespace

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_limit_ranges

List LimitRanges per namespace

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_find_crashloop_pods

Find pods in CrashLoopBackOff state

**Parameters:**

- **namespace** (stringoptional): Namespace to search

### k8s_get_pod_metrics

Get pod metrics (CPU/Memory) - requires metrics-server

**Parameters:**

- **namespace** (stringoptional) (default: "default"): Namespace
- **name** (stringoptional): Specific pod name (optional)

### k8s_get_node_metrics

Get node metrics (CPU/Memory) - requires metrics-server

**Parameters:**

- **name** (stringoptional): Specific node name (optional)

### k8s_health_score

Calculate cluster health score based on various factors

**Parameters:** None

### k8s_top_pod

Display resource usage (CPU/Memory) for pods (like kubectl top pod). Requires metrics-server.

**Parameters:**

- **namespace** (stringoptional): Namespace to filter (shows all if not specified)
- **name** (stringoptional): Specific pod name (optional, shows all pods if not specified)
- **allNamespaces** (booleanoptional) (default: false): Show pods from all namespaces
- **containers** (booleanoptional) (default: false): Show per-container metrics
- **sortBy** (stringoptional) [enum: cpu, memory]: Sort results by field (cpu or memory)

### k8s_top_node

Display resource usage (CPU/Memory) for nodes (like kubectl top node). Requires metrics-server.

**Parameters:**

- **name** (stringoptional): Specific node name (optional, shows all nodes if not specified)

### k8s_create_resource_quota

Create a ResourceQuota to limit resource consumption in a namespace

**Parameters:**

- **name** (string, required): Name of the ResourceQuota
- **namespace** (stringoptional) (default: "default"): Namespace for the ResourceQuota
- **hard** (object, required): Resource limits (e.g., {pods: '10', 'requests.cpu': '20', 'requests.memory': '100Gi'})
- **scopeSelector** (objectoptional): Scope selector to match pods
- **scopes** (arrayoptional): Scopes for the quota (e.g., Terminating, NotTerminating)
  Items: string

### k8s_create_limit_range

Create a LimitRange to set default resource limits for pods/containers in a namespace

**Parameters:**

- **name** (string, required): Name of the LimitRange
- **namespace** (stringoptional) (default: "default"): Namespace for the LimitRange
- **limits** (array, required): Limit range specs
  Items:
    - **type** (stringoptional) [enum: Container, Pod, PersistentVolumeClaim]: Type of resource (Container, Pod, PersistentVolumeClaim)
    - **max** (objectoptional): Maximum resource limits
    - **min** (objectoptional): Minimum resource limits
    - **default** (objectoptional): Default resource limits
    - **defaultRequest** (objectoptional): Default resource requests
    - **maxLimitRequestRatio** (objectoptional): Max limit/request ratio

### k8s_delete_limitrange

Delete a LimitRange

**Parameters:**

- **name** (string, required): Name of the LimitRange to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the LimitRange
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_delete_resourcequota

Delete a ResourceQuota

**Parameters:**

- **name** (string, required): Name of the ResourceQuota to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the ResourceQuota
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_list_pod_disruption_budgets

List PodDisruptionBudgets (PDBs) for protecting pods during voluntary disruptions

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

## Networking Tools

Network-related resources and operations

**Total Tools:** 18

### k8s_list_services

List all services

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_service

Get detailed information about a Service

**Parameters:**

- **name** (string, required): Name of the Service
- **namespace** (stringoptional) (default: "default"): Namespace of the Service

### k8s_get_service_endpoints

Get endpoints for a service

**Parameters:**

- **name** (string, required): Name of the service
- **namespace** (stringoptional) (default: "default"): Namespace of the service

### k8s_list_ingresses

List all Ingresses

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_list_network_policies

List all NetworkPolicies

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_ingress

Get detailed information about an Ingress

**Parameters:**

- **name** (string, required): Name of the Ingress
- **namespace** (stringoptional) (default: "default"): Namespace of the Ingress

### k8s_get_network_policy

Get detailed information about a NetworkPolicy

**Parameters:**

- **name** (string, required): Name of the NetworkPolicy
- **namespace** (stringoptional) (default: "default"): Namespace of the NetworkPolicy

### k8s_test_dns

Test DNS resolution within the cluster

**Parameters:**

- **hostname** (string, required): Hostname to resolve
- **namespace** (stringoptional) (default: "default"): Namespace context for short names

### k8s_service_topology

Show service-to-pod mapping for visualization

**Parameters:**

- **namespace** (stringoptional) (default: "default"): Namespace to analyze

### k8s_delete_service

Delete a Service

**Parameters:**

- **name** (string, required): Name of the Service to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the Service
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_delete_ingress

Delete an Ingress

**Parameters:**

- **name** (string, required): Name of the Ingress to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the Ingress
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_create_service

Create a new Kubernetes Service

**Parameters:**

- **name** (string, required): Name of the Service
- **namespace** (stringoptional) (default: "default"): Namespace for the Service
- **type** (stringoptional) (default: "ClusterIP") [enum: ClusterIP, NodePort, LoadBalancer, ExternalName]: Service type (ClusterIP, NodePort, LoadBalancer, ExternalName)
- **selector** (objectoptional): Label selector for targeting pods (e.g., {app: 'nginx'})
- **ports** (array, required): Service ports
  Items:
    - **port** (numberoptional): 
    - **targetPort** (numberoptional): 
    - **protocol** (stringoptional) (default: "TCP"): 
    - **name** (stringoptional): 
- **externalName** (stringoptional): External name for ExternalName type service

### k8s_expose

Expose a deployment or pod as a service (like kubectl expose)

**Parameters:**

- **resource** (string, required) [enum: deployment, pod, replicaset, replicationcontroller]: Resource type (deployment, pod, replicaset, replicationcontroller)
- **name** (string, required): Name of the resource to expose
- **namespace** (stringoptional) (default: "default"): Namespace
- **port** (number, required): Service port
- **targetPort** (numberoptional): Target port on pods (defaults to port)
- **type** (stringoptional) (default: "ClusterIP") [enum: ClusterIP, NodePort, LoadBalancer]: Service type
- **serviceName** (stringoptional): Name for the created service (defaults to resource name)

### k8s_create_ingress

Create a new Kubernetes Ingress

**Parameters:**

- **name** (string, required): Name of the Ingress
- **namespace** (stringoptional) (default: "default"): Namespace for the Ingress
- **rules** (array, required): Ingress rules
  Items:
    - **host** (stringoptional): 
    - **paths** (arrayoptional): 
      Items:
        - **path** (stringoptional) (default: "/"): 
        - **pathType** (stringoptional) (default: "Prefix") [enum: Prefix, Exact, ImplementationSpecific]: 
        - **serviceName** (stringoptional): 
        - **servicePort** (numberoptional): 
- **tls** (arrayoptional): TLS configuration
  Items:
    - **hosts** (arrayoptional): 
      Items: string
    - **secretName** (stringoptional): 
- **annotations** (objectoptional): Ingress annotations (e.g., nginx.ingress.kubernetes.io/rewrite-target)

### k8s_create_networkpolicy

Create a Kubernetes NetworkPolicy to control traffic flow

**Parameters:**

- **name** (string, required): Name of the NetworkPolicy
- **namespace** (stringoptional) (default: "default"): Namespace for the NetworkPolicy
- **podSelector** (objectoptional): Pod selector labels (empty = all pods in namespace)
- **policyTypes** (arrayoptional) (default: ["Ingress"]): Policy types (Ingress, Egress, or both)
  Items: string
- **ingress** (arrayoptional): Ingress rules (allowed incoming traffic)
  Items:
    - **from** (arrayoptional): 
    - **ports** (arrayoptional): 
- **egress** (arrayoptional): Egress rules (allowed outgoing traffic)
  Items:
    - **to** (arrayoptional): 
    - **ports** (arrayoptional): 

### k8s_list_endpoints

List Endpoints for services (like kubectl get endpoints)

**Parameters:**

- **namespace** (stringoptional): Namespace (default: all namespaces)
- **service** (stringoptional): Filter by service name

### k8s_list_endpointslice

List EndpointSlices (modern replacement for Endpoints, like kubectl get endpointslice)

**Parameters:**

- **namespace** (stringoptional): Namespace (default: all namespaces)
- **service** (stringoptional): Filter by service name (label selector)

### k8s_list_ingressclass

List IngressClasses (like kubectl get ingressclass)

**Parameters:** None

## Nodes Tools

Node management and operations

**Total Tools:** 10

### k8s_list_nodes

List all nodes in the cluster with status and resource information

**Parameters:** None

### k8s_get_node

Get detailed information about a specific node

**Parameters:**

- **name** (string, required): Name of the node

### k8s_cordon_node

Mark a node as unschedulable (cordon)

**Parameters:**

- **name** (string, required): Name of the node to cordon

### k8s_uncordon_node

Mark a node as schedulable (uncordon)

**Parameters:**

- **name** (string, required): Name of the node to uncordon

### k8s_drain_node

Drain a node by cordoning it and evicting all pods

**Parameters:**

- **name** (string, required): Name of the node to drain
- **force** (booleanoptional) (default: false): Force deletion of pods with local storage
- **gracePeriodSeconds** (numberoptional) (default: 30): Grace period for pod termination

### k8s_add_node_taint

Add a taint to a node

**Parameters:**

- **name** (string, required): Name of the node
- **key** (string, required): Taint key
- **value** (stringoptional): Taint value
- **effect** (string, required) [enum: NoSchedule, PreferNoSchedule, NoExecute]: Taint effect (NoSchedule, PreferNoSchedule, NoExecute)

### k8s_remove_node_taint

Remove a taint from a node

**Parameters:**

- **name** (string, required): Name of the node
- **key** (string, required): Taint key to remove
- **effect** (stringoptional) [enum: NoSchedule, PreferNoSchedule, NoExecute]: Taint effect (optional, removes all matching keys if not specified)

### k8s_add_node_label

Add or update a label on a node

**Parameters:**

- **name** (string, required): Name of the node
- **key** (string, required): Label key
- **value** (string, required): Label value

### k8s_remove_node_label

Remove a label from a node

**Parameters:**

- **name** (string, required): Name of the node
- **key** (string, required): Label key to remove

### k8s_node_pressure_status

Check for node pressure conditions (Memory, Disk, PID)

**Parameters:**

- **name** (stringoptional): Name of the node (optional, checks all nodes if not specified)

## Pod Tools

Pod lifecycle management and operations

**Total Tools:** 13

### k8s_list_pods

List pods across all namespaces or a specific namespace

**Parameters:**

- **namespace** (stringoptional): Namespace to filter by (optional, shows all if not specified)
- **labelSelector** (stringoptional): Label selector to filter pods
- **fieldSelector** (stringoptional): Field selector to filter pods
- **context** (stringoptional): Kubernetes context to use (from kubeconfig). Uses current context if not specified

### k8s_get_pod

Get detailed information about a specific pod

**Parameters:**

- **name** (string, required): Name of the pod
- **namespace** (stringoptional) (default: "default"): Namespace of the pod

### k8s_get_logs

Get logs from a pod, deployment, statefulset, daemonset, job, or service. Supports following logs, previous container instances, time-based filtering, and label selectors.

**Parameters:**

- **name** (stringoptional): Name of the pod, deployment (deploy/name), statefulset (sts/name), daemonset (ds/name), job (job/name), or service (svc/name). Use format like 'deploy/my-deployment', 'sts/my-statefulset', or 'svc/my-service'
- **namespace** (stringoptional) (default: "default"): Namespace of the resource
- **container** (stringoptional): Container name (for multi-container pods)
- **tailLines** (numberoptional) (default: 100): Number of lines to show from the end
- **previous** (booleanoptional) (default: false): Get logs from previous container instance (for crashed containers)
- **follow** (booleanoptional) (default: false): Stream logs in real-time (like tail -f). Note: In MCP, this returns initial logs only.
- **labelSelector** (stringoptional): Label selector to select pods (e.g., 'app=nginx,name=myLabel')
- **allContainers** (booleanoptional) (default: false): Get logs from all containers in the pod(s)
- **timestamps** (booleanoptional) (default: false): Include timestamps in log output
- **sinceSeconds** (numberoptional): Only return logs newer than a relative duration (e.g., 300 for 5 minutes)
- **sinceTime** (stringoptional): Only return logs after a specific date (RFC3339 format, e.g., '2024-01-01T00:00:00Z')
- **since** (stringoptional): Only return logs newer than a relative duration (e.g., '5s', '2m', '3h'). Mutually exclusive with sinceSeconds.
- **limitBytes** (numberoptional): Maximum bytes of logs to return
- **prefix** (booleanoptional) (default: false): Prefix each log line with the log source (pod name and container name)
- **filter** (stringoptional): Filter logs by pattern (case-insensitive substring match, like grep)
- **exclude** (stringoptional): Exclude lines matching pattern (case-insensitive)
- **level** (stringoptional) [enum: error, warn, info, debug]: Filter by log level keywords
- **format** (stringoptional) (default: "structured") [enum: structured, text, summary]: Output format for multi-pod results
- **maxPods** (numberoptional) (default: 10): Maximum pods to fetch logs from when using labelSelector or deployment/service (default: 10, max: 50)
- **analyze** (booleanoptional) (default: false): Enable AI analysis mode - returns statistics, patterns, and insights without full log content
- **patterns** (arrayoptional): Custom patterns to search for and count (e.g., ['timeout', 'connection refused', 'database'])
  Items: string
- **scrub** (booleanoptional) (default: false): Mask potential secrets in logs (passwords, tokens, emails, IPs)

### k8s_delete_pod

Delete a pod

**Parameters:**

- **name** (string, required): Name of the pod to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the pod
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_describe_pod

Get full YAML description of a pod

**Parameters:**

- **name** (string, required): Name of the pod
- **namespace** (stringoptional) (default: "default"): Namespace of the pod
- **scrub** (booleanoptional) (default: false): Mask potential secrets in pod spec (env vars, command args)

### k8s_get_pod_events

Get events for a specific pod

**Parameters:**

- **name** (string, required): Name of the pod
- **namespace** (stringoptional) (default: "default"): Namespace of the pod

### k8s_find_unhealthy_pods

Find pods that are not in Running state or have issues

**Parameters:**

- **namespace** (stringoptional): Namespace to search (optional, all if not specified)

### k8s_restart_pod

Restart a pod by deleting it (will be recreated if part of a controller)

**Parameters:**

- **name** (string, required): Name of the pod to restart
- **namespace** (stringoptional) (default: "default"): Namespace of the pod

### k8s_debug_scheduling

Debug why a pod is stuck in Pending state

**Parameters:**

- **name** (string, required): Name of the pending pod
- **namespace** (stringoptional) (default: "default"): Namespace of the pod

### k8s_debug_pod

Create an ephemeral debug container in a running pod (like kubectl debug)

**Parameters:**

- **name** (string, required): Name of the pod to debug
- **namespace** (stringoptional) (default: "default"): Namespace of the pod
- **image** (stringoptional) (default: "busybox:latest"): Debug container image (default: busybox)
- **command** (arrayoptional) (default: ["sh"]): Command to run in debug container
  Items: string
- **target** (stringoptional): Target container name (defaults to first container)

### k8s_run

Run a pod imperatively (like kubectl run). Creates and starts a single pod.

**Parameters:**

- **name** (stringoptional): Name for the pod (optional, auto-generated if not provided)
- **image** (string, required): Container image to run
- **namespace** (stringoptional) (default: "default"): Namespace
- **command** (arrayoptional): Command to run in the container
  Items: string
- **args** (arrayoptional): Arguments for the command
  Items: string
- **env** (arrayoptional): Environment variables (KEY=VALUE format)
  Items: string
- **labels** (objectoptional): Labels to apply to the pod
- **port** (numberoptional): Container port to expose
- **restartPolicy** (stringoptional) (default: "Always") [enum: Always, OnFailure, Never]: Restart policy
- **serviceAccount** (stringoptional): ServiceAccount to use
- **dryRun** (stringoptional) [enum: client, server]: Dry run mode (client or server)
- **output** (stringoptional) (default: "yaml") [enum: json, yaml]: Output format for dry-run
- **tty** (booleanoptional) (default: false): Allocate TTY for interactive use
- **stdin** (booleanoptional) (default: false): Keep stdin open

### k8s_attach

Attach to a running container (like kubectl attach). View output or interact with a running container.

**Parameters:**

- **name** (string, required): Pod name
- **namespace** (stringoptional) (default: "default"): Namespace
- **container** (stringoptional): Container name (defaults to first container)
- **stdin** (booleanoptional) (default: false): Pass stdin to the container
- **tty** (booleanoptional) (default: false): Allocate a TTY for the container

### k8s_debug_node

Debug a node by creating a debug pod on it (like kubectl debug node). Creates a privileged pod on the target node for debugging.

**Parameters:**

- **node** (string, required): Node name to debug
- **image** (stringoptional) (default: "busybox:latest"): Debug container image
- **namespace** (stringoptional) (default: "default"): Namespace for debug pod
- **command** (arrayoptional) (default: ["sh"]): Command to run
  Items: string

## Security Tools

RBAC, secrets, and security-related operations

**Total Tools:** 31

### k8s_list_serviceaccounts

List all ServiceAccounts

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_list_roles

List all Roles

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_list_clusterroles

List all ClusterRoles

**Parameters:** None

### k8s_list_rolebindings

List all RoleBindings

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_list_clusterrolebindings

List all ClusterRoleBindings

**Parameters:** None

### k8s_list_secrets

List all Secrets (values are masked)

**Parameters:**

- **namespace** (stringoptional): Namespace to filter
- **type** (stringoptional): Filter by secret type (e.g., kubernetes.io/tls, Opaque)

### k8s_list_configmaps

List all ConfigMaps

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_secret

Get detailed information about a Secret (values are masked)

**Parameters:**

- **name** (string, required): Name of the Secret
- **namespace** (stringoptional) (default: "default"): Namespace of the Secret
- **decode** (booleanoptional) (default: false): Decode base64 values (use with caution)

### k8s_get_serviceaccount

Get detailed information about a ServiceAccount

**Parameters:**

- **name** (string, required): Name of the ServiceAccount
- **namespace** (stringoptional) (default: "default"): Namespace of the ServiceAccount

### k8s_get_role

Get detailed information about a Role

**Parameters:**

- **name** (string, required): Name of the Role
- **namespace** (stringoptional) (default: "default"): Namespace of the Role

### k8s_get_clusterrole

Get detailed information about a ClusterRole

**Parameters:**

- **name** (string, required): Name of the ClusterRole

### k8s_get_rolebinding

Get detailed information about a RoleBinding

**Parameters:**

- **name** (string, required): Name of the RoleBinding
- **namespace** (stringoptional) (default: "default"): Namespace of the RoleBinding

### k8s_get_clusterrolebinding

Get detailed information about a ClusterRoleBinding

**Parameters:**

- **name** (string, required): Name of the ClusterRoleBinding

### k8s_get_configmap

Get detailed ConfigMap data

**Parameters:**

- **name** (string, required): Name of the ConfigMap
- **namespace** (stringoptional) (default: "default"): Namespace of the ConfigMap
- **scrub** (booleanoptional) (default: false): Mask potential secrets in ConfigMap data

### k8s_get_rbac_summary

Get RBAC summary for a user or service account

**Parameters:**

- **kind** (string, required) [enum: User, Group, ServiceAccount]: Type of subject (User, Group, ServiceAccount)
- **name** (string, required): Name of the subject
- **namespace** (stringoptional): Namespace (for ServiceAccount)

### k8s_check_privileged_pods

Find pods running with privileged security contexts

**Parameters:**

- **namespace** (stringoptional): Namespace to check

### k8s_delete_serviceaccount

Delete a ServiceAccount

**Parameters:**

- **name** (string, required): Name of the ServiceAccount to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the ServiceAccount
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_delete_role

Delete a Role

**Parameters:**

- **name** (string, required): Name of the Role to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the Role
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_delete_clusterrole

Delete a ClusterRole

**Parameters:**

- **name** (string, required): Name of the ClusterRole to delete
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_delete_rolebinding

Delete a RoleBinding

**Parameters:**

- **name** (string, required): Name of the RoleBinding to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the RoleBinding
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_delete_clusterrolebinding

Delete a ClusterRoleBinding

**Parameters:**

- **name** (string, required): Name of the ClusterRoleBinding to delete
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_create_serviceaccount

Create a Kubernetes ServiceAccount

**Parameters:**

- **name** (string, required): Name of the ServiceAccount
- **namespace** (stringoptional) (default: "default"): Namespace for the ServiceAccount
- **automountToken** (booleanoptional) (default: true): Allow automounting service account token
- **labels** (objectoptional): Labels to apply
- **annotations** (objectoptional): Annotations to apply

### k8s_create_role

Create a Kubernetes Role (namespaced permissions)

**Parameters:**

- **name** (string, required): Name of the Role
- **namespace** (stringoptional) (default: "default"): Namespace for the Role
- **rules** (array, required): Policy rules defining permissions
  Items:
    - **apiGroups** (arrayoptional) (default: [""]): 
      Items: string
    - **resources** (arrayoptional): 
      Items: string
    - **verbs** (arrayoptional): 
      Items: string
    - **resourceNames** (arrayoptional): 
      Items: string
- **labels** (objectoptional): Labels to apply
- **annotations** (objectoptional): Annotations to apply

### k8s_create_rolebinding

Create a Kubernetes RoleBinding (binds Role to users/groups/serviceaccounts)

**Parameters:**

- **name** (string, required): Name of the RoleBinding
- **namespace** (stringoptional) (default: "default"): Namespace for the RoleBinding
- **roleName** (string, required): Name of the Role to bind
- **roleKind** (stringoptional) (default: "Role") [enum: Role, ClusterRole]: Kind of the role (Role or ClusterRole)
- **subjects** (array, required): Subjects to bind (users, groups, or serviceaccounts)
  Items:
    - **kind** (stringoptional) [enum: User, Group, ServiceAccount]: 
    - **name** (stringoptional): 
    - **namespace** (stringoptional): 
    - **apiGroup** (stringoptional): 
- **labels** (objectoptional): Labels to apply

### k8s_create_clusterrole

Create a Kubernetes ClusterRole (cluster-wide permissions)

**Parameters:**

- **name** (string, required): Name of the ClusterRole
- **rules** (array, required): Policy rules defining permissions
  Items:
    - **apiGroups** (arrayoptional) (default: [""]): 
      Items: string
    - **resources** (arrayoptional): 
      Items: string
    - **verbs** (arrayoptional): 
      Items: string
    - **resourceNames** (arrayoptional): 
      Items: string
    - **nonResourceURLs** (arrayoptional): 
      Items: string
- **labels** (objectoptional): Labels to apply
- **annotations** (objectoptional): Annotations to apply
- **aggregationRule** (objectoptional): Aggregation rule for combining cluster roles

### k8s_create_clusterrolebinding

Create a Kubernetes ClusterRoleBinding (binds ClusterRole to users/groups/serviceaccounts cluster-wide)

**Parameters:**

- **name** (string, required): Name of the ClusterRoleBinding
- **clusterRoleName** (string, required): Name of the ClusterRole to bind
- **subjects** (array, required): Subjects to bind (users, groups, or serviceaccounts)
  Items:
    - **kind** (stringoptional) [enum: User, Group, ServiceAccount]: 
    - **name** (stringoptional): 
    - **namespace** (stringoptional): 
    - **apiGroup** (stringoptional): 
- **labels** (objectoptional): Labels to apply

### k8s_auth_can_i

Check if you can perform an action (like kubectl auth can-i)

**Parameters:**

- **verb** (string, required): Verb to check (create, get, list, delete, update, patch, watch, etc.)
- **resource** (string, required): Resource type (pods, deployments, services, etc.)
- **namespace** (stringoptional): Namespace to check in (default: all namespaces for cluster-scoped, or 'default')
- **subresource** (stringoptional): Subresource to check (e.g., 'log', 'exec', 'status')
- **resourceName** (stringoptional): Specific resource name to check
- **asUser** (stringoptional): Check permissions as a different user (requires impersonation rights)
- **asServiceAccount** (stringoptional): Check permissions as a service account (format: namespace/name)

### k8s_list_csr

List Certificate Signing Requests (CSR)

**Parameters:** None

### k8s_certificate_approve

Approve a Certificate Signing Request (like kubectl certificate approve)

**Parameters:**

- **name** (string, required): Name of the CSR to approve
- **force** (booleanoptional) (default: false): Force approval even if already approved

### k8s_certificate_deny

Deny a Certificate Signing Request (like kubectl certificate deny)

**Parameters:**

- **name** (string, required): Name of the CSR to deny
- **force** (booleanoptional) (default: false): Force denial even if already denied

### k8s_auth_reconcile

Reconciles rules for RBAC Role, ClusterRole, RoleBinding, and ClusterRoleBinding (like kubectl auth reconcile)

**Parameters:**

- **manifest** (string, required): YAML/JSON manifest containing RBAC resources to reconcile
- **removeExtraSubjects** (booleanoptional) (default: false): Remove extra subjects from bindings
- **removeExtraPermissions** (booleanoptional) (default: false): Remove extra permissions from roles
- **dryRun** (booleanoptional) (default: false): Show what would be changed without making changes

## Storage Tools

Persistent volumes, claims, and storage operations

**Total Tools:** 11

### k8s_list_pvs

List all PersistentVolumes

**Parameters:** None

### k8s_list_pvcs

List all PersistentVolumeClaims

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_list_storageclasses

List all StorageClasses

**Parameters:** None

### k8s_get_pv

Get detailed information about a PersistentVolume

**Parameters:**

- **name** (string, required): Name of the PersistentVolume

### k8s_get_storageclass

Get detailed information about a StorageClass

**Parameters:**

- **name** (string, required): Name of the StorageClass

### k8s_get_pvc_details

Get detailed information about a PVC including events

**Parameters:**

- **name** (string, required): Name of the PVC
- **namespace** (stringoptional) (default: "default"): Namespace of the PVC

### k8s_find_unbound_pvcs

Find PVCs that are not bound to a PV

**Parameters:**

- **namespace** (stringoptional): Namespace to check (optional, all if not specified)

### k8s_storage_summary

Get cluster-wide storage summary

**Parameters:** None

### k8s_delete_pvc

Delete a PersistentVolumeClaim

**Parameters:**

- **name** (string, required): Name of the PVC to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the PVC
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_create_pvc

Create a PersistentVolumeClaim (like kubectl create pvc or apply -f pvc.yaml)

**Parameters:**

- **name** (string, required): Name of the PVC
- **namespace** (stringoptional) (default: "default"): Namespace for the PVC
- **storageClass** (stringoptional): StorageClass name (omit for default)
- **size** (string, required): Storage size (e.g., '10Gi', '500Mi')
- **accessModes** (arrayoptional) (default: ["ReadWriteOnce"]): Access modes
  Items: string
- **volumeName** (stringoptional): Specific PV to bind to (optional, for pre-bound PVCs)
- **volumeMode** (stringoptional) (default: "Filesystem") [enum: Filesystem, Block]: Volume mode (Filesystem or Block)
- **labels** (objectoptional): Labels to add to the PVC
- **annotations** (objectoptional): Annotations to add to the PVC

### k8s_create_pv

Create a PersistentVolume (cluster admin operation, like kubectl create pv or apply -f pv.yaml)

**Parameters:**

- **name** (string, required): Name of the PV
- **capacity** (string, required): Storage capacity (e.g., '10Gi', '500Mi')
- **accessModes** (arrayoptional) (default: ["ReadWriteOnce"]): Access modes
  Items: string
- **storageClass** (stringoptional): StorageClass name
- **volumeMode** (stringoptional) (default: "Filesystem") [enum: Filesystem, Block]: Volume mode (Filesystem or Block)
- **reclaimPolicy** (stringoptional) (default: "Retain") [enum: Retain, Recycle, Delete]: Reclaim policy
- **path** (stringoptional): Host path (for hostPath volumes)
- **nfsServer** (stringoptional): NFS server (for NFS volumes)
- **nfsPath** (stringoptional): NFS path (for NFS volumes)
- **csiDriver** (stringoptional): CSI driver name (for CSI volumes)
- **csiVolumeHandle** (stringoptional): CSI volume handle (for CSI volumes)
- **nodeAffinity** (objectoptional): Node affinity for local volumes

## Templates Tools

Deployment templates and quick deployment utilities

**Total Tools:** 2

### k8s_get_deployment_templates

Get common deployment templates for quick deployment

**Parameters:**

- **category** (stringoptional) [enum: web, api, database, worker]: Template category (web, api, database, worker)

### k8s_quick_deploy

Quick deploy using template with custom parameters

**Parameters:**

- **template** (string, required): Template name (web, api, database, worker)
- **name** (string, required): Custom deployment name
- **image** (string, required): Custom container image
- **replicas** (numberoptional) (default: 1): Number of replicas
- **namespace** (stringoptional) (default: "default"): Target namespace
- **resources** (objectoptional): Resource requests and limits
  - **memory** (stringoptional): 
  - **cpu** (stringoptional): 

## WebSocket Tools

Real-time streaming, exec, and port forwarding

**Total Tools:** 5

### k8s_exec_pod

Execute command in a pod, or first pod of a deployment/service. Supports format like 'deploy/my-deployment' or 'svc/my-service'. Can execute directly (returns output) or return WebSocket URL for interactive sessions.

**Parameters:**

- **resource** (string, required): Pod name, or deployment (deploy/name), or service (svc/name). Use format like 'deploy/my-deployment' or 'svc/my-service'
- **namespace** (string, required) (default: "default"): Namespace
- **container** (stringoptional): Container name (for multi-container pods)
- **command** (arrayoptional) (default: ["/bin/sh"]): Command to execute
  Items: string
- **tty** (booleanoptional) (default: false): Allocate TTY (like kubectl exec -t)
- **stdin** (booleanoptional) (default: false): Pass stdin to container (like kubectl exec -i)
- **mode** (stringoptional) (default: "direct") [enum: direct, websocket]: Execution mode: 'direct' executes command and returns output, 'websocket' returns WebSocket URL for interactive session
- **scrub** (booleanoptional) (default: false): Mask potential secrets in command output (passwords, tokens, emails, IPs)

### k8s_port_forward

Set up port forwarding to a pod, deployment, or service. Supports format like 'deploy/my-deployment' or 'svc/my-service'. Use mode='direct' for immediate port forwarding.

**Parameters:**

- **resource** (string, required): Pod name, or deployment (deploy/name), or service (svc/name). Use format like 'deploy/my-deployment' or 'svc/my-service'
- **namespace** (stringoptional) (default: "default"): Namespace
- **ports** (array, required): Port mappings (e.g., ['8080:80', '8443:443']). For services, can use port name like '5000:my-service-port'
  Items: string
- **mode** (stringoptional) (default: "direct") [enum: direct, command]: Execution mode: 'direct' for immediate port forwarding, 'command' to return kubectl command string

### k8s_stream_logs

Stream pod logs in real-time (returns stream info)

**Parameters:**

- **pod** (string, required): Pod name
- **namespace** (string, required) (default: "default"): Pod namespace
- **container** (stringoptional): Container name (for multi-container pods)
- **follow** (booleanoptional) (default: true): Follow log stream
- **tailLines** (numberoptional) (default: 100): Number of lines to show from the end

### k8s_attach_pod

Attach to running pod (returns attach info)

**Parameters:**

- **pod** (string, required): Pod name
- **namespace** (string, required) (default: "default"): Pod namespace
- **container** (stringoptional): Container name (for multi-container pods)
- **stdin** (booleanoptional) (default: true): Attach stdin
- **stdout** (booleanoptional) (default: true): Attach stdout
- **stderr** (booleanoptional) (default: true): Attach stderr

### k8s_watch

Watch resources for changes in real-time (like kubectl get --watch). Returns WebSocket URL for streaming events.

**Parameters:**

- **resource** (string, required): Resource type to watch (pod, deployment, service, configmap, secret, etc.)
- **namespace** (stringoptional): Namespace to watch (default: all namespaces for cluster-scoped, default for namespaced)
- **name** (stringoptional): Specific resource name to watch (optional - watches all resources of type if not specified)
- **labelSelector** (stringoptional): Label selector to filter watched resources (e.g., app=nginx)
- **fieldSelector** (stringoptional): Field selector to filter watched resources (e.g., metadata.name=my-pod)

## Workloads Tools

Deployments, StatefulSets, DaemonSets, Jobs, and CronJobs

**Total Tools:** 43

### k8s_list_deployments

List all deployments

**Parameters:**

- **namespace** (stringoptional): Namespace to filter (optional, all if not specified)

### k8s_get_deployment

Get detailed information about a deployment

**Parameters:**

- **name** (string, required): Name of the deployment
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment

### k8s_scale_deployment

Scale a deployment to a specific number of replicas

**Parameters:**

- **name** (string, required): Name of the deployment
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment
- **replicas** (number, required): Number of replicas

### k8s_restart_deployment

Perform a rolling restart of a deployment

**Parameters:**

- **name** (string, required): Name of the deployment
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment

### k8s_rollback_deployment

Rollback a deployment to a previous revision

**Parameters:**

- **name** (string, required): Name of the deployment
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment
- **revision** (numberoptional): Revision to rollback to (optional, rolls back to previous if not specified)

### k8s_list_statefulsets

List all StatefulSets

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_statefulset

Get detailed information about a StatefulSet

**Parameters:**

- **name** (string, required): Name of the StatefulSet
- **namespace** (stringoptional) (default: "default"): Namespace of the StatefulSet

### k8s_delete_statefulset

Delete a StatefulSet

**Parameters:**

- **name** (string, required): Name of the StatefulSet to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the StatefulSet
- **cascade** (booleanoptional) (default: true): Delete pods owned by the StatefulSet

### k8s_list_daemonsets

List all DaemonSets

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_daemonset

Get detailed information about a DaemonSet

**Parameters:**

- **name** (string, required): Name of the DaemonSet
- **namespace** (stringoptional) (default: "default"): Namespace of the DaemonSet

### k8s_delete_daemonset

Delete a DaemonSet

**Parameters:**

- **name** (string, required): Name of the DaemonSet to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the DaemonSet

### k8s_list_replicasets

List all ReplicaSets

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_replicaset

Get detailed information about a ReplicaSet

**Parameters:**

- **name** (string, required): Name of the ReplicaSet
- **namespace** (stringoptional) (default: "default"): Namespace of the ReplicaSet

### k8s_delete_replicaset

Delete a ReplicaSet

**Parameters:**

- **name** (string, required): Name of the ReplicaSet to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the ReplicaSet
- **cascade** (booleanoptional) (default: true): Delete pods owned by the ReplicaSet

### k8s_list_jobs

List all Jobs

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_job

Get detailed information about a Job

**Parameters:**

- **name** (string, required): Name of the Job
- **namespace** (stringoptional) (default: "default"): Namespace of the Job

### k8s_delete_job

Delete a Job

**Parameters:**

- **name** (string, required): Name of the Job to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the Job
- **cascade** (booleanoptional) (default: true): Delete pods owned by the Job

### k8s_trigger_job

Manually trigger a CronJob to create a Job

**Parameters:**

- **name** (string, required): Name of the CronJob
- **namespace** (stringoptional) (default: "default"): Namespace of the CronJob

### k8s_list_cronjobs

List all CronJobs

**Parameters:**

- **namespace** (stringoptional): Namespace to filter

### k8s_get_cronjob

Get detailed information about a CronJob

**Parameters:**

- **name** (string, required): Name of the CronJob
- **namespace** (stringoptional) (default: "default"): Namespace of the CronJob

### k8s_deployment_rollout_status

Check the rollout status of a deployment

**Parameters:**

- **name** (string, required): Name of the deployment
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment

### k8s_rollout_history

View rollout history for a deployment

**Parameters:**

- **name** (string, required): Name of the deployment
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment

### k8s_rollout_undo

Rollback a deployment to a previous revision

**Parameters:**

- **name** (string, required): Name of the deployment
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment
- **revision** (numberoptional): Revision to rollback to (optional, rolls back to previous if not specified)

### k8s_create_deployment

Create a deployment imperatively (like kubectl create deployment)

**Parameters:**

- **name** (string, required): Name of the deployment
- **image** (string, required): Container image
- **namespace** (stringoptional) (default: "default"): Namespace
- **replicas** (numberoptional) (default: 1): Number of replicas
- **port** (numberoptional): Container port to expose
- **env** (arrayoptional): Environment variables (KEY=VALUE format)
  Items: string
- **labels** (objectoptional): Additional labels
- **imagePullSecrets** (arrayoptional): Image pull secrets for private registries (e.g., ACR, ECR, GCR)
  Items: string

### k8s_create_job

Create a job imperatively (like kubectl create job)

**Parameters:**

- **name** (string, required): Name of the job
- **image** (string, required): Container image
- **namespace** (stringoptional) (default: "default"): Namespace
- **command** (arrayoptional) (default: []): Command to run
  Items: string
- **restartPolicy** (stringoptional) (default: "Never") [enum: Never, OnFailure]: Restart policy
- **completions** (numberoptional): Number of successful completions needed
- **parallelism** (numberoptional): Number of pods to run in parallel

### k8s_create_cronjob

Create a cronjob imperatively (like kubectl create cronjob)

**Parameters:**

- **name** (string, required): Name of the cronjob
- **image** (string, required): Container image
- **schedule** (string, required): Cron schedule expression (e.g., */1 * * * *)
- **namespace** (stringoptional) (default: "default"): Namespace
- **command** (arrayoptional) (default: []): Command to run
  Items: string
- **restartPolicy** (stringoptional) (default: "Never") [enum: Never, OnFailure]: Restart policy
- **suspend** (booleanoptional) (default: false): Suspend cronjob scheduling

### k8s_set_image

Update container image in a deployment (like kubectl set image)

**Parameters:**

- **deployment** (string, required): Name of the deployment
- **namespace** (stringoptional) (default: "default"): Namespace
- **container** (stringoptional): Container name (defaults to first container if not specified)
- **image** (string, required): New container image

### k8s_autoscale

Auto-scale a deployment (like kubectl autoscale)

**Parameters:**

- **deployment** (string, required): Name of the deployment to autoscale
- **namespace** (stringoptional) (default: "default"): Namespace
- **min** (number, required) (default: 1): Minimum number of replicas
- **max** (number, required) (default: 10): Maximum number of replicas
- **cpuPercent** (numberoptional) (default: 80): Target CPU utilization percentage

### k8s_label

Add or remove labels on resources (like kubectl label)

**Parameters:**

- **resource** (string, required): Resource type (pod, deployment, node, etc.)
- **name** (string, required): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace (for namespaced resources)
- **labels** (object, required): Labels to add (key-value pairs). Use null value to remove a label.
- **overwrite** (booleanoptional) (default: false): Overwrite existing labels

### k8s_annotate

Add or remove annotations on resources (like kubectl annotate)

**Parameters:**

- **resource** (string, required): Resource type (pod, deployment, service, etc.)
- **name** (string, required): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace (for namespaced resources)
- **annotations** (object, required): Annotations to add (key-value pairs). Use null value to remove an annotation.
- **overwrite** (booleanoptional) (default: false): Overwrite existing annotations

### k8s_scale

Scale deployments, replicasets, statefulsets (like kubectl scale). Supports single resource, multiple resources, or file-based scaling.

**Parameters:**

- **resource** (stringoptional): Resource type (deployment, replicaset, statefulset, rc)
- **name** (stringoptional): Resource name (single resource)
- **names** (arrayoptional): Multiple resource names (e.g., ['foo', 'bar', 'baz'])
  Items: string
- **namespace** (stringoptional) (default: "default"): Namespace
- **replicas** (number, required): Number of replicas
- **currentReplicas** (numberoptional): Current replicas (for conditional scaling - only scales if current matches)
- **manifest** (stringoptional): YAML/JSON manifest content to identify resource (like kubectl scale -f)

### k8s_delete_deployment

Delete a Deployment

**Parameters:**

- **name** (string, required): Name of the Deployment to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the Deployment
- **gracePeriodSeconds** (numberoptional): Grace period for termination
- **force** (booleanoptional) (default: false): Force delete (immediate removal)

### k8s_delete_cronjob

Delete a CronJob

**Parameters:**

- **name** (string, required): Name of the CronJob to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the CronJob
- **gracePeriodSeconds** (numberoptional): Grace period for termination

### k8s_rollout_pause

Pause a deployment rollout (like kubectl rollout pause)

**Parameters:**

- **deployment** (string, required): Name of the deployment to pause
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment

### k8s_rollout_resume

Resume a paused deployment rollout (like kubectl rollout resume)

**Parameters:**

- **deployment** (string, required): Name of the deployment to resume
- **namespace** (stringoptional) (default: "default"): Namespace of the deployment

### k8s_restart_statefulset

Restart a StatefulSet by updating its pod template (like kubectl rollout restart statefulset)

**Parameters:**

- **name** (string, required): Name of the StatefulSet to restart
- **namespace** (stringoptional) (default: "default"): Namespace of the StatefulSet

### k8s_restart_daemonset

Restart a DaemonSet by updating its pod template (like kubectl rollout restart daemonset)

**Parameters:**

- **name** (string, required): Name of the DaemonSet to restart
- **namespace** (stringoptional) (default: "default"): Namespace of the DaemonSet

### k8s_list_hpa

List all HorizontalPodAutoscalers (like kubectl get hpa). Shows autoscalers that automatically adjust pod replicas based on CPU/memory usage or custom metrics.

**Parameters:**

- **namespace** (stringoptional): Namespace to filter (shows all if not specified)

### k8s_get_hpa

Get detailed information about a HorizontalPodAutoscaler (like kubectl describe hpa). Shows current metrics, target resources, and scaling behavior.

**Parameters:**

- **name** (string, required): Name of the HPA
- **namespace** (stringoptional) (default: "default"): Namespace of the HPA

### k8s_delete_hpa

Delete a HorizontalPodAutoscaler (like kubectl delete hpa). The target deployment will no longer scale automatically.

**Parameters:**

- **name** (string, required): Name of the HPA to delete
- **namespace** (stringoptional) (default: "default"): Namespace of the HPA

### k8s_create_pdb

Create a PodDisruptionBudget to ensure high availability (like kubectl create pdb)

**Parameters:**

- **name** (string, required): Name of the PodDisruptionBudget
- **namespace** (stringoptional) (default: "default"): Namespace for the PDB
- **selector** (object, required): Label selector to match pods (e.g., {app: 'nginx'})
- **minAvailable** (string,numberoptional): Minimum number of pods that must be available (can be number or percentage, e.g., '50%')
- **maxUnavailable** (string,numberoptional): Maximum number of pods that can be unavailable (can be number or percentage, e.g., '1')

### k8s_create_statefulset

Create a StatefulSet (like kubectl create statefulset). StatefulSets are used for applications that require stable network identity and persistent storage.

**Parameters:**

- **name** (string, required): Name of the StatefulSet
- **image** (string, required): Container image
- **namespace** (stringoptional) (default: "default"): Namespace
- **replicas** (numberoptional) (default: 1): Number of replicas
- **port** (numberoptional): Container port to expose
- **serviceName** (string, required): Name of the governing service (required for StatefulSet)
- **storageClass** (stringoptional): StorageClass for PVCs (omit for default)
- **storageSize** (stringoptional) (default: "1Gi"): Storage size per replica (e.g., '10Gi', '100Mi')
- **command** (arrayoptional): Command to run in container
  Items: string
- **env** (arrayoptional): Environment variables (KEY=VALUE format)
  Items: string

### k8s_create_daemonset

Create a DaemonSet (like kubectl create daemonset). DaemonSets run a pod on every node (or matching nodes), useful for log collectors, monitoring agents, etc.

**Parameters:**

- **name** (string, required): Name of the DaemonSet
- **image** (string, required): Container image
- **namespace** (stringoptional) (default: "default"): Namespace
- **port** (numberoptional): Container port to expose
- **command** (arrayoptional): Command to run in container
  Items: string
- **env** (arrayoptional): Environment variables (KEY=VALUE format)
  Items: string
- **nodeSelector** (objectoptional): Node selector labels (e.g., {app: 'monitoring'})
- **hostNetwork** (booleanoptional) (default: false): Use host network namespace
- **hostPID** (booleanoptional) (default: false): Use host PID namespace

## Multi-Cluster Tools

Operations across multiple clusters and contexts

**Total Tools:** 3

### k8s_list_kubeconfigs

List available kubeconfig files and their contexts from common locations

**Parameters:**

- **includeDetails** (booleanoptional) (default: true): Include detailed context information (may slow down response for large configs)

### k8s_switch_kubeconfig

Switch to a different kubeconfig file. Sets KUBECONFIG_PATH environment variable and reloads the client configuration.

**Parameters:**

- **path** (string, required): Path to the kubeconfig file to switch to
- **context** (stringoptional): Optional: Specific context to use within the kubeconfig (if not provided, uses current-context)

### k8s_add_kubeconfig

Add a new kubeconfig file path to the search list and optionally validate it

**Parameters:**

- **path** (string, required): Path to the kubeconfig file to add
- **validate** (booleanoptional) (default: true): Validate the kubeconfig file exists and is valid

## SRE Tools

SRE diagnostic, incident triage, blast radius simulation, drift detection, and preventive audit tools

**Total Tools:** 5

### k8s_incident_snapshot

First-minute SRE triage in one call. Returns unhealthy pods grouped by failure mode (CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending, Evicted), recent warning events grouped by reason, active and stuck rollouts, node pressure (Ready/MemoryPressure/DiskPressure/PIDPressure), and control-plane health (failing webhooks and unavailable APIServices). Output includes a severity headline (green/yellow/red). Read-only and safe under all protection modes.

**Parameters:**

- **namespace** (stringoptional): Limit pod, event, and rollout collection to a single namespace. Omit for cluster-wide scope. Control-plane checks always run cluster-wide unless includeControlPlane is false.
- **since** (stringoptional) (default: "15m"): Time window for events and rollout staleness, e.g. '5m', '15m', '1h', '24h'. Defaults to '15m'.
- **includeControlPlane** (booleanoptional): Whether to check failing webhooks and unavailable APIServices. Defaults to true when scope is cluster-wide, false when a namespace is specified.
- **maxEvents** (numberoptional) (default: 20): Maximum number of distinct event reasons to return in topReasons. Defaults to 20.
- **maxPodsPerCategory** (numberoptional) (default: 10): Maximum example pods returned per failure-mode group. Defaults to 10.

### k8s_changes_since

Returns a time-windowed diff of cluster state. Lists resources created, modified, or being deleted within the window across 9 kinds (Deployment, StatefulSet, DaemonSet, ConfigMap, Secret, RoleBinding, ClusterRoleBinding, HorizontalPodAutoscaler, Service), with who-did-what attribution from managedFields. Also includes scaling and configuration events. Use during incident triage to answer 'what changed?'. Read-only and safe under all protection modes.

**Parameters:**

- **since** (stringoptional) (default: "1h"): Time window for changes, e.g. '5m', '15m', '1h', '24h'. Defaults to '1h'.
- **namespace** (stringoptional): Limit to a single namespace. Omit for cluster-wide scope.
- **kinds** (arrayoptional): Filter to specific resource kinds. Omit to scan all 9 supported kinds.
  Items: string
- **maxResults** (numberoptional) (default: 50): Maximum number of resource changes to return. Defaults to 50.
- **includeEvents** (booleanoptional) (default: true): Whether to include relevant cluster events (scaling, image updates, etc.). Defaults to true.

### k8s_blast_radius

Pre-flight simulator for destructive Kubernetes operations. Analyzes the impact of drain/cordon/delete/scale BEFORE executing, returning safe/risky/unsafe verdict with structured reasons (PDB violations, last-replica risks, dependent Services, stateful workload concerns) and machine-readable details. Read-only by design — does NOT execute the action. Safe under all protection modes.

**Parameters:**

- **action** (string, required) [enum: drain, cordon, delete, scale]: The destructive action to simulate. drain/cordon require node; delete/scale require kind+name (and namespace).
- **node** (stringoptional): Node name. Required for drain or cordon.
- **kind** (stringoptional) [enum: Deployment, StatefulSet, DaemonSet, Service]: Resource kind. Required for delete or scale.
- **name** (stringoptional): Resource name. Required for delete or scale.
- **namespace** (stringoptional) (default: "default"): Namespace of the resource. Defaults to 'default' for delete or scale.
- **replicas** (numberoptional): Target replica count. Required for scale.

### k8s_workload_diff

Compares two workloads (same kind, e.g. staging vs prod Deployment) and returns a categorized diff: image tags, replicas, resource requests/limits, env vars, ConfigMap/Secret refs, labels, scheduling, HPA settings, PDB coverage. Returns severity per finding (critical/warning/info) and a verdict (in_sync, drift_detected, comparison_failed). Use to answer 'how is staging different from prod' or 'what changed between blue and green'. Read-only and safe under all protection modes.

**Parameters:**

- **source** (object, required): Source workload (one side of the comparison).
  - **kind** (string, required) [enum: Deployment, StatefulSet, DaemonSet]: 
  - **name** (string, required): 
  - **namespace** (stringoptional) (default: "default"): 
- **target** (object, required): Target workload (the other side of the comparison). Must be the same kind as source.
  - **kind** (string, required) [enum: Deployment, StatefulSet, DaemonSet]: 
  - **name** (string, required): 
  - **namespace** (stringoptional) (default: "default"): 
- **includeHpa** (booleanoptional) (default: true): Include HorizontalPodAutoscaler comparison. Defaults to true.
- **includePdb** (booleanoptional) (default: true): Include PodDisruptionBudget coverage comparison. Defaults to true.
- **ignoreLabels** (arrayoptional): Label keys to ignore in the comparison (e.g. 'env', 'tier'). Useful when intentional differences would otherwise be reported as drift.
  Items: string
- **ignoreAnnotations** (arrayoptional): Annotation keys to ignore in the comparison.
  Items: string
- **ignoreEnvVars** (arrayoptional): Environment variable names to ignore in the comparison.
  Items: string

### k8s_silent_killers

Scheduled audit of slow-burning cluster issues: expiring TLS certs (Secrets, webhook caBundles, APIService caBundles), broken webhooks (failurePolicy=Fail with missing/empty backing service), stale APIServices, stuck finalizers, and orphaned bound PVCs. Returns prioritized findings with severity. Designed for periodic (cron) execution. Read-only and safe under all protection modes.

**Parameters:**

- **certExpiryDays** (numberoptional) (default: 30): Days threshold for cert expiry warnings. Defaults to 30.
- **stuckThresholdHours** (numberoptional) (default: 24): Hours threshold for stuck finalizers and stale APIServices. Defaults to 24.
- **orphanPvcDays** (numberoptional) (default: 30): Days threshold for orphan bound PVCs (no consumer pods). Defaults to 30.
- **includePvcAudit** (booleanoptional) (default: true): Whether to scan PVCs (slow on clusters with thousands of PVCs). Defaults to true.
- **includeFinalizerAudit** (booleanoptional) (default: true): Whether to scan namespaces and pods for stuck finalizers. Defaults to true.
- **maxPerSection** (numberoptional) (default: 100): Maximum findings returned per check. Defaults to 100.

## Advanced Tools

Advanced operations including batch processing and resource comparison

**Total Tools:** 23

### k8s_cache_stats

Get cache statistics including hit rate, miss rate, and total requests. Provides visibility into cache effectiveness.

**Parameters:** None

### k8s_cache_clear

Clear all cached entries and reset statistics. Use this to force fresh data retrieval.

**Parameters:** None

### k8s_batch_get_resources

Get multiple Kubernetes resources in parallel for improved performance. Supports Pod, Deployment, Service, ConfigMap, Secret, Node, Namespace, StatefulSet, DaemonSet, Job, CronJob, Ingress, PVC, PV, StorageClass, ServiceAccount, Role, ClusterRole, RoleBinding, ClusterRoleBinding.

**Parameters:**

- **resources** (array, required): Array of resources to fetch
  Items:
    - **kind** (string, required): Resource kind (e.g., Pod, Deployment, Service)
    - **name** (string, required): Resource name
    - **namespace** (stringoptional): Resource namespace (defaults to 'default' for namespaced resources)

### k8s_kubectl

Execute arbitrary kubectl command (fallback for unsupported operations). Use with caution - this is a generic tool for commands not covered by specific tools.

**Parameters:**

- **command** (string, required): kubectl command to execute (without 'kubectl' prefix, e.g., 'get pods -o wide')
- **namespace** (stringoptional): Namespace to use (optional, defaults to current context)
- **context** (stringoptional): Kubeconfig context to use (optional)
- **scrub** (booleanoptional) (default: false): Mask potential secrets in output (passwords, tokens, emails, IPs)

### k8s_raw_api_query

Execute a raw API query against the Kubernetes API server

**Parameters:**

- **path** (string, required): API path (e.g., /api/v1/nodes, /apis/apps/v1/deployments)

### k8s_analyze_pod_failure

AI-style diagnosis of why a pod is failing

**Parameters:**

- **name** (string, required): Name of the pod
- **namespace** (stringoptional) (default: "default"): Namespace of the pod

### k8s_suggest_optimizations

Analyze resources and suggest optimizations

**Parameters:**

- **namespace** (stringoptional): Namespace to analyze

### k8s_bulk_delete_pods

Delete multiple pods matching criteria

**Parameters:**

- **namespace** (string, required): Namespace (required)
- **labelSelector** (stringoptional): Label selector to match pods
- **status** (stringoptional): Filter by pod status (e.g., Failed, Evicted)
- **dryRun** (booleanoptional) (default: false): Show what would be deleted without actually deleting

### k8s_find_orphaned_resources

Find resources that may be orphaned or unused

**Parameters:**

- **namespace** (stringoptional): Namespace to analyze

### k8s_explain

Show resource documentation and schema (like kubectl explain)

**Parameters:**

- **resource** (string, required): Resource type (e.g., pod, deployment, service)
- **field** (stringoptional): Specific field path (e.g., spec.containers)

### k8s_api_resources

List available API resources (like kubectl api-resources). Supports filtering by namespaced, verbs, API group, and output formats.

**Parameters:**

- **namespaced** (booleanoptional): Filter to namespaced or cluster-scoped resources
- **verbs** (arrayoptional): Filter by supported verbs (e.g., list, get)
  Items: string
- **apiGroup** (stringoptional): Filter by API group (e.g., 'apps', 'extensions', 'rbac.authorization.k8s.io')
- **output** (stringoptional) (default: "standard") [enum: standard, name, wide]: Output format

### k8s_get_sorted

Get resources sorted by a specific field (like kubectl get --sort-by)

**Parameters:**

- **resource** (string, required): Resource type (pods, services, nodes, etc.)
- **namespace** (stringoptional): Namespace (for namespaced resources)
- **sortBy** (string, required): Field to sort by (e.g., .metadata.name, .status.phase, .metadata.creationTimestamp)
- **descending** (booleanoptional) (default: false): Sort in descending order

### k8s_get_jsonpath

Extract data using JSONPath expression (like kubectl -o jsonpath)

**Parameters:**

- **resource** (string, required): Resource type
- **name** (stringoptional): Resource name (optional, gets all if not specified)
- **namespace** (stringoptional) (default: "default"): Namespace
- **jsonpath** (string, required): JSONPath expression (e.g., {.metadata.name}, {.items[*].metadata.name})

### k8s_get_custom_columns

Get resources with custom column output (like kubectl -o custom-columns)

**Parameters:**

- **resource** (string, required): Resource type (pods, nodes, services, etc.)
- **namespace** (stringoptional): Namespace (for namespaced resources)
- **columns** (array, required): Custom columns (format: NAME:JSONPATH, e.g., NAME:.metadata.name, STATUS:.status.phase)
  Items: string

### k8s_get_with_labels

Get resources with their labels displayed (like kubectl get --show-labels)

**Parameters:**

- **resource** (string, required): Resource type (pods, nodes, services, etc.)
- **namespace** (stringoptional): Namespace
- **selector** (stringoptional): Label selector (e.g., app=nginx, env=prod)

### k8s_patch

Patch a resource with JSON or merge patch (like kubectl patch)

**Parameters:**

- **resource** (string, required): Resource type (pod, deployment, node, service, etc.)
- **name** (string, required): Resource name
- **namespace** (stringoptional) (default: "default"): Namespace (for namespaced resources)
- **patch** (string, required): JSON patch content (object or JSON string)
- **patchType** (stringoptional) (default: "strategic") [enum: strategic, merge, json]: Patch type
- **subresource** (stringoptional): Subresource to patch (e.g., 'scale', 'status')

### k8s_delete

Delete resources with selectors and options (like kubectl delete). Supports single/multiple resources, file-based deletion, label selectors, and force deletion.

**Parameters:**

- **resource** (stringoptional): Resource type (pod, deployment, service, etc.) or comma-separated list (pod,service)
- **name** (stringoptional): Specific resource name to delete
- **names** (arrayoptional): Multiple resource names to delete
  Items: string
- **namespace** (stringoptional) (default: "default"): Namespace
- **allNamespaces** (booleanoptional) (default: false): Delete from all namespaces
- **labelSelector** (stringoptional): Label selector (e.g., app=nginx, env=prod)
- **fieldSelector** (stringoptional): Field selector (e.g., status.phase=Failed)
- **gracePeriodSeconds** (numberoptional): Grace period for pod termination (default: 30, 0 for immediate)
- **now** (booleanoptional) (default: false): Force deletion with grace period 0 (like --now flag)
- **force** (booleanoptional) (default: false): Force deletion (ignore grace period)
- **all** (booleanoptional) (default: false): Delete all resources of specified type(s) in namespace
- **cascade** (stringoptional) (default: "background") [enum: background, orphan, foreground]: Cascade deletion policy
- **manifest** (stringoptional): YAML/JSON manifest content to identify resources to delete (like kubectl delete -f)
- **dryRun** (booleanoptional) (default: false): Dry run mode - show what would be deleted
- **wait** (booleanoptional) (default: false): Wait for resource deletion to complete

### k8s_get_go_template

Get resources using Go template syntax (like kubectl -o go-template). Supports Go template expressions for formatting output.

**Parameters:**

- **resource** (string, required): Resource type (pods, nodes, services, deployments, etc.)
- **name** (stringoptional): Resource name (optional, gets all if not specified)
- **namespace** (stringoptional) (default: "default"): Namespace (for namespaced resources)
- **template** (string, required): Go template string (e.g., {{range .items}}{{ .metadata.name }}{{end}})

### k8s_list_crd

List Custom Resource Definitions (CRDs) in the cluster

**Parameters:** None

### k8s_get_custom_resource

Get a specific custom resource by its API group, version, kind, namespace and name

**Parameters:**

- **group** (string, required): API group of the custom resource (e.g., monitoring.coreos.com)
- **version** (string, required): API version (e.g., v1)
- **plural** (string, required): Plural name of the resource (e.g., servicemonitors, prometheusrules)
- **namespace** (string, required): Namespace of the resource
- **name** (string, required): Name of the resource

### k8s_list_custom_resources

List custom resources by their API group, version, and plural name

**Parameters:**

- **group** (string, required): API group of the custom resource (e.g., monitoring.coreos.com)
- **version** (string, required): API version (e.g., v1)
- **plural** (string, required): Plural name of the resource (e.g., servicemonitors, prometheusrules)
- **namespace** (stringoptional): Namespace (omit for cluster-scoped resources)

### k8s_wait

Wait for a specific condition on a resource (like kubectl wait)

**Parameters:**

- **resource** (string, required): Resource type (pod, deployment, job, etc.)
- **name** (stringoptional): Name of the resource
- **namespace** (stringoptional) (default: "default"): Namespace of the resource
- **for** (string, required): Condition to wait for (e.g., 'condition=Ready', 'delete', 'jsonpath=...')
- **timeout** (numberoptional) (default: 300): Timeout in seconds
- **labelSelector** (stringoptional): Label selector to wait for multiple resources

### k8s_proxy

Start a proxy server to the Kubernetes API (like kubectl proxy)

**Parameters:**

- **port** (numberoptional) (default: 8001): Local port to listen on
- **address** (stringoptional) (default: "127.0.0.1"): IP address to listen on
- **apiPrefix** (stringoptional) (default: "/"): API prefix path
- **staticDir** (stringoptional): Directory to serve static files from
- **disableFilter** (booleanoptional) (default: false): Disable request filtering

## Server Management

Internal MCP server status, metrics, lifecycle management, and protection mode controls

**Total Tools:** 8

### k8s_server_info

Get comprehensive MCP server information and status

**Parameters:**

- **includeMetrics** (booleanoptional) (default: false): Include detailed tool metrics

### k8s_server_health

Comprehensive health check with diagnostics

**Parameters:**

- **deep** (booleanoptional) (default: false): Perform deep health check including cluster connectivity
- **timeout** (numberoptional) (default: 10): Health check timeout in seconds

### k8s_server_metrics

Get detailed tool usage metrics

**Parameters:**

- **tool** (stringoptional): Specific tool name (optional, shows all if not specified)
- **sortBy** (stringoptional) (default: "calls") [enum: calls, errors, avgResponseTime]: Sort metrics by field

### k8s_server_stop

Shut down the MCP server gracefully

**Parameters:**

- **confirm** (boolean, required) (default: false): Confirmation flag to prevent accidental shutdown

### k8s_toggle_protection_mode

Toggle infrastructure protection mode on/off. When enabled, blocks destructive operations like delete, drain, cordon, and rollback.

**Parameters:**

- **enabled** (boolean, required): Enable (true) or disable (false) infrastructure protection mode

### k8s_toggle_strict_protection_mode

Toggle strict protection mode on/off. When enabled, only read-only operations are allowed (list, get, describe, logs).

**Parameters:**

- **enabled** (boolean, required): Enable (true) or disable (false) strict protection mode

### k8s_toggle_no_delete_mode

Toggle no-delete protection mode on/off. When enabled, blocks all deletion operations while allowing other modifications.

**Parameters:**

- **enabled** (boolean, required): Enable (true) or disable (false) no-delete protection mode

### k8s_toggle_all_protection_modes

Toggle all protection modes on/off at once. Convenience tool to enable or disable infrastructure, strict, and no-delete protection simultaneously.

**Parameters:**

- **enabled** (boolean, required): Enable (true) or disable (false) all protection modes

## Helm Chart Management

Helm chart creation, packaging, linting, and verification

**Total Tools:** 5

### k8s_helm_create

Create a new Helm chart directory with common files and directories

**Parameters:**

- **name** (string, required): Name of the chart to create
- **starter** (stringoptional): The name or absolute path to the Helm chart starter scaffold

### k8s_helm_package

Package a Helm chart into a versioned chart archive file

**Parameters:**

- **chartPath** (string, required): Path to the chart directory
- **destination** (stringoptional): Location to write the chart package (default: current directory)
- **sign** (booleanoptional) (default: false): Use a PGP private key to sign the package
- **key** (stringoptional): Name of the key to use for signing
- **keyring** (stringoptional): Location of a public keyring for signing (default: ~/.gnupg/pubring.gpg)
- **passphraseFile** (stringoptional): Location of a file containing passphrase for signing key
- **appVersion** (stringoptional): Set the appVersion on the chart to this version
- **version** (stringoptional): Set the version on the chart to this semver version
- **dependencyUpdate** (booleanoptional) (default: false): Update dependencies from Chart.yaml to dir charts/ before packaging
- **caFile** (stringoptional): Verify certificates of HTTPS-enabled servers using this CA bundle
- **certFile** (stringoptional): Identify HTTPS client using this SSL certificate file
- **insecureSkipTlsVerify** (booleanoptional) (default: false): Skip TLS certificate checks for the chart download
- **keyFile** (stringoptional): Identify HTTPS client using this SSL key file
- **password** (stringoptional): Chart repository password where to locate the requested chart
- **plainHttp** (booleanoptional) (default: false): Use insecure HTTP connections for the chart download
- **username** (stringoptional): Chart repository username where to locate the requested chart

### k8s_helm_lint

Run tests to examine a Helm chart and identify possible issues

**Parameters:**

- **chart** (string, required): Chart path or reference to lint
- **strict** (booleanoptional) (default: false): Fail on lint warnings
- **quiet** (booleanoptional) (default: false): Print only warnings and errors
- **kubeVersion** (stringoptional): Kubernetes version used for capabilities and deprecation checks
- **set** (arrayoptional): Set values on the command line (key=value format)
  Items: string
- **setFile** (arrayoptional): Set values from files (key=filepath format)
  Items: string
- **setJson** (arrayoptional): Set JSON values on the command line (key=jsonvalue format)
  Items: string
- **setLiteral** (arrayoptional): Set literal STRING values on the command line
  Items: string
- **setString** (arrayoptional): Set STRING values on the command line (key=value format)
  Items: string
- **skipSchemaValidation** (booleanoptional) (default: false): Disable JSON schema validation
- **values** (stringoptional): Path to values.yaml file or URL
- **withSubcharts** (booleanoptional) (default: false): Lint dependent charts too

### k8s_helm_pull

Download/pull a Helm chart from a repository

**Parameters:**

- **chart** (string, required): Chart reference (e.g., 'bitnami/nginx')
- **version** (stringoptional): Chart version to download (default: latest)
- **untar** (booleanoptional) (default: false): Untar the chart after downloading
- **destination** (stringoptional): Location to write the chart (default: ~/helm-charts or system temp)
- **verify** (booleanoptional) (default: false): Verify the package before using it
- **devel** (booleanoptional) (default: false): Use development versions (equivalent to version '>0.0.0-0')
- **prov** (booleanoptional) (default: false): Fetch the provenance file, but don't perform verification
- **untardir** (stringoptional): Directory name into which the chart is expanded (if untar is specified)
- **repo** (stringoptional): Chart repository URL where to locate the requested chart
- **username** (stringoptional): Chart repository username
- **password** (stringoptional): Chart repository password
- **caFile** (stringoptional): Verify certificates of HTTPS-enabled servers using this CA bundle
- **certFile** (stringoptional): Identify HTTPS client using this SSL certificate file
- **keyFile** (stringoptional): Identify HTTPS client using this SSL key file
- **keyring** (stringoptional): Location of public keys used for verification
- **insecureSkipTlsVerify** (booleanoptional) (default: false): Skip TLS certificate checks for the chart download
- **passCredentials** (booleanoptional) (default: false): Pass credentials to all domains
- **plainHttp** (booleanoptional) (default: false): Use insecure HTTP connections for the chart download

### k8s_helm_verify

Verify that a chart has been signed and is valid

**Parameters:**

- **chartPath** (string, required): Path to the chart package (.tgz)
- **keyring** (stringoptional): Path to public keys used for verification

## Helm Chart Template

Helm chart template rendering

**Total Tools:** 1

### k8s_helm_template

Locally render templates for a Helm chart without installing

**Parameters:**

- **chart** (string, required): Chart reference (repo/chart, path, or URL)
- **release** (stringoptional): Release name for template rendering
- **namespace** (stringoptional) (default: "default"): Namespace for template rendering
- **version** (stringoptional): Chart version
- **values** (stringoptional): Path to values.yaml file
- **set** (arrayoptional): Set values (key=value)
  Items: string
- **includeCRDs** (booleanoptional) (default: false): Include CRDs in the templated output
- **skipTests** (booleanoptional) (default: false): Skip tests from templated output
- **validate** (booleanoptional) (default: false): Validate your manifests against the Kubernetes cluster
- **noHooks** (booleanoptional) (default: false): Prevent hooks from running during template rendering
- **kubeVersion** (stringoptional): Kubernetes version used for capabilities and deprecation checks
- **apiVersions** (arrayoptional): Kubernetes API versions used for capabilities check
  Items: string
- **skipSchemaValidation** (booleanoptional) (default: false): Skip JSON schema validation
- **description** (stringoptional): Add a custom description for the release
- **createNamespace** (booleanoptional) (default: false): Create the release namespace if not present
- **dependencyUpdate** (booleanoptional) (default: false): Update dependencies if they are missing before rendering
- **devel** (booleanoptional) (default: false): Use development versions too
- **disableOpenapiValidation** (booleanoptional) (default: false): Don't validate rendered templates against Kubernetes OpenAPI Schema
- **isUpgrade** (booleanoptional) (default: false): Set .Release.IsUpgrade instead of .Release.IsInstall
- **labels** (stringoptional): Labels added to release metadata (comma-separated key=value)
- **outputDir** (stringoptional): Write templates to files in this directory instead of stdout
- **repo** (stringoptional): Chart repository URL where to locate the requested chart
- **setFile** (arrayoptional): Set values from files (key=filepath)
  Items: string
- **setJson** (arrayoptional): Set JSON values on command line (key=jsonvalue)
  Items: string
- **setLiteral** (arrayoptional): Set literal STRING values on command line
  Items: string
- **setString** (arrayoptional): Set STRING values on command line (key=value)
  Items: string
- **showOnly** (arrayoptional): Only show manifests rendered from the given template files
  Items: string
- **skipCRDs** (booleanoptional) (default: false): Skip CRD installation
- **username** (stringoptional): Chart repository username
- **password** (stringoptional): Chart repository password
- **keyring** (stringoptional): Location of public keys for verification (default: ~/.gnupg/pubring.gpg)
- **verify** (booleanoptional) (default: false): Verify the package before using it
- **scrub** (booleanoptional) (default: false): Mask potential secrets in rendered templates (passwords, tokens, emails, IPs)

## Helm Dependency Management

Helm chart dependency operations

**Total Tools:** 1

### k8s_helm_dependency

Manage Helm chart dependencies (list, update, build)

**Parameters:**

- **command** (string, required) [enum: list, update, build]: Dependency command
- **chart** (string, required): Path to the chart

## Helm Environment

Helm environment and version information

**Total Tools:** 2

### k8s_helm_env

Display Helm environment information

**Parameters:** None

### k8s_helm_version

Display Helm version information

**Parameters:**

- **short** (booleanoptional) (default: false): Print short version
- **template** (stringoptional): Template to format output (e.g., 'Version: {{.Version}}')

## Helm Plugin Management

Helm plugin installation and management

**Total Tools:** 6

### k8s_helm_plugin_list

List installed Helm plugins

**Parameters:**

- **type** (stringoptional): Plugin type filter (e.g., 'helm' or 'oci')

### k8s_helm_plugin_install

Install a Helm plugin

**Parameters:**

- **path** (string, required): Path or URL to the plugin
- **version** (stringoptional): Specific version to install
- **verify** (booleanoptional) (default: true): Verify the plugin signature before installing
- **keyring** (stringoptional): Location of public keys for verification (default: ~/.gnupg/pubring.gpg)
- **username** (stringoptional): Registry username for plugin download
- **password** (stringoptional): Registry password for plugin download
- **insecureSkipTlsVerify** (booleanoptional) (default: false): Skip TLS certificate checks for plugin download
- **plainHttp** (booleanoptional) (default: false): Use insecure HTTP connections for the plugin download
- **caFile** (stringoptional): Verify certificates of HTTPS-enabled servers using this CA bundle
- **certFile** (stringoptional): Identify registry client using this SSL certificate file
- **keyFile** (stringoptional): Identify registry client using this SSL key file

### k8s_helm_plugin_uninstall

Uninstall one or more Helm plugins

**Parameters:**

- **names** (array, required): Plugin names to uninstall
  Items: string

### k8s_helm_plugin_update

Update Helm plugins

**Parameters:**

- **name** (stringoptional): Specific plugin to update (default: all)

### k8s_helm_plugin_package

Package a Helm plugin directory into a plugin archive

**Parameters:**

- **path** (string, required): Path to the plugin directory
- **destination** (stringoptional): Destination to write the plugin archive
- **sign** (booleanoptional) (default: true): Use a PGP private key to sign the package
- **keyring** (stringoptional): Location of a public keyring (default: ~/.gnupg/pubring.gpg)
- **key** (stringoptional): Name of the key to use for signing
- **passphraseFile** (stringoptional): File containing the passphrase for the private key

### k8s_helm_plugin_verify

Verify that a Helm plugin has been signed and is valid

**Parameters:**

- **path** (string, required): Path to the plugin package
- **keyring** (stringoptional): Path to public keys used for verification

## Helm Registry Management

OCI registry login/logout and chart push

**Total Tools:** 3

### k8s_helm_registry_login

Login to an OCI registry for Helm charts

**Parameters:**

- **host** (string, required): Registry host to login to (e.g., registry.example.com)
- **username** (stringoptional): Registry username
- **password** (stringoptional): Registry password or token
- **insecure** (booleanoptional) (default: false): Allow connections to TLS registry without certs
- **caFile** (stringoptional): Verify certificates of HTTPS-enabled servers using this CA bundle
- **certFile** (stringoptional): Identify registry client using this SSL certificate file
- **keyFile** (stringoptional): Identify registry client using this SSL key file
- **plainHttp** (booleanoptional) (default: false): Use insecure HTTP connections for chart upload

### k8s_helm_registry_logout

Logout from an OCI registry

**Parameters:**

- **host** (string, required): Registry host to logout from

### k8s_helm_push

Push a chart to an OCI registry or remote URL

**Parameters:**

- **chart** (string, required): Chart path or .tgz file to push
- **remote** (string, required): Remote URL or registry reference (e.g., oci://registry.example.com/charts)
- **insecureSkipTlsVerify** (booleanoptional) (default: false): Skip TLS certificate checks for the chart upload
- **caFile** (stringoptional): Verify certificates of HTTPS-enabled servers using this CA bundle
- **certFile** (stringoptional): Identify registry client using this SSL certificate file
- **keyFile** (stringoptional): Identify registry client using this SSL key file
- **username** (stringoptional): Chart repository username where to locate the requested chart
- **password** (stringoptional): Chart repository password where to locate the requested chart
- **plainHttp** (booleanoptional) (default: false): Use insecure HTTP connections for the chart upload

## Helm Release Get Info

Get release manifests, notes, hooks, and metadata

**Total Tools:** 5

### k8s_helm_get_manifest

Get the manifest of a named release (generated Kubernetes resources)

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **revision** (numberoptional): Specific revision (default: current)

### k8s_helm_get_notes

Get the notes of a named release

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **revision** (numberoptional): Specific revision

### k8s_helm_get_hooks

Get the hooks of a named release

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **revision** (numberoptional): Specific revision

### k8s_helm_get_all

Get all information about a release (values, manifest, hooks, notes)

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **revision** (numberoptional): Specific revision

### k8s_helm_get_metadata

Fetch metadata for a Helm release

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **revision** (numberoptional): Specific revision (default: current)
- **output** (stringoptional) [enum: table, json, yaml]: Prints the output in the specified format (table, json, yaml)

## Helm Release Get Values

Get Helm release values

**Total Tools:** 1

### k8s_helm_values

Get the values of a Helm release (like helm get values)

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **revision** (numberoptional): Specific revision (default: current)
- **allValues** (booleanoptional) (default: false): Show all computed values including defaults
- **output** (stringoptional) [enum: table, json, yaml]: Prints the output in the specified format (table, json, yaml)
- **scrubSecrets** (booleanoptional) (default: false): Mask potential secrets in values output (passwords, tokens, keys)

## Helm Release History

Helm release history operations

**Total Tools:** 1

### k8s_helm_history

Get release history of a Helm chart (like helm history)

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **max** (numberoptional): Maximum number of revisions to show (default: 256)
- **output** (stringoptional) [enum: table, json, yaml]: Prints the output in the specified format (table, json, yaml)

## Helm Release Install

Install Helm charts into Kubernetes

**Total Tools:** 1

### k8s_helm_install

Install a Helm chart into Kubernetes

**Parameters:**

- **release** (stringoptional): Release name (optional for auto-generated)
- **chart** (string, required): Chart reference (repo/chart, path, or URL)
- **namespace** (stringoptional) (default: "default"): Namespace to install into
- **version** (stringoptional): Chart version to install
- **values** (arrayoptional): Path to values.yaml file or URL (can specify multiple)
  Items: string
- **set** (arrayoptional): Set values on command line (key=value format)
  Items: string
- **setFile** (arrayoptional): Set values from files (key=filepath format)
  Items: string
- **setJson** (arrayoptional): Set JSON values on command line (key=jsonvalue format)
  Items: string
- **setLiteral** (arrayoptional): Set literal STRING values on command line
  Items: string
- **setString** (arrayoptional): Set STRING values on command line (key=value format)
  Items: string
- **dryRun** (stringoptional) [enum: none, client, server]: Simulate an install (none, client, or server)
- **wait** (booleanoptional) (default: false): Wait until resources are ready
- **timeout** (stringoptional): Time to wait (e.g., '5m', '300s')
- **createNamespace** (booleanoptional) (default: false): Create the namespace if it doesn't exist
- **noHooks** (booleanoptional) (default: false): Prevent hooks from running during install
- **dependencyUpdate** (booleanoptional) (default: false): Update missing dependencies before installing
- **description** (stringoptional): Add a custom description for the release
- **devel** (booleanoptional) (default: false): Use development versions, too
- **disableOpenapiValidation** (booleanoptional) (default: false): Don't validate rendered templates against Kubernetes OpenAPI Schema
- **enableDns** (booleanoptional) (default: false): Enable DNS lookups when rendering templates
- **forceConflicts** (booleanoptional) (default: false): Force server-side apply changes against conflicts
- **forceReplace** (booleanoptional) (default: false): Force resource updates by replacement
- **generateName** (booleanoptional) (default: false): Generate the name (and omit the NAME parameter)
- **hideNotes** (booleanoptional) (default: false): Do not show notes in install output
- **hideSecret** (booleanoptional) (default: false): Hide Kubernetes Secrets when using --dry-run
- **labels** (stringoptional): Labels to add to release metadata (comma-separated key=value pairs)
- **nameTemplate** (stringoptional): Specify template used to name the release
- **output** (stringoptional) [enum: table, json, yaml]: Prints the output in the specified format (table, json, yaml)
- **postRenderer** (stringoptional): The name of a post-renderer type plugin to be used
- **postRendererArgs** (arrayoptional): Arguments to the post-renderer
  Items: string
- **renderSubchartNotes** (booleanoptional) (default: false): Render subchart notes along with the parent
- **replace** (booleanoptional) (default: false): Reuse the given name, only if that name is a deleted release
- **repo** (stringoptional): Chart repository URL where to locate the requested chart
- **rollbackOnFailure** (booleanoptional) (default: false): Rollback (uninstall) the installation upon failure
- **serverSide** (booleanoptional) (default: true): Object updates run in the server instead of the client
- **skipCRDs** (booleanoptional) (default: false): Skip CRD installation
- **skipSchemaValidation** (booleanoptional) (default: false): Disable JSON schema validation
- **takeOwnership** (booleanoptional) (default: false): Ignore the check for helm annotations and take ownership of existing resources
- **verify** (booleanoptional) (default: false): Verify the package before using it
- **waitForJobs** (booleanoptional) (default: false): Wait until all Jobs have been completed
- **caFile** (stringoptional): Verify certificates of HTTPS-enabled servers using this CA bundle
- **certFile** (stringoptional): Identify HTTPS client using this SSL certificate file
- **insecureSkipTlsVerify** (booleanoptional) (default: false): Skip TLS certificate checks for the chart download
- **keyFile** (stringoptional): Identify HTTPS client using this SSL key file
- **keyring** (stringoptional): Location of public keys used for verification
- **passCredentials** (booleanoptional) (default: false): Pass credentials to all domains
- **password** (stringoptional): Chart repository password where to locate the requested chart
- **plainHttp** (booleanoptional) (default: false): Use insecure HTTP connections for the chart download
- **username** (stringoptional): Chart repository username where to locate the requested chart

## Helm Release List

List and search Helm releases

**Total Tools:** 1

### k8s_helm_list

List Helm releases (like helm list). Shows all installed Helm charts.

**Parameters:**

- **namespace** (stringoptional): Namespace to filter (default: all namespaces)
- **allNamespaces** (booleanoptional) (default: false): List releases across all namespaces
- **filter** (stringoptional): Filter releases by name (regex)
- **deployed** (booleanoptional) (default: false): Show deployed releases
- **failed** (booleanoptional) (default: false): Show failed releases
- **pending** (booleanoptional) (default: false): Show pending releases
- **date** (booleanoptional) (default: false): Sort by release date
- **reverse** (booleanoptional) (default: false): Reverse sort order
- **offset** (numberoptional): Skip N releases for pagination
- **max** (numberoptional): Maximum number of releases to fetch (default: 256)
- **noHeaders** (booleanoptional) (default: false): Don't print headers when using the default output format
- **output** (stringoptional) [enum: table, json, yaml]: Prints the output in the specified format (table, json, yaml)
- **selector** (stringoptional): Selector (label query) to filter on (e.g., key1=value1,key2=value2)
- **short** (booleanoptional) (default: false): Output short (quiet) listing format
- **superseded** (booleanoptional) (default: false): Show superseded releases
- **timeFormat** (stringoptional): Format time using golang time formatter (e.g., 2006-01-02 15:04:05Z0700)
- **uninstalled** (booleanoptional) (default: false): Show uninstalled releases (if --keep-history was used)
- **uninstalling** (booleanoptional) (default: false): Show releases currently being uninstalled

## Helm Release Rollback

Roll back Helm releases to previous versions

**Total Tools:** 1

### k8s_helm_rollback

Roll back to a previous revision

**Parameters:**

- **release** (string, required): Release name
- **revision** (numberoptional) (default: 0): Revision number to rollback to (0 for previous)
- **namespace** (stringoptional) (default: "default"): Release namespace
- **wait** (booleanoptional) (default: false): Wait until resources are ready
- **timeout** (stringoptional): Time to wait
- **cleanupOnFail** (booleanoptional) (default: false): Allow deletion of new resources on rollback failure
- **noHooks** (booleanoptional) (default: false): Prevent hooks from running during rollback
- **recreatePods** (booleanoptional) (default: false): Restart pods after rollback
- **dryRun** (stringoptional) [enum: none, client, server]: Simulate rollback (none, client, server)
- **forceConflicts** (booleanoptional) (default: false): Force changes against conflicts with server-side apply
- **forceReplace** (booleanoptional) (default: false): Force resource updates by replacement
- **historyMax** (numberoptional): Maximum revisions saved per release (0=no limit)
- **serverSide** (stringoptional) (default: "auto") [enum: true, false, auto]: Server-side apply (true, false, auto)
- **waitForJobs** (booleanoptional) (default: false): Wait for all Jobs to complete before marking success

## Helm Release Status

Get Helm release status information

**Total Tools:** 1

### k8s_helm_status

Get status of a Helm release (like helm status)

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **revision** (numberoptional): Specific revision (default: current)
- **showDesc** (booleanoptional) (default: false): Show description in output
- **showResources** (booleanoptional) (default: false): Show resources in output
- **output** (stringoptional) (default: "json") [enum: table, json, yaml]: Output format (table, json, yaml)

## Helm Release Test

Run Helm release tests

**Total Tools:** 1

### k8s_helm_test

Run tests for a Helm release

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **timeout** (stringoptional): Time to wait (e.g., '5m')
- **logs** (booleanoptional) (default: false): Dump pod logs on failure
- **filter** (stringoptional): Filter tests by attribute using name=value syntax (e.g., name=test1 or !name=test2 to exclude)

## Helm Release Uninstall

Uninstall Helm releases

**Total Tools:** 1

### k8s_helm_uninstall

Uninstall a Helm release

**Parameters:**

- **release** (string, required): Release name
- **namespace** (stringoptional) (default: "default"): Release namespace
- **keepHistory** (booleanoptional) (default: false): Remove all associated resources and mark the release as deleted, but retain the release history
- **wait** (booleanoptional) (default: false): Wait until resources are deleted
- **timeout** (stringoptional): Time to wait (e.g., '5m', '300s')
- **noHooks** (booleanoptional) (default: false): Prevent hooks from running during uninstall
- **cascade** (stringoptional) [enum: background, orphan, foreground]: Deletion cascading strategy (background, orphan, foreground)
- **description** (stringoptional): Add a custom description for the uninstall
- **dryRun** (booleanoptional) (default: false): Simulate uninstall without actually deleting
- **ignoreNotFound** (booleanoptional) (default: false): Treat 'release not found' as successful uninstall

## Helm Release Upgrade

Upgrade Helm releases to new versions

**Total Tools:** 1

### k8s_helm_upgrade

Upgrade a Helm release to a new version of a chart

**Parameters:**

- **release** (string, required): Release name
- **chart** (string, required): Chart reference
- **namespace** (stringoptional) (default: "default"): Release namespace
- **version** (stringoptional): Chart version
- **values** (stringoptional): Values file path
- **set** (arrayoptional): Set values (key=value)
  Items: string
- **dryRun** (booleanoptional) (default: false): Simulate an upgrade
- **install** (booleanoptional) (default: false): Install if release doesn't exist (helm upgrade --install)
- **wait** (booleanoptional) (default: false): Wait until resources are ready
- **timeout** (stringoptional): Time to wait (e.g., '5m')
- **force** (booleanoptional) (default: false): Force resource updates through deletion/recreate
- **resetValues** (booleanoptional) (default: false): Reset values to built-in defaults
- **reuseValues** (booleanoptional) (default: false): Reuse previous values
- **rollbackOnFailure** (booleanoptional) (default: false): Rollback on failed upgrade
- **noHooks** (booleanoptional) (default: false): Prevent hooks from running during upgrade
- **dependencyUpdate** (booleanoptional) (default: false): Update missing dependencies before upgrading
- **atomic** (booleanoptional) (default: false): Rollback on failure (atomic upgrade)
- **description** (stringoptional): Add a custom description for the release
- **disableOpenapiValidation** (booleanoptional) (default: false): Don't validate rendered templates against Kubernetes OpenAPI Schema
- **skipCRDs** (booleanoptional) (default: false): Skip CRD installation
- **skipSchemaValidation** (booleanoptional) (default: false): Disable JSON schema validation
- **verify** (booleanoptional) (default: false): Verify the package before using it
- **waitForJobs** (booleanoptional) (default: false): Wait until all Jobs have been completed
- **createNamespace** (booleanoptional) (default: false): Create the release namespace if not present (with --install)
- **historyMax** (numberoptional): Maximum number of revisions saved per release (0=no limit)
- **cleanupOnFail** (booleanoptional) (default: false): Allow deletion of new resources created when upgrade fails
- **keyring** (stringoptional): Location of public keys for verification (default: ~/.gnupg/pubring.gpg)
- **repo** (stringoptional): Chart repository URL where to locate the requested chart
- **username** (stringoptional): Chart repository username
- **password** (stringoptional): Chart repository password
- **devel** (booleanoptional) (default: false): Use development versions too
- **hideSecret** (booleanoptional) (default: false): Hide Kubernetes Secrets when using --dry-run
- **setFile** (arrayoptional): Set values from files (key=filepath)
  Items: string
- **setJson** (arrayoptional): Set JSON values on command line (key=jsonvalue)
  Items: string
- **setLiteral** (arrayoptional): Set literal STRING values on command line
  Items: string
- **setString** (arrayoptional): Set STRING values on command line (key=value)
  Items: string

## Helm Repo Management

Helm repository management

**Total Tools:** 5

### k8s_helm_repo_list

List configured Helm chart repositories (like helm repo list)

**Parameters:**

- **noHeaders** (booleanoptional) (default: false): Suppress headers in the output
- **output** (stringoptional) (default: "json") [enum: table, json, yaml]: Output format (table, json, yaml)

### k8s_helm_repo_add

Add a Helm chart repository

**Parameters:**

- **name** (string, required): Repository name
- **url** (string, required): Repository URL
- **username** (stringoptional): Chart repository username
- **password** (stringoptional): Chart repository password
- **allowDeprecatedRepos** (booleanoptional) (default: false): Allow adding deprecated official repos
- **caFile** (stringoptional): Verify certificates of HTTPS-enabled servers using this CA bundle
- **certFile** (stringoptional): Identify HTTPS client using this SSL certificate file
- **forceUpdate** (booleanoptional) (default: false): Replace (overwrite) the repo if it already exists
- **insecureSkipTlsVerify** (booleanoptional) (default: false): Skip TLS certificate checks for the repository
- **keyFile** (stringoptional): Identify HTTPS client using this SSL key file
- **passCredentials** (booleanoptional) (default: false): Pass credentials to all domains
- **timeout** (stringoptional): Time to wait for index file download (default: 2m0s)

### k8s_helm_repo_remove

Remove a Helm chart repository

**Parameters:**

- **name** (string, required): Repository name

### k8s_helm_repo_update

Update Helm chart repositories (get latest charts)

**Parameters:**

- **repo** (stringoptional): Specific repo to update (default: all)
- **timeout** (stringoptional): Time to wait for index file download (default: 2m0s)

### k8s_helm_repo_index

Generate an index file given a directory containing packaged charts

**Parameters:**

- **directory** (string, required): Directory containing packaged charts
- **url** (stringoptional): URL to prepend to each chart URL
- **merge** (stringoptional): Merge the generated index with an existing index file
- **json** (booleanoptional) (default: false): Output in JSON format

## Helm Search Hub

Search for Helm charts in Artifact Hub and repositories

**Total Tools:** 1

### k8s_helm_search

Search for Helm charts in artifact hub or local repos (like helm search)

**Parameters:**

- **keyword** (string, required): Search keyword
- **source** (stringoptional) (default: "repo") [enum: hub, repo]: Search source (hub=Artifact Hub, repo=local repos)
- **maxResults** (numberoptional): Maximum number of results (default: 25)
- **versions** (booleanoptional) (default: false): Show all versions (default: latest only)
- **devel** (booleanoptional) (default: false): Use development versions (alpha, beta, release candidates)
- **version** (stringoptional): Semantic version constraint (e.g., ^1.0.0)
- **regexp** (booleanoptional) (default: false): Use regular expressions for searching
- **output** (stringoptional) (default: "json") [enum: table, json, yaml]: Output format (table, json, yaml)
- **endpoint** (stringoptional): Hub instance to query for charts (default: https://hub.helm.sh)
- **failOnNoResult** (booleanoptional) (default: false): Search fails if no results are found
- **listRepoUrl** (booleanoptional) (default: false): Print charts repository URL
- **maxColWidth** (numberoptional): Maximum column width for output table (default: 50)

## Helm Show Chart

Show Helm chart information

**Total Tools:** 1

### k8s_helm_show

Show information about a Helm chart (like helm show chart/values/readme)

**Parameters:**

- **chart** (string, required): Chart reference (repo/chart or path)
- **info** (stringoptional) (default: "chart") [enum: chart, values, readme, all, crds]: Type of information to show
- **version** (stringoptional): Chart version
- **jsonpath** (stringoptional): JSONPath expression to filter the output (for values only)
- **repo** (stringoptional): Chart repository URL where to locate the requested chart
- **username** (stringoptional): Chart repository username
- **password** (stringoptional): Chart repository password
- **devel** (booleanoptional) (default: false): Use development versions too
- **verify** (booleanoptional) (default: false): Verify the package before using it
- **keyring** (stringoptional): Location of public keys for verification (default: ~/.gnupg/pubring.gpg)
- **caFile** (stringoptional): Verify certificates of HTTPS-enabled servers using this CA bundle
- **certFile** (stringoptional): Identify HTTPS client using this SSL certificate file
- **keyFile** (stringoptional): Identify HTTPS client using this SSL key file
- **insecureSkipTlsVerify** (booleanoptional) (default: false): Skip TLS certificate checks for the chart download
- **passCredentials** (booleanoptional) (default: false): Pass credentials to all domains
- **plainHttp** (booleanoptional) (default: false): Use insecure HTTP connections for the chart download
