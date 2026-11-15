/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Core Docker Engine service layer handling host health checks, fleet telemetry aggregation, container inspection, and lifecycle actions.
 */

import type Docker from 'dockerode';
import {
  createDockerClient,
  getDockerHostById,
} from '@/lib/host-registry';
import {
  createEmptyMetricsSnapshot,
  extractHealthFromStatus,
  parseContainerStats,
  type RawDockerStatsPayload,
} from '@/lib/docker-metrics';
import { normalizeContainerName } from '@/lib/formatters';
import type {
  ContainerHealthState,
  ContainerInspectDetail,
  ContainerLifecycleAction,
  ContainerMetricsSnapshot,
  ContainerPortBinding,
  ContainerSummaryItem,
  DashboardOverviewResponse,
  DockerHostStatus,
  FleetKpiSummary,
} from '@/types/docker';

/**
 * Wraps a promise with an explicit timeout so unresponsive remote daemons or stats calls fail fast.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(fallbackMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Checks connectivity and retrieves engine metadata for a specific Docker host.
 */
export async function checkHostConnection(
  hostId?: string | null
): Promise<{ status: DockerHostStatus; client: Docker }> {
  const host = getDockerHostById(hostId);
  const client = createDockerClient(host, 6000);
  const startTime = Date.now();

  try {
    await withTimeout(
      client.ping(),
      4000,
      `Timed out connecting to Docker host (${host.endpoint})`
    );
    const latencyMs = Date.now() - startTime;

    const [info, version] = await Promise.all([
      withTimeout(client.info(), 4000, 'Timed out fetching Docker info'),
      withTimeout(client.version(), 4000, 'Timed out fetching Docker version'),
    ]);

    return {
      client,
      status: {
        host,
        connected: true,
        latencyMs,
        engineVersion: version.Version || info.ServerVersion || 'Unknown',
        os: info.OperatingSystem || version.Os || 'Linux',
        architecture: info.Architecture || version.Arch || 'x86_64',
        cpus: info.NCPU || 1,
        totalMemoryBytes: info.MemTotal || 0,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to reach Docker daemon';
    return {
      client,
      status: {
        host,
        connected: false,
        latencyMs: null,
        errorMessage: message,
      },
    };
  }
}

/**
 * Fetches a single non-streaming stats snapshot for a running container with a fast timeout.
 */
async function fetchOneShotContainerStats(
  client: Docker,
  containerId: string
): Promise<ContainerMetricsSnapshot> {
  try {
    const container = client.getContainer(containerId);
    const rawStats = (await withTimeout(
      container.stats({ stream: false }) as unknown as Promise<RawDockerStatsPayload>,
      2500,
      'Stats snapshot timeout'
    )) as RawDockerStatsPayload;
    return parseContainerStats(rawStats);
  } catch {
    return createEmptyMetricsSnapshot();
  }
}

/**
 * Normalizes port bindings from Dockerode's listContainers format.
 */
function mapSummaryPorts(
  ports?: Docker.Port[]
): ContainerPortBinding[] {
  if (!Array.isArray(ports)) {
    return [];
  }

  return ports.map((p) => ({
    ip: p.IP,
    privatePort: p.PrivatePort,
    publicPort: p.PublicPort,
    type: p.Type || 'tcp',
  }));
}

/**
 * Retrieves the complete fleet overview (host status, container list, live metrics, and KPI summary).
 */
export async function getDashboardOverview(
  hostId?: string | null
): Promise<DashboardOverviewResponse> {
  const { status: hostStatus, client } = await checkHostConnection(hostId);

  const emptyKpi: FleetKpiSummary = {
    totalContainers: 0,
    runningContainers: 0,
    pausedContainers: 0,
    stoppedContainers: 0,
    unhealthyContainers: 0,
    aggregateCpuPercent: 0,
    aggregateMemoryUsageBytes: 0,
    hostTotalMemoryBytes: hostStatus.totalMemoryBytes || 0,
    aggregateNetworkRxBytes: 0,
    aggregateNetworkTxBytes: 0,
    aggregateBlockReadBytes: 0,
    aggregateBlockWriteBytes: 0,
  };

  if (!hostStatus.connected) {
    return {
      hostStatus,
      kpi: emptyKpi,
      containers: [],
      timestamp: new Date().toISOString(),
    };
  }

  const rawContainers = await withTimeout(
    client.listContainers({ all: true }),
    6000,
    'Timed out listing containers'
  );

  // Fetch metrics snapshots concurrently for running containers
  const containers: ContainerSummaryItem[] = await Promise.all(
    rawContainers.map(async (item) => {
      const isRunning = item.State === 'running';
      const metrics = isRunning
        ? await fetchOneShotContainerStats(client, item.Id)
        : createEmptyMetricsSnapshot();

      const primaryName =
        Array.isArray(item.Names) && item.Names.length > 0
          ? normalizeContainerName(item.Names[0])
          : item.Id.slice(0, 12);

      const labels = item.Labels || {};
      const health = extractHealthFromStatus(item.Status);

      return {
        id: item.Id,
        shortId: item.Id.slice(0, 12),
        name: primaryName,
        image: item.Image || 'unknown',
        command: item.Command || '',
        created: item.Created || 0,
        state: (item.State || 'unknown').toLowerCase(),
        status: item.Status || '',
        health,
        ports: mapSummaryPorts(item.Ports),
        composeProject: labels['com.docker.compose.project'],
        composeService: labels['com.docker.compose.service'],
        metrics,
      };
    })
  );

  // Sort running containers first, then alphabetically by container name
  containers.sort((a, b) => {
    if (a.state === 'running' && b.state !== 'running') return -1;
    if (a.state !== 'running' && b.state === 'running') return 1;
    return a.name.localeCompare(b.name);
  });

  // Compute aggregate fleet KPIs
  const kpi: FleetKpiSummary = {
    totalContainers: containers.length,
    runningContainers: containers.filter((c) => c.state === 'running').length,
    pausedContainers: containers.filter((c) => c.state === 'paused').length,
    stoppedContainers: containers.filter(
      (c) => c.state !== 'running' && c.state !== 'paused'
    ).length,
    unhealthyContainers: containers.filter((c) => c.health === 'unhealthy')
      .length,
    aggregateCpuPercent: Number(
      containers
        .reduce((acc, c) => acc + c.metrics.cpuPercent, 0)
        .toFixed(2)
    ),
    aggregateMemoryUsageBytes: containers.reduce(
      (acc, c) => acc + c.metrics.memoryUsageBytes,
      0
    ),
    hostTotalMemoryBytes: hostStatus.totalMemoryBytes || 0,
    aggregateNetworkRxBytes: containers.reduce(
      (acc, c) => acc + c.metrics.networkRxBytes,
      0
    ),
    aggregateNetworkTxBytes: containers.reduce(
      (acc, c) => acc + c.metrics.networkTxBytes,
      0
    ),
    aggregateBlockReadBytes: containers.reduce(
      (acc, c) => acc + c.metrics.blockReadBytes,
      0
    ),
    aggregateBlockWriteBytes: containers.reduce(
      (acc, c) => acc + c.metrics.blockWriteBytes,
      0
    ),
  };

  return {
    hostStatus,
    kpi,
    containers,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Inspects a specific container and returns normalized metadata for the detail drawer.
 */
export async function inspectContainerDetails(
  hostId: string | null | undefined,
  containerId: string
): Promise<ContainerInspectDetail> {
  const host = getDockerHostById(hostId);
  const client = createDockerClient(host, 6000);
  const container = client.getContainer(containerId);
  const info = await container.inspect();

  const rawHealth = info.State?.Health?.Status?.toLowerCase();
  const health: ContainerHealthState =
    rawHealth === 'healthy' ||
    rawHealth === 'unhealthy' ||
    rawHealth === 'starting'
      ? rawHealth
      : 'none';

  const ports: ContainerPortBinding[] = [];
  const rawPorts = info.NetworkSettings?.Ports || {};
  for (const [portProto, bindings] of Object.entries(rawPorts)) {
    const [portStr, proto = 'tcp'] = portProto.split('/');
    const privatePort = Number(portStr) || 0;
    if (Array.isArray(bindings) && bindings.length > 0) {
      for (const b of bindings) {
        ports.push({
          ip: b.HostIp,
          privatePort,
          publicPort: b.HostPort ? Number(b.HostPort) : undefined,
          type: proto,
        });
      }
    } else {
      ports.push({
        privatePort,
        type: proto,
      });
    }
  }

  const networks = Object.entries(info.NetworkSettings?.Networks || {}).map(
    ([netName, netConfig]) => ({
      name: netName,
      ipAddress: netConfig.IPAddress || '—',
      gateway: netConfig.Gateway || '—',
      macAddress: netConfig.MacAddress || '—',
    })
  );

  const mounts = (info.Mounts || []).map((m) => ({
    type: m.Type || 'bind',
    source: m.Source || '',
    destination: m.Destination || '',
    mode: m.Mode || '',
    rw: Boolean(m.RW),
  }));

  const rawCmd = info.Config?.Cmd;
  const command = Array.isArray(rawCmd)
    ? rawCmd
    : typeof rawCmd === 'string'
    ? [rawCmd]
    : [];

  const rawEntrypoint = info.Config?.Entrypoint;
  const entrypoint = Array.isArray(rawEntrypoint)
    ? rawEntrypoint
    : typeof rawEntrypoint === 'string'
    ? [rawEntrypoint]
    : [];

  return {
    id: info.Id,
    shortId: info.Id.slice(0, 12),
    name: normalizeContainerName(info.Name),
    image: info.Config?.Image || info.Image || 'unknown',
    created: info.Created || '',
    platform: info.Platform || 'linux',
    state: {
      status: info.State?.Status || 'unknown',
      running: Boolean(info.State?.Running),
      paused: Boolean(info.State?.Paused),
      restarting: Boolean(info.State?.Restarting),
      oomKilled: Boolean(info.State?.OOMKilled),
      pid: info.State?.Pid || 0,
      exitCode: info.State?.ExitCode ?? 0,
      startedAt: info.State?.StartedAt || '',
      finishedAt: info.State?.FinishedAt || '',
      health,
    },
    restartPolicy: {
      name: info.HostConfig?.RestartPolicy?.Name || 'no',
      maximumRetryCount:
        info.HostConfig?.RestartPolicy?.MaximumRetryCount || 0,
    },
    command,
    entrypoint,
    workingDir: info.Config?.WorkingDir || '/',
    env: info.Config?.Env || [],
    labels: info.Config?.Labels || {},
    mounts,
    networks,
    ports,
  };
}

/**
 * Executes a lifecycle control action (start, stop, restart, pause, unpause, remove) on a container.
 */
export async function executeContainerAction(
  hostId: string | null | undefined,
  containerId: string,
  action: ContainerLifecycleAction
): Promise<{ success: boolean; action: ContainerLifecycleAction; containerId: string }> {
  const host = getDockerHostById(hostId);
  const client = createDockerClient(host, 15000);
  const container = client.getContainer(containerId);

  switch (action) {
    case 'start':
      await container.start();
      break;
    case 'stop':
      await container.stop({ t: 5 });
      break;
    case 'restart':
      await container.restart({ t: 5 });
      break;
    case 'pause':
      await container.pause();
      break;
    case 'unpause':
      await container.unpause();
      break;
    case 'remove':
      await container.remove({ force: true, v: false });
      break;
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unsupported lifecycle action: ${String(exhaustiveCheck)}`);
    }
  }

  return {
    success: true,
    action,
    containerId,
  };
}
