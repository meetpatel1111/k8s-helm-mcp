import * as yaml from "js-yaml";

/**
 * Utility functions and schema definitions for advanced querying (sorting, filtering, limiting, formatting)
 * across Kubernetes list and get tools.
 */

export const commonListQuerySchema = {
  labelSelector: {
    type: "string",
    description: "Label selector to filter resources (e.g. 'app=nginx', 'environment in (production,staging)')",
  },
  fieldSelector: {
    type: "string",
    description: "Field selector to filter resources (e.g. 'status.phase=Running', 'spec.nodeName=node-1')",
  },
  sortBy: {
    type: "string",
    description: "Field to sort by. Supports shorthand aliases (e.g., 'creationTimestamp', 'age', 'name', 'namespace', 'status', 'restarts', 'replicas') or dot/bracket path notation (e.g., '.metadata.creationTimestamp', 'metadata.labels.app')",
  },
  descending: {
    type: "boolean",
    description: "Sort in descending order (e.g., newest first for creationTimestamp, highest first for restarts). Default: false",
    default: false,
  },
  limit: {
    type: "number",
    description: "Maximum number of items to return after sorting and filtering (prevents context window overflow)",
    minimum: 1,
  },
  output: {
    type: "string",
    enum: ["json", "yaml", "name"],
    description: "Output format: 'json' (default structured list), 'yaml' (YAML formatted text), or 'name' (resource names only)",
    default: "json",
  },
};

export const commonGetQuerySchema = {
  output: {
    type: "string",
    enum: ["json", "yaml", "name"],
    description: "Output format: 'json' (default structured object), 'yaml' (YAML formatted string), or 'name' (concise resource identifier)",
    default: "json",
  },
  subpath: {
    type: "string",
    description: "Extract a specific field or sub-tree (e.g., 'status.podIP', 'spec.nodeName', '.metadata.labels', 'spec.containers[0].image')",
  },
  ignoreNotFound: {
    type: "boolean",
    description: "If true, returns { found: false } instead of throwing an error when the resource does not exist (like kubectl --ignore-not-found)",
    default: false,
  },
};

/**
 * Checks whether an error represents a 404 Not Found error from Kubernetes API.
 */
export function isNotFoundError(error: any): boolean {
  if (!error) return false;
  if (error.statusCode === 404 || error.status === 404) return true;
  if (error.response?.statusCode === 404 || error.response?.status === 404) return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("not found") || msg.includes("404");
}

export interface GetFormattingOptions {
  kind?: string;
  name?: string;
  namespace?: string;
  output?: string;
  subpath?: string;
}

/**
 * Formats a single resource object according to requested get options (output format, subpath extraction).
 */
export function applyGetFormatting(data: any, options: GetFormattingOptions = {}): any {
  if (data === null || data === undefined) return data;

  // 1. Subpath extraction if requested
  let target = data;
  if (options.subpath) {
    const extracted = extractFieldValue(data, options.subpath);
    target = {
      path: options.subpath,
      value: extracted,
    };
  }

  // 2. Output formatting
  if (options.output === "yaml") {
    try {
      return {
        yaml: yaml.dump(target, { indent: 2, lineWidth: -1 }),
      };
    } catch {
      return { yaml: String(target) };
    }
  }

  if (options.output === "name") {
    const kindPrefix = options.kind ? `${options.kind.toLowerCase()}/` : "";
    const resName = options.name || target.metadata?.name || target.name || "unknown";
    return {
      name: `${kindPrefix}${resName}`,
    };
  }

  // Default: json
  return target;
}

/**
 * Extracts a value from an object by path or shorthand alias.
 */
export function extractFieldValue(item: any, path: string): any {
  if (!item || !path) return undefined;

  const normalized = path.startsWith(".") ? path.substring(1) : path;

  // Shorthand aliases for common fields
  const aliases: Record<string, string[]> = {
    creationtimestamp: ["metadata.creationTimestamp", "creationTimestamp", "created", "age"],
    created: ["created", "metadata.creationTimestamp", "creationTimestamp", "age"],
    age: ["age", "metadata.creationTimestamp", "creationTimestamp", "created"],
    name: ["name", "metadata.name"],
    namespace: ["namespace", "metadata.namespace"],
    status: ["status", "status.phase"],
    phase: ["status.phase", "status"],
    restarts: ["restarts", "status.containerStatuses[0].restartCount"],
    replicas: ["replicas", "spec.replicas"],
    ready: ["ready", "status.readyReplicas"],
    node: ["node", "spec.nodeName"],
    ip: ["ip", "status.podIP", "spec.clusterIP"],
    type: ["type", "spec.type"],
  };

  const lookup = normalized.toLowerCase();
  const candidatePaths = aliases[lookup] ? Array.from(new Set([normalized, ...aliases[lookup]])) : [normalized];

  for (const candidate of candidatePaths) {
    const val = getDeepValue(item, candidate);
    if (val !== undefined && val !== null) {
      return val;
    }
  }

  return undefined;
}

function getDeepValue(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
    if (arrayMatch) {
      const prop = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      current = current[prop]?.[index];
    } else {
      current = current[part];
    }
  }

  return current;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Compares two values supporting numbers, strings, dates, and booleans.
 */
function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;

  // If numbers
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  // Check if both are strict ISO 8601 date strings
  if (typeof a === "string" && typeof b === "string" && ISO_DATE_REGEX.test(a) && ISO_DATE_REGEX.test(b)) {
    const aTime = Date.parse(a);
    const bTime = Date.parse(b);
    if (!isNaN(aTime) && !isNaN(bTime)) {
      return aTime - bTime;
    }
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export interface QueryOptions {
  sortBy?: string;
  descending?: boolean;
  limit?: number;
  output?: string;
}

export interface QueryResult<T> {
  items: T[];
  total: number;
  returned: number;
  sortedBy?: string;
  yaml?: string;
  names?: string[];
}

/**
 * Applies sorting, limiting, and output formatting to an array of items.
 */
export function applySortAndLimit<T>(items: T[], options: QueryOptions = {}): QueryResult<T> {
  const total = items.length;
  let result = [...items];

  if (options.sortBy) {
    const isDesc = options.descending === true;
    result.sort((a, b) => {
      const valA = extractFieldValue(a, options.sortBy!);
      const valB = extractFieldValue(b, options.sortBy!);
      const cmp = compareValues(valA, valB);
      return isDesc ? -cmp : cmp;
    });
  }

  if (options.limit && options.limit > 0) {
    result = result.slice(0, options.limit);
  }

  const queryResult: QueryResult<T> = {
    items: result,
    total,
    returned: result.length,
    sortedBy: options.sortBy
      ? `${options.sortBy} (${options.descending ? "desc" : "asc"})`
      : undefined,
  };

  if (options.output === "yaml") {
    try {
      queryResult.yaml = yaml.dump(result, { indent: 2, lineWidth: -1 });
    } catch {
      queryResult.yaml = String(result);
    }
  } else if (options.output === "name") {
    queryResult.names = result
      .map((i) => (i as any).name || (i as any).metadata?.name)
      .filter(Boolean);
  }

  return queryResult;
}
