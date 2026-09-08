import * as k8s from "@kubernetes/client-node";
import * as yaml from "js-yaml";
import { execFileSync } from "child_process";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { setGlobalDispatcher, Agent as UndiciAgent } from "undici";
import { 
  K8sMcpError, 
  classifyError, 
  validateResourceName, 
  validateNamespace,
  validateYamlManifest,
  safeExecute,
  checkResourceExists,
  ErrorContext 
} from "./error-handling.js";

function getKubectlInstallInstructions(): string[] {
  const platform = process.platform;
  
  const baseInstructions = [
    "kubectl is required to use this MCP server",
  ];
  
  if (platform === "win32") {
    return [
      ...baseInstructions,
      "Official installation guide: https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/",
      "",
      "Install using winget (recommended):",
      "  winget install -e --id Kubernetes.kubectl",
      "",
      "Or install using Chocolatey:",
      "  choco install kubernetes-cli",
      "",
      "Or install using Scoop:",
      "  scoop install kubectl",
      "",
      "Or download directly with curl:",
      "  curl.exe -LO \"https://dl.k8s.io/release/v1.35.0/bin/windows/amd64/kubectl.exe\"",
      "",
      "Validate binary (optional):",
      "  curl.exe -LO \"https://dl.k8s.io/v1.35.0/bin/windows/amd64/kubectl.exe.sha256\"",
      "  CertUtil -hashfile kubectl.exe SHA256",
      "  type kubectl.exe.sha256",
      "",
      "Add to PATH and verify:",
      "  kubectl version --client",
      "",
      "Note: Docker Desktop adds its own kubectl to PATH. Ensure your kubectl comes first in PATH.",
    ];
  } else if (platform === "darwin") {
    return [
      ...baseInstructions,
      "Official installation guide: https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/",
      "",
      "Install using Homebrew (recommended):",
      "  brew install kubectl",
      "",
      "Or install using MacPorts:",
      "  sudo port install kubectl",
      "",
      "Or download binary with curl (Intel):",
      "  curl -LO \"https://dl.k8s.io/release/v1.35.0/bin/darwin/amd64/kubectl\"",
      "",
      "Or download binary with curl (Apple Silicon):",
      "  curl -LO \"https://dl.k8s.io/release/v1.35.0/bin/darwin/arm64/kubectl\"",
      "",
      "Validate binary (optional):",
      "  curl -LO \"https://dl.k8s.io/release/v1.35.0/bin/darwin/amd64/kubectl.sha256\"",
      "  echo \"$(cat kubectl.sha256)  kubectl\" | shasum -a 256 --check",
      "",
      "Install kubectl:",
      "  chmod +x kubectl",
      "  sudo mv kubectl /usr/local/bin/",
      "",
      "After installation, verify with: kubectl version --client",
    ];
  } else {
    // Linux and others
    return [
      ...baseInstructions,
      "Official installation guide: https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/",
      "",
      "Install using native package manager (recommended):",
      "",
      "Debian/Ubuntu:",
      "  sudo apt-get update",
      "  sudo apt-get install -y apt-transport-https ca-certificates curl",
      "  curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.35/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg",
      "  echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.35/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list",
      "  sudo apt-get update && sudo apt-get install -y kubectl",
      "",
      "RHEL/CentOS/Fedora:",
      "  sudo yum install -y kubectl",
      "",
      "Or install using snap:",
      "  sudo snap install kubectl --classic",
      "",
      "Or download binary with curl (amd64):",
      "  curl -LO \"https://dl.k8s.io/release/v1.35.0/bin/linux/amd64/kubectl\"",
      "  curl -LO \"https://dl.k8s.io/release/v1.35.0/bin/linux/amd64/kubectl.sha256\"",
      "  echo \"$(cat kubectl.sha256)  kubectl\" | sha256sum --check",
      "  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl",
      "  # Or for non-root install to ~/.local/bin:",
      "  # chmod +x kubectl && mkdir -p ~/.local/bin && mv ./kubectl ~/.local/bin/",
      "",
      "After installation, verify with: kubectl version --client",
    ];
  }
}

function checkKubectlInstalled(): void {
  try {
    execFileSync("kubectl", ["version", "--client"], { stdio: "ignore" });
  } catch {
    throw new K8sMcpError(
      "client",
      "kubectl is not installed or not found in PATH",
      { operation: "checkKubectlInstalled" },
      undefined,
      getKubectlInstallInstructions()
    );
  }
}

export interface ListOptions {
  limit?: number;
  labelSelector?: string;
  fieldSelector?: string;
}

function parseListOptions(limitOrOptions?: number | ListOptions): ListOptions {
  if (typeof limitOrOptions === "number") {
    return { limit: limitOrOptions };
  }
  return limitOrOptions || {};
}

export class K8sClient {
  private _kc: k8s.KubeConfig;
  private coreV1Api: k8s.CoreV1Api;
  private appsV1Api: k8s.AppsV1Api;
  private batchV1Api: k8s.BatchV1Api;
  private networkingV1Api: k8s.NetworkingV1Api;
  private storageV1Api: k8s.StorageV1Api;
  private rbacV1Api: k8s.RbacAuthorizationV1Api;
  private autoscalingV2Api: k8s.AutoscalingV2Api;
  private requestTimeout: number = 30000; // 30 seconds default
  private retryAttempts: number = 3;

  constructor() {
    // Check kubectl is installed first
    checkKubectlInstalled();
    
    this._kc = new k8s.KubeConfig();
    
    try {
      // Load kubeconfig with flexible source priority
      this.loadKubeconfig();
      this.validateConfiguration();
      
      // Configure connection pooling for better performance
      this.setupConnectionPooling();
    } catch (error) {
      const context: ErrorContext = { operation: "constructor" };
      throw classifyError(error, context);
    }
    
    try {
      this.coreV1Api = this._kc.makeApiClient(k8s.CoreV1Api);
      this.appsV1Api = this._kc.makeApiClient(k8s.AppsV1Api);
      this.batchV1Api = this._kc.makeApiClient(k8s.BatchV1Api);
      this.networkingV1Api = this._kc.makeApiClient(k8s.NetworkingV1Api);
      this.storageV1Api = this._kc.makeApiClient(k8s.StorageV1Api);
      this.rbacV1Api = this._kc.makeApiClient(k8s.RbacAuthorizationV1Api);
      this.autoscalingV2Api = this._kc.makeApiClient(k8s.AutoscalingV2Api);
    } catch (error) {
      const context: ErrorContext = { operation: "initializeApiClients" };
      throw classifyError(error, context);
    }
  }

  private loadKubeconfig(): void {
    // Priority 1: KUBECONFIG_YAML (env var) - inline YAML config
    if (process.env.KUBECONFIG_YAML) {
      this.loadFromInlineYaml(process.env.KUBECONFIG_YAML);
      return;
    }
    
    // Priority 2: KUBECONFIG_JSON (env var) - inline JSON config
    if (process.env.KUBECONFIG_JSON) {
      this.loadFromInlineJson(process.env.KUBECONFIG_JSON);
      return;
    }
    
    // Priority 3: K8S_SERVER + K8S_TOKEN (env vars) - direct server/token
    if (process.env.K8S_SERVER && process.env.K8S_TOKEN) {
      this.loadFromEnvVars();
      return;
    }
    
    // Priority 4: In-cluster config (for pods running in Kubernetes)
    if (this.isInCluster()) {
      this._kc.loadFromCluster();
      return;
    }
    
    // Priority 5: KUBECONFIG_PATH (env var) - custom path
    if (process.env.KUBECONFIG_PATH) {
      this._kc.loadFromFile(process.env.KUBECONFIG_PATH);
      return;
    }
    
    // Priority 6: Standard kubeconfig (default behavior)
    this._kc.loadFromDefault();
  }

  private loadFromInlineYaml(yamlContent: string): void {
    try {
      // Write to a temporary file and load it
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, 'kubeconfig.yaml');
      fs.writeFileSync(tempFile, yamlContent);
      
      this._kc.loadFromFile(tempFile);
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
    } catch (error: any) {
      throw new K8sMcpError(
        "validation",
        "Failed to parse KUBECONFIG_YAML environment variable",
        { operation: "loadFromInlineYaml" },
        error,
        ["Ensure KUBECONFIG_YAML contains valid YAML", "Check YAML syntax and structure"]
      );
    }
  }

  private loadFromInlineJson(jsonContent: string): void {
    try {
      // Write to a temporary file and load it
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, 'kubeconfig.json');
      fs.writeFileSync(tempFile, jsonContent);
      
      this._kc.loadFromFile(tempFile);
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
    } catch (error: any) {
      throw new K8sMcpError(
        "validation",
        "Failed to parse KUBECONFIG_JSON environment variable",
        { operation: "loadFromInlineJson" },
        error,
        ["Ensure KUBECONFIG_JSON contains valid JSON", "Check JSON syntax and structure"]
      );
    }
  }

  private loadFromEnvVars(): void {
    const server = process.env.K8S_SERVER;
    const token = process.env.K8S_TOKEN;
    const caCert = process.env.K8S_CA_CERT;
    
    if (!server || !token) {
      throw new K8sMcpError(
        "validation",
        "K8S_SERVER and K8S_TOKEN environment variables must both be set",
        { operation: "loadFromEnvVars" },
        undefined,
        ["Set both K8S_SERVER and K8S_TOKEN environment variables", "Optionally set K8S_CA_CERT for custom CA"]
      );
    }

    const cluster: k8s.Cluster = {
      name: 'default',
      server: server,
      caFile: caCert,
      skipTLSVerify: !caCert,
    };

    const user: k8s.User = {
      name: 'default',
      authProvider: {
        name: 'token',
        config: {
          'token': token,
        },
      },
    };

    const context: k8s.Context = {
      name: 'default',
      cluster: 'default',
      user: 'default',
    };

    this._kc.loadFromOptions({
      clusters: [cluster],
      users: [user],
      contexts: [context],
      currentContext: 'default',
    });
  }

  private isInCluster(): boolean {
    try {
      return fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
    } catch {
      return false;
    }
  }

  private setupConnectionPooling(): void {
    // @kubernetes/client-node 2.x uses undici as its HTTP backend, so node's
    // https.Agent (and the old cluster.agent hook) is ignored. Own the transport
    // explicitly via a tuned global undici dispatcher — shared with the client
    // (same deduped undici instance) — so keep-alive and per-origin connection
    // limits stay stable across client-node/undici upgrades instead of drifting
    // with undici defaults (idle keep-alive ~4s, connections uncapped). This
    // server fans many list/get calls out in parallel, so a bounded, warm pool
    // matters for throughput and avoids socket churn.
    const maxSockets = parseInt(process.env.K8S_MAX_SOCKETS || "", 10);
    const keepAliveMs = parseInt(process.env.K8S_KEEPALIVE_MS || "", 10);
    setGlobalDispatcher(
      new UndiciAgent({
        connections: Number.isFinite(maxSockets) && maxSockets > 0 ? maxSockets : 50,
        keepAliveTimeout: Number.isFinite(keepAliveMs) && keepAliveMs > 0 ? keepAliveMs : 30000,
        keepAliveMaxTimeout: 600000, // hard cap idle keep-alive at 10 minutes
      })
    );
  }

  private validateConfiguration(): void {
    const currentContext = this._kc.getCurrentContext();
    if (!currentContext) {
      throw new K8sMcpError(
        "validation",
        "No current context found in kubeconfig. Please configure kubectl with a valid context.",
        { operation: "validateConfiguration" },
        undefined,
        [
          "Run 'kubectl config current-context' to check current context",
          "Use 'kubectl config use-context <context-name>' to set a context",
          "Verify kubeconfig file exists at ~/.kube/config"
        ]
      );
    }

    const cluster = this._kc.getCurrentCluster();
    if (!cluster || !cluster.server) {
      throw new K8sMcpError(
        "validation",
        "No cluster server found in current context.",
        { operation: "validateConfiguration", resource: currentContext },
        undefined,
        [
          "Check your kubeconfig has valid cluster configuration",
          "Verify the cluster is accessible"
        ]
      );
    }

    // Validate server URL format
    try {
      new URL(cluster.server);
    } catch {
      throw new K8sMcpError(
        "validation",
        `Invalid cluster server URL: ${cluster.server}`,
        { operation: "validateConfiguration", resource: cluster.server },
        undefined,
        [
          "Check your kubeconfig cluster server URL format",
          "URL should be valid HTTP/HTTPS URL"
        ]
      );
    }
  }

  private async retryWithBackoff<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    const context: ErrorContext = { operation: operationName };
    
    return safeExecute(operation, context, {
      retry: true,
      maxRetries: this.retryAttempts,
      timeout: this.requestTimeout
    });
  }

  private sanitizeResourceName(name: string): string {
    validateResourceName(name);
    return name;
  }

  private sanitizeNamespace(namespace?: string): string {
    if (!namespace) return 'default';
    
    try {
      validateNamespace(namespace);
      return namespace;
    } catch (error) {
      // If validation fails, return default with warning
      console.error(`Invalid namespace "${namespace}", using default: ${error}`);
      return 'default';
    }
  }

  // Getters for accessing kubeconfig
  get kc(): k8s.KubeConfig {
    return this._kc;
  }

  // Context Management
  getContexts(): k8s.Context[] {
    return this._kc.getContexts();
  }

  getCurrentContext(): string {
    return this._kc.getCurrentContext();
  }

  setCurrentContext(context: string): void {
    this._kc.setCurrentContext(context);
    this.refreshClients();
  }

  private refreshClients(): void {
    this.coreV1Api = this._kc.makeApiClient(k8s.CoreV1Api);
    this.appsV1Api = this._kc.makeApiClient(k8s.AppsV1Api);
    this.batchV1Api = this._kc.makeApiClient(k8s.BatchV1Api);
    this.networkingV1Api = this._kc.makeApiClient(k8s.NetworkingV1Api);
    this.storageV1Api = this._kc.makeApiClient(k8s.StorageV1Api);
    this.rbacV1Api = this._kc.makeApiClient(k8s.RbacAuthorizationV1Api);
    this.autoscalingV2Api = this._kc.makeApiClient(k8s.AutoscalingV2Api);
  }

  /**
   * Execute an operation with a specific context, then restore the original context
   * This is useful for multi-cluster operations without affecting global state
   */
  async withContext<T>(contextName: string, operation: () => Promise<T>): Promise<T> {
    const originalContext = this._kc.getCurrentContext();
    
    // Validate context exists
    const contexts = this._kc.getContexts();
    const targetContext = contexts.find((ctx: k8s.Context) => ctx.name === contextName);
    
    if (!targetContext) {
      const availableContexts = contexts.map((ctx: k8s.Context) => ctx.name);
      throw new K8sMcpError(
        "validation",
        `Context "${contextName}" not found in kubeconfig`,
        { operation: "withContext", resource: contextName },
        undefined,
        [
          `Available contexts: ${availableContexts.join(", ") || "none"}`,
          "Use 'k8s_list_contexts' to see all available contexts",
          "Run 'kubectl config get-contexts' to verify contexts"
        ]
      );
    }
    
    try {
      // Switch to target context
      this._kc.setCurrentContext(contextName);
      this.refreshClients();
      
      // Execute operation
      return await operation();
    } finally {
      // Always restore original context
      this._kc.setCurrentContext(originalContext);
      this.refreshClients();
    }
  }

  // Cluster Info
  async getClusterVersion(): Promise<any> {
    return this.retryWithBackoff(
      () => this.rawApiRequest("/version"),
      "Get cluster version"
    );
  }

  async getComponentStatuses(): Promise<k8s.V1ComponentStatus[]> {
    return this.retryWithBackoff(
      async () => {
        const response = await this.coreV1Api.listComponentStatus();
        return response.items || [];
      },
      "List component statuses"
    );
  }

  // Nodes
  getCoreV1Api(): k8s.CoreV1Api {
    return this.coreV1Api;
  }

  getAppsV1Api(): k8s.AppsV1Api {
    return this.appsV1Api;
  }

  getBatchV1Api(): k8s.BatchV1Api {
    return this.batchV1Api;
  }

  getNetworkingV1Api(): k8s.NetworkingV1Api {
    return this.networkingV1Api;
  }

  getStorageV1Api(): k8s.StorageV1Api {
    return this.storageV1Api;
  }

  getRbacV1Api(): k8s.RbacAuthorizationV1Api {
    return this.rbacV1Api;
  }

  getAutoscalingV2Api(): k8s.AutoscalingV2Api {
    return this.autoscalingV2Api;
  }

  async listNodes(limitOrOptions?: number | ListOptions): Promise<k8s.V1Node[]> {
    const opts = parseListOptions(limitOrOptions);
    return this.retryWithBackoff(
      async () => {
        const response = await this.coreV1Api.listNode({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
        return response.items || [];
      },
      "List nodes"
    );
  }

  async getNode(name: string): Promise<k8s.V1Node> {
    this.sanitizeResourceName(name);
    
    return this.retryWithBackoff(
      async () => {
        const response = await this.coreV1Api.readNode({ name }, {});
        if (!response) {
          throw new K8sMcpError(
            "not_found",
            `Node ${name} not found`,
            { operation: "getNode", resource: name },
            undefined,
            ["Check node name is correct", "List nodes to see available nodes"]
          );
        }
        return response;
      },
      `Get node ${name}`
    );
  }

  async patchNode(name: string, patch: any, options: { dryRun?: string } = {}): Promise<k8s.V1Node> {
    return safeExecute(async () => {
      const response = await this.coreV1Api.patchNode({
        name,
        body: patch,
        dryRun: options.dryRun,
      }, {
        middleware: [{
          pre: (context: k8s.RequestContext) => {
            context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
            return Promise.resolve(context);
          },
          post: (response: k8s.ResponseContext) => Promise.resolve(response)
        }]
      } as any);
      return response;
    }, { operation: "patchNode", resource: name });
  }

  // Pods

  /**
   * List pods in a namespace or across all namespaces
   * @param namespace - Optional namespace filter. If not provided, lists pods from all namespaces
   * @param limit - Maximum number of pods to return (pagination)
   * @returns Array of pods
   */
  async listPods(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1Pod[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace 
      ? await this.coreV1Api.listNamespacedPod({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.coreV1Api.listPodForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  /**
   * Get a specific pod by name and namespace
   * @param name - Pod name
   * @param namespace - Pod namespace
   * @returns Pod object
   */
  async getPod(name: string, namespace: string): Promise<k8s.V1Pod> {
    const response = await this.coreV1Api.readNamespacedPod({ name, namespace });
    return response;
  }

  /**
   * Delete a pod by name and namespace
   * @param name - Pod name
   * @param namespace - Pod namespace
   */
  async deletePod(
    name: string,
    namespace: string,
    options: { dryRun?: string; gracePeriodSeconds?: number; propagationPolicy?: string } = {}
  ): Promise<void> {
    await this.coreV1Api.deleteNamespacedPod({
      name,
      namespace,
      dryRun: options.dryRun,
      gracePeriodSeconds: options.gracePeriodSeconds,
      propagationPolicy: options.propagationPolicy,
    });
  }

  /**
   * Get pod logs with full kubectl logs parameter support
   * @param name - Pod name
   * @param namespace - Pod namespace
   * @param container - Container name (for multi-container pods)
   * @param tailLines - Number of lines to return from the end of the logs
   * @param follow - Whether to follow the log stream (not fully supported in MCP)
   * @param previous - Return logs from previous container instance
   * @param sinceSeconds - Only return logs newer than a relative duration (e.g., 300 for 5 minutes)
   * @param sinceTime - Only return logs after a specific date (RFC3339 format)
   * @param limitBytes - Maximum bytes of logs to return
   * @returns Pod logs as string
   */
  async getPodLogs(
    name: string,
    namespace: string,
    container?: string,
    tailLines?: number,
    follow?: boolean,
    previous?: boolean,
    sinceSeconds?: number,
    sinceTime?: string,
    limitBytes?: number
  ): Promise<string> {
    try {
      // Note: follow=true is not fully supported in MCP context due to streaming limitations
      // The response will be truncated to initial logs only
      const response = await (this.coreV1Api as any).readNamespacedPodLog({
        name,
        namespace,
        container
      });
      return response;
    } catch (error: any) {
      // Log the actual error for debugging
      console.error(`Log retrieval error for ${name}/${namespace}:`, error?.message || error);
      // If logs are empty or container produces no logs (like pause image), return empty string
      if (error?.statusCode === 400 || error?.message?.includes('container not running')) {
        return '';
      }
      throw error;
    }
  }

  // Namespaces

  /**
   * Batch get multiple resources in parallel
   * @param resources - Array of resource requests with kind, name, and namespace
   * @returns Array of resource objects
   */
  async batchGetResources(resources: { kind: string; name: string; namespace?: string }[]): Promise<any[]> {
    return Promise.all(resources.map(async (r) => {
      const ns = r.namespace || "default";
      try {
        switch (r.kind) {
          case "Pod":
            return await this.getPod(r.name, ns);
          case "Deployment":
            return await this.getDeployment(r.name, ns);
          case "Service":
            return await this.coreV1Api.readNamespacedService({ name: r.name, namespace: ns });
          case "ConfigMap":
            return await this.coreV1Api.readNamespacedConfigMap({ name: r.name, namespace: ns });
          case "Secret":
            return await this.coreV1Api.readNamespacedSecret({ name: r.name, namespace: ns });
          case "Node":
            return await this.getNode(r.name);
          case "Namespace":
            return await this.coreV1Api.readNamespace({ name: r.name });
          case "StatefulSet":
            return await this.appsV1Api.readNamespacedStatefulSet({ name: r.name, namespace: ns });
          case "DaemonSet":
            return await this.appsV1Api.readNamespacedDaemonSet({ name: r.name, namespace: ns });
          case "Job":
            return await this.batchV1Api.readNamespacedJob({ name: r.name, namespace: ns });
          case "CronJob":
            return await this.batchV1Api.readNamespacedCronJob({ name: r.name, namespace: ns });
          case "Ingress":
            return await this.networkingV1Api.readNamespacedIngress({ name: r.name, namespace: ns });
          case "PersistentVolumeClaim":
            return await this.coreV1Api.readNamespacedPersistentVolumeClaim({ name: r.name, namespace: ns });
          case "PersistentVolume":
            return await this.coreV1Api.readPersistentVolume({ name: r.name });
          case "StorageClass":
            return await this.storageV1Api.readStorageClass({ name: r.name });
          case "ServiceAccount":
            return await this.coreV1Api.readNamespacedServiceAccount({ name: r.name, namespace: ns });
          case "Role":
            return await this.rbacV1Api.readNamespacedRole({ name: r.name, namespace: ns });
          case "ClusterRole":
            return await this.rbacV1Api.readClusterRole({ name: r.name });
          case "RoleBinding":
            return await this.rbacV1Api.readNamespacedRoleBinding({ name: r.name, namespace: ns });
          case "ClusterRoleBinding":
            return await this.rbacV1Api.readClusterRoleBinding({ name: r.name });
          default:
            return { error: `Unsupported resource kind: ${r.kind}` };
        }
      } catch (error: any) {
        return { 
          kind: r.kind, 
          name: r.name, 
          namespace: ns, 
          error: error.message || String(error) 
        };
      }
    }));
  }

  /**
   * List all namespaces in the cluster
   * @returns Array of namespaces
   */
  async listNamespaces(limitOrOptions?: number | ListOptions): Promise<k8s.V1Namespace[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = await this.coreV1Api.listNamespace({
      limit: opts.limit,
      labelSelector: opts.labelSelector,
      fieldSelector: opts.fieldSelector,
    });
    return response.items || [];
  }

  // Deployments

  /**
   * List deployments in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of deployments to return or ListOptions
   * @returns Array of deployments
   */
  async listDeployments(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1Deployment[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.appsV1Api.listNamespacedDeployment({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.appsV1Api.listDeploymentForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  /**
   * Get a specific deployment by name and namespace
   * @param name - Deployment name
   * @param namespace - Deployment namespace
   * @returns Deployment object
   */
  async getDeployment(name: string, namespace: string): Promise<k8s.V1Deployment> {
    const response = await this.appsV1Api.readNamespacedDeployment({ name, namespace });
    return response;
  }

  /**
   * Scale a deployment to the specified number of replicas
   * @param name - Deployment name
   * @param namespace - Deployment namespace
   * @param replicas - Number of replicas
   * @returns Updated deployment
   */
  async scaleDeployment(name: string, namespace: string, replicas: number, options: { dryRun?: string } = {}): Promise<k8s.V1Deployment> {
    const patch = { spec: { replicas } };
    return safeExecute(async () => {
      const response = await this.appsV1Api.patchNamespacedDeployment({
        name,
        namespace,
        body: patch,
        dryRun: options.dryRun,
      }, {
        middleware: [{
          pre: (context: k8s.RequestContext) => {
            context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
            return Promise.resolve(context);
          },
          post: (response: k8s.ResponseContext) => Promise.resolve(response)
        }]
      } as any);
      return response;
    }, { operation: "scaleDeployment", resource: `${namespace}/${name}` });
  }

  /**
   * Restart a deployment by updating its pod template annotation
   * @param name - Deployment name
   * @param namespace - Deployment namespace
   * @returns Updated deployment
   */
  async restartDeployment(name: string, namespace: string, options: { dryRun?: string } = {}): Promise<k8s.V1Deployment> {
    const now = new Date().toISOString();
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/restartedAt": now,
            },
          },
        },
      },
    };
    return safeExecute(async () => {
      const response = await this.appsV1Api.patchNamespacedDeployment({
        name,
        namespace,
        body: patch,
        dryRun: options.dryRun,
      }, {
        middleware: [{
          pre: (context: k8s.RequestContext) => {
            context.setHeaderParam("Content-Type", "application/strategic-merge-patch+json");
            return Promise.resolve(context);
          },
          post: (response: k8s.ResponseContext) => Promise.resolve(response)
        }]
      } as any);
      return response;
    }, { operation: "restartDeployment", resource: `${namespace}/${name}` });
  }

  // Services

  /**
   * List services in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limit - Maximum number of services to return
   * @returns Array of services
   */
  async listServices(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1Service[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.coreV1Api.listNamespacedService({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.coreV1Api.listServiceForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // Events

  /**
   * List events in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param fieldSelector - Field selector to filter events
   * @param limit - Maximum number of events to return
   * @returns Array of events
   */
  async listEvents(
    namespace?: string,
    fieldSelectorOrOptions?: string | ListOptions,
    limit?: number
  ): Promise<k8s.CoreV1Event[]> {
    let fieldSelector: string | undefined;
    let labelSelector: string | undefined;
    let actualLimit = limit;

    if (typeof fieldSelectorOrOptions === "object" && fieldSelectorOrOptions !== null) {
      fieldSelector = fieldSelectorOrOptions.fieldSelector;
      labelSelector = fieldSelectorOrOptions.labelSelector;
      if (fieldSelectorOrOptions.limit !== undefined) {
        actualLimit = fieldSelectorOrOptions.limit;
      }
    } else {
      fieldSelector = fieldSelectorOrOptions;
    }

    const response = namespace
      ? await this.coreV1Api.listNamespacedEvent({
          namespace,
          fieldSelector,
          labelSelector,
          limit: actualLimit,
        })
      : await this.coreV1Api.listEventForAllNamespaces({
          fieldSelector,
          labelSelector,
          limit: actualLimit,
        });
    return response.items || [];
  }

  // Jobs

  /**
   * List jobs in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of jobs to return or ListOptions
   * @returns Array of jobs
   */
  async listJobs(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1Job[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.batchV1Api.listNamespacedJob({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.batchV1Api.listJobForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // CronJobs

  /**
   * List cronjobs in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of cronjobs to return or ListOptions
   * @returns Array of cronjobs
   */
  async listCronJobs(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1CronJob[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.batchV1Api.listNamespacedCronJob({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.batchV1Api.listCronJobForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // Ingress

  /**
   * List ingresses in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of ingresses to return or ListOptions
   * @returns Array of ingresses
   */
  async listIngresses(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1Ingress[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.networkingV1Api.listNamespacedIngress({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.networkingV1Api.listIngressForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // PVC

  /**
   * List persistent volume claims in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of PVCs to return or ListOptions
   * @returns Array of PVCs
   */
  async listPVCs(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1PersistentVolumeClaim[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.coreV1Api.listNamespacedPersistentVolumeClaim({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.coreV1Api.listPersistentVolumeClaimForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // PV

  /**
   * List all persistent volumes
   * @param limitOrOptions - Maximum number of PVs to return or ListOptions
   * @returns Array of PVs
   */
  async listPVs(limitOrOptions?: number | ListOptions): Promise<k8s.V1PersistentVolume[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = await this.coreV1Api.listPersistentVolume({
      limit: opts.limit,
      labelSelector: opts.labelSelector,
      fieldSelector: opts.fieldSelector,
    });
    return response.items || [];
  }

  // StorageClasses

  /**
   * List all storage classes
   * @param limitOrOptions - Maximum number of storage classes to return or ListOptions
   * @returns Array of storage classes
   */
  async listStorageClasses(limitOrOptions?: number | ListOptions): Promise<k8s.V1StorageClass[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = await this.storageV1Api.listStorageClass({
      limit: opts.limit,
      labelSelector: opts.labelSelector,
      fieldSelector: opts.fieldSelector,
    });
    return response.items || [];
  }

  // ConfigMaps

  /**
   * List configmaps in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of config maps to return or ListOptions
   * @returns Array of configmaps
   */
  async listConfigMaps(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1ConfigMap[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.coreV1Api.listNamespacedConfigMap({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.coreV1Api.listConfigMapForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // Secrets

  /**
   * List secrets in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of secrets to return or ListOptions
   * @returns Array of secrets
   */
  async listSecrets(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1Secret[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.coreV1Api.listNamespacedSecret({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.coreV1Api.listSecretForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // ServiceAccounts

  /**
   * List service accounts in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of service accounts to return or ListOptions
   * @returns Array of service accounts
   */
  async listServiceAccounts(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1ServiceAccount[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.coreV1Api.listNamespacedServiceAccount({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.coreV1Api.listServiceAccountForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // Roles

  /**
   * List roles in a namespace or across all namespaces
   * @param namespace - Optional namespace filter
   * @param limitOrOptions - Maximum number of roles to return or ListOptions
   * @returns Array of roles
   */
  async listRoles(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1Role[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.rbacV1Api.listNamespacedRole({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.rbacV1Api.listRoleForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // ClusterRoles

  /**
   * List all cluster roles
   * @param limitOrOptions - Maximum number of cluster roles to return or ListOptions
   * @returns Array of cluster roles
   */
  async listClusterRoles(limitOrOptions?: number | ListOptions): Promise<k8s.V1ClusterRole[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = await this.rbacV1Api.listClusterRole({
      limit: opts.limit,
      labelSelector: opts.labelSelector,
      fieldSelector: opts.fieldSelector,
    });
    return response.items || [];
  }

  // StatefulSets

  /**
   * List statefulsets in a namespace or across all namespaces
   */
  async listStatefulSets(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1StatefulSet[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.appsV1Api.listNamespacedStatefulSet({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.appsV1Api.listStatefulSetForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // DaemonSets

  /**
   * List daemonsets in a namespace or across all namespaces
   */
  async listDaemonSets(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1DaemonSet[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.appsV1Api.listNamespacedDaemonSet({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.appsV1Api.listDaemonSetForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // ReplicaSets

  /**
   * List replicasets in a namespace or across all namespaces
   */
  async listReplicaSets(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1ReplicaSet[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.appsV1Api.listNamespacedReplicaSet({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.appsV1Api.listReplicaSetForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // RoleBindings

  /**
   * List rolebindings in a namespace or across all namespaces
   */
  async listRoleBindings(namespace?: string, limitOrOptions?: number | ListOptions): Promise<k8s.V1RoleBinding[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = namespace
      ? await this.rbacV1Api.listNamespacedRoleBinding({
          namespace,
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        })
      : await this.rbacV1Api.listRoleBindingForAllNamespaces({
          limit: opts.limit,
          labelSelector: opts.labelSelector,
          fieldSelector: opts.fieldSelector,
        });
    return response.items || [];
  }

  // ClusterRoleBindings

  /**
   * List all cluster role bindings
   */
  async listClusterRoleBindings(limitOrOptions?: number | ListOptions): Promise<k8s.V1ClusterRoleBinding[]> {
    const opts = parseListOptions(limitOrOptions);
    const response = await this.rbacV1Api.listClusterRoleBinding({
      limit: opts.limit,
      labelSelector: opts.labelSelector,
      fieldSelector: opts.fieldSelector,
    });
    return response.items || [];
  }

  // API group mappings for resource types
  private static readonly RESOURCE_API_MAP: Record<string, { group: string; version: string; resource: string; namespaced: boolean }> = {
    "Pod": { group: "", version: "v1", resource: "pods", namespaced: true },
    "Service": { group: "", version: "v1", resource: "services", namespaced: true },
    "ConfigMap": { group: "", version: "v1", resource: "configmaps", namespaced: true },
    "Secret": { group: "", version: "v1", resource: "secrets", namespaced: true },
    "PersistentVolumeClaim": { group: "", version: "v1", resource: "persistentvolumeclaims", namespaced: true },
    "PersistentVolume": { group: "", version: "v1", resource: "persistentvolumes", namespaced: false },
    "Namespace": { group: "", version: "v1", resource: "namespaces", namespaced: false },
    "ServiceAccount": { group: "", version: "v1", resource: "serviceaccounts", namespaced: true },
    "ResourceQuota": { group: "", version: "v1", resource: "resourcequotas", namespaced: true },
    "LimitRange": { group: "", version: "v1", resource: "limitranges", namespaced: true },
    "Deployment": { group: "apps", version: "v1", resource: "deployments", namespaced: true },
    "StatefulSet": { group: "apps", version: "v1", resource: "statefulsets", namespaced: true },
    "DaemonSet": { group: "apps", version: "v1", resource: "daemonsets", namespaced: true },
    "ReplicaSet": { group: "apps", version: "v1", resource: "replicasets", namespaced: true },
    "Job": { group: "batch", version: "v1", resource: "jobs", namespaced: true },
    "CronJob": { group: "batch", version: "v1", resource: "cronjobs", namespaced: true },
    "Ingress": { group: "networking.k8s.io", version: "v1", resource: "ingresses", namespaced: true },
    "NetworkPolicy": { group: "networking.k8s.io", version: "v1", resource: "networkpolicies", namespaced: true },
    "StorageClass": { group: "storage.k8s.io", version: "v1", resource: "storageclasses", namespaced: false },
    "Role": { group: "rbac.authorization.k8s.io", version: "v1", resource: "roles", namespaced: true },
    "ClusterRole": { group: "rbac.authorization.k8s.io", version: "v1", resource: "clusterroles", namespaced: false },
    "RoleBinding": { group: "rbac.authorization.k8s.io", version: "v1", resource: "rolebindings", namespaced: true },
    "ClusterRoleBinding": { group: "rbac.authorization.k8s.io", version: "v1", resource: "clusterrolebindings", namespaced: false },
    "HorizontalPodAutoscaler": { group: "autoscaling", version: "v2", resource: "horizontalpodautoscalers", namespaced: true },
    "PodDisruptionBudget": { group: "policy", version: "v1", resource: "poddisruptionbudgets", namespaced: true },
    "Endpoints": { group: "", version: "v1", resource: "endpoints", namespaced: true },
    "EndpointSlice": { group: "discovery.k8s.io", version: "v1", resource: "endpointslices", namespaced: true },
    "CustomResourceDefinition": { group: "apiextensions.k8s.io", version: "v1", resource: "customresourcedefinitions", namespaced: false },
    "CertificateSigningRequest": { group: "certificates.k8s.io", version: "v1", resource: "certificatesigningrequests", namespaced: false },
    "Lease": { group: "coordination.k8s.io", version: "v1", resource: "leases", namespaced: true },
    "PriorityClass": { group: "scheduling.k8s.io", version: "v1", resource: "priorityclasses", namespaced: false },
  };

  // Apply YAML with enhanced error handling - supports ALL resource types
  async applyManifest(
    manifest: string,
    options: { dryRun?: string; fieldManager?: string; forceConflicts?: boolean; serverSide?: boolean } = {}
  ): Promise<any> {
    const validation = validateYamlManifest(manifest);
    if (!validation.valid) {
      throw new K8sMcpError(
        "validation",
        `Invalid manifest: ${validation.error}`,
        { operation: "applyManifest" },
        undefined,
        [
          "Check YAML syntax is correct",
          "Ensure all required fields (apiVersion, kind, metadata.name) are present",
          "Validate resource names follow Kubernetes conventions"
        ]
      );
    }

    const documents = validation.documents || [];
    const results = [];

    for (const doc of documents) {
      if (!doc || !doc.apiVersion || !doc.kind) {
        continue;
      }

      const { kind, metadata } = doc;
      const namespace = metadata?.namespace || "default";

      if (options.dryRun === "client") {
        results.push({
          kind,
          name: metadata?.name,
          namespace,
          status: "validated",
          dryRun: "client",
          message: `[Client Dry-Run] ${kind} '${metadata?.name}' in namespace '${namespace}' validated successfully.`,
        });
        continue;
      }

      const context: ErrorContext = {
        operation: "applyManifest",
        resource: metadata?.name,
        namespace
      };

      const queryParams: string[] = [];
      if (options.dryRun === "server") queryParams.push("dryRun=All");
      if (options.fieldManager) queryParams.push(`fieldManager=${encodeURIComponent(options.fieldManager)}`);
      if (options.forceConflicts) queryParams.push("force=true");
      const qs = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      const method = options.serverSide ? "PATCH" : "POST";

      try {
        const mapping = K8sClient.RESOURCE_API_MAP[kind];
        if (mapping) {
          // Use the generic raw API to create the resource
          const basePath = mapping.group
            ? `/apis/${mapping.group}/${mapping.version}`
            : `/api/${mapping.version}`;
          const path = mapping.namespaced
            ? `${basePath}/namespaces/${namespace}/${mapping.resource}${qs}`
            : `${basePath}/${mapping.resource}${qs}`;

          const result = await this.rawApiRequest(path, { method, body: doc });
          results.push({ kind, name: metadata.name, status: "created", dryRun: options.dryRun || "none", result });
        } else {
          // Attempt to derive API path from apiVersion for unknown types
          const apiVersion = doc.apiVersion as string;
          const resourcePlural = kind.toLowerCase() + "s";
          const basePath = apiVersion.includes("/")
            ? `/apis/${apiVersion}`
            : `/api/${apiVersion}`;
          const path = metadata?.namespace
            ? `${basePath}/namespaces/${namespace}/${resourcePlural}${qs}`
            : `${basePath}/${resourcePlural}${qs}`;

          try {
            const result = await this.rawApiRequest(path, { method, body: doc });
            results.push({ kind, name: metadata.name, status: "created", dryRun: options.dryRun || "none", result });
          } catch {
            results.push({
              kind,
              name: metadata.name,
              status: "error",
              error: `Unknown resource type '${kind}'. Try using kubectl apply directly.`,
            });
          }
        }
      } catch (error) {
        const classified = classifyError(error, context);
        results.push({
          kind,
          name: metadata.name,
          status: "error",
          error: classified.message,
          type: classified.type,
          suggestions: classified.suggestions
        });
      }
    }

    return results;
  }

  // Raw API access with full HTTP method support
  // Raw API access with full HTTP method support
  async rawApiRequest(path: string, methodOrOptions?: any, body?: any, ...args: any[]): Promise<any> {
    const cluster = this._kc.getCurrentCluster();
    if (!cluster) {
      throw new K8sMcpError(
        "validation",
        "No current cluster configured for API request",
        { operation: "rawApiRequest" },
        undefined,
        ["Check kubeconfig has valid current context"]
      );
    }

    let method = "GET";
    let requestBody = body;
    let extraOptions: any = {};

    if (typeof methodOrOptions === "string") {
      method = methodOrOptions;
      requestBody = body;
      // If there are more args, the last one might be an options object
      if (args.length > 0) {
        const lastArg = args[args.length - 1];
        if (lastArg && typeof lastArg === "object") {
          extraOptions = lastArg;
        }
      }
    } else if (methodOrOptions && typeof methodOrOptions === "object") {
      method = methodOrOptions.method || "GET";
      requestBody = methodOrOptions.body;
      extraOptions = methodOrOptions;
    }

    const context: ErrorContext = { operation: `rawApiRequest ${method}`, resource: path };

    return safeExecute(async () => {
      const opts: any = {
        headers: { ...extraOptions.headers },
        method
      };
      
      // The new way to apply auth/TLS options to a manual request
      await this._kc.applyToHTTPSOptions(opts);

      const url = new URL(path, cluster.server);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      const bodyStr = requestBody ? JSON.stringify(requestBody) : undefined;

      return new Promise((resolve, reject) => {
        const headers: Record<string, string> = { ...opts.headers };
        if (bodyStr) {
          headers["Content-Type"] = headers["Content-Type"] || "application/json";
          headers["Content-Length"] = String(Buffer.byteLength(bodyStr));
        }

        const requestOptions: any = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers,
          rejectUnauthorized: opts.rejectUnauthorized !== undefined ? opts.rejectUnauthorized : false,
        };

        // Apply TLS options from kubeconfig (CA cert, client cert, key)
        if (opts.ca) requestOptions.ca = opts.ca;
        if (opts.cert) requestOptions.cert = opts.cert;
        if (opts.key) requestOptions.key = opts.key;
        if (opts.pfx) requestOptions.pfx = opts.pfx;
        if (opts.passphrase) requestOptions.passphrase = opts.passphrase;

        const req = httpModule.request(requestOptions, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 400) {
              let errorDetail = data;
              try { errorDetail = JSON.stringify(JSON.parse(data), null, 2); } catch {}
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}\n${errorDetail}`));
            } else {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve(data);
              }
            }
          });
        });

        req.on('error', (err: Error) => {
          reject(new Error(`Request failed: ${err.message}`));
        });

        if (bodyStr) {
          req.write(bodyStr);
        }
        req.end();
      });
    }, context, { retry: method === "GET", timeout: 30000 });
  }
}
