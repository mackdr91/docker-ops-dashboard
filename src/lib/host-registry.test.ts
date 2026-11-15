/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Unit tests for multi-host Docker endpoint validation and Dockerode client creation.
 */

import { describe, expect, it } from 'vitest';
import {
  createDockerClient,
  getDefaultLocalHost,
  validateHostInput,
} from './host-registry';

describe('host-registry validation and factory', () => {
  it('returns the default local Unix socket configuration', () => {
    const def = getDefaultLocalHost();
    expect(def.id).toBe('local');
    expect(def.type).toBe('socket');
    expect(def.isDefault).toBe(true);
  });

  it('validates and normalizes socket, TCP, and SSH endpoints', () => {
    const sockRes = validateHostInput({
      name: 'Local Sock',
      type: 'socket',
      endpoint: '/var/run/docker.sock',
    });
    expect(sockRes.valid).toBe(true);
    expect(sockRes.normalizedEndpoint).toBe('/var/run/docker.sock');

    const tcpRes = validateHostInput({
      name: 'Prod Cluster',
      type: 'tcp',
      endpoint: '192.168.1.50:2375',
    });
    expect(tcpRes.valid).toBe(true);
    expect(tcpRes.normalizedEndpoint).toBe('http://192.168.1.50:2375');

    const sshRes = validateHostInput({
      name: 'Remote Edge Node',
      type: 'ssh',
      endpoint: 'ubuntu@10.0.0.15:22',
    });
    expect(sshRes.valid).toBe(true);
    expect(sshRes.normalizedEndpoint).toBe('ssh://ubuntu@10.0.0.15:22');
  });

  it('rejects invalid host configurations cleanly', () => {
    const badName = validateHostInput({
      name: 'A',
      type: 'socket',
      endpoint: '/var/run/docker.sock',
    });
    expect(badName.valid).toBe(false);

    const badSock = validateHostInput({
      name: 'Bad Socket',
      type: 'socket',
      endpoint: 'relative/path.sock',
    });
    expect(badSock.valid).toBe(false);
  });

  it('creates Dockerode client instances for socket and TCP configs', () => {
    const client = createDockerClient({
      id: 'test-tcp',
      name: 'TEST TCP',
      type: 'tcp',
      endpoint: 'http://127.0.0.1:2375',
      createdAt: new Date().toISOString(),
    });
    expect(client).toBeDefined();
  });
});
