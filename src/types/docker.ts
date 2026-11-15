/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: TypeScript interfaces and domain types for multi-host Docker connections, container telemetry, logs, and lifecycle controls.
 */

export type DockerConnectionType = 'socket' | 'tcp' | 'ssh';

export interface DockerHostConfig {
  id: string;
  name: string;
  type: DockerConnectionType;
  endpoint: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface DockerHostStatus {
  host: DockerHostConfig;
  connected: boolean;
  latencyMs: number | null;
  engineVersion?: string;
  os?: string;
  architecture?: string;
  cpus?: number;
  totalMemoryBytes?: number;
  errorMessage?: string;
}

export interface ContainerPortBinding {
  ip?: string;
  privatePort: number;
  publicPort?: number;
  type: string;
}

export interface ContainerMetricsSnapshot {
  timestamp: string;
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
  pids: number;
}

export type ContainerHealthState = 'healthy' | 'unhealthy' | 'starting' | 'none';

export interface ContainerSummaryItem {
  id: string;
  shortId: string;
  name: string;
  image: string;
  command: string;
  created: number;
  state: string;
  status: string;
  health: ContainerHealthState;
  ports: ContainerPortBinding[];
  composeProject?: string;
  composeService?: string;
  metrics: ContainerMetricsSnapshot;
}

export interface FleetKpiSummary {
  totalContainers: number;
  runningContainers: number;
  pausedContainers: number;
  stoppedContainers: number;
  unhealthyContainers: number;
  aggregateCpuPercent: number;
  aggregateMemoryUsageBytes: number;
  hostTotalMemoryBytes: number;
  aggregateNetworkRxBytes: number;
  aggregateNetworkTxBytes: number;
  aggregateBlockReadBytes: number;
  aggregateBlockWriteBytes: number;
}

export interface DashboardOverviewResponse {
  hostStatus: DockerHostStatus;
  kpi: FleetKpiSummary;
  containers: ContainerSummaryItem[];
  timestamp: string;
}

export interface ContainerMountInfo {
  type: string;
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
}

export interface ContainerNetworkInfo {
  name: string;
  ipAddress: string;
  gateway: string;
  macAddress: string;
}

export interface ContainerInspectDetail {
  id: string;
  shortId: string;
  name: string;
  image: string;
  created: string;
  platform: string;
  state: {
    status: string;
    running: boolean;
    paused: boolean;
    restarting: boolean;
    oomKilled: boolean;
    pid: number;
    exitCode: number;
    startedAt: string;
    finishedAt: string;
    health: ContainerHealthState;
  };
  restartPolicy: {
    name: string;
    maximumRetryCount: number;
  };
  command: string[];
  entrypoint: string[];
  workingDir: string;
  env: string[];
  labels: Record<string, string>;
  mounts: ContainerMountInfo[];
  networks: ContainerNetworkInfo[];
  ports: ContainerPortBinding[];
}

export type ContainerLifecycleAction =
  | 'start'
  | 'stop'
  | 'restart'
  | 'pause'
  | 'unpause'
  | 'remove';

export type LogSeverityLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface ContainerLogEntry {
  id: string;
  timestamp: string;
  stream: 'stdout' | 'stderr';
  message: string;
  level: LogSeverityLevel;
}
