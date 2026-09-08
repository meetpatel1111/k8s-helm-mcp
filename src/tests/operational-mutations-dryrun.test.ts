import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerWorkloadTools } from '../k8s-tools/workloads.js';
import { registerNodeTools } from '../k8s-tools/nodes.js';
import { registerPodTools } from '../k8s-tools/pods.js';
import { registerAdvancedTools } from '../k8s-tools/advanced.js';
import { K8sClient } from '../k8s-client.js';

describe('Operational Mutations Native DryRun Safety', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('Workload mutation tools dryRun schema and client dryRun', () => {
    it('k8s_scale_deployment should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_scale_deployment')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();
      expect((tool.tool.inputSchema.properties?.dryRun as any).enum).toEqual(['none', 'client', 'server']);

      const result: any = await tool.handler({
        name: 'test-deploy',
        namespace: 'default',
        replicas: 3,
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Deployment');
      expect(result.resource.name).toBe('test-deploy');
      expect(result.resource.details.replicas).toBe(3);
    });

    it('k8s_restart_deployment should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_restart_deployment')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        name: 'test-deploy',
        namespace: 'default',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Deployment');
      expect(result.resource.name).toBe('test-deploy');
      expect(result.resource.details.restartedAt).toBeDefined();
    });

    it('k8s_rollout_pause should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_rollout_pause')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        deployment: 'test-deploy',
        namespace: 'default',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Deployment');
      expect(result.resource.name).toBe('test-deploy');
      expect(result.resource.patch.spec.paused).toBe(true);
    });

    it('k8s_rollout_resume should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_rollout_resume')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        deployment: 'test-deploy',
        namespace: 'default',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Deployment');
      expect(result.resource.name).toBe('test-deploy');
      expect(result.resource.patch.spec.paused).toBe(false);
    });

    it('k8s_restart_statefulset should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_restart_statefulset')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        name: 'test-sts',
        namespace: 'default',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('StatefulSet');
      expect(result.resource.name).toBe('test-sts');
    });

    it('k8s_restart_daemonset should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_restart_daemonset')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        name: 'test-ds',
        namespace: 'default',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('DaemonSet');
      expect(result.resource.name).toBe('test-ds');
    });

    it('k8s_scale should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_scale')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        resource: 'deployment',
        name: 'test-deploy',
        namespace: 'default',
        replicas: 4,
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.name).toBe('test-deploy');
      expect(result.resource.details.targetReplicas).toBe(4);
    });

    it('k8s_trigger_job should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_trigger_job')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();
    });

    it('k8s_expose should support dryRun schema and client dry-run', async () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_expose')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        resource: 'deployment',
        name: 'web',
        port: 80,
        targetPort: 8080,
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Service');
      expect(result.resource.name).toBe('web');
    });
  });

  describe('Node mutation tools dryRun schema and client dryRun', () => {
    it('k8s_cordon_node should support dryRun schema and client dry-run', async () => {
      const tools = registerNodeTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_cordon_node')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        name: 'node-1',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Node');
      expect(result.resource.name).toBe('node-1');
      expect(result.resource.patch.spec.unschedulable).toBe(true);
    });

    it('k8s_uncordon_node should support dryRun schema and client dry-run', async () => {
      const tools = registerNodeTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_uncordon_node')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        name: 'node-1',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Node');
      expect(result.resource.name).toBe('node-1');
      expect(result.resource.patch.spec.unschedulable).toBe(false);
    });

    it('k8s_add_node_label should support dryRun schema and client dry-run', async () => {
      const tools = registerNodeTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_add_node_label')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        name: 'node-1',
        key: 'zone',
        value: 'us-east-1a',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Node');
      expect(result.resource.patch.metadata.labels['zone']).toBe('us-east-1a');
    });

    it('k8s_remove_node_label should support dryRun schema and client dry-run', async () => {
      const tools = registerNodeTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_remove_node_label')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        name: 'node-1',
        key: 'zone',
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.kind).toBe('Node');
      expect(result.resource.patch.metadata.labels['zone']).toBeNull();
    });
  });

  describe('Pod mutation tools dryRun schema and client dryRun', () => {
    it('k8s_restart_pod should support dryRun schema', async () => {
      const tools = registerPodTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_restart_pod')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();
      expect((tool.tool.inputSchema.properties?.dryRun as any).enum).toEqual(['none', 'client', 'server']);
    });
  });

  describe('Advanced mutation tools dryRun schema and client dryRun', () => {
    it('k8s_patch should support dryRun schema and client dry-run', async () => {
      const tools = registerAdvancedTools(mockK8sClient);
      const patchTools = tools.filter(t => t.tool.name === 'k8s_patch');
      expect(patchTools.length).toBeGreaterThan(0);

      for (const tool of patchTools) {
        expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

        const result: any = await tool.handler({
          resource: 'deployment',
          name: 'frontend',
          namespace: 'prod',
          patch: { spec: { replicas: 5 } },
          dryRun: 'client',
        });

        expect(result.success).toBe(true);
        expect(result.dryRun).toBe('client');
        expect(result.resource.name).toBe('frontend');
      }
    });

    it('k8s_label should support dryRun schema and client dry-run', async () => {
      const tools = registerAdvancedTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_label')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        resource: 'pod',
        name: 'nginx',
        namespace: 'default',
        labels: { tier: 'backend' },
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.name).toBe('nginx');
    });

    it('k8s_annotate should support dryRun schema and client dry-run', async () => {
      const tools = registerAdvancedTools(mockK8sClient);
      const tool = tools.find(t => t.tool.name === 'k8s_annotate')!;
      expect(tool.tool.inputSchema.properties?.dryRun).toBeDefined();

      const result: any = await tool.handler({
        resource: 'deployment',
        name: 'web',
        namespace: 'default',
        annotations: { 'description': 'production web tier' },
        dryRun: 'client',
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe('client');
      expect(result.resource.name).toBe('web');
    });
  });
});
