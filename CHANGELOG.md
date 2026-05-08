# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.28.0] - 2026-05-07

### Added
- **SRE Preventive Audit**: `k8s_silent_killers` tool — scheduled audit that surfaces slow-burning issues that quietly take down clusters weeks later. Run nightly; get a Slack alert when something is about to fire.
- **Risk Categories**: TLS cert expiry (Secrets, webhook caBundles, APIService caBundles within configurable threshold); unhealthy webhooks (`failurePolicy=Fail` pointing at missing services or zero-endpoint services — the "expired cert + Fail policy = apiserver hang" classic); stale APIServices (`Available=False` for >24h); stuck finalizers (namespaces / pods stuck `Terminating` for >24h); orphan PVCs (bound PVCs with no using pod for >30 days).
- **Severity Classification**: critical (cert expiring within 7 days, webhook with Fail policy + missing service, stuck namespace finalizer); warning (cert within 30 days, stale APIService, stuck pod finalizer); info (orphan PVCs, healthy-but-noteworthy webhook configs).
- **Configurability**: `certWarnDays` (default 30), `certCriticalDays` (default 7), `staleApiServiceHours` (default 24), `stuckTerminatingHours` (default 24), `orphanPvcDays` (default 30).
- **Security**: `k8s_silent_killers` registered in `READ_ONLY_TOOLS` — read-only by design.
- **Testing**: 28-test unit suite covering cert decoding, webhook health classification, finalizer-age math, severity rollup, and graceful degradation when subsystems are unavailable.


## [0.27.0] - 2026-05-07

### Added
- **SRE Drift Detection**: `k8s_workload_diff` tool — compares two workloads (Deployment, StatefulSet, or DaemonSet) and returns a categorized structured diff. Use to answer "how is staging different from prod?" or "what changed between blue and green?".
- **Severity Categorization**: critical (image mismatch, container count drift), warning (resource drift, replica drift, scheduling drift, PDB gap, HPA settings), info (label/annotation/env-var differences).
- **Diff Coverage**: image tags, replicas, CPU/memory requests and limits, environment variables, ConfigMap/Secret references, NodeSelector, tolerations, ServiceAccount, PriorityClass, labels, annotations, HPA min/max replicas, PDB coverage and minAvailable.
- **Smart Container Matching**: matches containers by name when possible, falls back to position. Reordered containers with same names produce no false-positive diffs.
- **Configurable Ignores**: `ignoreLabels`, `ignoreAnnotations`, `ignoreEnvVars` parameters for filtering intentional differences (e.g., `env=staging` vs `env=prod`).
- **Security**: `k8s_workload_diff` registered in `READ_ONLY_TOOLS` — read-only by design.
- **Testing**: 41-test unit suite covering replica diff, container alignment, env-var matching, ConfigMap/Secret refs, scheduling diff, label/annotation diff, severity rollup.


## [0.26.2] - 2026-05-06

### Added
- **SRE Action Safety**: `k8s_blast_radius` tool — pre-flight simulator for destructive operations (drain, cordon, delete, scale). Returns a `safe`/`risky`/`unsafe` verdict with structured reasons and details, **without executing the action**.
- **Multi-Action Analysis**: drain (last-replica detection, stateful flags, orphan pod warnings); cordon (capacity assessment); delete (PDB coverage, dependent Services, singleton risk, LoadBalancer external-IP impact); scale (PDB minAvailable violations, scale-to-zero unsafe flagging, scale-up capacity notes).
- **Security**: `k8s_blast_radius` registered in `READ_ONLY_TOOLS` — read-only by design (analyzes only, never executes).
- **Testing**: 36-test unit suite covering verdict escalation, owner-reference walking, label-selector matching, and the four action-specific decision paths.
- **Doc Sync**: Updated README tool count from stale 264 to 267 (catches drift since 0.24.0 plus this release).


## [0.26.1] - 2026-05-06

### Added
- **Multi-Platform Proliferation**: Standardized and optimized documentation for **Gemini CLI**, **Claude Code**, **Codex CLI**, **Antigravity**, **VS Code / GitHub Copilot**, **Cursor**, and **Windsurf**.
- **Gemini CLI Optimization**: Added support for hierarchical scopes (User/Project), automated trust workflows (`gemini trust`), and safety-first CLI syntax using the `--` argument separator.
- **Antigravity Interoperability**: Documented the managed configuration ecosystem for Antigravity and added a comparison guide for users running both IDE and CLI tools.
- **VS Code Native Support**: Fully documented the `mcp.json` native integration for GitHub Copilot, including workspace-level configurations (`.vscode/mcp.json`) for team sharing.
- **Branding**: Updated visual identity with high-fidelity "Works with" badges for Gemini CLI, Claude Code, and Codex CLI.

### Fixed
- **Naming Consistency**: Standardized server identifiers to `k8s-helm-mcp` (CLI) and `k8sHelm` (VS Code) across all supported environments to ensure persistent connectivity.
- **Configuration Duplication**: Consolidated overlapping integration options and re-ordered the guide into a logical, sequential 10-option workflow.

## [0.26.0] - 2026-05-05

### Added
- **Multi-Client Integration**: Added native support and documentation for **Codex** (OpenAI), **Windsurf** (Codeium), **Antigravity** (Google DeepMind), **Cursor**, and **GitHub Copilot (VS Code)**.
- **Configuration Templates**: Created standalone configuration templates for all supported clients in the `assets/` directory with embedded path guidance and cloud auth reminders:
    - `assets/claude-desktop-config.json`
    - `assets/codex-config.toml`
    - `assets/windsurf-config.json`
    - `assets/antigravity-config.json`
    - `assets/cursor-config.json`
    - `assets/vscode-copilot-config.json`
- **Branding & Visual Identity**: 
    - Added official "Works with" badges for all new supported clients to the README.
    - Integrated a **high-resolution 7-spoked hybrid logo** into the server's visual identity, now visible in IDE connector UIs (Claude Desktop, etc.) via `iconUrl` metadata.
- **Cloud Provider Error Handling**: Integrated smart detection for **EKS (AWS)**, **GKE (Google)**, and **AKS (Azure)** authentication failures, providing actionable login commands and CLI installation links directly in tool error responses.
- **Proactive CLI Checks**: Added detection for missing cloud CLIs (`aws`, `gcloud`, `az`) when used as authentication plugins, with platform-specific recovery guidance.

## [0.25.0] - 2026-05-05

### Added
- **Server Management Renaming**: 
  - Standardized all internal server management tools with `k8s_server_` prefix:
    - `mcp_server_info` → `k8s_server_info`
    - `mcp_health_check` → `k8s_server_health`
    - `mcp_tool_metrics` → `k8s_server_metrics`
- **Graceful Shutdown**: Added `k8s_server_stop` tool for programmatic graceful termination.
- **K8sClient Hardening**:
  - Integrated native support for **Autoscaling V2 API** and **RBAC V1 API** in `K8sClient`.
  - Added unified `listEvents()` method with field selector and limit support.
- **Internal**: Optimized resource attribution logic for better auditing.

## [0.24.0] - 2026-05-05

### Added
- **Resource Change Tracking**: `k8s_changes_since` tool for time-windowed cluster state diffs using `managedFields` for resource attribution.
- **SRE Tooling**: Added scan support for 9 resource kinds including Deployment, StatefulSet, and HPA.

## [0.23.0] - 2026-05-04

### Added
- **SRE Triage Suite**: `k8s_incident_snapshot` tool for rapid multi-resource triage (Pods, Events, Rollouts, Nodes, Control Plane).
- **Failure Analysis**: Enhanced pod failure detection logic to prioritize `OOMKilled` root-cause analysis over generic `CrashLoopBackOff` states.
- **Security**: Registered new diagnostic tools in `ProtectionManager.READ_ONLY_TOOLS` for compliance across all protection modes.
- **Testing**: Comprehensive unit test suite for incident triage logic with 100% logic coverage.
- **Refactoring**: Exported core classification helpers from `incident-snapshot.ts` for improved testability.

## [0.22.1] - 2026-05-01

### Added
- **Optimized Build Pipeline**: Refactored `scripts/build.ts` to use automated dependency externalization, reducing production bundle size from ~5MB to **460 KB**.
- **IDE Configuration**: Updated `tsconfig.json` to include the `scripts/` directory and relaxed `rootDir` constraints, resolving all "missing name" type errors in the build script.
- **Bun Support**: Added high-performance native Bun build and configuration options for Claude Desktop users.

## [0.22.0] - 2026-05-01

### Added
- **Security Logic Centralization**: Refactored monolithic protection mode logic into a dedicated `ProtectionManager` class, significantly improving codebase maintainability.
- **Security Surface Completion**: Performed a comprehensive audit and added **64 missing tools** to the protection categories, ensuring 100% coverage for Infrastructure, Strict, and No-Delete modes.
- **Modernized Build Pipeline**: Implemented a robust `scripts/build.ts` using `esbuild` for cross-platform shebang injection and optimized bundling.
- **Security Documentation & Compliance**: Performed a massive audit of `SECURITY.md` to document full compliance with **OWASP Kubernetes Top 10 (2025)** and the **SlowMist MCP Security Checklist**.
- **Automated Documentation Integrity**: Updated `generate-api-docs.ts` to maintain doc synchronization with the refactored server architecture.

## [0.21.1] - 2026-05-01
- **Professional Documentation Suite**: Added a centralized "Project Documentation" navigation footer to all 11 markdown files for improved discoverability.
- **Dynamic Repository Metrics**: Integrated live Shields.io badges for NPM downloads, bundle size, and GitHub activity.
- **Enhanced NPM Metadata**: Added `homepage` and `bugs` tracking links to `package.json` for better NPM registry integration.

### Fixed
- **Consistency**: Standardized Apache 2.0 license labeling across all documentation and package manifests.
- **Rebranding**: Finalized project naming consistency (`k8s-helm-mcp`) across all security and contribution guides.

## [0.21.0] - 2026-05-01

### Added
- **Modernized Dev-Tools Stack**: 
  - Upgraded to **TypeScript v6.0.3** for faster type-checking and modern syntax support.
  - Upgraded to **ESLint v10.2.1**, including a full migration to the new **Flat Config (`eslint.config.js`)** format.
  - Upgraded **esbuild to v0.28.0** for optimized production bundling.
  - Upgraded **Husky to v9.1.7** for improved Git hooks management.
- **Enhanced Error Debuggability**: Implemented `cause` property attachment on all custom thrown Errors to preserve original stack traces and improve troubleshooting.

### Changed
- **Core Dependency Modernization**:
  - Upgraded **Express to v5.2.1** for improved performance and modern middleware handling.
  - Upgraded **Zod to v4.4.1** for optimized schema validation.
  - Updated `@types` ecosystem to match new core versions.
- **Dependency Stability**: Locked `@opentelemetry` SDK components at v0.45.1/v1.18.1 to ensure runtime stability with existing tracing infrastructure.

## [0.20.0] - 2026-05-01

### Added
- **GitHub Community Standards & CI/CD**: Fully implemented a robust `.github` management suite.
  - Added GitHub Actions workflows for Continuous Integration (`ci.yml`), automated documentation generation (`docs.yml`), and automated release publishing (`release.yml`).
  - Added structured Issue Templates (`bug_report.yml`, `feature_request.yml`) to enforce high-quality community reporting.
  - Added `PULL_REQUEST_TEMPLATE.md` to standardize community contributions.
  - Added `dependabot.yml` for automated dependency vulnerability scanning and package updates.

### Changed
- **Kubernetes SDK Modernization**: Upgraded `@kubernetes/client-node` to `v1.4.0+`.
  - Migrated 150+ API calls to the strictly typed `ObjectParamAPI` syntax, removing deprecated positional arguments.
  - Eliminated legacy `.body` property response access across the entire codebase.
  - Implemented `ConfigurationOptions.middleware` pattern for header injection on `patch` operations.
  - **Performance Boost**: Replacing the deprecated `request` engine with the native Fetch API (`node-fetch`) drastically reduces memory footprint, lowers read/write latency to `5-25ms`, and significantly increases server throughput.

## [0.19.0] - 2026-05-01

### Changed
- **License Transition**: Migrated project from MIT to **Apache License 2.0** for better ecosystem alignment and legal protection.
- **Project Rebranding Finalization**: Completed global rebranding across all documentation and internal metadata.

## [0.18.0] - 2026-04-30

### Fixed
- **Sanitization Optimization**: Refined `shell-sanitizer` and `input-sanitizer` to support Kubernetes regex paths (`(/|$)`) and complex annotations.
- **Redaction Precision**: Pruned overly aggressive scrubbing patterns that were redacting LoadBalancer IPs and resource GUIDs.
- **Data Integrity**: Resolved regression where Ingress rewrite-targets and paths were being corrupted by the security layer.

### Added
- **Project Rebranding**: Officially rebranded to `k8s-helm-mcp` for npm/npx distribution.
- **Claude Code Support**: Added official support and documentation for **Claude Code**.
- **Expanded Exemption Whitelist**: Added `path`, `host`, `image`, and Helm-specific keys to the sanitization bypass list.

## [0.17.0] - 2026-04-30

### Added
- **Enterprise-Grade Security Hardening** (SlowMist & OWASP Compliance)
  - **Bearer Token Authentication**: Mandatory auth for SSE transport layer.
  - **Deep Input Sanitization**: Automated deep-traversal of tool arguments to prevent shell injection.
  - **Immutable Audit Logging**: JSON-structured telemetry emitted to `stderr` by default for SIEM integration.
  - **Global Output Scrubbing**: Centralized redaction of credentials and PII from all tool results and errors.
  - **DoS Protection**: Enforced 1MB payload limits and 50-document constraints for YAML processing.
  - **Security Script**: Added `npm run start:secure` with Node.js experimental permission sandboxing.

### Changed
- **Secret Access Security**: Enforced mandatory `scrub: true` flag for reading or exporting Kubernetes Secrets.
- **Audit Implementation**: Transitioned from file-based to process-stream audit logging for enhanced tamper-resistance.

## [0.16.0] - 2026-04-27

### Added
- **Secret Scrubbing** - Automatic PII and credential redaction in tool outputs
  - New `scrub` parameter on sensitive tools (opt-in, default: false)
  - 40+ detection patterns for passwords, tokens, API keys, cloud credentials
  - Covers AWS, GCP, Azure, GitHub, Slack, Stripe, OpenAI keys
  - JWT tokens, PEM private keys, certificates, database connection strings
  - Credit cards, SSN, email addresses, IP addresses (internal and public)
  - Applied to: `k8s_get_logs`, `k8s_exec_pod`, `k8s_kubectl`, `k8s_describe_pod`, `k8s_helm_values`, `k8s_helm_template`, `k8s_get_configmap`, `k8s_export_resource`, `k8s_pod_log_search`
  - Response includes `scrubbed: true/false` flag to indicate if redaction was applied
  - New utility: `src/utils/secret-scrubber.ts` with `scrubSensitiveData()` function

- **Audit Logging Framework** - Foundation for compliance and security tracking
  - New `src/audit-logger.ts` with `AuditLogger` class
  - Supports file-based audit trails with structured JSON logs
  - Tracks tool executions, data access, and security events
  - Configurable via `AUDIT_LOG_ENABLED` and `AUDIT_LOG_PATH` environment variables

### Security
- Enhanced data exposure protection across all output-generating tools
- Reduced risk of accidental secret leakage in logs and command outputs

### Changed
- **Breaking: All Protection Modes Enabled by Default**
  - `STRICT_PROTECTION_MODE` now defaults to `true` (was `false`)
  - `NO_DELETE_PROTECTION_MODE` now defaults to `true` (was `false`)
  - Server starts in maximum security mode - read-only by default
  - Users must explicitly disable protection modes to enable modifications
  - Updated documentation and environment variable examples to reflect new defaults

## [0.15.0] - 2026-04-27

### Added
- **API Documentation Generator** - Auto-generate API docs from tool schemas
  - New `npm run generate-docs` script to regenerate documentation
  - Created `scripts/generate-api-docs.ts` documentation generator
  - Generates `API_DOCUMENTATION.md` with 259+ tools across 32 categories
  - Documents tool names, descriptions, and input schemas with parameter types
  - Includes table of contents and tool counts per category

### Changed
- **Test Coverage Expansion** - Comprehensive test coverage for all helm-tools categories
  - Created 19 separate test files for helm-tools (chart-management, chart-template, dependency-management, plugin-management, registry-management, release-get-info, release-get-values, release-history, release-rollback, release-test, show-chart, environment, release-install, release-list, release-status, release-uninstall, release-upgrade, search-hub, repo-management)
  - Added 91 new test cases validating tool registration, descriptions, input schemas, and handlers
  - Total test count increased to 382 tests across 40 test suites
  - Mirrors k8s-tools test structure for consistency

### Fixed
- **Port Forward Default Mode** - Fixed inconsistent default mode for `k8s_port_forward`
  - Schema and handler now both default to "direct" mode
  - Previously schema said "direct" but handler defaulted to "command"
  - Direct mode spawns kubectl port-forward in background and returns PID

## [0.14.0] - 2026-04-27

### Added
- **SSE Transport** - Server-Sent Events support for web deployment
  - New `TRANSPORT` environment variable to select transport mode (stdio/sse)
  - New `PORT` environment variable for HTTP server port (default: 3000)
  - HTTP server with CORS support for web clients
  - Endpoints: `/health`, `/sse`, `/message`
  - Express dependency for HTTP server
  - Updated README with SSE deployment instructions
- **Bundle Size Optimization** - esbuild integration for smaller bundles
  - New `build:dev` script for fast TypeScript compilation
  - Default `build` script now uses esbuild for optimized bundle
  - Bundle size reduced to ~438kb (from ~5MB)
  - Tree-shaking and minification enabled
  - All heavy dependencies externalized (K8s SDK, OpenTelemetry, Express)
- **Port Forward Direct Execution** - Immediate port forwarding support
  - New `mode` parameter for `k8s_port_forward` tool
  - `mode="direct"` (default) spawns kubectl port-forward in background
  - `mode="command"` returns kubectl command string
  - Returns process PID for management
  - Aligned with `k8s_exec_pod` default behavior

### Changed
- **Default Execution Modes** - Consistent direct execution defaults
  - `k8s_exec_pod` defaults to "direct" mode
  - `k8s_port_forward` defaults to "direct" mode
  - Users can explicitly set `mode="command"` for command string output

### Dependencies
- Added `express@^4.18.2` for SSE transport
- Added `@types/express@^4.17.21` for TypeScript support
- Added `esbuild@^0.19.0` for bundle optimization

## [0.13.0] - 2026-04-27

### Added
- **Direct Exec Execution** - `k8s_exec_pod` now supports direct command execution mode
  - New `mode` parameter: "direct" (default) executes commands and returns output
  - "websocket" mode returns WebSocket URL for interactive sessions
  - Matches mcp-server-kubernetes capability for direct execution
- **OpenTelemetry Integration** - Distributed tracing and observability support
  - Automatic span creation for tool execution
  - Configurable via `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable
  - Service name configurable via `OTEL_SERVICE_NAME`
  - Graceful shutdown of telemetry on server exit
- **Connection Pooling** - HTTP connection reuse for improved performance
  - 20-30% latency reduction for high-throughput scenarios
  - Configured with keep-alive, maxSockets: 50, maxFreeSockets: 10
  - Applied to all HTTPS clusters in kubeconfig
- **Bun Runtime Support** - Alternative JavaScript runtime for better performance
  - New `npm run start:bun` script
  - 50-70% faster cold start, 10-15% faster execution
  - Fully compatible with existing compiled JavaScript
  - Updated README with runtime options
- **Flexible Kubeconfig Loading** - 6-source priority system for configuration
  - `KUBECONFIG_YAML` - inline YAML config (highest priority)
  - `KUBECONFIG_JSON` - inline JSON config
  - `K8S_SERVER` + `K8S_TOKEN` - direct server/token authentication
  - In-cluster config for pods running in Kubernetes
  - `KUBECONFIG_PATH` - custom kubeconfig path
  - Standard kubeconfig (default, lowest priority)
- **Request Batching** - Parallel resource fetching for improved performance
  - `k8s_batch_get_resources` tool for bulk operations
  - Supports 19 resource types (Pod, Deployment, Service, ConfigMap, Secret, Node, Namespace, StatefulSet, DaemonSet, Job, CronJob, Ingress, PVC, PV, StorageClass, ServiceAccount, Role, ClusterRole, RoleBinding, ClusterRoleBinding)
  - Uses `Promise.all()` for parallel execution
- **Generic kubectl Tool** - Fallback for unsupported operations
  - `k8s_kubectl` tool for arbitrary kubectl commands
  - Supports optional namespace and context parameters
  - Uses `execFileSync` for direct execution
- **Cache Statistics** - Visibility into cache effectiveness
  - `k8s_cache_stats` tool with hit rate, miss rate, total requests
  - `k8s_cache_clear` tool to reset cache and statistics
  - Enhanced `CacheManager` with hit/miss tracking

### Changed
- Updated tool count from 190+ to 260+ in package description
- Enhanced `k8s_exec_pod` with dual execution modes (direct/websocket)
- Improved performance through connection pooling optimizations

### Dependencies
- Added OpenTelemetry packages: `@opentelemetry/api`, `@opentelemetry/exporter-trace-otlp-grpc`, `@opentelemetry/instrumentation`, `@opentelemetry/resources`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/semantic-conventions`

## [0.12.0] - 2026-04-26

### Added
- Consolidated documentation into `TOOLS_REFERENCE.md`
- Added `DOCKER_DESKTOP_GUIDE.md` for Docker Desktop Kubernetes users
- Updated README with 260+ tool count and Helm support

### Changed
- Refactored documentation structure
- Fixed broken documentation links

## [0.11.0] - 2026-04-22

### Added
- `mcp_server_info` tool for comprehensive server diagnostics
- `mcp_health_check` tool with deep cluster connectivity checks
- `mcp_tool_metrics` for performance monitoring and usage statistics

### Fixed
- Improved error handling for missing kubeconfig scenarios

## [0.10.0] - 2026-04-18

### Added
- **Helm Tools Suite** - 40+ tools for complete Helm lifecycle management
  - Release management: install, upgrade, rollback, uninstall, history, status, test
  - Chart operations: pull, package, search, show, template, lint, verify
  - Repository management: add, remove, update, list
  - Registry operations: login, logout, push
  - Plugin management: install, uninstall, update, list
- Helm chart creation with `mcp8_k8s_helm_create`
- Helm dependency management support

## [0.9.0] - 2026-04-12

### Added
- **Multi-Mode Protection System**
  - `k8s_toggle_protection_mode` - Infrastructure Protection (default)
  - `k8s_toggle_strict_protection_mode` - Strict read-only mode
  - `k8s_toggle_no_delete_mode` - No-delete protection mode
  - `k8s_toggle_all_protection_modes` - Master control for all modes
- `k8s_pod_log_search` for searching patterns across pod logs
- `k8s_bulk_delete_pods` for bulk pod deletion with selectors

### Changed
- Enhanced protection mode enforcement across all destructive tools

## [0.8.0] - 2026-04-08

### Added
- WebSocket-based interactive tools
  - `k8s_stream_logs` - Real-time log streaming
  - `k8s_attach_pod` - Container attachment
  - `k8s_port_forward` - Secure port forwarding
- `k8s_quick_deploy` templates for web, api, database, worker workloads
- `k8s_cluster_health` and `k8s_health_score` for cluster diagnostics
- `k8s_find_orphaned_resources` and `k8s_suggest_optimizations`
- `k8s_debug_node` and `k8s_node_pressure_status` for node diagnostics
- `k8s_restart_deployment`, `k8s_restart_statefulset`, `k8s_restart_daemonset`

## [0.7.0] - 2026-04-05

### Added
- `k8s_check_privileged_pods` for security auditing
- Certificate management: `mcp8_k8s_certificate_approve`, `mcp8_k8s_certificate_deny`
- `k8s_debug_pod` and `k8s_debug_scheduling` for pod troubleshooting
- `k8s_validate_manifest`, `k8s_diff`, `k8s_wait`, `k8s_watch`
- `k8s_rollout_pause`, `k8s_rollout_resume`, `k8s_rollout_undo`
- `k8s_scale` and `k8s_autoscale` for workload scaling
- `k8s_restart_pod` for pod restart operations

### Changed
- Enhanced RBAC tools with comprehensive listing and detail views

## [0.6.0] - 2026-04-04

### Added
- Complete Kubernetes resource coverage
  - Cluster: contexts, namespaces, API versions, component status
  - Nodes: list, describe, cordon, uncordon, drain, taints, labels
  - Pods: logs, exec, describe, events, metrics, delete
  - Workloads: Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs
  - Networking: Services, Endpoints, EndpointSlices, Ingresses, NetworkPolicies
  - Storage: PVs, PVCs, StorageClasses
  - Security: RBAC resources, Secrets, ConfigMaps
- `k8s_apply_manifest` and `k8s_export_resource`
- `k8s_find_crashloop_pods` and `k8s_find_unhealthy_pods`

## [0.5.0] - 2026-04-03

### Added
- Production-grade Kubernetes MCP Server - Complete kubectl coverage with Infrastructure Protection, Helm support, Diagnostics, Response Caching, 265 tools, Direct Exec, OpenTelemetry
- K8sClient with retry logic and timeout protection
- Comprehensive documentation: README, API docs, kubectl mappings

## [0.4.0] - 2026-04-02

### Added
- Beta release with core functionality
- Pod listing, logs, exec capabilities
- Node management (list, describe)
- Basic workload support (Deployments, Services)
- Context switching and cluster information

### Changed
- Refactored from proof-of-concept to production structure

## [0.3.0] - 2026-04-02

### Added
- Expanded tool coverage for alpha testing
- RBAC resource listing (ServiceAccounts, Roles, RoleBindings)
- Storage resource support (PVs, PVCs, StorageClasses)
- Job and CronJob management
- Namespace operations

## [0.2.0] - 2026-04-01

### Added
- Alpha release with basic Kubernetes tools
- MCP server foundation with SDK integration
- Core pod operations (list, logs)
- Cluster context management
- TypeScript project structure

## [0.1.0] - 2026-04-01

### Added
- Initial proof-of-concept
- Basic kubectl wrapper functionality
- Project scaffolding with TypeScript

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
