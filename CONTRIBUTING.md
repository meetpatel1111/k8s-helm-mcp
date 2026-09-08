# Contributing to k8s-helm-mcp

Thank you for your interest in contributing to the k8s-helm-mcp! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18+ OR Bun 1.0+ installed
- npm or yarn package manager
- Git
- kubectl (for testing against a real cluster)
- Helm (optional, for testing Helm tools)

### Getting Started

1. **Fork and clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/k8s-helm-mcp.git
cd k8s-helm-mcp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

4. **Run in development mode:**
```bash
npm run dev  # Runs TypeScript in watch mode
```

## Code Style and Standards

### TypeScript

- Use TypeScript for all new code
- Follow existing code style and patterns
- Use strict type checking (enabled in tsconfig.json)
- Add JSDoc comments for complex functions
- Use meaningful variable and function names

### Code Organization

- Tools are organized by domain in separate files (cluster.ts, nodes.ts, pods.ts, etc.)
- Helm tools are in the `helm-tools/` directory
- Shared utilities go in appropriate utility files
- Follow the existing file structure

### Naming Conventions

- **Tool names:** Use `k8s_` prefix for standard Kubernetes tools, `k8s_helm_` for Helm tools, and `k8s_server_` for server management tools (`k8s_server_info`, `k8s_server_health`, etc.).
- **File names:** Use lowercase with hyphens for utilities, camelCase for tool files
- **Variables:** Use camelCase
- **Constants:** Use UPPER_SNAKE_CASE

## Adding New Tools

### Step 1: Choose the Right File

- Cluster operations: `cluster.ts`
- Node operations: `nodes.ts`
- Pod operations: `pods.ts`
- Workloads: `workloads.ts`
- Networking: `networking.ts`
- Storage: `storage.ts`
- Security/RBAC: `security.ts`
- Monitoring: `monitoring.ts`
- Configuration: `config.ts`
- Advanced operations: `advanced.ts`
- Helm operations: `helm-tools/`

### Step 2: Implement the Tool

```typescript
export const k8s_your_tool: Tool = {
  name: "k8s_your_tool",
  description: "Clear description of what the tool does",
  inputSchema: z.object({
    // Define your input parameters
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional().describe("Optional parameter"),
  }),
  
  async handler(args, context) {
    // Your implementation
    const k8s = new K8sClient();
    // ... your logic
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};
```

### Step 3: Register the Tool

Add the tool to the tool registration in `src/index.ts`:

```typescript
server.addTool(k8s_your_tool);
```

### Step 4: Add Protection Mode (if destructive)

If the tool performs destructive or modification operations, it must be validated by the **ProtectionManager**. Add it to the appropriate category in `src/security/protection-manager.ts`:

- `READ_ONLY_TOOLS`: For tools that don't modify state (get, list, logs, etc.)
- `DESTRUCTIVE_TOOLS`: For tools that can break infrastructure (delete, cordon, drain)
- `DELETION_TOOLS`: Specifically for deletion operations

The server automatically validates every tool call against the current protection mode settings.

### Step 5: Adopt Universal Query & Safety Utilities

To preserve architectural consistency across all 269 tools:
- **GET & LIST Tools**: Enhance schema with `addQueryParameters(schema)` and use `applyQueryParameters(items, args)` from `src/utils/query-helper.ts` to support pagination (`limit`, `continue`), sorting (`sortBy`, `sortOrder`), and multi-format output (`outputFormat: json | yaml`).
- **DELETE Tools**: Enhance schema with `addDeletionSafetyParameters(schema)` and wrap the handler in `executeWithDeletionSafety(...)` from `src/utils/safety-helper.ts` to support `dryRun`, `gracePeriodSeconds`, `propagationPolicy`, and `ignoreNotFound`.
- **CREATE Tools**: Enhance schema with `addCreationSafetyParameters(schema)` and wrap in `executeWithCreationSafety(...)` to support `dryRun: 'none' | 'client' | 'server'`.
- **OPERATIONAL MUTATION Tools**: Enhance schema with `addMutationSafetyParameters(schema)` and wrap in `executeWithMutationSafety(...)` to support pre-flight dry-run execution.

### Step 6: Update Documentation

- Add the tool to `TOOLS_REFERENCE.md`
- Update the tool count in `README.md`
- Add examples if the tool is commonly used
- Update `CHANGELOG.md` with the new feature

## Testing

### Running Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:watch  # Watch mode
```

### Manual Testing

1. Build the project: `npm run build`
2. Configure Claude Desktop to use your local build
3. Test the tool manually through Claude Desktop

### Testing Against Real Clusters

- Use a test cluster (kind, minikube, or a development cluster)
- Never test against production clusters
- Clean up test resources after testing

## Commit Guidelines

### Commit Message Format

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(pods): add pod restart functionality
fix(nodes): resolve cordon node permission error
docs(readme): update installation instructions
```

### Branch Naming

- `feature/your-feature-name`
- `fix/your-bug-fix`
- `docs/your-documentation-update`

## Pull Request Process

1. **Update the changelog:** Add your changes to `CHANGELOG.md` under `[Unreleased]`
2. **Run tests:** Ensure all tests pass
3. **Run linting:** `npm run lint`
4. **Type check:** `npm run typecheck`
5. **Build:** `npm run build`
6. **Submit PR:** Create a pull request with a clear description

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested this change

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
```

## Code Review

### Review Checklist

- [ ] Code follows project conventions
- [ ] TypeScript types are correct
- [ ] Error handling is appropriate
- [ ] Tool descriptions are clear
- [ ] Documentation is updated
- [ ] Tests are included (if applicable)
- [ ] No sensitive data (API keys, tokens) in code

### Feedback Process

- Be constructive and respectful
- Focus on the code, not the person
- Explain the reasoning for suggestions
- Be open to feedback on your own PRs

## Release Process

Releases are managed by maintainers:

1. Update version in `package.json`
2. Update version in `README.md`
3. Move changelog entries from `[Unreleased]` to new version
4. Create git tag
5. Publish to npm (if applicable)
6. Create GitHub release

## Getting Help

- Open an issue for bugs or feature requests
- Use GitHub Discussions for questions
- Check existing issues and documentation first

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

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
