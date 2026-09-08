import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { trace } from "@opentelemetry/api";

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 * This should be called at application startup
 */
export function initializeTelemetry(): void {
  // Check if telemetry is disabled via environment variable
  if (process.env.OTEL_SDK_DISABLED === "true") {
    console.error("OpenTelemetry disabled via OTEL_SDK_DISABLED");
    return;
  }

  // Get OTLP endpoint from environment variable or use default
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4317";
  const serviceName = process.env.OTEL_SERVICE_NAME || "k8s-helm-mcp";

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "0.19.0",
    })
  );

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: otlpEndpoint,
    }),
    // Add auto-instrumentations if needed in the future
    // instrumentations: [getNodeAutoInstrumentations()],
  });

  // Initialize the SDK
  try {
    sdk.start();
    console.error(`OpenTelemetry initialized successfully. Exporting to ${otlpEndpoint}`);
  } catch (error) {
    console.error("Failed to initialize OpenTelemetry:", error);
  }
}

/**
 * Shutdown OpenTelemetry SDK
 * This should be called at application shutdown
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    console.error("OpenTelemetry shutdown complete");
  }
}

/**
 * Wrap a tool handler with telemetry
 * Creates a span for the tool execution
 */
export function withTelemetry(toolName: string, handler: Function): Function {
  return async (...args: any[]) => {
    const tracer = trace.getTracer("k8s-helm-mcp");
    const span = tracer.startSpan(toolName);

    try {
      // Add tool name as attribute
      span.setAttribute("tool.name", toolName);
      
      // Execute the handler
      const result = await handler(...args);
      
      // Mark span as successful
      span.setStatus({ code: 1 }); // OK
      
      return result;
    } catch (error: any) {
      // Record exception
      span.recordException(error);
      
      // Mark span as error
      span.setStatus({ code: 2, message: error.message }); // ERROR
      
      throw error;
    } finally {
      // End the span
      span.end();
    }
  };
}

/**
 * Get the current tracer
 */
export function getTracer() {
  return trace.getTracer("k8s-helm-mcp");
}
