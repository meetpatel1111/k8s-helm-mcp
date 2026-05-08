import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "./k8s-client.js";
import { registerClusterTools } from "./k8s-tools/cluster.js";
import { registerNodeTools } from "./k8s-tools/nodes.js";
import { registerPodTools } from "./k8s-tools/pods.js";
import { registerWorkloadTools } from "./k8s-tools/workloads.js";
import { registerNetworkingTools } from "./k8s-tools/networking.js";
import { registerStorageTools } from "./k8s-tools/storage.js";
import { registerSecurityTools } from "./k8s-tools/security.js";
import { registerMonitoringTools } from "./k8s-tools/monitoring.js";
import { registerConfigTools } from "./k8s-tools/config.js";
import { registerIncidentSnapshotTools } from "./k8s-tools/incident-snapshot.js";
import { registerChangesSinceTools } from "./k8s-tools/changes-since.js";
import { registerAdvancedTools } from "./k8s-tools/advanced.js";
import { registerBlastRadiusTools } from "./k8s-tools/blast-radius.js";
import { registerWorkloadDiffTools } from "./k8s-tools/workload-diff.js";
import { registerSilentKillersTools } from "./k8s-tools/silent-killers.js";
import { registerTemplateTools } from "./k8s-tools/templates.js";
import { registerWebSocketTools } from "./k8s-tools/websocket.js";
import { registerHelmReleaseListTools } from "./helm-tools/release-list.js";
import { registerHelmReleaseStatusTools } from "./helm-tools/release-status.js";
import { registerHelmReleaseHistoryTools } from "./helm-tools/release-history.js";
import { registerHelmReleaseGetValuesTools } from "./helm-tools/release-get-values.js";
import { registerHelmReleaseInstallTools } from "./helm-tools/release-install.js";
import { registerHelmReleaseUninstallTools } from "./helm-tools/release-uninstall.js";
import { registerHelmReleaseUpgradeTools } from "./helm-tools/release-upgrade.js";
import { registerHelmReleaseRollbackTools } from "./helm-tools/release-rollback.js";
import { registerHelmReleaseTestTools } from "./helm-tools/release-test.js";
import { registerHelmReleaseGetInfoTools } from "./helm-tools/release-get-info.js";
import { registerHelmSearchHubTools } from "./helm-tools/search-hub.js";
import { registerHelmRepoManagementTools } from "./helm-tools/repo-management.js";
import { registerHelmShowChartTools } from "./helm-tools/show-chart.js";
import { registerHelmChartManagementTools } from "./helm-tools/chart-management.js";
import { registerHelmChartTemplateTools } from "./helm-tools/chart-template.js";
import { registerHelmDependencyManagementTools } from "./helm-tools/dependency-management.js";
import { registerHelmPluginManagementTools } from "./helm-tools/plugin-management.js";
import { registerHelmRegistryManagementTools } from "./helm-tools/registry-management.js";
import { registerHelmEnvironmentTools } from "./helm-tools/environment.js";
import { registerDiagnosticsTools } from "./k8s-tools/diagnostics.js";
import { registerMultiClusterTools } from "./k8s-tools/multi-cluster.js";
import { classifyError, ErrorContext } from "./error-handling.js";
import { loadConfig, ServerConfig } from "./config.js";
import { CacheManager } from "./cache-manager.js";
import { ToolRegistry } from "./tool-registry.js";
import { createRequire } from "module";
import { initializeTelemetry, shutdownTelemetry } from "./telemetry.js";
import { startSSEServer } from "./sse-transport.js";
import { scrubSensitiveData } from "./utils/secret-scrubber.js";
import { auditLogger } from "./audit-logger.js";
import { sanitizeInputArgs } from "./utils/input-sanitizer.js";
import { validateNamespace, validateResourceName } from "./validators.js";
import { ProtectionManager } from "./security/protection-manager.js";
import { LOGO_BASE64 } from "./assets/logo-base64.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

interface ServerInfo {
  name: string;
  version: string;
  startTime: Date;
  uptime: string;
  toolsCount: number;
  clusterInfo?: any;
  lastHealthCheck?: Date;
  errorCount: number;
  requestCount: number;
  protectionModes?: {
    infrastructure: boolean;
    strict: boolean;
    noDelete: boolean;
    strictBlockedToolCount?: number;
    noDeleteBlockedToolCount?: number;
  };
}

interface ToolMetrics {
  name: string;
  calls: number;
  errors: number;
  avgResponseTime: number;
  lastCalled?: Date;
  lastError?: string;
}


class K8sMcpServer {
  private server: Server;
  private k8sClient: K8sClient;
  private toolRegistry: ToolRegistry;
  private startTime: Date = new Date();
  private isHealthy: boolean = true;
  private lastError?: string;
  private errorCount: number = 0;
  private requestCount: number = 0;
  private toolMetrics: Map<string, ToolMetrics> = new Map();
  private lastHealthCheck?: Date;
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerTimer?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly config: ServerConfig;
  private readonly cacheManager: CacheManager;
  private readonly protectionManager: ProtectionManager;
  // Sliding window for error rate tracking (timestamps of recent errors)
  private recentErrors: number[] = [];
  
  // Per-tool timeout overrides (ms)
  private readonly TOOL_TIMEOUTS: Record<string, number> = {
    "k8s_cluster_info_dump": 120000,
    "k8s_server_health": 60000,
    "k8s_analyze_pod_failure": 60000,
    "k8s_suggest_optimizations": 60000,
    "k8s_debug_scheduling": 45000,
    "k8s_service_topology": 45000,
    "k8s_find_orphaned_resources": 60000,
    "k8s_helm_list": 30000,
    "k8s_helm_status": 30000,
    "k8s_namespace_summary": 60000,
    "k8s_resource_age_report": 60000,
  };

  constructor() {
    // Initialize OpenTelemetry first
    initializeTelemetry();

    // Load configuration
    this.config = loadConfig();

    // Initialize protection manager
    this.protectionManager = new ProtectionManager({
      infraProtectionEnabled: this.config.infraProtectionEnabled,
      strictProtectionEnabled: this.config.strictProtectionEnabled,
      noDeleteProtectionEnabled: this.config.noDeleteProtectionEnabled,
    });

    // Initialize cache manager
    this.cacheManager = new CacheManager(this.config.cacheDefaultTtl);

    // Initialize tool registry
    this.toolRegistry = new ToolRegistry();

    this.setupGracefulShutdown();

    console.error(`Infrastructure Protection Mode: ${this.protectionManager.isInfraProtectionEnabled() ? "ENABLED" : "DISABLED"}`);
    if (this.protectionManager.isInfraProtectionEnabled()) {
      console.error(`Destructive tools are blocked. Use k8s_toggle_protection_mode to disable.`);
    }
    console.error(`Strict Protection Mode: ${this.protectionManager.isStrictProtectionEnabled() ? "ENABLED" : "DISABLED"}`);
    if (this.protectionManager.isStrictProtectionEnabled()) {
      console.error(`ALL modification operations are blocked. Only read-only tools are available.`);
    }
    console.error(`No Delete Protection Mode: ${this.protectionManager.isNoDeleteProtectionEnabled() ? "ENABLED" : "DISABLED"}`);
    if (this.protectionManager.isNoDeleteProtectionEnabled()) {
      console.error(`Delete operations are blocked. Updates and modifications are still allowed.`);
    }

    try {
      this.k8sClient = new K8sClient();
    } catch (error) {
      console.error("Failed to initialize K8sClient:", error);
      throw new Error(`Kubernetes client initialization failed: ${error}`, { cause: error });
    }
    
    this.server = new Server(
      {
        name: "k8s-helm-mcp",
        version: packageJson.version,
        icons: [
          {
            src: LOGO_BASE64,
            mimeType: "image/png"
          }
        ]
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupHealthCheck();
    this.setupErrorHandling();
  }


  private setupHandlers(): void {
    try {
      // Register all tool categories
      this.registerTools(registerClusterTools(this.k8sClient));
      this.registerTools(registerNodeTools(this.k8sClient));
      this.registerTools(registerPodTools(this.k8sClient));
      this.registerTools(registerWorkloadTools(this.k8sClient));
      this.registerTools(registerNetworkingTools(this.k8sClient));
      this.registerTools(registerStorageTools(this.k8sClient));
      this.registerTools(registerSecurityTools(this.k8sClient));
      this.registerTools(registerMonitoringTools(this.k8sClient));
      this.registerTools(registerConfigTools(this.k8sClient));
      this.registerTools(registerIncidentSnapshotTools(this.k8sClient));
      this.registerTools(registerChangesSinceTools(this.k8sClient));
      this.registerTools(registerAdvancedTools(this.k8sClient, this.cacheManager));
      this.registerTools(registerBlastRadiusTools(this.k8sClient));
      this.registerTools(registerWorkloadDiffTools(this.k8sClient));
      this.registerTools(registerSilentKillersTools(this.k8sClient));
      this.registerTools(registerTemplateTools(this.k8sClient));
      this.registerTools(registerWebSocketTools(this.k8sClient));
      this.registerTools(registerHelmReleaseListTools(this.k8sClient));
      this.registerTools(registerHelmReleaseStatusTools(this.k8sClient));
      this.registerTools(registerHelmReleaseHistoryTools(this.k8sClient));
      this.registerTools(registerHelmReleaseGetValuesTools(this.k8sClient));
      this.registerTools(registerHelmReleaseInstallTools(this.k8sClient));
      this.registerTools(registerHelmReleaseUninstallTools(this.k8sClient));
      this.registerTools(registerHelmReleaseUpgradeTools(this.k8sClient));
      this.registerTools(registerHelmReleaseRollbackTools(this.k8sClient));
      this.registerTools(registerHelmReleaseTestTools(this.k8sClient));
      this.registerTools(registerHelmReleaseGetInfoTools(this.k8sClient));
      this.registerTools(registerHelmSearchHubTools(this.k8sClient));
      this.registerTools(registerHelmRepoManagementTools(this.k8sClient));
      this.registerTools(registerHelmShowChartTools(this.k8sClient));
      this.registerTools(registerHelmChartManagementTools(this.k8sClient));
      this.registerTools(registerHelmChartTemplateTools(this.k8sClient));
      this.registerTools(registerHelmDependencyManagementTools(this.k8sClient));
      this.registerTools(registerHelmPluginManagementTools(this.k8sClient));
      this.registerTools(registerHelmRegistryManagementTools(this.k8sClient));
      this.registerTools(registerHelmEnvironmentTools(this.k8sClient));
      this.registerTools(registerDiagnosticsTools(this.k8sClient));
      this.registerTools(registerMultiClusterTools(this.k8sClient));

      // Register server management tools
      this.registerServerTools();

      console.error(`Registered ${this.toolRegistry.size()} tools successfully`);
    } catch (error) {
      console.error("Failed to register tools:", error);
      throw new Error(`Tool registration failed: ${error}`, { cause: error });
    }

    // Set up request handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        return {
          tools: Array.from(this.toolRegistry.getAllTools().values()),
        };
      } catch (error) {
        console.error("Failed to list tools:", error);
        throw new McpError(ErrorCode.InternalError, "Failed to retrieve tools list");
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      this.requestCount++;

      const name = request.params.name;
      const args = request.params.arguments;

      // Log tool call and protection state for debugging (visible in MCP logs)
      const isDestructive = this.protectionManager.isDestructiveTool(name);
      const isReadOnly = this.protectionManager.isReadOnlyTool(name);
      const isDeletion = this.protectionManager.isDeletionTool(name);
      console.error(`[MCP Tool Call] ${name} | Infra: ${this.protectionManager.isInfraProtectionEnabled()} (Destructive: ${isDestructive}) | Strict: ${this.protectionManager.isStrictProtectionEnabled()} (ReadOnly: ${isReadOnly}) | NoDelete: ${this.protectionManager.isNoDeleteProtectionEnabled()} (Deletion: ${isDeletion})`);

      try {
        // 1. Mandatory Protection Checks - ALWAYS RUN FIRST
        this.protectionManager.validateOperation(name);

        const handler = this.toolRegistry.getHandler(name);
        if (!handler) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // Check circuit breaker - block requests when error rate is too high
        if (this.circuitBreakerOpen) {
          throw new Error(`Circuit breaker is OPEN due to high error rate. Requests temporarily blocked. ` +
            `Auto-resets in up to ${this.config.circuitBreakerTimeout / 1000}s. Wait and retry.`);
        }

        // Apply global input sanitization to prevent prompt-injection attacks
        const sanitizedArgs = sanitizeInputArgs(name, args);

        // Enforce strict namespace and resource name validation globally
        if (sanitizedArgs && typeof sanitizedArgs === 'object') {
          if ('namespace' in (sanitizedArgs as any) && typeof (sanitizedArgs as any).namespace === 'string') {
            validateNamespace((sanitizedArgs as any).namespace);
          }
          if ('name' in (sanitizedArgs as any) && typeof (sanitizedArgs as any).name === 'string') {
            validateResourceName((sanitizedArgs as any).name);
          }
        }

        // Validate arguments
        const tool = this.toolRegistry.getTool(name);
        if (tool && tool.inputSchema) {
          const validationError = this.validateArguments(tool.inputSchema, sanitizedArgs);
          if (validationError) {
            throw new McpError(ErrorCode.InvalidParams, validationError);
          }
        }

        // Check cache for read-only operations
        if (this.protectionManager.isReadOnlyTool(name)) {
          const cacheKey = `${name}:${JSON.stringify(sanitizedArgs || {})}`;
          const cached = this.cacheManager.get(cacheKey);
          if (cached !== undefined) {
            const responseTime = Date.now() - startTime;
            this.updateToolMetrics(name, startTime, true);
            
            auditLogger.log({
              timestamp: new Date().toISOString(),
              user: "system",
              tool: name,
              action: "execute",
              success: true,
              args: sanitizedArgs,
            });

            const cachedText = typeof cached === "string" ? cached : JSON.stringify(cached, null, 2);
            return {
              content: [{ type: "text", text: scrubSensitiveData(cachedText) }],
              _meta: { executionTime: responseTime, toolName: name, cached: true },
            };
          }
        }

        // Get per-tool timeout
        const timeout = this.TOOL_TIMEOUTS[name] || this.config.defaultToolTimeout;

        const result = await Promise.race([
          handler(sanitizedArgs),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout / 1000}s`)), timeout)
          )
        ]);

        const responseTime = Date.now() - startTime;
        this.updateToolMetrics(name, startTime, true);

        // Cache read-only results
        if (this.protectionManager.isReadOnlyTool(name)) {
          const cacheKey = `${name}:${JSON.stringify(sanitizedArgs || {})}`;
          this.cacheManager.set(cacheKey, result);
        }

        const resultText = typeof result === "string" ? result : JSON.stringify(result, null, 2);

        auditLogger.log({
          timestamp: new Date().toISOString(),
          user: "system",
          tool: name,
          action: "execute",
          success: true,
          args: sanitizedArgs,
        });

        return {
          content: [
            {
              type: "text",
              text: scrubSensitiveData(resultText),
            },
          ],
          _meta: {
            executionTime: responseTime,
            toolName: name,
          },
        };
      } catch (error) {
        const argsAny = args as any;
        const context: ErrorContext = { operation: name, resource: argsAny?.name, namespace: argsAny?.namespace };
        const classifiedError = classifyError(error, context);

        this.lastError = scrubSensitiveData(classifiedError.message);
        this.errorCount++;
        this.trackError();
        this.updateToolMetrics(name, startTime, false, this.lastError);

        auditLogger.log({
          timestamp: new Date().toISOString(),
          user: "system",
          tool: name,
          action: "execute",
          success: false,
          args: args,
          error: this.lastError
        });

        // Check sliding window error rate for circuit breaker
        if (this.getRecentErrorCount() >= this.config.maxErrorsPerMinute) {
          this.openCircuitBreaker();
        }

        // Return a structured error result instead of throwing a protocol error
        // This ensures the client/LLM sees the content and suggestions
        const errorText = `ERROR: ${this.lastError}\n` +
          `Type: ${classifiedError.type}\n` +
          (classifiedError.suggestions.length > 0 
            ? `\nSUGGESTIONS:\n${classifiedError.suggestions.map(s => `* ${s}`).join("\n")}` 
            : "");

        return {
          content: [
            {
              type: "text",
              text: scrubSensitiveData(errorText),
            },
          ],
          isError: true,
          _meta: {
            executionTime: Date.now() - startTime,
            toolName: name,
            errorType: classifiedError.type,
          },
        };
      }
    });
  }

  private registerTools(tools: { tool: Tool; handler: Function }[]): void {
    this.toolRegistry.registerMany(tools);
  }

  private registerServerTools(): void {
    // Server info tool
    this.registerTools([{
      tool: {
        name: "k8s_server_info",
        description: "Get comprehensive MCP server information and status",
        inputSchema: {
          type: "object",
          properties: {
            includeMetrics: {
              type: "boolean",
              description: "Include detailed tool metrics",
              default: false,
            },
          },
        },
      },
      handler: async ({ includeMetrics }: { includeMetrics?: boolean }) => {
        const uptime = this.getUptime();
        const blockedCount = this.protectionManager.isStrictProtectionEnabled()
          ? Array.from(this.toolRegistry.getAllTools().keys()).filter(name => !this.protectionManager.isReadOnlyTool(name)).length
          : 0;
        const info: ServerInfo = {
          name: "k8s-helm-mcp",
          version: packageJson.version,
          startTime: this.startTime,
          uptime,
          toolsCount: this.toolRegistry.size(),
          lastHealthCheck: this.lastHealthCheck,
          errorCount: this.errorCount,
          requestCount: this.requestCount,
          protectionModes: {
            infrastructure: this.protectionManager.isInfraProtectionEnabled(),
            strict: this.protectionManager.isStrictProtectionEnabled(),
            noDelete: this.protectionManager.isNoDeleteProtectionEnabled(),
            strictBlockedToolCount: blockedCount > 0 ? blockedCount : undefined,
            noDeleteBlockedToolCount: this.protectionManager.isNoDeleteProtectionEnabled() ? this.protectionManager.getDeletionToolsCount() : undefined,
          },
        };
        
        try {
          info.clusterInfo = await this.k8sClient.getClusterVersion();
        } catch (error) {
          info.clusterInfo = { 
            error: "Unable to connect to cluster",
            details: error instanceof Error ? error.message : String(error)
          };
        }
        
        if (includeMetrics) {
          const metrics = Array.from(this.toolMetrics.entries()).map(([toolName, metric]) => ({
            toolName,
            ...metric,
          }));
          return { ...info, metrics };
        }
        
        return info;
      },
    }]);

    // Enhanced health check
    this.registerTools([{
      tool: {
        name: "k8s_server_health",
        description: "Comprehensive health check with diagnostics",
        inputSchema: {
          type: "object",
          properties: {
            deep: {
              type: "boolean",
              description: "Perform deep health check including cluster connectivity",
              default: false,
            },
            timeout: {
              type: "number",
              description: "Health check timeout in seconds",
              default: 10,
            },
          },
        },
      },
      handler: async ({ deep, timeout }: { deep?: boolean; timeout?: number }) => {
        const blockedCount = this.protectionManager.isStrictProtectionEnabled()
          ? Array.from(this.toolRegistry.getAllTools().keys()).filter(name => !this.protectionManager.isReadOnlyTool(name)).length
          : 0;
        const health = {
          server: {
            healthy: this.isHealthy,
            uptime: this.getUptime(),
            lastError: this.lastError,
            errorCount: this.errorCount,
            requestCount: this.requestCount,
            circuitBreakerOpen: this.circuitBreakerOpen,
          },
          protection: {
            infrastructure: this.protectionManager.isInfraProtectionEnabled(),
            strict: this.protectionManager.isStrictProtectionEnabled(),
            noDelete: this.protectionManager.isNoDeleteProtectionEnabled(),
            strictBlockedToolCount: blockedCount > 0 ? blockedCount : undefined,
            noDeleteBlockedToolCount: this.protectionManager.isNoDeleteProtectionEnabled() ? this.protectionManager.getDeletionToolsCount() : undefined,
            readOnlyToolCount: this.protectionManager.getReadOnlyToolsCount(),
          },
          cluster: {
            connected: false,
            version: null as any,
            nodes: 0,
            namespaces: 0,
            responseTime: null as number | null,
            error: null as string | null,
          },
          tools: {
            total: this.toolRegistry.size(),
            registered: this.toolRegistry.size(),
            withErrors: Array.from(this.toolMetrics.entries())
              .filter(([, metric]) => metric.errors > 0)
              .map(([name]) => name),
          },
        };

        if (deep) {
          try {
            const startTime = Date.now();
            
            // Test cluster connectivity with timeout
            const version = await Promise.race([
              this.k8sClient.getClusterVersion(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Health check timeout")), (timeout || 10) * 1000)
              )
            ]);
            
            health.cluster.connected = true;
            health.cluster.version = version;
            health.cluster.responseTime = Date.now() - startTime;
            
            // Get basic cluster stats
            const [nodes, namespaces] = await Promise.all([
              this.k8sClient.listNodes().catch(() => []),
              this.k8sClient.listNamespaces().catch(() => []),
            ]);
            health.cluster.nodes = nodes.length;
            health.cluster.namespaces = namespaces.length;
            
          } catch (error) {
            health.cluster.connected = false;
            health.cluster.error = error instanceof Error ? error.message : String(error);
          }
        }

        return health;
      },
    }]);

    // Tool metrics
    this.registerTools([{
      tool: {
        name: "k8s_server_metrics",
        description: "Get detailed tool usage metrics",
        inputSchema: {
          type: "object",
          properties: {
            tool: {
              type: "string",
              description: "Specific tool name (optional, shows all if not specified)",
            },
            sortBy: {
              type: "string",
              description: "Sort metrics by field",
              enum: ["calls", "errors", "avgResponseTime"],
              default: "calls",
            },
          },
        },
      },
      handler: async ({ tool, sortBy }: { tool?: string; sortBy?: string }) => {
        let metrics = Array.from(this.toolMetrics.entries()).map(([toolName, metric]) => ({
          toolName,
          ...metric,
        }));
        
        if (tool) {
          metrics = metrics.filter(m => m.toolName === tool);
        }
        
        metrics.sort((a, b) => {
          const field = sortBy || "calls";
          return (b[field as keyof ToolMetrics] as number) - (a[field as keyof ToolMetrics] as number);
        });
        
        return {
          metrics,
          summary: {
            totalTools: this.toolRegistry.size(),
            toolsWithMetrics: metrics.length,
            totalCalls: metrics.reduce((sum, m) => sum + m.calls, 0),
            totalErrors: metrics.reduce((sum, m) => sum + m.errors, 0),
          },
        };
      },
    }]);

    // Server stop tool
    this.registerTools([{
      tool: {
        name: "k8s_server_stop",
        description: "Shut down the MCP server gracefully. This will terminate the process and stop the server from accepting further requests. Use with caution.",
        inputSchema: {
          type: "object",
          properties: {
            confirm: {
              type: "boolean",
              description: "Confirmation flag to prevent accidental shutdown",
              default: false,
            },
          },
          required: ["confirm"],
        },
      },
      handler: async ({ confirm }: { confirm: boolean }) => {
        if (!confirm) {
          return {
            success: false,
            message: "Shutdown rejected. You must set 'confirm: true' to acknowledge the action.",
          };
        }

        console.error("Shutdown requested via k8s_server_stop. Terminating in 2 seconds...");
        
        // Start shutdown sequence asynchronously to allow response to be sent
        setTimeout(async () => {
          if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
          if (this.circuitBreakerTimer) clearTimeout(this.circuitBreakerTimer);
          await shutdownTelemetry();
          process.exit(0);
        }, 2000);

        return {
          success: true,
          message: "Server shutdown initiated. The process will terminate in 2 seconds.",
          uptime: this.getUptime(),
          startTime: this.startTime.toISOString(),
        };
      },
    }]);

    // Infrastructure Protection Mode toggle
    this.registerTools([{
      tool: {
        name: "k8s_toggle_protection_mode",
        description: "Toggle Infrastructure Protection Mode. When enabled (default), destructive tools that could break cluster infrastructure are blocked. When disabled, all tools are available. Use with caution.",
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable (true) or disable (false) protection mode. If not specified, returns current status.",
            },
            confirm: {
              type: "boolean",
              description: "Required confirmation when disabling protection mode (set to true to acknowledge risk)",
              default: false,
            },
          },
        },
      },
      handler: async ({ enabled, confirm }: { enabled?: boolean; confirm?: boolean }) => {
        // If no enabled param, return current status
        if (enabled === undefined) {
          return {
            protectionMode: this.protectionManager.isInfraProtectionEnabled() ? "enabled" : "disabled",
            destructiveToolsCount: this.protectionManager.getDestructiveToolsCount(),
            message: this.protectionManager.isInfraProtectionEnabled() 
              ? "Infrastructure Protection Mode is ENABLED. Destructive tools are blocked."
              : "Infrastructure Protection Mode is DISABLED. All tools are available - use with caution!",
          };
        }
        
        // Trying to disable protection
        if (!enabled) {
          if (!confirm) {
            return {
              success: false,
              protectionMode: "enabled",
              warning: "⚠️  DISABLING INFRASTRUCTURE PROTECTION IS DANGEROUS",
              message: "To disable protection mode, you must set 'confirm: true' to acknowledge the risk.",
              note: "When disabled, destructive operations like delete, drain, scale-down, and resource modifications will be allowed.",
              destructiveToolsCount: this.protectionManager.getDestructiveToolsCount(),
            };
          }
          
          this.protectionManager.setInfraProtection(false);
          console.error("⚠️  INFRASTRUCTURE PROTECTION MODE DISABLED - Destructive tools are now available");
          
          return {
            success: true,
            protectionMode: "disabled",
            warning: "⚠️  Infrastructure Protection Mode is now DISABLED",
            message: "Destructive tools are now available. Use with extreme caution!",
          };
        }
        
        // Enabling protection
        this.protectionManager.setInfraProtection(true);
        console.error("Infrastructure Protection Mode ENABLED - Destructive tools are now blocked");

        return {
          success: true,
          protectionMode: "enabled",
          message: "Infrastructure Protection Mode is now ENABLED. Destructive tools are blocked.",
          destructiveToolsBlocked: this.protectionManager.getDestructiveToolsCount(),
        };
      },
    }]);

    // Strict Protection Mode toggle - blocks ALL non-read-only operations
    this.registerTools([{
      tool: {
        name: "k8s_toggle_strict_protection_mode",
        description: "Toggle Strict Protection Mode. When enabled, ALL non-read-only tools are blocked - only list, get, describe, and monitoring operations are allowed. This is the highest level of protection for production clusters where no modifications should ever be made. Use with caution.",
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable (true) or disable (false) strict protection mode. If not specified, returns current status.",
            },
            confirm: {
              type: "boolean",
              description: "Required confirmation when disabling strict protection mode (set to true to acknowledge risk)",
              default: false,
            },
          },
        },
      },
      handler: async ({ enabled, confirm }: { enabled?: boolean; confirm?: boolean }) => {
        // If no enabled param, return current status
        if (enabled === undefined) {
          const allTools = Array.from(this.toolRegistry.getAllTools().keys());
          const blockedToolsCount = allTools.filter(name => !this.protectionManager.isReadOnlyTool(name)).length;
 
          return {
            strictProtectionMode: this.protectionManager.isStrictProtectionEnabled() ? "enabled" : "disabled",
            readOnlyToolsAvailable: this.protectionManager.getReadOnlyToolsCount(),
            blockedToolsCount: blockedToolsCount,
            message: this.protectionManager.isStrictProtectionEnabled()
              ? "Strict Protection Mode is ENABLED. Only read-only/list operations are allowed."
              : "Strict Protection Mode is DISABLED. All tools are available - use with caution!",
          };
        }

        // Trying to disable strict protection
        if (!enabled) {
          if (!confirm) {
            const allTools = Array.from(this.toolRegistry.getAllTools().keys());
            const blockedTools = allTools.filter(name => !this.protectionManager.isReadOnlyTool(name));
            return {
              success: false,
              strictProtectionMode: "enabled",
              warning: "⚠️  DISABLING STRICT PROTECTION IS EXTREMELY DANGEROUS FOR PRODUCTION",
              message: "To disable strict protection mode, you must set 'confirm: true' to acknowledge the risk.",
              note: "When disabled, ALL modification operations including create, update, delete, scale, restart, and resource changes will be allowed.",
              blockedToolsCount: blockedTools.length,
              blockedToolCategories: [
                "Create operations (deployments, services, configmaps, secrets, etc.)",
                "Update operations (scaling, image updates, patching, labeling)",
                "Delete operations (pods, deployments, namespaces, etc.)",
                "Helm operations (install, upgrade, uninstall, rollback)",
                "Node operations (drain, cordon, taints)",
                "Resource modifications (rollouts, restarts, autoscaling)",
              ],
            };
          }

          this.protectionManager.setStrictProtection(false);
          console.error("⚠️  STRICT PROTECTION MODE DISABLED - All modification tools are now available");

          return {
            success: true,
            strictProtectionMode: "disabled",
            warning: "⚠️  Strict Protection Mode is now DISABLED",
            message: "All modification tools are now available. Use with extreme caution!",
          };
        }

        // Enabling strict protection
        this.protectionManager.setStrictProtection(true);
        const allTools = Array.from(this.toolRegistry.getAllTools().keys());
        const blockedToolsCount = allTools.filter(name => !this.protectionManager.isReadOnlyTool(name)).length;
        console.error("STRICT PROTECTION MODE ENABLED - Only read-only tools are now available");

        return {
          success: true,
          strictProtectionMode: "enabled",
          message: "Strict Protection Mode is now ENABLED. Only read-only/list operations are allowed.",
          readOnlyToolsAvailable: this.protectionManager.getReadOnlyToolsCount(),
          blockedToolsCount: blockedToolsCount,
          note: "This is the highest level of protection. No modifications to the cluster are possible.",
          allowedOperations: [
            "List resources (pods, deployments, nodes, services, etc.)",
            "Get resource details and describe operations",
            "View logs and events",
            "Check health, metrics, and status",
            "Export and view configurations",
          ],
          blockedOperations: [
            "Create, update, or delete any resources",
            "Scale deployments or enable autoscaling",
            "Drain, cordon, or modify nodes",
            "Install, upgrade, or uninstall Helm charts",
            "Apply manifests or run pods",
            "Restart deployments or perform rollouts",
          ],
        };
      },
    }]);

    // No Delete Protection Mode toggle - blocks only deletion operations
    this.registerTools([{
      tool: {
        name: "k8s_toggle_no_delete_mode",
        description: "Toggle No Delete Protection Mode. When enabled, only delete operations are blocked - you can still update, scale, modify, and create resources. This is useful for environments where resource modifications are needed but accidental deletions must be prevented.",
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable (true) or disable (false) no-delete protection mode. If not specified, returns current status.",
            },
            confirm: {
              type: "boolean",
              description: "Required confirmation when disabling no-delete protection mode (set to true to acknowledge risk)",
              default: false,
            },
          },
        },
      },
      handler: async ({ enabled, confirm }: { enabled?: boolean; confirm?: boolean }) => {
        // If no enabled param, return current status
        if (enabled === undefined) {
          return {
            noDeleteProtectionMode: this.protectionManager.isNoDeleteProtectionEnabled() ? "enabled" : "disabled",
            deleteToolsBlocked: this.protectionManager.getDeletionToolsCount(),
            message: this.protectionManager.isNoDeleteProtectionEnabled()
              ? "No Delete Protection Mode is ENABLED. Delete operations are blocked, but updates and modifications are allowed."
              : "No Delete Protection Mode is DISABLED. All operations including deletes are available.",
          };
        }

        // Trying to disable no-delete protection
        if (!enabled) {
          if (!confirm) {
            return {
              success: false,
              noDeleteProtectionMode: "enabled",
              warning: "⚠️  DISABLING NO-DELETE PROTECTION WILL ALLOW DELETION OF RESOURCES",
              message: "To disable no-delete protection mode, you must set 'confirm: true' to acknowledge the risk.",
              note: "When disabled, delete operations including pod deletion, namespace deletion, resource cleanup, and Helm uninstall will be allowed.",
              deleteToolsCount: this.protectionManager.getDeletionToolsCount(),
            };
          }

          this.protectionManager.setNoDeleteProtection(false);
          console.error("⚠️  NO DELETE PROTECTION MODE DISABLED - Delete operations are now available");

          return {
            success: true,
            noDeleteProtectionMode: "disabled",
            warning: "⚠️  No Delete Protection Mode is now DISABLED",
            message: "Delete operations are now available. Deletions of resources, namespaces, and Helm releases are now allowed.",
          };
        }

        // Enabling no-delete protection
        this.protectionManager.setNoDeleteProtection(true);
        console.error("NO DELETE PROTECTION MODE ENABLED - Delete operations are now blocked");

        return {
          success: true,
          noDeleteProtectionMode: "enabled",
          message: "No Delete Protection Mode is now ENABLED. Delete operations are blocked, but updates and modifications are still allowed.",
          deleteToolsBlocked: this.protectionManager.getDeletionToolsCount(),
          note: "You can still create, update, scale, patch, and modify resources. Only delete and uninstall operations are blocked.",
          allowedOperations: [
            "Create resources (deployments, services, configmaps, secrets, etc.)",
            "Update resources (scaling, image updates, patching, labeling)",
            "Modify resource configurations",
            "Install and upgrade Helm charts",
            "Run new pods and jobs",
            "Apply manifests",
            "Restart and rollout deployments",
          ],
          blockedOperations: [
            "Delete pods, deployments, namespaces, or any resources",
            "Uninstall Helm releases",
            "Bulk delete operations",
            "Uninstall Helm plugins",
          ],
        };
      },
    }]);

    // Master toggle for all protection modes
    this.registerTools([{
      tool: {
        name: "k8s_toggle_all_protection_modes",
        description: "Master toggle to control all protection modes at once. This allows you to enable or disable Infrastructure Protection, Strict Protection, and No Delete Protection modes simultaneously. Useful for quickly switching between full access and fully protected states.",
        inputSchema: {
          type: "object",
          properties: {
            infrastructure: {
              type: "boolean",
              description: "Enable (true) or disable (false) Infrastructure Protection Mode. If not specified, keeps current state.",
            },
            strict: {
              type: "boolean",
              description: "Enable (true) or disable (false) Strict Protection Mode. If not specified, keeps current state.",
            },
            noDelete: {
              type: "boolean",
              description: "Enable (true) or disable (false) No Delete Protection Mode. If not specified, keeps current state.",
            },
            confirm: {
              type: "boolean",
              description: "Required confirmation when disabling any protection mode (set to true to acknowledge risk)",
              default: false,
            },
          },
        },
      },
      handler: async ({ infrastructure, strict, noDelete, confirm }: { infrastructure?: boolean; strict?: boolean; noDelete?: boolean; confirm?: boolean }) => {
        // If no params provided, return current status of all modes
        if (infrastructure === undefined && strict === undefined && noDelete === undefined) {
          return {
            protectionModes: {
              infrastructure: {
                enabled: this.protectionManager.isInfraProtectionEnabled(),
                description: "Blocks destructive operations (delete, risky creates)",
              },
              strict: {
                enabled: this.protectionManager.isStrictProtectionEnabled(),
                description: "Blocks ALL non-read-only operations (read-only mode)",
                readOnlyToolCount: this.protectionManager.getReadOnlyToolsCount(),
              },
              noDelete: {
                enabled: this.protectionManager.isNoDeleteProtectionEnabled(),
                description: "Blocks only deletion operations (updates allowed)",
                deleteToolCount: this.protectionManager.getDeletionToolsCount(),
              },
            },
            summary: {
              totalProtected: (this.protectionManager.isInfraProtectionEnabled() ? 1 : 0) + (this.protectionManager.isStrictProtectionEnabled() ? 1 : 0) + (this.protectionManager.isNoDeleteProtectionEnabled() ? 1 : 0),
              mostRestrictiveActive: this.protectionManager.isStrictProtectionEnabled() ? "strict" : this.protectionManager.isInfraProtectionEnabled() ? "infrastructure" : this.protectionManager.isNoDeleteProtectionEnabled() ? "noDelete" : "none",
            },
          };
        }

        // Check if trying to disable any protection without confirmation
        const disablingInfra = infrastructure === false && this.protectionManager.isInfraProtectionEnabled();
        const disablingStrict = strict === false && this.protectionManager.isStrictProtectionEnabled();
        const disablingNoDelete = noDelete === false && this.protectionManager.isNoDeleteProtectionEnabled();

        if ((disablingInfra || disablingStrict || disablingNoDelete) && !confirm) {
          const modesBeingDisabled: string[] = [];
          if (disablingInfra) modesBeingDisabled.push("Infrastructure Protection");
          if (disablingStrict) modesBeingDisabled.push("Strict Protection");
          if (disablingNoDelete) modesBeingDisabled.push("No Delete Protection");

          return {
            success: false,
            warning: `⚠️  DISABLING PROTECTION MODES: ${modesBeingDisabled.join(", ")}`,
            message: "To disable protection modes, you must set 'confirm: true' to acknowledge the risk.",
            currentStates: {
              infrastructure: this.protectionManager.isInfraProtectionEnabled(),
              strict: this.protectionManager.isStrictProtectionEnabled(),
              noDelete: this.protectionManager.isNoDeleteProtectionEnabled(),
            },
          };
        }

        // Track what changed
        const changes: string[] = [];

        // Apply Infrastructure Protection change
        if (infrastructure !== undefined && infrastructure !== this.protectionManager.isInfraProtectionEnabled()) {
          this.protectionManager.setInfraProtection(infrastructure);
          changes.push(infrastructure ? "Infrastructure Protection ENABLED" : "Infrastructure Protection DISABLED");
          console.error(infrastructure ? "Infrastructure Protection Mode ENABLED - Destructive tools are now blocked" : "⚠️  INFRASTRUCTURE PROTECTION MODE DISABLED");
        }

        // Apply Strict Protection change
        if (strict !== undefined && strict !== this.protectionManager.isStrictProtectionEnabled()) {
          this.protectionManager.setStrictProtection(strict);
          changes.push(strict ? "Strict Protection ENABLED" : "Strict Protection DISABLED");
          console.error(strict ? "STRICT PROTECTION MODE ENABLED - Only read-only tools are now available" : "⚠️  STRICT PROTECTION MODE DISABLED");
        }

        // Apply No Delete Protection change
        if (noDelete !== undefined && noDelete !== this.protectionManager.isNoDeleteProtectionEnabled()) {
          this.protectionManager.setNoDeleteProtection(noDelete);
          changes.push(noDelete ? "No Delete Protection ENABLED" : "No Delete Protection DISABLED");
          console.error(noDelete ? "NO DELETE PROTECTION MODE ENABLED - Delete operations are now blocked" : "⚠️  NO DELETE PROTECTION MODE DISABLED");
        }

        // If nothing changed
        if (changes.length === 0) {
          return {
            success: true,
            changed: false,
            message: "No protection modes were changed (requested states match current states).",
            currentStates: {
              infrastructure: this.protectionManager.isInfraProtectionEnabled(),
              strict: this.protectionManager.isStrictProtectionEnabled(),
              noDelete: this.protectionManager.isNoDeleteProtectionEnabled(),
            },
          };
        }

        return {
          success: true,
          changed: true,
          changes,
          message: `Protection modes updated: ${changes.join(", ")}`,
          currentStates: {
            infrastructure: this.protectionManager.isInfraProtectionEnabled(),
            strict: this.protectionManager.isStrictProtectionEnabled(),
            noDelete: this.protectionManager.isNoDeleteProtectionEnabled(),
          },
          summary: {
            mostRestrictiveActive: this.protectionManager.isStrictProtectionEnabled() ? "strict" : this.protectionManager.isInfraProtectionEnabled() ? "infrastructure" : this.protectionManager.isNoDeleteProtectionEnabled() ? "noDelete" : "none",
            allModesDisabled: !this.protectionManager.isInfraProtectionEnabled() && !this.protectionManager.isStrictProtectionEnabled() && !this.protectionManager.isNoDeleteProtectionEnabled(),
          },
        };
      },
    }]);
  }

  private setupHealthCheck(): void {
    // Periodic health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.k8sClient.getClusterVersion();
        this.isHealthy = true;
        this.lastHealthCheck = new Date();
      } catch (error) {
        this.isHealthy = false;
        this.lastError = error instanceof Error ? error.message : String(error);
        this.lastHealthCheck = new Date();
      }
      // Prune expired cache entries periodically
      this.pruneCache();
    }, 30000);
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.error(`Received ${signal}, shutting down gracefully...`);
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      if (this.circuitBreakerTimer) clearTimeout(this.circuitBreakerTimer);
      
      // Shutdown OpenTelemetry
      await shutdownTelemetry();
      
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  private setupErrorHandling(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.errorCount++;
      this.lastError = error.message;
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.errorCount++;
      this.lastError = String(reason);
    });
  }

  private validateArguments(schema: any, args: any): string | null {
    if (!args) return null;

    const required = schema.required || [];
    for (const field of required) {
      if (!(field in args)) {
        return `Missing required parameter: ${field}`;
      }
    }

    const properties = schema.properties || {};
    for (const [key, value] of Object.entries(args)) {
      if (properties[key]) {
        const prop = properties[key] as any;

        // Type checks
        if (prop.type === 'string' && typeof value !== 'string') {
          return `Parameter '${key}' must be a string, got ${typeof value}`;
        }
        if (prop.type === 'number' && typeof value !== 'number') {
          return `Parameter '${key}' must be a number, got ${typeof value}`;
        }
        if (prop.type === 'boolean' && typeof value !== 'boolean') {
          return `Parameter '${key}' must be a boolean, got ${typeof value}`;
        }
        if (prop.type === 'array' && !Array.isArray(value)) {
          return `Parameter '${key}' must be an array, got ${typeof value}`;
        }

        // Enum validation
        if (prop.enum && Array.isArray(prop.enum) && !prop.enum.includes(value)) {
          return `Parameter '${key}' must be one of: ${prop.enum.join(', ')}. Got: '${value}'`;
        }

        // Number range validation
        if (prop.type === 'number' && typeof value === 'number') {
          if (prop.minimum !== undefined && value < prop.minimum) {
            return `Parameter '${key}' must be >= ${prop.minimum}, got ${value}`;
          }
          if (prop.maximum !== undefined && value > prop.maximum) {
            return `Parameter '${key}' must be <= ${prop.maximum}, got ${value}`;
          }
        }

        // String length validation
        if (prop.type === 'string' && typeof value === 'string') {
          if (prop.minLength !== undefined && value.length < prop.minLength) {
            return `Parameter '${key}' must be at least ${prop.minLength} characters`;
          }
          if (prop.maxLength !== undefined && value.length > prop.maxLength) {
            return `Parameter '${key}' must be at most ${prop.maxLength} characters`;
          }
        }
      }
    }

    return null;
  }

  private updateToolMetrics(toolName: string, startTime: number, success: boolean, error?: string): void {
    const responseTime = Date.now() - startTime;
    
    if (!this.toolMetrics.has(toolName)) {
      this.toolMetrics.set(toolName, {
        name: toolName,
        calls: 0,
        errors: 0,
        avgResponseTime: 0,
      });
    }
    
    const metrics = this.toolMetrics.get(toolName)!;
    metrics.calls++;
    metrics.lastCalled = new Date();
    
    if (success) {
      // Update average response time
      metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.calls - 1) + responseTime) / metrics.calls;
    } else {
      metrics.errors++;
      metrics.lastError = error;
    }
  }

  private openCircuitBreaker(): void {
    this.circuitBreakerOpen = true;
    console.error("Circuit breaker OPEN due to high error rate");
    
    // Auto-reset after timeout
    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
    }
    
    this.circuitBreakerTimer = setTimeout(() => {
      this.circuitBreakerOpen = false;
      this.recentErrors = [];
      console.error("Circuit breaker CLOSED - accepting requests again");
    }, this.config.circuitBreakerTimeout);
  }

  // Sliding window error tracking
  private trackError(): void {
    this.recentErrors.push(Date.now());
  }

  private getRecentErrorCount(): number {
    const oneMinuteAgo = Date.now() - 60000;
    this.recentErrors = this.recentErrors.filter(t => t > oneMinuteAgo);
    return this.recentErrors.length;
  }

  // Response cache methods (delegated to CacheManager)
  private getFromCache(key: string): any | undefined {
    return this.cacheManager.get(key);
  }

  private setCache(key: string, data: any, ttl?: number): void {
    this.cacheManager.set(key, data, ttl);
  }

  private pruneCache(): void {
    this.cacheManager.prune();
  }

  private getUptime(): string {
    const now = new Date();
    const diff = now.getTime() - this.startTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async start(): Promise<void> {
    const transport = process.env.TRANSPORT || 'stdio';
    const port = parseInt(process.env.PORT || '3000', 10);

    if (transport === 'sse') {
      // SSE transport for web deployment - creates new Server instance per connection
      await startSSEServer(port);
      console.error(`Kubernetes MCP Server v${packageJson.version} running on SSE (port ${port})`);
    } else {
      // Default stdio transport
      const stdioTransport = new StdioServerTransport();
      await this.server.connect(stdioTransport);
      console.error(`Kubernetes MCP Server v${packageJson.version} running on stdio`);
    }
    
    console.error(`Tools registered: ${this.toolRegistry.size()}`);
    console.error(`Infrastructure Protection: ${this.protectionManager.isInfraProtectionEnabled() ? "ENABLED" : "DISABLED"}`);
    console.error(`Strict Protection: ${this.protectionManager.isStrictProtectionEnabled() ? "ENABLED" : "DISABLED"}`);
    if (this.protectionManager.isStrictProtectionEnabled()) {
      const blockedCount = Array.from(this.toolRegistry.getAllTools().keys())
        .filter(name => !this.protectionManager.isReadOnlyTool(name)).length;
      console.error(`  └─ ${blockedCount} modification tools blocked, ${this.protectionManager.getReadOnlyToolsCount()} read-only tools available`);
    }
    console.error(`No Delete Protection: ${this.protectionManager.isNoDeleteProtectionEnabled() ? "ENABLED" : "DISABLED"}`);
    if (this.protectionManager.isNoDeleteProtectionEnabled()) {
      console.error(`  └─ ${this.protectionManager.getDeletionToolsCount()} delete operations blocked, updates still allowed`);
    }
    console.error(`Started at: ${this.startTime.toISOString()}`);
  }
}

const server = new K8sMcpServer();
server.start().catch(console.error);
