/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Multi-host Docker registry and Dockerode client factory supporting Unix sockets, TCP/HTTP(S), and SSH endpoints.
 */

import fs from 'fs';
import path from 'path';
import Docker from 'dockerode';
import type { DockerConnectionType, DockerHostConfig } from '@/types/docker';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'hosts.json');

/**
 * In-memory fallback store used when the container filesystem is read-only or not yet persisted.
 */
let memoryCustomHosts: DockerHostConfig[] | null = null;

/**
 * Returns the default local Unix socket Docker host configuration.
 */
export function getDefaultLocalHost(): DockerHostConfig {
  return {
    id: 'local',
    name: 'LOCAL // UNIX SOCKET',
    type: 'socket',
    endpoint: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
    isDefault: true,
    createdAt: '2026-11-15T00:00:00.000Z',
  };
}

/**
 * Loads user-defined custom hosts from disk or memory cache.
 */
function loadCustomHosts(): DockerHostConfig[] {
  if (memoryCustomHosts !== null) {
    return memoryCustomHosts;
  }

  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryCustomHosts = parsed;
        return memoryCustomHosts;
      }
    }
  } catch {
    // Fallback to empty custom list if disk read fails
  }

  memoryCustomHosts = [];
  return memoryCustomHosts;
}

/**
 * Persists custom hosts to disk while keeping the in-memory cache synchronized.
 */
function saveCustomHosts(hosts: DockerHostConfig[]): void {
  memoryCustomHosts = hosts;
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(hosts, null, 2), 'utf8');
  } catch {
    // Keep in-memory state if running in a read-only filesystem
  }
}

/**
 * Lists all registered Docker hosts (always starting with the default local socket).
 */
export function listDockerHosts(): DockerHostConfig[] {
  const custom = loadCustomHosts();
  return [getDefaultLocalHost(), ...custom];
}

/**
 * Resolves a DockerHostConfig by its ID, falling back to the default local host if not found.
 */
export function getDockerHostById(hostId?: string | null): DockerHostConfig {
  const hosts = listDockerHosts();
  if (!hostId || hostId === 'local') {
    return hosts[0];
  }
  return hosts.find((h) => h.id === hostId) || hosts[0];
}

/**
 * Validates and normalizes a new Docker host endpoint configuration.
 */
export function validateHostInput(input: {
  name: string;
  type: DockerConnectionType;
  endpoint: string;
}): { valid: boolean; error?: string; normalizedEndpoint?: string } {
  const name = (input.name || '').trim();
  const endpoint = (input.endpoint || '').trim();
  const type = input.type;

  if (!name || name.length < 2) {
    return { valid: false, error: 'Host name must be at least 2 characters.' };
  }

  if (!['socket', 'tcp', 'ssh'].includes(type)) {
    return {
      valid: false,
      error: 'Connection type must be socket, tcp, or ssh.',
    };
  }

  if (!endpoint) {
    return { valid: false, error: 'Endpoint path or URL is required.' };
  }

  if (type === 'socket') {
    if (!endpoint.startsWith('/') && !endpoint.startsWith('//./pipe/')) {
      return {
        valid: false,
        error: 'Unix socket endpoint must start with "/" (e.g. /var/run/docker.sock).',
      };
    }
    return { valid: true, normalizedEndpoint: endpoint };
  }

  if (type === 'tcp') {
    const withProtocol =
      endpoint.startsWith('http://') ||
      endpoint.startsWith('https://') ||
      endpoint.startsWith('tcp://')
        ? endpoint.replace(/^tcp:\/\//, 'http://')
        : `http://${endpoint}`;

    try {
      const parsed = new URL(withProtocol);
      if (!parsed.hostname) {
        return { valid: false, error: 'Invalid TCP hostname.' };
      }
      return { valid: true, normalizedEndpoint: withProtocol };
    } catch {
      return {
        valid: false,
        error: 'Invalid TCP endpoint URL (e.g. http://192.168.1.50:2375).',
      };
    }
  }

  // SSH validation
  const withSsh = endpoint.startsWith('ssh://')
    ? endpoint
    : `ssh://${endpoint}`;
  try {
    const parsed = new URL(withSsh);
    if (!parsed.hostname) {
      return { valid: false, error: 'Invalid SSH hostname.' };
    }
    return { valid: true, normalizedEndpoint: withSsh };
  } catch {
    return {
      valid: false,
      error: 'Invalid SSH endpoint (e.g. ssh://root@10.0.0.10:22).',
    };
  }
}

/**
 * Registers a new custom Docker host and saves it to the registry.
 */
export function addDockerHost(input: {
  name: string;
  type: DockerConnectionType;
  endpoint: string;
}): DockerHostConfig {
  const validation = validateHostInput(input);
  if (!validation.valid || !validation.normalizedEndpoint) {
    throw new Error(validation.error || 'Invalid Docker host configuration.');
  }

  const customHosts = loadCustomHosts();
  const id = `host-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newHost: DockerHostConfig = {
    id,
    name: input.name.trim().toUpperCase(),
    type: input.type,
    endpoint: validation.normalizedEndpoint,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  saveCustomHosts([...customHosts, newHost]);
  return newHost;
}

/**
 * Removes a custom Docker host by ID. Default 'local' host cannot be removed.
 */
export function removeDockerHost(hostId: string): boolean {
  if (!hostId || hostId === 'local') {
    throw new Error('The default local Docker socket host cannot be deleted.');
  }

  const customHosts = loadCustomHosts();
  const filtered = customHosts.filter((h) => h.id !== hostId);
  if (filtered.length === customHosts.length) {
    return false;
  }

  saveCustomHosts(filtered);
  return true;
}

/**
 * Creates a configured Dockerode client instance for the specified DockerHostConfig.
 */
export function createDockerClient(
  hostConfig: DockerHostConfig,
  timeoutMs = 8000
): Docker {
  if (hostConfig.type === 'socket') {
    return new Docker({
      socketPath: hostConfig.endpoint,
      timeout: timeoutMs,
    });
  }

  if (hostConfig.type === 'tcp') {
    const parsed = new URL(
      hostConfig.endpoint.replace(/^tcp:\/\//, 'http://')
    );
    const protocol = parsed.protocol === 'https:' ? 'https' : 'http';
    const port = parsed.port
      ? Number(parsed.port)
      : protocol === 'https'
      ? 2376
      : 2375;

    return new Docker({
      protocol,
      host: parsed.hostname,
      port,
      timeout: timeoutMs,
    });
  }

  // SSH connection type
  const parsed = new URL(
    hostConfig.endpoint.startsWith('ssh://')
      ? hostConfig.endpoint
      : `ssh://${hostConfig.endpoint}`
  );
  const port = parsed.port ? Number(parsed.port) : 22;

  return new Docker({
    protocol: 'ssh',
    host: parsed.hostname,
    port,
    username: parsed.username || 'root',
    timeout: timeoutMs,
  });
}
