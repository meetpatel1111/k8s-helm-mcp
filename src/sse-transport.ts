import { Server as HTTPServer } from "http";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { K8sClient } from "./k8s-client.js";
import { CacheManager } from "./cache-manager.js";
import { ToolRegistry } from "./tool-registry.js";
import { loadConfig } from "./config.js";
import { initializeTelemetry } from "./telemetry.js";
import { createRequire } from "module";
import * as crypto from "crypto";

// Tool registration + toolset gating (shared with the stdio server).
import { buildCategorizedTools, loadToolsetConfig, selectTools } from "./toolsets.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

// Track active connections
interface Connection {
  id: string;
  transport: SSEServerTransport;
  server: Server;
  res: Response;
}
const activeConnections = new Map<string, Connection>();

// Shared resources across all connections
let sharedK8sClient: K8sClient | null = null;
let sharedCacheManager: CacheManager | null = null;

function getSharedResources() {
  if (!sharedK8sClient) {
    const config = loadConfig();
    sharedCacheManager = new CacheManager(config.cacheDefaultTtl);
    sharedK8sClient = new K8sClient();
  }
  return { k8sClient: sharedK8sClient, cacheManager: sharedCacheManager! };
}

function createToolRegistry() {
  const toolRegistry = new ToolRegistry();
  const { k8sClient, cacheManager } = getSharedResources();

  // Register tool categories, gated by K8S_TOOLSETS (default: all).
  const categorized = buildCategorizedTools(k8sClient, cacheManager);
  toolRegistry.registerMany(selectTools(categorized, loadToolsetConfig()));

  return toolRegistry;
}

export async function startSSEServer(port: number = 3000): Promise<void> {
  // Initialize telemetry once
  initializeTelemetry();

  const app = express();
  
  // Security: Enforce Bearer Token Authentication for HTTP Transport
  const authToken = process.env.MCP_AUTH_TOKEN || crypto.randomUUID();
  console.error(`[SECURITY] SSE Transport starting with Authentication ENABLED.`);
  console.error(`[SECURITY] Clients MUST provide the following header:`);
  console.error(`[SECURITY] Authorization: Bearer ${authToken}`);
  if (!process.env.MCP_AUTH_TOKEN) {
    console.error(`[SECURITY] (Token was auto-generated. Set MCP_AUTH_TOKEN env var to use a static token)`);
  }

  // Enable CORS for web clients
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json());

  // Require authentication for all routes except /health and OPTIONS preflight
  app.use((req, res, next) => {
    if (req.method === "OPTIONS" || req.path === "/health") {
      return next();
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${authToken}`) {
      res.status(401).json({ 
        error: "Unauthorized", 
        message: "Valid Authorization Bearer token required for MCP access." 
      });
      return;
    }
    next();
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      transport: "sse",
      activeConnections: activeConnections.size,
      version: packageJson.version
    });
  });

  // SSE endpoint for MCP - creates a new Server instance per connection
  app.get("/sse", async (req: Request, res: Response) => {
    const sessionId = crypto.randomUUID();
    console.log(`[SSE] New connection: ${sessionId} (total: ${activeConnections.size + 1})`);
    
    try {
      // Create a new Server instance for this connection
      const server = new Server(
        {
          name: "k8s-helm-mcp",
          version: packageJson.version,
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Create tool registry for this connection
      const toolRegistry = createToolRegistry();
      
      // Set up request handlers for this server instance
      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: Array.from(toolRegistry.getAllTools().values()),
        };
      });

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const handler = toolRegistry.getHandler(name);

        if (!handler) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const result = await handler(args || {});
        return {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      });

      // Create SSE transport
      const transport = new SSEServerTransport("/message", res);
      
      // Store connection
      const connection: Connection = {
        id: sessionId,
        transport,
        server,
        res
      };
      activeConnections.set(sessionId, connection);
      
      // Handle connection close
      res.on("close", () => {
        console.log(`[SSE] Connection closed: ${sessionId}`);
        activeConnections.delete(sessionId);
      });
      
      // Connect server to transport
      await server.connect(transport);
      console.log(`[SSE] Connection established: ${sessionId}`);
      
    } catch (error: any) {
      console.error(`[SSE] Connection error for ${sessionId}:`, error);
      activeConnections.delete(sessionId);
      res.status(500).json({ error: error.message });
    }
  });

  // Message endpoint - must handle POST from SSE transport
  app.post("/message", async (req: Request, res: Response) => {
    // Find the transport for this session (MCP SDK handles session tracking via query param)
    const sessionId = req.query.sessionId as string;
    const connection = sessionId ? activeConnections.get(sessionId) : null;
    
    if (connection) {
      // Let the transport handle the message
      await connection.transport.handlePostMessage(req, res);
    } else {
      // No specific session, return status
      res.json({ status: "ok", activeConnections: activeConnections.size });
    }
  });

  const httpServer = new HTTPServer(app);
  
  httpServer.listen(port, () => {
    console.log(`SSE server listening on port ${port}`);
    console.log(`SSE endpoint: http://localhost:${port}/sse`);
    console.log(`Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[SSE] Shutting down...");
    activeConnections.clear();
    httpServer.close(() => {
      console.log("SSE server closed");
    });
  });

  process.on("SIGINT", () => {
    console.log("[SSE] Shutting down...");
    activeConnections.clear();
    httpServer.close(() => {
      console.log("SSE server closed");
    });
  });
}

// Import required schemas
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
