# Security and Data Protection Guide

This document explains the security architecture, data protection mechanisms, and safety features of the k8s-helm-mcp.

## Overview

The k8s-helm-mcp is designed with security as a primary concern. It acts as a secure proxy between Claude and your Kubernetes cluster, ensuring that sensitive credentials and configuration data are never exposed to the AI.

## Security Compliance & Standards

The k8s-helm-mcp is architected to align with industry-leading security frameworks:

- **OWASP Kubernetes Top 10 (2025)**: Proactive mitigation of insecure workload configurations (K01), overly permissive authorization (K02), and secrets management failures (K03).
- **SlowMist MCP Security Checklist**: Full compliance with AI agent security standards, including robust input validation, infrastructure isolation, and error scrubbing.
- **MCP Best Practices**: Adherence to official Model Context Protocol security guidelines for local tool execution, resource limits, and data privacy.

## Security Architecture

### Data Flow

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Claude    │         │  k8s-helm-mcp  │         │ Kubernetes API  │
│  (AI Client)│────────▶│  (Local Proxy)   │────────▶│  (Cluster)      │
└─────────────┘         └──────────────────┘         └─────────────────┘
                            │
                            ├─ Reads kubeconfig locally
                            ├─ Stores credentials in memory
                            ├─ Authenticates with Kubernetes
                            ├─ Executes operations
                            └─ Returns results only
```

### What Claude Sees

**Claude has access to:**
- Tool names and descriptions
- Tool input parameters (namespace, pod name, resource names)
- Tool output results (pod status, logs, resource configurations)
- Error messages and operation results

**Claude does NOT have access to:**
- Kubeconfig file contents
- API tokens and certificates
- Authentication credentials
- Cluster connection details (server URLs, CA certificates)
- User credentials or service account tokens
- Private registry credentials (when using pre-existing secrets)

### What the MCP Server Handles Locally

**The server processes locally:**
- Reading and parsing kubeconfig files
- Storing authentication credentials in memory
- Establishing TLS connections to Kubernetes API
- Handling certificate validation
- Managing authentication tokens
- Executing Kubernetes API calls
- Applying protection mode rules

### Infrastructure Isolation (SlowMist)

The server operates as a completely isolated local process. It does not require root privileges and communicates with the Kubernetes API via standard, encrypted TLS channels. No external control plane, third-party relay, or cloud-based processing is involved in the credential handling.

### Supply Chain Integrity (SlowMist)

- **Dependency Locking**: All dependencies are strictly locked via package-lock.json to prevent supply chain substitution attacks.
- **Minimal Attack Surface**: We prioritize official, high-quality dependencies like @kubernetes/client-node and avoid unnecessary third-party wrappers.
- **Vulnerability Scanning**: The project maintains regular scans to ensure all dependencies are free from known CVEs and security vulnerabilities.

## Credential Management

### Kubeconfig Security

**How kubeconfig is handled:**
1. Server reads kubeconfig from standard location (`~/.kube/config`)
2. Credentials are loaded into memory only
3. Credentials are never logged or transmitted to Claude
4. Credentials are never written to disk by the server
5. Memory is cleared when server shuts down

**Supported authentication methods:**
- Client certificates
- Bearer tokens
- Basic authentication
- Exec-based authentication (e.g., AWS IAM, GKE)
- OIDC authentication

### Private Registry Credentials

**Recommended approach (secure):**
```bash
# Create secret manually - credentials never shared with Claude
kubectl create secret docker-registry my-registry-secret \
  --docker-server=registry.example.com \
  --docker-username=your-username \
  --docker-password=your-password
```

**Alternative (less secure):**
- Claude can create secrets interactively
- User provides credentials in conversation
- Credentials are stored in Kubernetes secrets
- **Note:** This approach shares credentials with Claude

## Protection Modes

The server includes two protection modes to prevent accidental or malicious operations:

### Infrastructure Protection Mode

**Purpose:** Prevent destructive operations on critical infrastructure

**Protected tools (when enabled):**
- Node operations (cordon, drain, delete)
- Cluster-wide operations
- Storage operations (PV deletion)
- Critical configuration changes

**How it works:**
- Enabled by default
- Blocks destructive tools by default
- Requires explicit confirmation to disable
- Logs all blocked attempts

**Configuration:**
```bash
export INFRA_PROTECTION_MODE=true  # Enable (default: true)
export INFRA_PROTECTION_MODE=false # Disable protection
```

### Strict Protection Mode

**Purpose:** Blocks ALL non-read-only operations - highest level of protection

**What it blocks:**
- All modification operations (create, update, delete)
- Only allows list, get, describe, and monitoring operations
- Useful for production clusters where no modifications should ever be made

**Configuration:**
```bash
export STRICT_PROTECTION_MODE=true  # Enable (default: true)
export STRICT_PROTECTION_MODE=false # Disable
```

**Tool:** `k8s_toggle_strict_protection_mode`

### No Delete Protection Mode

**Purpose:** Blocks only deletion operations while allowing other modifications

**What it blocks:**
- Delete operations only
- Allows create, update, scale, and modify operations
- Useful for environments where modifications are needed but accidental deletions must be prevented

**Configuration:**
```bash
export NO_DELETE_PROTECTION_MODE=true  # Enable (default: true)
export NO_DELETE_PROTECTION_MODE=false # Disable
```

**Tool:** `k8s_toggle_no_delete_mode`

### Master Toggle

**Tool:** `k8s_toggle_all_protection_modes`

Controls all three protection modes simultaneously for quick switching between full access and fully protected states. This aligns with **OWASP K04: Lack of Cluster Level Policy Enforcement**, providing a local enforcement layer.

### Toolset Selection (Attack-Surface Reduction)

Where Protection Modes block a tool **at call time**, toolset selection removes it **at registration time** — the tool is never advertised to the model, so it cannot be invoked or prompt-injected into use. This is the outermost of the layered controls and is the recommended first step for least-privilege AI deployments.

Configure via environment variables (see the README [Toolsets](README.md#toolsets-tool-selection) section for the full list):

| Variable | Effect |
|----------|--------|
| `K8S_TOOLSETS=readonly` | Registers only read/list/get/inspect tools — the model never sees any mutating or deletion tool |
| `K8S_TOOLSETS=readwrite` | Registers reads + resource CRUD, but no node-admin ops (cordon, drain, taint, node labels) |
| `K8S_TOOLSETS=admin` | Every tool, including node lifecycle (alias for `all`, the default) |
| `K8S_TOOLSETS=nodelete` | Registers reads and updates but no delete/destroy tools |
| `K8S_TOOLSETS=kubernetes` / `helm` / `core` / `lean` | Registers a focused subset for the agent's job |
| `K8S_DISABLED_TOOLSETS=...` | Removes specific categories after selection |

The access-level ladder (`readonly` → `readwrite` → `admin`) mirrors the model used by other Kubernetes MCP servers; `readonly` is the strictest and wins when combined with other filters.

```bash
# Least-privilege observability agent: read-only surface, enforced at registration
K8S_TOOLSETS=readonly npm start
```

**Defense in depth.** Toolset selection and Protection Modes are application-layer guardrails, not the security boundary. The authoritative control is **Kubernetes RBAC on the kubeconfig's ServiceAccount**. For a read-only agent, bind its kubeconfig to a read-only `ClusterRole` **and** set `K8S_TOOLSETS=readonly`: RBAC enforces authorization at the API server, while the toolset reduces attack surface and model context. This maps to **OWASP K01 (RBAC)** layered with **K04 (local policy enforcement)**.

### Native Pre-Flight Simulation & Dry-Run Engine (SlowMist AI Safety)

**Purpose:** Provide zero-risk pre-flight verification for AI agents and automation scripts prior to committing mutations to production Kubernetes clusters.

In autonomous multi-agent environments, agents may propose cluster mutations, scaling, deletions, or configuration changes. To guarantee that dangerous actions are never executed blindly, k8s-helm-mcp introduces native dry-run execution across all creation, deletion, and operational mutation tools:

| Mode | Execution Path | Safety & Security Guarantees |
|------|----------------|------------------------------|
| `none` (default) | Standard Kubernetes API / CLI mutation | Direct cluster state modification with full audit logging |
| `client` | Local schema & parameter simulation | Executes local input validation, safety checks, and parameter sanitization without contacting the cluster |
| `server` | Kubernetes API Server Dry-Run (`dryRun=All`) | Passes the mutation request to the Kubernetes API server admission chain (ValidatingAdmissionWebhooks, MutatingAdmissionWebhooks, RBAC authorization, schema validation, quota checks) **without persisting state** to etcd |

**Security Benefits:**
- **Pre-Execution RBAC Validation**: Verifies that the current kubeconfig context has sufficient RBAC permissions to perform the action before attempting it live.
- **Webhook Admission Verification**: Catches violations of OPA Gatekeeper, Kyverno, or custom admission webhooks before any actual mutation occurs.
- **Quota & Limit Enforcement Pre-checks**: Tests whether a pod, deployment, or PVC would exceed namespace resource quotas.

**Universal Scope:**
- **22 Creation Tools**: `k8s_create_*` (deployments, services, namespaces, ingress, PVCs, roles, secrets, configmaps, etc.)
- **20+ Deletion Tools**: `k8s_delete_*` (pods, deployments, statefulsets, services, pvcs, secrets, namespaces, generic delete)
- **Operational Mutations**: Node cordoning, uncordoning, draining, taints, labels; pod restarts; workload scaling, rollouts, image updates, pause/resume, autoscaling; generic patch, label, and annotate.

### Deletion Safety & Cascade Controls

**Purpose:** Prevent accidental cascading cluster outages and catastrophic data loss caused by AI hallucinations or aggressive cleanup scripts.

Every deletion tool in the MCP server is equipped with universal deletion safety parameters:
- **`dryRun`** (`'none' | 'client' | 'server'`): Pre-flight simulation before deleting critical pods, storage, or workloads.
- **`gracePeriodSeconds`**: Allows controlled shutdown countdowns, preventing abrupt termination of stateful or database workloads.
- **`propagationPolicy`** (`'Orphan' | 'Background' | 'Foreground'`): Explicit control over Kubernetes garbage collection, preventing accidental recursive deletion of child resources (e.g. pods, replicasets, persistent volumes).
- **`ignoreNotFound`** (`boolean`): Idempotent deletion handling that safely succeeds with a descriptive notice if the target resource does not exist, preventing script crashes and error cascades.

## Data Protection

### Data in Transit

**TLS/SSL encryption:**
- All communication between MCP server and Kubernetes API uses TLS
- Certificate validation is enforced by default
- Custom CA certificates are supported
- Secure by default configuration

**Communication with Claude:**
- Uses stdio (standard input/output) for local communication
- No network exposure to Claude
- Claude Desktop runs locally on your machine

### Data at Rest

**Kubernetes secrets:**
- The server does not create secrets unless explicitly requested
- When creating secrets, they are stored in Kubernetes
- Kubernetes secrets are encrypted at rest (cluster-dependent)
- Server does not persist secrets locally

**Local storage:**
- No credential storage on disk
- No persistent storage of sensitive data
- Credentials loaded into memory only from kubeconfig
- Server does not write credentials to disk

### Data in Memory

**Credential storage:**
- Credentials stored in process memory only
- Memory is cleared on server shutdown
- Server does not actively prevent memory dumps (OS-dependent)
- Server does not actively prevent swap to disk (OS-dependent)

**Session isolation:**
- Each server instance has isolated memory
- No credential sharing between sessions
- Restart clears all credentials

### Logging

**What is logged:**
- Server startup messages (version, tool count, protection mode status)
- Protection mode changes (enable/disable events)
- Error messages for debugging (may include resource names, namespaces, error details)
- Circuit breaker status changes
- Tool invocation errors
- OpenTelemetry initialization status (if enabled)

**What is NOT logged:**
- Kubeconfig file contents
- API tokens and certificates
- Secret values
- Authentication credentials
- Sensitive configuration data

**Note:** Error messages may contain resource names and namespaces but not credentials. Logs are written to stderr/stdout and managed by the host system.

### Input Validation & Sanitization (SlowMist)

The server implements multi-layered input validation to prevent injection attacks and data corruption:

- **DNS-1123 Validation**: All resource names and namespaces are validated against strict Kubernetes naming conventions before being used in API calls.
- **Shell Injection Prevention**: A robust sanitizeShellArg utility is used for any operations involving command execution (e.g., k8s_kubectl, k8s_exec_pod), preventing arbitrary command execution.
- **Manifest Protection**: Complex Kubernetes fields like Ingress regexes, annotations, and labels are protected during sanitization to ensure security without corrupting legitimate configuration syntax.
- **JSON/YAML Schema Enforcement**: All tool inputs are validated against strict Zod schemas before processing.

### Error Scrubbing & Redaction (SlowMist)

To prevent the leakage of internal system details or sensitive cluster metadata, the server employs a centralized error management system:

- **Stack Trace Redaction**: Internal JavaScript/Node.js stack traces and file paths are never exposed to the AI client.
- **Credential Stripping**: Any error messages returned by the Kubernetes API are scanned for sensitive tokens or server URLs before being passed back to Claude.
- **Actionable Summaries**: Technical errors are translated into high-level, security-safe summaries with specific remediation suggestions.

### Secret Scrubbing (PII/Credential Redaction)

**Purpose:** Automatically detect and redact sensitive data in tool outputs to prevent accidental credential exposure to Claude.

**How it works:**
- Optional `scrub` parameter available on sensitive tools (default: `false` for backwards compatibility)
- When enabled, output is scanned against 40+ detection patterns
- Detected sensitive values are replaced with redaction markers (e.g., `[AWS_ACCESS_KEY_REDACTED]`, `[PASSWORD_REDACTED]`)
- Response includes `scrubbed: true/false` flag to indicate if redaction was applied

**Tools supporting scrub:**
- `k8s_get_logs` - Pod/deployment/service logs
- `k8s_exec_pod` - Command execution output
- `k8s_kubectl` - Arbitrary kubectl command output
- `k8s_describe_pod` - Full pod YAML description
- `k8s_helm_values` - Helm release values
- `k8s_helm_template` - Rendered Helm templates
- `k8s_get_configmap` - ConfigMap data
- `k8s_export_resource` - Exported resource YAML
- `k8s_pod_log_search` - Log search results

**Detection patterns include:**
- **Passwords:** password, passwd, pwd, pass, adminpass, rootpass (case-insensitive)
- **Tokens:** access_token, refresh_token, auth_token, api_token, bearer_token, JWT tokens
- **API Keys:** api_key, secret_key, private_key, client_secret, app_key
- **Cloud Credentials:**
  - AWS: AKIA, ASIA access keys (16 chars), 40-char secret keys
  - GCP: AIza... API keys (35 chars)
  - Azure: GUIDs for service principals
  - GitHub: ghp_, gho_, ghu_, ghs_, ghr_ tokens
  - Slack: xoxb-, xoxa-, xoxp-, xoxr-, xoxs- tokens
  - Stripe: sk_live_, pk_live_, sk_test_, pk_test_ keys
  - OpenAI: sk-... API keys
- **Cryptographic:** PEM private/public keys, X.509 certificates, hex tokens (32-64 chars)
- **Authentication:** Bearer tokens, Basic Auth, OAuth tokens, database connection strings
- **PII:** Credit cards, SSN (XXX-XX-XXXX), email addresses, phone numbers
- **Kubernetes:** tls.crt, tls.key, ca.crt data fields, Docker registry auth
- **Infrastructure:** Public IP addresses and resource identifiers are preserved to maintain cluster visibility; focused redaction is applied only to actual secrets.

**Example usage:**
```bash
# Get logs with secret scrubbing enabled
k8s_get_logs name=my-pod namespace=default scrub=true

# Export resource with sensitive data redacted
k8s_export_resource kind=ConfigMap name=my-config scrub=true

# Helm values with credential masking
k8s_helm_values release=my-release scrubSecrets=true
```

**Redaction markers:**
- `[PASSWORD_REDACTED]`
- `[AWS_ACCESS_KEY_REDACTED]`
- `[JWT_TOKEN_REDACTED]`
- `[EMAIL_REDACTED]`
- `[CREDIT_CARD_REDACTED]`
- `[PRIVATE_KEY_REDACTED]`
- And 35+ more specific markers

**Limitations:**
- Pattern-based detection (may have false positives/negatives)
- Binary data is not scrubbed
- Very short secrets (< 8 chars) may not be detected
- Custom/obscure credential formats may not be recognized
- Opt-in feature - must explicitly set `scrub=true` on each tool call

### Observability (OpenTelemetry)

**OpenTelemetry Integration:**
- Distributed tracing for tool execution and API calls
- Configurable via environment variables:
  - `OTEL_SDK_DISABLED=true` to disable telemetry
  - `OTEL_EXPORTER_OTLP_ENDPOINT` to set OTLP collector endpoint
  - `OTEL_SERVICE_NAME` to customize service name
- Spans include tool names, resource information, and operation details
- Telemetry data is exported to configured OTLP endpoint (e.g., Jaeger, Tempo)
- No sensitive credentials or secrets are included in trace data
- Telemetry can be disabled for air-gapped or privacy-sensitive environments

### Resource Limits & DoS Protection (SlowMist/MCP)

To maintain server stability and prevent Denial of Service (DoS) attacks:

- **Payload Limits**: The server enforces maximum buffer sizes (e.g., 10MB) for log retrieval and resource listing.
- **Execution Timeouts**: All tool executions have configurable timeouts to prevent hanging processes from consuming resources.
- **Memory Management**: The server utilizes connection pooling and efficient stream processing to minimize memory spikes during large resource exports.

## Security Best Practices

### For Users

1. **Use pre-existing secrets for private registries**
   - Create secrets manually with kubectl
   - Reference secrets in deployments
   - Avoid sharing credentials with Claude

2. **Enable protection modes**
   - Keep infrastructure protection enabled
   - Configure multi-mode protection for your environment
   - Review protection mode settings regularly

3. **Limit cluster access**
   - Use service accounts with minimal permissions
   - Apply RBAC policies to restrict access
   - Use separate kubeconfig for MCP server

4. **Audit access**
   - Review Kubernetes audit logs
   - Monitor MCP server logs for suspicious activity
   - Track tool usage patterns

5. **Keep server updated**
   - Install security updates promptly
   - Review changelog for security fixes
   - Monitor GitHub issues for security reports

### For Administrators

1. **Network security**
   - Run MCP server in secure network environment
   - Use firewall rules to restrict access
   - Implement network policies in Kubernetes

2. **Credential management**
   - Rotate credentials regularly
   - Use short-lived tokens
   - Implement credential rotation policies
   - Use external secret managers

3. **Monitoring and alerting**
   - Enable Kubernetes audit logging
   - Monitor for unusual API calls
   - Set up alerts for protection mode triggers
   - Track resource usage patterns

4. **Compliance**
   - Review logs for compliance requirements
   - Implement retention policies
   - Ensure audit trail completeness
   - Document security procedures

## Risk Assessment

### Identified Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Credential exposure to Claude | Low | High | Server handles credentials locally; Claude only sees tool interface |
| Accidental cluster modification | Medium | High | Protection modes enabled by default |
| Malicious tool usage | Low | High | Protection modes; audit logging |
| Unauthorized cluster access | Low | High | RBAC; credential management |
| Data leakage through logs | Low | Medium | No sensitive data logging |
| Man-in-the-middle attacks | Low | High | TLS enforcement; certificate validation |

### Risk Mitigation

**Credential exposure:**
- Server architecture prevents credential exposure
- Credentials never transmitted to Claude
- Memory-only credential storage
- Regular security audits

**Accidental modifications:**
- Infrastructure protection mode enabled by default
- Multi-mode protection for fine-grained control
- Confirmation required for destructive operations
- Audit logging of all operations

**Unauthorized access:**
- RBAC enforcement
- Service account isolation
- Network policies
- Credential rotation

## Audit and Logging

### Server Logging

**What is logged:**
- Tool invocations (name, parameters)
- Operation results (success/failure)
- Protection mode triggers
- Error messages (no sensitive data)
- Server startup and shutdown

**What is NOT logged:**
- Credentials
- API tokens
- Certificate contents
- Secret values
- Sensitive configuration data

### Kubernetes Audit Logging

**Enable audit logging:**
```yaml
# Kubernetes audit policy
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["pods", "deployments", "services"]
```

**Monitor audit logs:**
```bash
kubectl get events --all-namespaces
kubectl logs -n kube-system -l component=kube-apiserver
```

## Compliance Considerations

### Data Residency

- Server runs locally on your machine
- No data transmitted to external services
- Kubernetes cluster controls data residency
- Compliance depends on your cluster configuration

### Access Control

- MCP server respects Kubernetes RBAC
- Service account permissions enforced
- No privilege escalation
- Namespace isolation maintained

### Audit Trail

- Kubernetes audit logs provide complete trail
- Server logs supplement with tool-level tracking
- Protection mode triggers logged
- All operations attributable to user context

## Incident Response

### If Credentials Are Compromised

1. **Immediate actions:**
   - Rotate all affected credentials
   - Revoke compromised tokens
   - Update kubeconfig
   - Restart MCP server

2. **Investigation:**
   - Review audit logs
   - Check Kubernetes API logs
   - Identify affected resources
   - Assess impact scope

3. **Recovery:**
   - Restore from backups if needed
   - Update security policies
   - Implement additional protections
   - Document lessons learned

### If Unauthorized Access Detected

1. **Containment:**
   - Disable MCP server
   - Revoke service account permissions
   - Isolate affected cluster
   - Enable additional monitoring

2. **Investigation:**
   - Review all logs
   - Identify access patterns
   - Determine attack vector
   - Assess data exposure

3. **Remediation:**
   - Patch vulnerabilities
   - Update configurations
   - Strengthen access controls
   - Implement additional safeguards

## Security Checklist

- [ ] Infrastructure protection mode enabled
- [ ] Multi-mode protection configured
- [ ] RBAC policies applied
- [ ] Service account with minimal permissions
- [ ] Kubernetes audit logging enabled
- [ ] Regular credential rotation
- [ ] Pre-existing secrets for private registries
- [ ] TLS/SSL enforced for API communication
- [ ] Network policies configured
- [ ] Monitoring and alerting setup
- [ ] Security review completed
- [ ] Incident response plan documented
- [ ] **OWASP Kubernetes Top 10 Compliance Verified**
- [ ] **SlowMist MCP Security Checklist Compliance Verified**
- [ ] **Input Sanitization for complex K8s fields tested**

## Additional Resources

- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/security-checklist/)
- [Kubernetes Audit Logging](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
- [RBAC Documentation](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Secrets Management](https://kubernetes.io/docs/concepts/configuration/secret/)

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not create a public GitHub issue
2. Email: pmeet464@gmail.com
3. Include details of the vulnerability
4. Allow time for the issue to be addressed
5. Coordinate disclosure timeline

## Summary

The k8s-helm-mcp is designed with security as a foundational principle:

- **Credentials never exposed to Claude** - handled locally by the server
- **Protection modes prevent accidents** - enabled by default
- **TLS encryption for all communications** - secure by default
- **Audit logging for accountability** - complete operation trail
- **RBAC enforcement** - respects Kubernetes access controls
- **Memory-only credential storage** - no persistence of sensitive data

By following the security best practices outlined in this guide, you can ensure safe and secure operation of the k8s-helm-mcp in your environment.

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
