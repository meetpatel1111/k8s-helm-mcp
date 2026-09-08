import { isNotFoundError } from "./query-helper.js";

export interface DeleteQueryOptions {
  dryRun?: "none" | "client" | "server" | string;
  gracePeriodSeconds?: number;
  propagationPolicy?: "Background" | "Foreground" | "Orphan" | string;
  ignoreNotFound?: boolean;
}

export interface ApplyQueryOptions {
  dryRun?: "none" | "client" | "server" | string;
  fieldManager?: string;
  forceConflicts?: boolean;
  serverSide?: boolean;
}

export const commonDeleteQuerySchema = {
  dryRun: {
    type: "string",
    enum: ["none", "client", "server"],
    description: "Must be 'none', 'client', or 'server'. If 'client', validate input and preview deletion without sending request to cluster. If 'server', submit a dry-run request to the Kubernetes API server.",
    default: "none",
  },
  gracePeriodSeconds: {
    type: "number",
    description: "The duration in seconds before the object should be deleted. 0 indicates delete immediately (like kubectl --now).",
  },
  propagationPolicy: {
    type: "string",
    enum: ["Background", "Foreground", "Orphan"],
    description: "Whether and how garbage collection will be performed: 'Background', 'Foreground', or 'Orphan' (maps to kubectl --cascade).",
    default: "Background",
  },
  ignoreNotFound: {
    type: "boolean",
    description: "Treat 'resource not found' (404) as a successful deletion (like kubectl delete --ignore-not-found).",
    default: false,
  },
};

export const commonApplyQuerySchema = {
  dryRun: {
    type: "string",
    enum: ["none", "client", "server"],
    description: "Must be 'none', 'client', or 'server'. If 'client', validate manifest locally without sending to cluster. If 'server', execute server-side dry-run request.",
    default: "none",
  },
  fieldManager: {
    type: "string",
    description: "Name of the manager used to track field ownership in server-side apply (default: 'k8s-helm-mcp').",
    default: "k8s-helm-mcp",
  },
  forceConflicts: {
    type: "boolean",
    description: "Force apply changes by taking ownership of conflicting fields in server-side apply.",
    default: false,
  },
  serverSide: {
    type: "boolean",
    description: "If true, apply runs on the server instead of the client (Server-Side Apply).",
    default: false,
  },
};

export const commonCreateQuerySchema = {
  dryRun: {
    type: "string",
    enum: ["none", "client", "server"],
    description: "Must be 'none', 'client', or 'server'. If 'client', validate input and preview creation without sending request to cluster. If 'server', submit a dry-run request to the Kubernetes API server.",
    default: "none",
  },
};

export function buildServerCreateParams(options: { dryRun?: string } = {}): {
  dryRun?: string;
} {
  if (isServerDryRun(options.dryRun)) {
    return { dryRun: "All" };
  }
  return {};
}

export function formatClientDryRunCreate(params: {
  kind: string;
  name: string;
  namespace?: string;
  manifest?: any;
}): {
  success: boolean;
  dryRun: "client";
  message: string;
  resource: any;
} {
  const nsPart = params.namespace ? ` in namespace '${params.namespace}'` : "";
  return {
    success: true,
    dryRun: "client",
    message: `[Client Dry-Run] ${params.kind} '${params.name}'${nsPart} would be created.`,
    resource: params.manifest || {
      apiVersion: "v1",
      kind: params.kind,
      metadata: {
        name: params.name,
        ...(params.namespace ? { namespace: params.namespace } : {}),
      },
    },
  };
}

export const commonMutationQuerySchema = commonCreateQuerySchema;

export const buildServerMutationParams = buildServerCreateParams;

export function formatClientDryRunMutation(params: {
  operation: string;
  kind?: string;
  name: string;
  namespace?: string;
  patch?: any;
  details?: any;
}): {
  success: boolean;
  dryRun: "client";
  message: string;
  operation: string;
  resource: {
    kind?: string;
    name: string;
    namespace?: string;
    patch?: any;
    details?: any;
  };
} {
  const kindPart = params.kind ? `${params.kind} ` : "";
  const nsPart = params.namespace ? ` in namespace '${params.namespace}'` : "";
  return {
    success: true,
    dryRun: "client",
    message: `[Client Dry-Run] ${params.operation} for ${kindPart}'${params.name}'${nsPart} simulated successfully.`,
    operation: params.operation,
    resource: {
      kind: params.kind,
      name: params.name,
      namespace: params.namespace,
      ...(params.patch !== undefined ? { patch: params.patch } : {}),
      ...(params.details !== undefined ? { details: params.details } : {}),
    },
  };
}

export function isClientDryRun(dryRun?: string): boolean {
  return dryRun === "client";
}

export function isServerDryRun(dryRun?: string): boolean {
  return dryRun === "server";
}

export function buildServerDeleteParams(options: DeleteQueryOptions = {}): {
  dryRun?: string;
  gracePeriodSeconds?: number;
  propagationPolicy?: string;
} {
  const params: {
    dryRun?: string;
    gracePeriodSeconds?: number;
    propagationPolicy?: string;
  } = {};

  if (isServerDryRun(options.dryRun)) {
    params.dryRun = "All";
  }

  if (typeof options.gracePeriodSeconds === "number") {
    params.gracePeriodSeconds = options.gracePeriodSeconds;
  }

  if (options.propagationPolicy) {
    params.propagationPolicy = options.propagationPolicy;
  }

  return params;
}

export function formatClientDryRunDelete(params: {
  kind: string;
  name: string;
  namespace?: string;
  gracePeriodSeconds?: number;
  propagationPolicy?: string;
}): {
  success: boolean;
  dryRun: "client";
  message: string;
  resource: {
    kind: string;
    name: string;
    namespace?: string;
    gracePeriodSeconds?: number;
    propagationPolicy?: string;
  };
} {
  const nsPart = params.namespace ? ` in namespace '${params.namespace}'` : "";
  return {
    success: true,
    dryRun: "client",
    message: `[Client Dry-Run] ${params.kind} '${params.name}'${nsPart} would be deleted.`,
    resource: {
      kind: params.kind,
      name: params.name,
      namespace: params.namespace,
      gracePeriodSeconds: params.gracePeriodSeconds,
      propagationPolicy: params.propagationPolicy || "Background",
    },
  };
}

export function handleDeleteError(
  error: any,
  params: {
    kind: string;
    name: string;
    namespace?: string;
    ignoreNotFound?: boolean;
  }
): { success: boolean; deleted: boolean; message: string; notFound: boolean } | null {
  if (params.ignoreNotFound && isNotFoundError(error)) {
    const nsPart = params.namespace ? ` in namespace '${params.namespace}'` : "";
    return {
      success: true,
      deleted: false,
      notFound: true,
      message: `${params.kind} '${params.name}'${nsPart} not found (ignored).`,
    };
  }
  return null;
}
