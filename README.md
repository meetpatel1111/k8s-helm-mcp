<p align="center">
  <img src="assets/logo.png" width="300" alt="k8s-helm-mcp v0.30.0 logo">
</p>

# k8s-helm-mcp

[![npm version](https://img.shields.io/npm/v/k8s-helm-mcp.svg)](https://www.npmjs.com/package/k8s-helm-mcp)
[![npm downloads](https://img.shields.io/npm/dm/k8s-helm-mcp.svg)](https://www.npmjs.com/package/k8s-helm-mcp)
[![npm total downloads](https://img.shields.io/npm/dt/k8s-helm-mcp.svg)](https://www.npmjs.com/package/k8s-helm-mcp)
[![GitHub Stars](https://img.shields.io/github/stars/meetpatel1111/k8s-helm-mcp.svg)](https://github.com/meetpatel1111/k8s-helm-mcp/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/meetpatel1111/k8s-helm-mcp.svg)](https://github.com/meetpatel1111/k8s-helm-mcp/network/members)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/k8s-helm-mcp)](https://bundlephobia.com/package/k8s-helm-mcp)
[![Node.js Version](https://img.shields.io/node/v/k8s-helm-mcp.svg)](https://nodejs.org/)
[![GitHub last commit](https://img.shields.io/github/last-commit/meetpatel1111/k8s-helm-mcp)](https://github.com/meetpatel1111/k8s-helm-mcp/commits/main)
[![Works with Claude Desktop](https://img.shields.io/badge/Works_with-Claude_Desktop-blue?logo=anthropic)](https://modelcontextprotocol.io/)
[![Works with Claude Code](https://img.shields.io/badge/Works_with-Claude_Code-black?logo=anthropic)](https://code.claude.com/)
[![Works with Gemini CLI](https://img.shields.io/badge/Works_with-Gemini_CLI-blue?logo=google)](https://geminicli.com/)
[![Works with Antigravity](https://img.shields.io/badge/Works_with-Antigravity-purple?logo=google)](https://antigravity.google/)
[![Works with Cursor](https://img.shields.io/badge/Works_with-Cursor-00c198?logo=cursor)](https://cursor.com/)
[![Works with Windsurf](https://img.shields.io/badge/Works_with-Windsurf-blue?logo=codeium)](https://codeium.com/windsurf)
[![Works with VS Code](https://img.shields.io/badge/Works_with-VS_Code-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![Works with Codex](https://img.shields.io/badge/Works_with-Codex-black?logo=openai)](https://openai.com/)
[![Works with Codex CLI](https://img.shields.io/badge/Works_with-Codex_CLI-black?logo=openai)](https://openai.com/)

Production-grade Kubernetes MCP (Model Context Protocol) Server v0.30.0 - Complete cluster management via Model Context Protocol with Helm support, multi-mode protection, Native Pre-Flight Simulation & Dry-Run Engine (`dryRun: none | client | server`), Universal Query Helper & Pagination (`limit`, `continue`, `sortBy`, `outputFormat`), Universal Deletion Safety (`propagationPolicy`, `gracePeriodSeconds`, `ignoreNotFound`), Kubernetes v1.37 Alignment, Enterprise Security Hardening, Secret Scrubbing, Audit Logging, Direct Exec, OpenTelemetry, Bun runtime, SSE Transport, and Bundle Optimization.

> [!TIP]
> **Status:** This package works brilliantly with **Claude Desktop**, **Claude Code**, **Gemini CLI**, **Codex**, **Codex CLI**, **Windsurf**, **Antigravity**, **Cursor**, and **GitHub Copilot**! For most clients, you can add it using `npx -y k8s-helm-mcp`.

> [!NOTE]
> **SSE Feature:** The SSE transport feature is currently in development and should be considered experimental.

## Overview

This MCP server provides comprehensive Kubernetes cluster management capabilities, exposing kubectl/kubelet/API server functionality through the Model Context Protocol. It enables AI assistants and MCP clients to interact with Kubernetes clusters programmatically with enterprise safety guarantees.

## Features

### 269 Kubernetes & Helm Management Tools

| Category | Tools |
|----------|-------|
| **Cluster & Context** | List contexts, switch context, cluster version (k8s v1.37 aligned), component status, cluster health, API latency check |
| **Node Management** | List nodes, node details, cordon/uncordon, drain, taints, labels, pressure status, debug (all mutation tools with `dryRun` pre-flight simulation) |
| **Pod Management** | List pods (with pagination & sorting), pod details, logs, stream logs, search logs, exec, attach, delete (with deletion safety), debug, scheduling analysis, failure analysis |
| **Workloads** | Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs, scaling, rolling restart, rollout management, autoscaling (with mutation `dryRun`) |
| **Networking** | Services, endpoints, ingresses, network policies, DNS test, service topology (all with pagination, sorting & dry-run safety) |
| **Storage** | PersistentVolumes, PVCs, StorageClasses, unbound PVC detection, storage summary (with deletion safety) |
| **Security & RBAC** | ServiceAccounts, Roles, ClusterRoles, RoleBindings, ClusterRoleBindings, Secrets, ConfigMaps, privileged pod detection, certificates, **Secret Scrubbing** (PII/credential redaction) |
| **Monitoring** | Events, resource quotas, limit ranges, crash loop detection, pod/node metrics, health score, optimization suggestions |
| **SRE** | Incident snapshot, changes-since triage, blast radius simulation, workload diff (drift detection), silent killers (preventive audit) |
| **Safety & Dry-Run** | **Native Pre-Flight Simulation** (`client` & `server` dry-run) on all 20+ delete tools, 22 create tools, and operational mutation tools; deletion grace periods, propagation policies, and idempotent `ignoreNotFound` |
| **Query & Pagination** | **Universal Query Engine** across all GET/LIST tools (`limit`, `continue`, `sortBy`, `sortOrder`, `outputFormat: json \| yaml`, `subresource`) |
| **Configuration** | Apply manifests, export YAML, validate manifests, namespace management, patch, edit, diff, wait, watch |
| **Advanced** | Raw API queries, pod failure analysis, bulk operations, orphaned resource detection, resource age reports |
| **Helm** | 40+ tools for releases, charts, repos, plugins, registry (install, upgrade, rollback, lint, template, search) |
| **Visual & Cloud** | **Integrated Logo** (iconUrl support), **Proactive Cloud Auth** (EKS/GKE/AKS smart detection), CLI dependency guidance |
| **Server Management** | Server info, health checks, tool metrics, graceful stop, protection mode toggles |

## Quick Start

### Prerequisites

- **Node.js 18+** (Latest LTS recommended for best performance) OR **Bun 1.0+**
- **kubectl** installed and configured
- **Git** installed
- **Helm** (optional, required for Helm tools)

### Runtime Options

This server supports two JavaScript runtimes:

**Node.js (default):**
```bash
npm install
npm run build
npm start
```

**Bun (faster cold start, better performance):**
```bash
bun install
npm run build:bun  # High-performance Bun bundling
npm run start:bun
```

Bun provides 50-70% faster cold start and 10-15% faster execution for ephemeral deployments.

### Build Options

**Optimized build (default, production):**
```bash
npm run build
```
- Uses esbuild for tree-shaking and minification
- Bundle size: ~480kb
- Best for production deployment

**High-performance Bun build:**
```bash
npm run build:bun
```
- Uses Bun's native bundler for extreme speed
- Bundle size: ~480kb
- Optimized for users with the Bun runtime

**Fast build (development):**
```bash
npm run build:dev
```
- TypeScript compilation only
- Bundle size: ~5MB
- Faster builds, easier debugging

### Optional: Install Helm

The MCP server includes Helm tools for managing Helm charts. To use these features, install Helm:

**Windows:**
```powershell
winget install Helm.Helm
```

**macOS:**
```bash
brew install helm
```

**Linux:**
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

Verify installation:
```bash
helm version
```

### Installation & Usage

There are two ways to use the k8s-helm-mcp:

#### Option 1: Instant Usage (via npx - Recommended)

The easiest way to run the server is using `npx`. No cloning or manual building required.

```bash
npx k8s-helm-mcp
```

#### Option 2: Local Development

1. **Clone the repository**:
```bash
git clone https://github.com/meetpatel1111/k8s-helm-mcp.git
cd k8s-helm-mcp
```

2. **Install dependencies**:
```bash
npm install
```

3. **Build the project**:
```bash
npm run build
```

4. **Start the server**:
```bash
npm start
```

### Quick Start Examples

#### Workflow 1: Check Cluster Health

**Goal:** Quickly assess the overall health of your Kubernetes cluster

**Steps:**
1. Ask Claude: "What's the health of my cluster?"
2. Claude will automatically:
   - Check cluster health status
   - Verify node availability
   - Check for unhealthy pods
   - Provide a health score

**Expected result:** Summary of cluster status with any issues highlighted

#### Workflow 2: Deploy a Simple Application

**Goal:** Deploy nginx with 3 replicas and expose it as a service

**Steps:**
1. Ask Claude: "Deploy nginx with 3 replicas in the default namespace and expose it on port 80"
2. Claude will:
   - Create the deployment
   - Create a service to expose it
   - Verify the deployment is running
   - Show you the service endpoint

**Expected result:** Running nginx deployment with service accessible

#### Workflow 3: Debug a Failing Pod

**Goal:** Investigate why a pod is crashing

**Steps:**
1. Ask Claude: "My pod my-app-pod is failing, can you help debug it?"
2. Claude will:
   - Check pod status and events
   - Retrieve recent logs
   - Analyze the failure
   - Suggest fixes

**Expected result:** Diagnosis of the issue with recommended solutions

#### Workflow 4: Scale an Application

**Goal:** Increase replicas to handle more traffic

**Steps:**
1. Ask Claude: "Scale the web-app deployment to 5 replicas"
2. Claude will:
   - Check current replica count
   - Scale to 5 replicas
   - Verify the scaling completed
   - Show pod status

**Expected result:** Deployment scaled to 5 replicas

#### Workflow 5: Install a Helm Chart

**Goal:** Install Prometheus using Helm

**Steps:**
1. Ask Claude: "Install the Prometheus Helm chart in the monitoring namespace"
2. Claude will:
   - Add the Prometheus Helm repository
   - Install the chart
   - Verify the installation
   - Provide access information

**Expected result:** Prometheus installed and running

#### Workflow 6: Clean Up Failed Resources

**Goal:** Remove all failed pods from a namespace

**Steps:**
1. Ask Claude: "Clean up all failed pods in the staging namespace"
2. Claude will:
   - List failed pods
   - Delete them in bulk
   - Confirm cleanup

**Expected result:** Failed pods removed

#### Workflow 7: Check Resource Usage

**Goal:** Monitor CPU and memory usage of pods

**Steps:**
1. Ask Claude: "Show me resource usage for all pods in the default namespace"
2. Claude will:
   - Retrieve metrics for all pods
   - Display CPU and memory usage
   - Highlight any resource-intensive pods

**Expected result:** Resource usage table for all pods

#### Workflow 8: Update a Deployment Image

**Goal:** Update a deployment to use a new image version

**Steps:**
1. Ask Claude: "Update the web-app deployment to use nginx:1.25"
2. Claude will:
   - Update the deployment image
   - Monitor the rollout
   - Verify the new pods are running
   - Show rollout status

**Expected result:** Deployment updated with new image

### Configure Your MCP Client

#### Option 1: Claude Desktop

1. **Open Settings**: Press `Cmd + ,` (Mac) or `Ctrl + ,` (Windows/Linux)
2. **Go to Developer → Edit Config** (or manually open `%APPDATA%\Claude\claude_desktop_config.json`)

> [!TIP]
> **Microsoft Store Users:** If you installed Claude via the Microsoft Store, the config file is located at:
> `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`
> *(Note: The package folder name may vary, e.g., `Claude_pzs8sxrjxfjjc` or `AnthropicClaude_...`)*

3. **Add this configuration**:

**Using npx (Recommended - No path required):**
```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "npx",
      "args": ["-y", "k8s-helm-mcp"]
    }
  }
}
```

**Using bunx (Faster - Bun required):**
```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "bunx",
      "args": ["k8s-helm-mcp"]
    }
  }
}
```

**Using Local Build (Mac/Linux Node.js):**
```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "node",
      "args": ["/path/to/k8s-helm-mcp/dist/index.js"]
    }
  }
}
```

**Using Local Build (Windows Node.js):**
```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\k8s-helm-mcp\\dist\\index.js"]
    }
  }
}
```

**Using Local Build (Bun):**
```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "bun",
      "args": ["/path/to/k8s-helm-mcp/dist/index.js"]
    }
  }
}
```

> Each block above is a **complete, working config**. Only `command` and `args` are required — no environment variables are needed to start.

##### Optional: environment variables

The server needs **no** environment variables to run — it auto-discovers your kubeconfig from `~/.kube/config` (`%USERPROFILE%\.kube\config` on Windows). Add an `env` block only when you want to override a default. This annotated example is a normal config (all values shown are optional):

```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "npx",
      "args": ["-y", "k8s-helm-mcp"],
      "env": {
        "KUBECONFIG": "C:\\path\\to\\your\\.kube\\config",
        "K8S_TOOLSETS": "readonly"
      }
    }
  }
}
```

| `env` variable | Required? | Purpose |
|----------------|-----------|---------|
| `KUBECONFIG` | Optional | Path to kubeconfig, if not at the default location |
| `K8S_TOOLSETS` | Optional | Limit which tools are exposed — `readonly`, `kubernetes`, `helm`, `core`, `lean`, … (default: `all`). See [Toolsets](#toolsets-tool-selection) |
| `K8S_DISABLED_TOOLSETS` | Optional | Remove specific categories after selection |
| `INFRA_PROTECTION_MODE` / `STRICT_PROTECTION_MODE` / `NO_DELETE_PROTECTION_MODE` | Optional | Runtime safety guards (all default **on**) |
| `K8S_MAX_SOCKETS` / `K8S_KEEPALIVE_MS` | Optional | Tune the API-server connection pool (defaults `50` / `30000`) |
| `MCP_AUTH_TOKEN` | Optional | Bearer token for the SSE/HTTP transport (auto-generated if unset) |

> **Every variable above is optional**, so a minimal `command` + `args` config is fully functional. Enterprises typically add just `K8S_TOOLSETS` (e.g. `readonly`) to ship a least-privilege surface. The same `env` block works in every client below (Cursor, Windsurf, VS Code, etc.) — only the surrounding `command`/`args` change.

4. **Save and Restart Claude Desktop**
5. **Test it**: Ask Claude "List my Kubernetes pods"

#### Option 2: VS Code / GitHub Copilot
 
 GitHub Copilot in VS Code supports MCP servers **natively**. You can configure this either via the UI (easiest) or manually.
 
 **Direct Setup (Recommended):**
 1. Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).
 2. Type and select **"MCP: Add Server"**.
 3. Provide a name (e.g., `k8s-helm-mcp`) and the command: `npx -y k8s-helm-mcp@latest`.
 
 **Manual Configuration:**
 
 **1. User Level (Global):**
 Add to your global `mcp.json` (accessible via **"MCP: Open User Configuration"**):
 ```json
 {
   "servers": {
     "k8sHelm": {
       "type": "stdio",
       "command": "npx",
       "args": ["-y", "k8s-helm-mcp@latest"]
     }
   }
 }
 ```
 
 **2. Workspace Level (Project-Specific):**
 Create a file at **`.vscode/mcp.json`** in your project root. This is ideal for team sharing:
 ```json
 {
   "servers": {
     "k8sHelm": {
       "type": "stdio",
       "command": "npx",
       "args": ["-y", "k8s-helm-mcp@latest"]
     }
   }
 }
 ```
 
 **Default Paths:**
 - **User Configuration:** `%USERPROFILE%\AppData\Roaming\Code\User\globalStorage\github.copilot-chat\mcp.json`
 - **Workspace-specific:** `.vscode/mcp.json`
 
 > [!TIP]
 > **Discovery:** VS Code can automatically discover servers from other apps like Claude Desktop if `chat.mcp.discovery.enabled` is set to `true` in your VS Code settings.

#### Option 3: Cursor

Cursor uses a `mcp.json` file for configuration.

**Default Paths:**
- **Global:** `%USERPROFILE%\.cursor\mcp.json`
- **Project-Specific:** `.cursor/mcp.json` (in your project root)

**Configuration:**
Add this to your `mcp.json`:

```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "npx",
      "args": ["-y", "k8s-helm-mcp"],
      "env": {
        "KUBECONFIG": "C:\\path\\to\\your\\.kube\\config"
      }
    }
  }
}
```

> [!NOTE]
> The `env` block is **optional** — omit it entirely to auto-detect `~/.kube/config`. You can also add `K8S_TOOLSETS`, protection modes, etc. here; see [Optional: environment variables](#optional-environment-variables).

> [!TIP]
> **UI Access:** Go to **Cursor Settings** (Ctrl + ,) > **Features** > **MCP** (or **Tools & MCP** in some versions) and click **Add New MCP Server**.
> **Debugging:** Press `Ctrl + Shift + P` and search for **Developer: Show Logs...** > **MCP Logs** if the server connection dot is not green.

#### Option 4: Claude Code (CLI)
 
 Claude Code supports MCP servers natively with three levels of configuration scope.
 
 **CLI Configuration (Recommended):**
```bash
# Quick Setup (Default scope)
claude mcp add k8s-helm-mcp -- npx -y k8s-helm-mcp@latest

# Global Setup (Current User)
claude mcp add --scope user k8s-helm-mcp -- npx -y k8s-helm-mcp@latest

# Project Setup (Current Directory Only)
claude mcp add --scope project k8s-helm-mcp -- npx -y k8s-helm-mcp@latest
```
 
 **Manual Configuration (`~/.claude.json`):**
 ```json
 {
   "mcpServers": {
     "k8s-helm-mcp": {
       "command": "npx",
       "args": ["-y", "k8s-helm-mcp@latest"]
     }
   }
 }
 ```


#### Option 5: OpenAI Codex

Codex uses a unified configuration system for both the CLI and the IDE extension, primarily using the **TOML** format.

**Default Paths:**
- **Global (Windows):** `%USERPROFILE%\.codex\config.toml`
- **Global (macOS/Linux):** `~/.codex/config.toml`
- **Project-scoped:** `.codex/config.toml` (in your project root)

**Configuration:**
Add this to your `config.toml`:

```toml
[mcp_servers.k8s-helm-mcp]
command = "npx"
args = ["-y", "k8s-helm-mcp"]
env = { KUBECONFIG = "C:\\path\\to\\your\\.kube\\config" }
```

**How to Open and Edit:**
- **Via Extension:** In VS Code, click the **Gear Icon** in the Codex sidebar and select **Codex Settings > Open config.toml**.
- **Via CLI:** You can manage servers directly using terminal commands:
    ```bash
    codex mcp list                       # See all configured servers
    codex mcp add k8s-helm-mcp --command="npx" --args="-y,k8s-helm-mcp"
    codex mcp remove k8s-helm-mcp        # Remove a server
    ```

> [!TIP]
> **TUI Verification:** You can verify if the server is active by typing `/mcp` in the Codex CLI TUI.
> **Restart Required:** If you edit the `config.toml` file manually, you must restart the Codex session (or reload the VS Code window) for changes to take effect.

#### Option 6: Windsurf

Windsurf (by Codeium) uses `mcp_config.json` for MCP configuration.

**Default Paths:**
- **Windows:** `%USERPROFILE%\.codeium\windsurf\mcp_config.json`
- **macOS/Linux:** `~/.codeium/windsurf/mcp_config.json`

**Configuration:**
Add this to your `mcp_config.json`:

```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "npx",
      "args": ["-y", "k8s-helm-mcp"],
      "env": {
        "KUBECONFIG": "C:\\path\\to\\your\\.kube\\config"
      }
    }
  }
}
```

> [!NOTE]
> `KUBECONFIG` is **optional** (auto-detected if omitted). Add other optional vars like `K8S_TOOLSETS=readonly` in the same `env` block — see [Optional: environment variables](#optional-environment-variables).

> [!TIP]
> **Refresh Needed:** After saving the file, click the **Refresh** button (circular arrow) in the Windsurf MCP panel to see the new tools.
> **Variables:** Windsurf supports `${env:VARIABLE_NAME}` interpolation in the `env` section.



#### Option 7: Gemini CLI

Gemini CLI supports MCP servers via a hierarchical configuration system. Note that it uses a strict namespace format (`mcp_{serverName}_{toolName}`).

**CLI Configuration (Recommended):**
Choose the scope that fits your needs:
```bash
# Quick Setup (Default scope)
gemini mcp add k8s-helm-mcp npx -- -y k8s-helm-mcp@latest

# Global Setup (Current User)
gemini mcp add --scope user --trust k8s-helm-mcp npx -- -y k8s-helm-mcp@latest

# Project Setup (Current Directory Only)
gemini mcp add --scope project --trust k8s-helm-mcp npx -- -y k8s-helm-mcp@latest
```

**Verification:**
```bash
# List configured servers and check connectivity
gemini mcp list
```

> [!NOTE]
> **Trusting the Workspace:** For `stdio` servers to show as **Connected**, the current folder must be trusted. If `gemini mcp list` shows a `✗` or "Disconnected" status, run `gemini trust` in the project root.

**Manual Configuration:**
Gemini CLI looks for `settings.json` in the following locations:
- **Global:** `~/.gemini/settings.json`
- **Project:** `.gemini/settings.json`

Add the following structure:
```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "npx",
      "args": ["-y", "k8s-helm-mcp@latest"],
      "trust": true,
      "env": {
        "KUBECONFIG": "$KUBECONFIG"
      }
    }
  }
}
```

> [!TIP]
> **Headless Environments:** If running in CI/CD or a headless environment, set `GEMINI_CLI_TRUST_WORKSPACE="true"` to bypass manual folder trust checks.

> [!CAUTION]
> **Naming Rule:** Do not use underscores (`_`) in the server name. The Gemini policy engine uses the first underscore as a delimiter; an underscore in the name will cause security policies to fail silently.

#### Option 8: Codex CLI

Codex CLI features first-class MCP support and can be configured via the CLI or its configuration file.

**Default Path:**
- **Global:** `~/.codex/config.toml`

**CLI Configuration:**
Run the following command to add the server:

```bash
codex mcp add k8s-helm-mcp -- npx -y k8s-helm-mcp@latest
```

**Manual Configuration (`config.toml`):**
```toml
[mcp.servers.k8s-helm-mcp]
command = "npx"
args = ["-y", "k8s-helm-mcp@latest"]
```
> **Sandboxing:** On macOS and Linux, you can enable sandboxing by adding `"sandboxEnabled": true` to the server config.
> **Full Reference:** See the [official MCP configuration reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration) for all available fields.

#### Option 9: Antigravity
 
 Antigravity is a high-performance agentic IDE that uses a managed configuration system for MCP servers.
 
 **Managed Path:**
 - `.gemini/antigravity/mcp_config.json`
 
 **Manual Configuration:**
 Add the server to your `mcp_config.json`:
 
 ```json
 {
   "mcpServers": {
     "k8s-helm-mcp": {
       "command": "npx",
       "args": ["-y", "k8s-helm-mcp@latest"]
     }
   }
 }
 ```
 
 ### 🤝 Comparison: Antigravity vs. Gemini CLI
 
 If you use both, note that they maintain separate configurations but share global context.
 
 | Feature | Gemini CLI | Antigravity |
 | :--- | :--- | :--- |
 | **Primary Config** | `~/.gemini/settings.json` | `.gemini/antigravity/mcp_config.json` |
 | **Best For** | Automation, Scripting, DevOps | UI-driven dev, Agent orchestration |
 | **Control** | Manual / CLI-driven | Managed / UI-driven |
 
 > [!WARNING]
 > **Shared Context (GEMINI.md):** Both tools share `~/.gemini/GEMINI.md` for global system rules. Be careful when modifying this file, as it affects both the CLI and the IDE simultaneously.
 
 ---
 
 #### Option 10: Web Deployment (SSE Transport)
 
 > [!WARNING]
 > The SSE transport feature is currently in development and may be unstable. Stdio transport (default) is recommended for production use.
 
 For web-based clients, use the SSE transport:
 
 ```bash
 # Set environment variables
 export TRANSPORT=sse
 export PORT=3000
 
 # Start the server
 node dist/index.js
 ```
 
 The server will start an HTTP server with SSE support on the specified port.
 
 **Endpoints:**
 - `GET /health` - Health check
 - `GET /sse` - SSE connection for MCP
 - `POST /message` - Message endpoint for client requests
 
 **Windows:**
 ```powershell
 $env:TRANSPORT="sse"
 $env:PORT="3000"
 node dist\index.js
 ```

---

## Prerequisites

Before using this MCP server, make sure you have:

1. **kubectl installed** - [Installation Guide](https://kubernetes.io/docs/tasks/tools/)
2. **A valid kubeconfig file** at `~/.kube/config` (or set `KUBECONFIG` env var)
3. **Access to a Kubernetes cluster** (minikube, Docker Desktop, GKE, EKS, etc.)

> [!IMPORTANT]
> **Cloud Provider CLIs:** If you are using a managed cluster like **EKS (AWS)**, **GKE (Google)**, or **AKS (Azure)**, ensure you have the corresponding CLI tool (`aws-cli`, `gcloud`, or `az`) installed and authenticated on your local machine. The Kubernetes SDK uses these CLIs for "exec" authentication to generate tokens.

**Quick verification:**
```bash
kubectl get pods
```
If this works, you're ready!

### Metrics Server (Optional but Recommended)

For resource usage monitoring features (CPU/memory metrics for pods and nodes), install the Kubernetes Metrics Server:

**Installation:**
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

**Verification:**
```bash
# Wait a few seconds for the pod to start
kubectl get pods -n kube-system -l k8s-app=metrics-server

# Test metrics
kubectl top nodes
kubectl top pods
```

**Features enabled with metrics-server:**
- `k8s_top_pod` - Display resource usage for pods
- `k8s_top_node` - Display resource usage for nodes
- `k8s_get_pod_metrics` - Get detailed pod metrics
- `k8s_get_node_metrics` - Get detailed node metrics
- Enhanced `k8s_health_score` - More accurate health assessment

**Troubleshooting metrics-server:**
- If metrics are unavailable, verify the pod is running: `kubectl logs -n kube-system -l k8s-app=metrics-server`
- For Docker Desktop/minikube, you may need to add `--kubelet-insecure-tls` flag to metrics-server deployment

### For Different Kubernetes Setups:

- **Docker Desktop**: Kubernetes is built-in, enable in Settings
- **minikube**: Run `minikube start`
- **Rancher Desktop**: Enable Kubernetes in Preferences
- **Cloud (GKE/EKS/AKS)**: Follow provider's setup guide

---

### Manual Claude Desktop Config File Paths

To integrate this server, add the configuration below to your `claude_desktop_config.json`. 

> [!TIP]
> The easiest way to find this file is to open **Claude Desktop** → **Settings** → **Developer** → **Edit Config**. This works regardless of your installation path.

**Default Paths:**
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "node",
      "args": ["/path/to/k8s-mcp/dist/index.js"]
    }
  }
}
```

## Tool Reference

For a complete list of all 269 tools and their kubectl equivalents, see **[TOOLS_REFERENCE.md](TOOLS_REFERENCE.md)**.

### Tool Categories

| Category | Count | Sample Tools |
|----------|-------|--------------|
| **Cluster** | 21 | Context, namespace, API versions, resource quotas, priority classes, leases |
| **Nodes** | 10 | List, cordon, drain, taints, labels, pressure status |
| **Pods** | 13 | Logs, exec, debug, delete, run, bulk delete |
| **Workloads** | 42 | Deployments, Jobs, CronJobs, scaling, PodDisruptionBudgets, HPA |
| **Networking** | 18 | Services, ingress, DNS, topology, endpoints, endpointslices, network policies |
| **Storage** | 11 | PVs, PVCs, StorageClasses, storage summary |
| **Security** | 31 | RBAC, secrets, roles, bindings, auth reconcile, certificates |
| **Monitoring** | 14 | Events, metrics, health score, crash loop detection, restart report |
| **Configuration** | 19 | Apply, edit, diff, validate, kustomize, last-applied, convert, wait |
| **Advanced** | 25 | Bulk ops, analysis, optimization, raw API, proxy, kubectl passthrough |
| **Diagnostics** | 6 | Namespace summary, resource age, pod log search, resource comparison |
| **Templates** | 2 | Quick deploy, resource templates |
| **WebSocket** | 5 | Exec, attach, port-forward, logs, watch |
| **SRE** | 5 | Incident snapshot, changes-since, blast radius, workload diff, silent killers |
| **Helm** | 39 | Releases, charts, repos, plugins, registry, lint, template, search |
| **Server** | 8 | Server info, health, metrics, stop, protection mode toggles |

**Total: 269 tools** (some tools are registered in multiple categories; unique count is 269)

> These category names double as `K8S_TOOLSETS` selectors — e.g. `K8S_TOOLSETS=helm,monitoring` exposes only those two categories. See [Toolsets (Tool Selection)](#toolsets-tool-selection) to register a focused or read-only subset.

### Infrastructure Protection & Native Pre-Flight Simulation

Destructive tools are blocked by default via Protection Modes. Use `k8s_toggle_protection_mode` or `k8s_toggle_all_protection_modes` to enable:
- Delete operations
- Node modifications (drain, cordon, taints, labels)
- Workload modifications (scaling, rollouts, image updates, pod restarts)
- Resource modifications (patch, label, annotate)

Additionally, all modification, creation, and deletion tools now support **Native Pre-Flight Dry-Run Simulation** (`dryRun: 'none' | 'client' | 'server'`). AI assistants can safely simulate actions:
- `client`: Performs client-side schema, parameter, and safety validation without making any changes.
- `server`: Validates mutations directly against the live Kubernetes API server admission webhooks and RBAC policies without committing state.

See [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md) for full kubectl → MCP tool mapping and [SECURITY.md](SECURITY.md) for comprehensive safety architecture.

## Claude Desktop Integration

This MCP server is designed for seamless integration with Claude Desktop. Once configured, you can interact with your Kubernetes clusters using natural language.

### Configuration

**Prerequisites:** Before configuring, ensure you have:
1. Installed dependencies: `npm install`
2. Built the project: `npm run build`

Add the server to your config file (see the [Manual Paths](#manual-claude-desktop-config-file-paths) section above if you cannot find it):

Open Claude Desktop → Settings → Developer → Edit Config, then add:

```json
{
  "mcpServers": {
    "k8s-helm-mcp": {
      "command": "node",
      "args": ["PATH/TO/k8s-helm-mcp/dist/index.js"]
    }
  }
}
```

**Replace `PATH/TO/k8s-helm-mcp` with your actual installation path.**

### Common Workflows

#### **Check Cluster Status**

**You ask:** "What's the health of my cluster?"

**Claude responds by:**
- Calling `k8s_cluster_health` to get overall status
- Calling `k8s_health_score` for a health score
- Calling `k8s_list_nodes` to check node status
- Summarizing the cluster state

#### **Debug Application Issues**

**You ask:** "My web-app deployment is having issues, can you help debug?"

**Claude responds by:**
- Calling `k8s_list_pods` with label selector `app=web-app`
- Calling `k8s_get_pod_events` for failing pods
- Calling `k8s_get_pod_logs` to check error messages
- Calling `k8s_analyze_pod_failure` if pods are crashing
- Providing diagnosis and suggested fixes

#### **Deploy a New Application**

**You ask:** "Deploy nginx with 3 replicas in the production namespace"

**Claude responds by:**
- Calling `k8s_create_deployment` with:
  - name: `nginx`
  - image: `nginx:latest`
  - replicas: `3`
  - namespace: `production`
- Calling `k8s_create_service` to expose it
- Calling `k8s_list_pods` to verify deployment
- Confirming successful deployment

#### **Scale Based on Traffic**

**You ask:** "Scale the api-service to handle more traffic"

**Claude responds by:**
- Calling `k8s_get_deployment` to check current replicas
- Calling `k8s_scale_deployment` to increase replicas
- Calling `k8s_autoscale` to set up HPA for automatic scaling
- Confirming the changes

#### **Helm Chart Management**

**You ask:** "Install the Prometheus Helm chart in the monitoring namespace"

**Claude responds by:**
- Calling `mcp8_k8s_helm_repo_add` to add the Prometheus repository
- Calling `mcp8_k8s_helm_install` with:
  - chart: `prometheus/prometheus`
  - namespace: `monitoring`
  - release: `prometheus`
- Calling `mcp8_k8s_helm_status` to verify installation
- Providing access URLs

#### **Resource Cleanup**

**You ask:** "Clean up all failed pods in the staging namespace"

**Claude responds by:**
- Calling `k8s_list_pods` with field selector for failed status
- Calling `k8s_bulk_delete_pods` with label selector for cleanup
- Confirming the cleanup

#### **Security Audit**

**You ask:** "Check for any security issues in my cluster"

**Claude responds by:**
- Calling `k8s_check_privileged_pods` to find privileged containers
- Calling `k8s_list_secrets` to review secret exposure
- Calling `k8s_get_rbac_summary` to check permissions
- Providing security recommendations

### Tips for Best Results

- **Be specific with namespaces:** "in the production namespace" vs "in production"
- **Use resource names:** "the web-app deployment" vs "the web app"
- **Describe the goal:** "scale to handle more traffic" vs "scale it"
- **Ask for explanations:** "why is this pod failing?" triggers deeper analysis
- **Request verification:** "and verify it worked" adds confirmation steps

### Protection Mode in Claude Desktop

When protection mode is enabled (default), Claude will:
- Ask for confirmation before destructive operations
- Explain what will happen before executing
- Suggest safer alternatives when available
- Block operations that could break infrastructure

To disable protection temporarily:
```
You: "Disable protection mode so I can make changes"
Claude: Uses k8s_toggle_protection_mode to disable
```

## Examples

### List all pods in a namespace

```
Use the k8s_list_pods tool with namespace="default"
```

### Get pod logs

```
Use the k8s_get_pod_logs tool with:
- name="my-pod"
- namespace="default"
- tailLines=50
```

### Scale a deployment

```
Use the k8s_scale_deployment tool with:
- name="my-deployment"
- namespace="default"
- replicas=5
```

### Check cluster health

```
Use the k8s_health_score tool
```

### Debug a failing pod

```
Use the k8s_analyze_pod_failure tool with:
- name="failing-pod"
- namespace="default"
```

### Apply a manifest

```
Use the k8s_apply_manifest tool with:
- manifest="<YAML content>"
- namespace="default" (optional)
```

### Check pod resource usage

```
Use the k8s_top_pod tool with:
- namespace="default" (optional)
- sortBy="cpu" or "memory" (optional)
```

### View pod logs

```
Use the k8s_get_pod_logs tool with:
- name="my-pod"
- namespace="default"
- tailLines=100 (optional)
- follow=true (optional, for streaming)
```

### List events

```
Use the k8s_list_events tool with:
- namespace="default" (optional)
- type="Warning" (optional)
```

### Cordon a node

```
Use the k8s_cordon_node tool with:
- name="node-1"
```

### Rollback a deployment

```
Use the k8s_rollback_deployment tool with:
- name="web-app"
- namespace="default"
- revision=3 (optional, defaults to previous)
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KUBECONFIG` | Path to kubeconfig file | `~/.kube/config` |
| `INFRA_PROTECTION_MODE` | Enable infrastructure protection (blocks destructive operations) | `true` (enabled) |
| `STRICT_PROTECTION_MODE` | Enable strict protection (blocks all non-read operations) | `true` (enabled) |
| `NO_DELETE_PROTECTION_MODE` | Enable no-delete protection (blocks deletions only, allows updates) | `true` (enabled) |
| `K8S_TOOLSETS` | Comma-separated categories/presets to expose (see [Toolsets](#toolsets-tool-selection)) | `all` |
| `K8S_DISABLED_TOOLSETS` | Comma-separated categories to remove after selection | *(none)* |
| `K8S_MAX_SOCKETS` | Max pooled HTTP connections to the API server | `50` |
| `K8S_KEEPALIVE_MS` | Idle keep-alive timeout for pooled connections (ms) | `30000` |
| `MCP_AUTH_TOKEN` | Bearer token required by the SSE/HTTP transport | *(auto-generated)* |

### Protection Modes

Three configurable protection modes for safety:

| Mode | Description | Default |
|------|-------------|---------|
| **Infrastructure Protection** | Blocks all destructive operations (delete, drain, cordon, scale, etc.) | `enabled` |
| **Strict Protection** | Blocks all non-read-only operations (read-only mode) | `enabled` |
| **No Delete Protection** | Blocks only deletion operations, allows updates/changes | `enabled` |

**Toggle via environment variables:**
```bash
INFRA_PROTECTION_MODE=false npm start          # Disable infrastructure protection
STRICT_PROTECTION_MODE=false npm start         # Disable strict read-only mode
NO_DELETE_PROTECTION_MODE=false npm start      # Disable no-delete mode
```

**Toggle via tools:**
```bash
k8s_toggle_protection_mode { enabled: false, confirm: true }           # Infrastructure toggle
k8s_toggle_strict_protection_mode { enabled: true }                     # Strict mode toggle
k8s_toggle_no_delete_mode { enabled: true }                           # No-delete mode toggle
k8s_toggle_all_protection_modes { infrastructure: false, strict: false, noDelete: false }  # Master toggle - disable all to enable full access
```

**Check status:**
```
Use mcp_server_info or mcp_health_check to see current protection mode status
```

### Toolsets (Tool Selection)

The server exposes a large tool surface. `K8S_TOOLSETS` controls **which tools are registered** at startup — useful for reducing model context, staying under client tool-count limits, or shipping a read-only/least-privilege deployment. This is a *registration-time* filter and never changes any tool's behavior. The default (`all`) registers everything, identical to prior versions.

`K8S_TOOLSETS` takes a comma-separated list of two kinds of token:

**Presets & categories (additive — pick which groups to include):**

| Preset | Includes |
|--------|----------|
| `all` / `full` | Every category (default) |
| `kubernetes` / `k8s` | Every Kubernetes category, **excludes** Helm |
| `helm` | Helm tools only |
| `core` | cluster, nodes, pods, workloads, networking, storage, config |
| `diagnostics` | diagnostics, monitoring, sre |

Any individual category is also a valid token: `cluster`, `nodes`, `pods`, `workloads`, `networking`, `storage`, `security`, `monitoring`, `config`, `diagnostics`, `advanced`, `templates`, `websocket`, `multicluster`, `sre`, `helm`. `kubernetes` and `helm` are complements that together equal `all`.

**Filter flags (subtractive — trim whatever was picked):**

| Flag | Effect |
|------|--------|
| `readonly` (`ro`) | Keep only read/list/get/inspect tools |
| `nodelete` | Keep reads and updates, remove all delete/destroy tools |
| `lean` (`minimal`) | Expose just `k8s_kubectl` plus a handful of core reads |

Presets are applied first, then flags trim the result — so `K8S_TOOLSETS=kubernetes,nodelete` selects all Kubernetes tools and then strips the deletion tools. A flag given on its own applies against `all`. `K8S_DISABLED_TOOLSETS` removes whole categories after selection.

> The 8 server-management tools (server info/health/metrics, cache, protection toggles) are always registered regardless of selection.

**Examples:**
```bash
K8S_TOOLSETS=readonly npm start                       # read-only surface (ideal for least-privilege agents)
K8S_TOOLSETS=kubernetes npm start                     # all K8s tools, no Helm
K8S_TOOLSETS=helm npm start                            # Helm tools only
K8S_TOOLSETS=core,diagnostics npm start                # focused ops surface
K8S_TOOLSETS=kubernetes,nodelete npm start             # K8s create/update but never delete
K8S_TOOLSETS=lean npm start                            # minimal footprint (kubectl + core reads)
K8S_TOOLSETS=all K8S_DISABLED_TOOLSETS=websocket npm start   # everything except exec/attach/port-forward
```

### Secret Scrubbing (Data Redaction)

Prevent accidental exposure of sensitive data in tool outputs:

**What it does:**
- Automatically detects and redacts passwords, tokens, API keys, PII in tool outputs
- 40+ detection patterns for cloud credentials, cryptographic keys, PII
- Optional opt-in feature (set `scrub: true` on supported tools)

**Supported tools:**
- `k8s_get_logs` - Pod logs with sensitive data redacted
- `k8s_exec_pod` - Command output scrubbing
- `k8s_kubectl` - kubectl command output scrubbing
- `k8s_describe_pod` - Pod YAML scrubbing
- `k8s_helm_values` - Helm values redaction
- `k8s_helm_template` - Rendered template scrubbing
- `k8s_get_configmap` - ConfigMap data scrubbing
- `k8s_export_resource` - Resource YAML redaction
- `k8s_pod_log_search` - Log search results scrubbing

**Example usage:**
```bash
# Get logs with secret scrubbing
k8s_get_logs name=my-pod namespace=default scrub=true

# Export ConfigMap with sensitive values redacted
k8s_export_resource kind=ConfigMap name=my-config scrub=true

# Check response for scrubbed: true flag indicating redaction was applied
```

**Detects and redacts:**
- Passwords, tokens, API keys (AWS, GCP, Azure, GitHub, Slack, Stripe, OpenAI)
- JWT tokens, PEM private keys, certificates
- Database connection strings, Docker registry auth
- Credit cards, SSN, email addresses, IP addresses

See [SECURITY.md](SECURITY.md) for detailed documentation.

### Universal Query Helper & Pagination

All Kubernetes GET and LIST tools feature standardized querying, pagination, and multi-format output capabilities:

- **Pagination**: Supports `limit` (max records per page) and opaque `continue` tokens for seamless pagination through large clusters.
- **Sorting**: Supports `sortBy` (JSONPath or field name, e.g. `metadata.name`, `status.phase`, `metadata.creationTimestamp`) and `sortOrder` (`asc` or `desc`).
- **Format Flexibility**: Supports `outputFormat` (`json` or `yaml`), letting you receive raw structured JSON or clean, human/LLM-optimized YAML representations.
- **Subresource Queries**: Supports `subresource` targeting (e.g. `status`, `scale`, `log`) on supported resources.

**Example usage:**
```bash
# List top 10 pods sorted by creation timestamp descending
k8s_list_pods namespace=default limit=10 sortBy=metadata.creationTimestamp sortOrder=desc

# Fetch next page using continue token
k8s_list_pods namespace=default limit=10 continue="<continue-token>"

# Export deployment in clean YAML format
k8s_get_deployment name=frontend namespace=production outputFormat=yaml
```

### Native Pre-Flight Simulation & Dry-Run Engine

To ensure maximum safety for autonomous AI agents and SRE teams, all resource creation, deletion, and operational mutation tools natively support pre-flight dry-run execution:

| Mode | Behavior | Safety Guarantee |
|------|----------|------------------|
| `none` (default) | Normal execution | Persists changes directly to the Kubernetes cluster |
| `client` | Client-side simulation | Validates schemas, input parameters, and protection settings locally without modifying the cluster |
| `server` | Kubernetes API dry-run | Validates request against live admission webhooks, mutating/validating controllers, and RBAC via Kubernetes API server (`dryRun=All`) without persisting changes |

**Supported Mutation Categories:**
- **Imperative Resource Creation**: All 22 `k8s_create_*` tools (deployments, services, namespaces, ingress, PVC, etc.)
- **Node Operations**: `k8s_cordon_node`, `k8s_uncordon_node`, `k8s_drain_node`, `k8s_add_node_taint`, `k8s_remove_node_taint`, `k8s_add_node_label`, `k8s_remove_node_label`
- **Pod Operations**: `k8s_restart_pod`
- **Workload Modifications**: `k8s_scale_deployment`, `k8s_restart_deployment`, `k8s_rollback_deployment`, `k8s_rollout_undo`, `k8s_set_image`, `k8s_scale`, `k8s_rollout_pause`, `k8s_rollout_resume`, `k8s_restart_statefulset`, `k8s_restart_daemonset`, `k8s_autoscale`, `k8s_trigger_job`, `k8s_expose`, `k8s_label`, `k8s_annotate`
- **Generic Modifications**: `k8s_patch`, `k8s_label`, `k8s_annotate`

**Example usage:**
```bash
# Safely simulate cordoning a critical node with server-side validation
k8s_cordon_node name=node-prod-01 dryRun=server

# Simulate scaling a production deployment to verify RBAC and controller admission
k8s_scale_deployment name=api-gateway replicas=10 namespace=prod dryRun=server
```

### Universal Deletion Safety Engine

All 20+ resource deletion tools (`k8s_delete_pod`, `k8s_delete_deployment`, `k8s_delete_service`, `k8s_delete_pvc`, `k8s_delete_namespace`, `k8s_delete`, etc.) include comprehensive safety and cascade controls:

- **`dryRun`** (`none`, `client`, `server`): Test deletions before destroying workloads or data.
- **`gracePeriodSeconds`**: Override default termination countdowns (e.g., immediate deletion with `0` or extended grace periods for stateful workloads).
- **`propagationPolicy`** (`Orphan`, `Background`, `Foreground`): Control whether dependent child resources (e.g., Pods owned by a ReplicaSet) are orphaned or cleaned up in foreground/background.
- **`ignoreNotFound`** (`boolean`): Eliminates script and agent errors when cleaning up resources that may already have been deleted.

**Example usage:**
```bash
# Pre-flight check deleting a namespace and its contents
k8s_delete_namespace name=staging dryRun=server

# Delete a deployment with foreground cascade and custom grace period
k8s_delete_deployment name=old-app namespace=default propagationPolicy=Foreground gracePeriodSeconds=60

# Idempotently clean up a pod without erroring if already removed
k8s_delete_pod name=batch-worker-42 namespace=jobs ignoreNotFound=true
```

## Architecture

### Tool Organization

Tools are organized by domain across 19 TypeScript files:

| File | Tools | Domain |
|------|-------|--------|
| `cluster.ts` | 18 | Context switching, cluster info, namespaces, API versions, priority classes, leases |
| `multi-cluster.ts` | 3 | Multi-cluster management and federation |
| `nodes.ts` | 10 | Node management, cordon, drain, taints, labels |
| `pods.ts` | 13 | Pod operations, logs, exec, debugging |
| `workloads.ts` | 44 | Deployments, StatefulSets, DaemonSets, Jobs, CronJobs, scaling, rollouts, HPAs |
| `networking.ts` | 18 | Services, ingresses, network policies, DNS, expose |
| `storage.ts` | 11 | PVs, PVCs, StorageClasses |
| `security.ts` | 31 | RBAC, secrets, service accounts, policies, certificates |
| `monitoring.ts` | 14 | Events, metrics, quotas, health scores, resource usage |
| `config.ts` | 20 | Manifests, apply, export, edit, cp, diff, kustomize |
| `advanced.ts` | 25 | Raw API queries, bulk ops, analysis, optimization |
| `diagnostics.ts` | 6 | Cluster diagnostics, troubleshooting, connectivity checks |
| `templates.ts` | 2 | Quick deploy templates |
| `websocket.ts` | 5 | Interactive exec, attach, port-forward, log streaming |
| `incident-snapshot.ts` | 1 | SRE triage data collection for rapid incident response |
| `changes-since.ts` | 1 | Time-windowed diff of cluster resource changes |
| `blast-radius.ts` | 1 | Simulate deletion impact and blast radius analysis |
| `workload-diff.ts` | 1 | Drift detection between workloads (staging vs prod) |
| `silent-killers.ts` | 1 | Preventive audit for slow-burning cluster issues |
| `helm-tools/` | 39 | Helm releases, charts, repos, plugins, registry |
| `index.ts` | 8 | Server info, health, metrics, stop, protection mode toggles |

**Total: 269 unique tools** (some tools registered in multiple files are counted once)

### Core Components

```
┌─────────────────────────────────────────┐
│           K8sMcpServer                  │
│  ┌─────────────────────────────────┐     │
│  │     Tool Registration         │     │
│  │  • cluster.ts                 │     │
│  │  • nodes.ts                   │     │
│  │  • pods.ts                    │     │
│  │  • helm-tools/ (40+ tools)    │     │
│  │  • [10 more files...]         │     │
│  └─────────────────────────────────┘     │
│  ┌─────────────────────────────────┐     │
│  │   Multi-Mode Protection        │     │
│  │  • Infrastructure Protection   │     │
│  │  • Strict Protection (RO)    │     │
│  │  • No-Delete Protection      │     │
│  │  • Toggle via env/tools      │     │
│  └─────────────────────────────────┘     │
│  ┌─────────────────────────────────┐     │
│  │   Circuit Breaker & Metrics    │     │
│  │  • Error rate monitoring       │     │
│  │  • Auto-disable on failures    │     │
│  └─────────────────────────────────┘     │
│              ↓                          │
│  ┌─────────────────────────────────┐     │
│  │        K8sClient               │     │
│  │  • Retry logic                 │     │
│  │  • Timeout protection          │     │
│  │  • kubeconfig handling         │     │
│  └─────────────────────────────────┘     │
└─────────────────────────────────────────┘
```

### Request Flow

1. **MCP Client** sends tool call request
2. **K8sMcpServer** validates request
3. **Protection Check** - blocks based on active protection mode (Infrastructure/Strict/No-Delete)
4. **Circuit Breaker** - blocks if too many errors
5. **Handler Execution** - calls appropriate tool (Kubernetes or Helm)
6. **K8sClient** - makes Kubernetes API calls
7. **Response** - returns result to MCP client

## Troubleshooting

### Claude Desktop Connection Issues

**Problem:** Claude Desktop doesn't recognize the MCP server

**Solutions:**
1. Verify the path in `claude_desktop_config.json` is correct
2. Ensure you ran `npm install` and `npm run build` before configuring
3. Check that Node.js 18+ is installed: `node --version`
4. Restart Claude Desktop after editing the config file
5. Check Claude Desktop logs (Help → Developer → Show Logs) for errors

**Problem:** Tools are not available in Claude Desktop

**Solutions:**
1. Verify the MCP server is running (check Claude Desktop logs)
2. Ensure kubeconfig is accessible at `~/.kube/config` or set `KUBECONFIG` env var
3. Test kubectl connectivity: `kubectl cluster-info`
4. Check if protection mode is blocking operations

### Kubernetes Connection Issues

**Problem:** "Unable to connect to the server" error

**Solutions:**
1. Verify kubectl is configured: `kubectl config current-context`
2. Check kubeconfig file exists and is valid
3. Test cluster connectivity: `kubectl get nodes`
4. Ensure proper permissions for the configured context
5. Check if cluster is behind a VPN or requires special authentication

**Problem:** Authentication errors

**Solutions:**
1. Refresh authentication: `kubectl auth can-i list pods`
2. Check token expiration: `kubectl config view`
3. Re-authenticate if using cloud provider (AWS EKS, GKE, AKS)
4. Verify service account permissions if using in-cluster config

### Build and Installation Issues

**Problem:** `npm install` fails

**Solutions:**
1. Clear npm cache: `npm cache clean --force`
2. Delete `node_modules` and `package-lock.json`, then reinstall
3. Check Node.js version: `node --version` (must be 18+)
4. Try with npm legacy peer deps: `npm install --legacy-peer-deps`

**Problem:** `npm run build` fails with TypeScript errors

**Solutions:**
1. Ensure all dependencies are installed: `npm install`
2. Check TypeScript version in `package.json`
3. Run typecheck for details: `npm run typecheck`
4. Update TypeScript: `npm install typescript@latest`

### Helm Tools Not Working

**Problem:** Helm tools return "helm command not found"

**Solutions:**
1. Install Helm: See [Helm Installation Guide](https://helm.sh/docs/intro/install/)
2. Verify installation: `helm version`
3. Ensure Helm is in your system PATH
4. Restart Claude Desktop after installing Helm

**Problem:** Helm repo operations fail

**Solutions:**
1. Check internet connectivity
2. Verify repo URL is correct
3. Try adding repo manually: `helm repo add <name> <url>`
4. Check Helm repo list: `helm repo list`

### Protection Mode Issues

**Problem:** Operations blocked by protection mode

**Solutions:**
1. Check current protection status using `mcp_server_info`
2. Temporarily disable: `k8s_toggle_protection_mode { enabled: false, confirm: true }`
3. Use appropriate protection mode for your use case:
   - Infrastructure Protection: Blocks destructive ops
   - Strict Protection: Read-only mode
   - No-Delete Protection: Allows updates, blocks deletions

**Problem:** Cannot toggle protection mode

**Solutions:**
1. Ensure you have confirmation: set `confirm: true` when disabling
2. Check if environment variable is overriding: `INFRA_PROTECTION_MODE`
3. Restart Claude Desktop after changing environment variables

### Performance Issues

**Problem:** Slow response times

**Solutions:**
1. Check API server latency: `k8s_api_latency_check`
2. Verify cluster health: `k8s_cluster_health`
3. Check for resource constraints on the cluster
4. Reduce the number of resources being queried (use label selectors)

**Problem:** Memory issues with large clusters

**Solutions:**
1. Use label selectors to filter results
2. Query specific namespaces instead of all namespaces
3. Use pagination with `limit` parameters where available
4. Check Node.js memory limits

### Cloud Provider Specific Issues

**Problem:** AKS (Azure) specific errors

**Solutions:**
1. See [CLOUD_PROVIDER_LIMITATIONS.md](CLOUD_PROVIDER_LIMITATIONS.md) for known issues
2. Ensure Azure CLI is authenticated: `az login`
3. Check AKS cluster connectivity
4. Verify network policies and firewall rules

**Problem:** GKE (Google Cloud) specific errors

**Solutions:**
1. Authenticate with gcloud: `gcloud auth login`
2. Get cluster credentials: `gcloud container clusters get-credentials <cluster-name>`
3. Check IAM permissions
4. See [CLOUD_PROVIDER_LIMITATIONS.md](CLOUD_PROVIDER_LIMITATIONS.md)

**Problem:** EKS (AWS) specific errors

**Solutions:**
1. Configure AWS credentials: `aws configure`
2. Update kubeconfig: `aws eks update-kubeconfig --name <cluster-name>`
3. Check IAM role permissions
4. See [CLOUD_PROVIDER_LIMITATIONS.md](CLOUD_PROVIDER_LIMITATIONS.md)

### Getting Help

If you encounter issues not covered here:

1. Check the [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for detailed tool information
2. Review [TOOLS_REFERENCE.md](TOOLS_REFERENCE.md) for tool parameters
3. Enable debug logging by setting `DEBUG=*` environment variable
4. Check Claude Desktop logs for detailed error messages
5. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Kubernetes version (`kubectl version`)
   - Node.js version (`node --version`)
   - MCP server version (from `package.json`)

## FAQ

### General Questions

**Q: What is an MCP server?**
A: MCP (Model Context Protocol) is a standard that allows AI assistants like Claude to interact with external tools and data sources. This MCP server exposes Kubernetes functionality through the MCP protocol.

**Q: Do I need Kubernetes installed locally?**
A: No, you need kubectl installed and configured to connect to a Kubernetes cluster. The cluster can be local (minikube, Docker Desktop, kind) or remote (cloud provider, self-managed).

**Q: Can I use this with any Kubernetes cluster?**
A: Yes, as long as you have kubectl configured with access to the cluster. It works with AKS, GKE, EKS, self-managed clusters, and local development clusters.

**Q: Is this safe to use with production clusters?**
A: Yes, the server includes infrastructure protection mode that blocks destructive operations by default. You can configure different protection levels based on your needs.

### Configuration Questions

**Q: How do I switch between multiple clusters?**
A: Use `kubectl config use-context <context-name>` to switch contexts. The MCP server will use whatever context kubectl is currently configured to use.

**Q: Can I use a specific kubeconfig file?**
A: Yes, set the `KUBECONFIG` environment variable to point to your kubeconfig file before starting Claude Desktop.

**Q: Do I need to restart Claude Desktop after changing kubeconfig?**
A: Yes, the MCP server reads the kubeconfig when it starts. Restart Claude Desktop after changing your kubeconfig or context.

### Protection Mode Questions

**Q: What is infrastructure protection mode?**
A: It's a safety feature that blocks destructive operations (delete, drain, cordon, etc.) by default. You must explicitly disable it to perform destructive operations.

**Q: How do I disable protection mode?**
A: Ask Claude to "disable protection mode" or use the `k8s_toggle_protection_mode` tool with `confirm: true`.

**Q: What are the different protection modes?**
A: 
- Infrastructure Protection: Blocks destructive operations
- Strict Protection: Read-only mode, blocks all modifications
- No-Delete Protection: Allows updates but blocks deletions

**Q: Can I make protection mode permanent?**
A: Yes, set the `INFRA_PROTECTION_MODE`, `STRICT_PROTECTION_MODE`, or `NO_DELETE_PROTECTION_MODE` environment variables to `true`.

### Helm Questions

**Q: Do I need Helm installed?**
A: Only if you want to use the Helm tools. The Kubernetes tools work without Helm.

**Q: How do I install Helm?**
A: See the installation instructions in the Quick Start section or visit [helm.sh](https://helm.sh/docs/intro/install/).

**Q: Can I use private Helm repositories?**
A: Yes, you can add private repositories using the `mcp8_k8s_helm_repo_add` tool with authentication.

### Performance Questions

**Q: Will this slow down my cluster?**
A: The MCP server makes API calls on-demand. It doesn't run continuously in the background. Performance impact is minimal and similar to using kubectl.

**Q: What if I have a large cluster with thousands of resources?**
A: Use label selectors and namespace filters to limit the scope of queries. The server supports pagination and filtering to handle large clusters efficiently.

**Q: Does this cache results?**
A: The server includes response caching for frequently accessed data to improve performance.

### Security Questions

**Q: Is my kubeconfig data secure?**
A: The MCP server reads your kubeconfig but doesn't transmit it externally. It uses the credentials to authenticate with your Kubernetes cluster directly.

**Q: Can I use this with in-cluster authentication?**
A: Yes, if running inside a pod, the server can use the service account for authentication.

**Q: What permissions does the MCP server need?**
A: It needs the same permissions as kubectl. For full functionality, use cluster-admin or equivalent permissions. You can restrict permissions based on your needs.

### Troubleshooting Questions

**Q: Claude Desktop doesn't show the Kubernetes tools**
A: 
1. Verify the path in `claude_desktop_config.json` is correct
2. Ensure you ran `npm install` and `npm run build`
3. Restart Claude Desktop
4. Check Claude Desktop logs for errors

**Q: I get "Unable to connect to the server" errors**
A: 
1. Verify kubectl works: `kubectl get nodes`
2. Check your current context: `kubectl config current-context`
3. Ensure you have network access to the cluster
4. Check if VPN is required

**Q: Tools are blocked by protection mode**
A: 
1. Check current protection status with `k8s_server_info`
2. Temporarily disable: `k8s_toggle_protection_mode { enabled: false, confirm: true }`
3. Or use the appropriate protection mode for your use case

## License

Apache License 2.0

## Author

**Meetkumar Patel**  
Email: [pmeet464@gmail.com](mailto:pmeet464@gmail.com)  
GitHub: [@meetpatel1111](https://github.com/meetpatel1111)

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
