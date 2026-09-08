# Cloud Provider Limitations

This document describes known limitations and workarounds when using the k8s-helm-mcp with different cloud providers.

## Azure Kubernetes Service (AKS)

### Managed Node Restrictions

The following tools will fail on AKS system nodepools due to Azure's managed node restrictions:

| Tool | Error | Workaround |
|------|-------|-----------|
| `k8s_add_node_label` | HTTP 400 | AKS system nodepools do not allow user label modifications. Use custom nodepools for label modifications. |
| `k8s_add_node_taint` | HTTP 400 | AKS system nodepools do not allow taint modifications. Use custom nodepools for taint modifications. |

**Note**: These restrictions apply to AKS-managed system nodepools. Custom nodepools may allow these operations.

### NetworkPolicy with Calico

When using Calico as the network plugin on AKS, NetworkPolicy creation may fail with HTTP 400 errors due to Calico-specific format requirements.

**Known Issue**: `k8s_create_networkpolicy` may fail on AKS with Calico

**Workarounds**:
1. Try a minimal NetworkPolicy with empty podSelector:
   ```json
   {
     "podSelector": {},
     "policyTypes": ["Ingress"]
   }
   ```
2. Check Calico network policy documentation for AKS-specific requirements
3. Use `kubectl describe networkpolicy <name>` to see detailed error messages
4. Consider using Calico-specific network policy CRDs if standard Kubernetes NetworkPolicies are insufficient

### Rollout Operations

Some rollout operations may be restricted by AKS RBAC:

| Tool | Error | Workaround |
|------|-------|-----------|
| `k8s_rollout_pause` | HTTP 400 | AKS RBAC may restrict pause operations. Use direct deployment updates instead. |

### Log Streaming Limitations

The Kubernetes log API uses streaming responses which are not fully supported in the MCP context:

| Tool | Limitation | Workaround |
|------|-----------|-----------|
| `k8s_get_pod_logs` | Follow mode (real-time streaming) not supported | Use `kubectl logs -f` for real-time streaming. MCP returns initial logs only. |
| `k8s_get_pod_logs` | HTTP request failed for containers with no logs | Returns "(no logs available)" message. Use kubectl for direct access. |
| `k8s_get_pod_logs` | Streaming endpoints timeout | MCP HTTP client may timeout on streaming responses. Use kubectl instead. |

**Note**: This is a general MCP limitation, not specific to any cloud provider. The log API requires persistent HTTP connections or WebSockets for streaming, which the MCP server's HTTP client doesn't support in this environment.

### Strategic Merge Patch

AKS API server may reject strategic merge patch requests in certain scenarios. The MCP server now includes automatic fallback to merge patch when strategic merge fails.

**Automatic Fallback**: When `k8s_patch` with `patchType: "strategic"` fails with a validation error, the server automatically retries with `patchType: "merge"`.

**Manual Workaround**: Explicitly use `patchType: "merge"` if strategic merge consistently fails.

## Google Kubernetes Engine (GKE)

No known limitations at this time. The MCP server is expected to work with GKE clusters without issues.

## Amazon Elastic Kubernetes Service (EKS)
 
No known limitations at this time. The MCP server is expected to work with EKS clusters without issues.
 
## Authentication and CLI Dependencies
 
When using managed Kubernetes services (AKS, GKE, EKS), the Kubernetes SDK often relies on external command-line tools for authentication via "exec" plugins.
 
### Required CLIs
 
| Provider | Service | Required CLI | Recommended Auth Command |
|----------|---------|--------------|--------------------------|
| **Azure** | AKS | `az` (Azure CLI) | `az login` |
| **Google** | GKE | `gcloud` (Cloud SDK) | `gcloud auth login` |
| **AWS** | EKS | `aws` (AWS CLI) | `aws sso login` or `aws configure` |
 
### Known Issue: "executable file not found"
 
If the required CLI is not installed or not in your system's PATH, the MCP server will return an authentication error.
 
**Error Example**: `exec: "aws": executable file not found in %PATH%`
 
**Solution**:
1. Install the corresponding CLI for your cloud provider.
2. Ensure the CLI binary is available in the environment where the MCP client (e.g., Claude Desktop) is running.
3. Restart your MCP client after installing the CLI to refresh the PATH environment variable.
 
### GKE Authentication Plugin
 
For GKE clusters, you may also need to install the GKE-specific authentication plugin:
```bash
gcloud components install gke-gcloud-auth-plugin
```
 
## Self-Managed Clusters

The MCP server works with any Kubernetes cluster that supports standard kubeconfig-based authentication. No specific limitations for self-managed clusters.

## General Recommendations

1. **Test in non-production environments first**: Always test MCP server operations in a development/staging environment before using in production.

2. **Check RBAC permissions**: Ensure your kubeconfig has sufficient permissions for the operations you intend to perform.

3. **Use resource-specific delete tools**: For LimitRange and ResourceQuota, use `k8s_delete_limitrange` and `k8s_delete_resourcequota` instead of the generic `k8s_delete` tool.

4. **Monitor API server latency**: Some cloud providers (especially in certain regions) may have higher API latency. The `k8s_api_latency_check` tool can help diagnose performance issues.

5. **Enable metrics-server**: For resource usage metrics (top node, top pod), install metrics-server on your cluster. See [METRICS_SERVER.md](METRICS_SERVER.md) for installation instructions.

6. **Leverage Pre-Flight Dry-Run (`dryRun: 'server'`)**: Before applying mutations, deletions, or scaling on managed clusters (EKS, AKS, GKE), use `dryRun: 'server'` to test whether cloud-specific admission webhooks, Azure Policy, AWS GuardDuty, or GCP Anthos Config Management will reject the request before executing it live.

## Reporting Issues

If you encounter limitations or issues with specific cloud providers that are not documented here, please:

1. Review the error message and suggestions provided by the MCP server
2. Check the `k8s_cluster_health` and `k8s_health_score` tools for cluster diagnostics
3. Open an issue on GitHub with:
   - Cloud provider and region
   - Kubernetes version
   - MCP server version
   - Tool name and parameters used
   - Full error message
   - Steps to reproduce

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
