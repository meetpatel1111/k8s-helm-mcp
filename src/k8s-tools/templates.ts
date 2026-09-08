import * as k8s from "@kubernetes/client-node";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace, validatePort } from "../validators.js";
import { commonCreateQuerySchema } from "../utils/safety-helper.js";

export function registerTemplateTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_get_deployment_templates",
        description: "Get common deployment templates for quick deployment",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Template category (web, api, database, worker)",
              enum: ["web", "api", "database", "worker"],
            },
          },
        },
      },
      handler: async ({ category }: { category?: string }) => {
        const templates = {
          web: {
            name: "web-app-template",
            description: "Basic web application deployment",
            template: {
              apiVersion: "apps/v1",
              kind: "Deployment",
              metadata: {
                name: "web-app",
                labels: { app: "web-app" },
              },
              spec: {
                replicas: 3,
                selector: { matchLabels: { app: "web-app" } },
                template: {
                  metadata: { labels: { app: "web-app" } },
                  spec: {
                    containers: [
                      {
                        name: "web-app",
                        image: "nginx:latest",
                        ports: [{ containerPort: 80 }],
                        resources: {
                          requests: { memory: "128Mi", cpu: "100m" },
                          limits: { memory: "256Mi", cpu: "200m" },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          api: {
            name: "api-service-template",
            description: "REST API service deployment",
            template: {
              apiVersion: "apps/v1",
              kind: "Deployment",
              metadata: {
                name: "api-service",
                labels: { app: "api-service" },
              },
              spec: {
                replicas: 2,
                selector: { matchLabels: { app: "api-service" } },
                template: {
                  metadata: { labels: { app: "api-service" } },
                  spec: {
                    containers: [
                      {
                        name: "api",
                        image: "node:18-alpine",
                        ports: [{ containerPort: 3000 }],
                        env: [
                          { name: "NODE_ENV", value: "production" },
                          { name: "PORT", value: "3000" },
                        ],
                        resources: {
                          requests: { memory: "256Mi", cpu: "200m" },
                          limits: { memory: "512Mi", cpu: "500m" },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          database: {
            name: "postgresql-template",
            description: "PostgreSQL database deployment",
            template: {
              apiVersion: "apps/v1",
              kind: "StatefulSet",
              metadata: {
                name: "postgres-db",
                labels: { app: "postgres" },
              },
              spec: {
                serviceName: "postgres",
                replicas: 1,
                selector: { matchLabels: { app: "postgres" } },
                template: {
                  metadata: { labels: { app: "postgres" } },
                  spec: {
                    containers: [
                      {
                        name: "postgres",
                        image: "postgres:15",
                        ports: [{ containerPort: 5432 }],
                        env: [
                          { name: "POSTGRES_DB", value: "myapp" },
                          { name: "POSTGRES_USER", value: "admin" },
                          { name: "POSTGRES_PASSWORD", value: "secretpassword" },
                        ],
                        volumeMounts: [
                          { name: "postgres-storage", mountPath: "/var/lib/postgresql/data" },
                        ],
                        resources: {
                          requests: { memory: "512Mi", cpu: "300m" },
                          limits: { memory: "1Gi", cpu: "800m" },
                        },
                      },
                    ],
                  },
                },
                volumeClaimTemplates: [
                  {
                    metadata: { name: "postgres-storage" },
                    spec: {
                      accessModes: ["ReadWriteOnce"],
                      resources: { requests: { storage: "10Gi" } },
                    },
                  },
                ],
              },
            },
          },
          worker: {
            name: "worker-template",
            description: "Background worker deployment",
            template: {
              apiVersion: "apps/v1",
              kind: "Deployment",
              metadata: {
                name: "worker",
                labels: { app: "worker" },
              },
              spec: {
                replicas: 2,
                selector: { matchLabels: { app: "worker" } },
                template: {
                  metadata: { labels: { app: "worker" } },
                  spec: {
                    containers: [
                      {
                        name: "worker",
                        image: "redis:latest",
                        resources: {
                          requests: { memory: "128Mi", cpu: "100m" },
                          limits: { memory: "256Mi", cpu: "200m" },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        };

        if (category && templates[category as keyof typeof templates]) {
          return templates[category as keyof typeof templates];
        }

        return {
          available: Object.keys(templates),
          templates,
        };
      },
    },
    {
      tool: {
        name: "k8s_quick_deploy",
        description: "Quick deploy using template with custom parameters",
        inputSchema: {
          type: "object",
          properties: {
            template: {
              type: "string",
              description: "Template name (web, api, database, worker)",
            },
            name: {
              type: "string",
              description: "Custom deployment name",
            },
            image: {
              type: "string",
              description: "Custom container image",
            },
            replicas: {
              type: "number",
              description: "Number of replicas",
              default: 1,
            },
            namespace: {
              type: "string",
              description: "Target namespace",
              default: "default",
            },
            resources: {
              type: "object",
              description: "Resource requests and limits",
              properties: {
                memory: { type: "string" },
                cpu: { type: "string" },
              },
            },
            ...commonCreateQuerySchema,
          },
          required: ["template", "name", "image"],
        },
      },
      handler: async ({
        template,
        name,
        image,
        replicas,
        namespace,
        resources,
        dryRun,
      }: {
        template: string;
        name: string;
        image: string;
        replicas?: number;
        namespace?: string;
        resources?: { memory?: string; cpu?: string };
        dryRun?: string;
      }) => {
        try {
          // Validate inputs
          validateResourceName(name, "deployment name");
          const ns = namespace || "default";
          validateNamespace(ns);

          const templates = await k8sClient.applyManifest(`
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  replicas: ${replicas || 1}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: ${name}
        image: ${image}
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: ${resources?.memory || "128Mi"}
            cpu: ${resources?.cpu || "100m"}
          limits:
            memory: ${resources?.memory || "256Mi"}
            cpu: ${resources?.cpu || "200m"}
        `, { dryRun });

          return {
            deployed: true,
            dryRun: dryRun || "none",
            template,
            name,
            namespace: ns,
            results: templates,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_quick_deploy", resource: name, namespace: namespace || "default" };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
  ];
}
