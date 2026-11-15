/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Telemetry calculation engine and Docker stream demultiplexer for container CPU, memory, network, disk I/O, and logs.
 */

import type {
  ContainerHealthState,
  ContainerLogEntry,
  ContainerMetricsSnapshot,
  LogSeverityLevel,
} from '@/types/docker';

/**
 * Minimal shape of Dockerode's raw stats payload used for metric extraction.
 */
export interface RawDockerStatsPayload {
  read?: string;
  pids_stats?: {
    current?: number;
  };
  cpu_stats?: {
    cpu_usage?: {
      total_usage?: number;
      percpu_usage?: number[];
    };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: {
      total_usage?: number;
      percpu_usage?: number[];
    };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  memory_stats?: {
    usage?: number;
    limit?: number;
    stats?: {
      inactive_file?: number;
      total_inactive_file?: number;
      cache?: number;
    };
  };
  networks?: Record<
    string,
    {
      rx_bytes?: number;
      tx_bytes?: number;
    }
  >;
  blkio_stats?: {
    io_service_bytes_recursive?: Array<{
      op?: string;
      value?: number;
    }>;
  };
}

/**
 * Returns an empty zeroed metrics snapshot for stopped or non-reporting containers.
 */
export function createEmptyMetricsSnapshot(): ContainerMetricsSnapshot {
  return {
    timestamp: new Date().toISOString(),
    cpuPercent: 0,
    memoryUsageBytes: 0,
    memoryLimitBytes: 0,
    memoryPercent: 0,
    networkRxBytes: 0,
    networkTxBytes: 0,
    blockReadBytes: 0,
    blockWriteBytes: 0,
    pids: 0,
  };
}

/**
 * Computes CPU usage percentage following the official Docker CLI calculation formula.
 */
export function calculateCpuPercent(raw: RawDockerStatsPayload): number {
  const cpuTotal = raw.cpu_stats?.cpu_usage?.total_usage ?? 0;
  const preCpuTotal = raw.precpu_stats?.cpu_usage?.total_usage ?? 0;
  const systemUsage = raw.cpu_stats?.system_cpu_usage ?? 0;
  const preSystemUsage = raw.precpu_stats?.system_cpu_usage ?? 0;

  const cpuDelta = cpuTotal - preCpuTotal;
  const systemDelta = systemUsage - preSystemUsage;

  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0;
  }

  const onlineCpus =
    raw.cpu_stats?.online_cpus ||
    raw.cpu_stats?.cpu_usage?.percpu_usage?.length ||
    1;

  const percent = (cpuDelta / systemDelta) * onlineCpus * 100;
  return Number.isFinite(percent) && percent > 0
    ? Number(percent.toFixed(2))
    : 0;
}

/**
 * Computes active container memory usage (excluding reclaimable page cache) and percentage.
 */
export function calculateMemoryMetrics(raw: RawDockerStatsPayload): {
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
} {
  const rawUsage = raw.memory_stats?.usage ?? 0;
  const limit = raw.memory_stats?.limit ?? 0;
  const stats = raw.memory_stats?.stats;

  // Docker CLI subtracts inactive_file (or total_inactive_file) from raw usage
  const cacheAdjustment =
    stats?.inactive_file ?? stats?.total_inactive_file ?? 0;
  const usedBytes = Math.max(0, rawUsage - cacheAdjustment);

  const percent =
    limit > 0 ? Number(((usedBytes / limit) * 100).toFixed(2)) : 0;

  return {
    memoryUsageBytes: usedBytes,
    memoryLimitBytes: limit,
    memoryPercent: percent,
  };
}

/**
 * Aggregates cumulative network RX and TX bytes across all container interfaces.
 */
export function calculateNetworkIo(raw: RawDockerStatsPayload): {
  networkRxBytes: number;
  networkTxBytes: number;
} {
  if (!raw.networks) {
    return { networkRxBytes: 0, networkTxBytes: 0 };
  }

  let rx = 0;
  let tx = 0;
  for (const iface of Object.values(raw.networks)) {
    rx += iface.rx_bytes ?? 0;
    tx += iface.tx_bytes ?? 0;
  }

  return { networkRxBytes: rx, networkTxBytes: tx };
}

/**
 * Aggregates cumulative disk block read and write bytes.
 */
export function calculateBlockIo(raw: RawDockerStatsPayload): {
  blockReadBytes: number;
  blockWriteBytes: number;
} {
  const entries = raw.blkio_stats?.io_service_bytes_recursive;
  if (!Array.isArray(entries)) {
    return { blockReadBytes: 0, blockWriteBytes: 0 };
  }

  let readBytes = 0;
  let writeBytes = 0;

  for (const item of entries) {
    const op = (item.op || '').toLowerCase();
    const val = item.value ?? 0;
    if (op === 'read') {
      readBytes += val;
    } else if (op === 'write') {
      writeBytes += val;
    }
  }

  return { blockReadBytes: readBytes, blockWriteBytes: writeBytes };
}

/**
 * Transforms a raw Docker stats payload into a normalized ContainerMetricsSnapshot.
 */
export function parseContainerStats(
  raw?: RawDockerStatsPayload | null
): ContainerMetricsSnapshot {
  if (!raw) {
    return createEmptyMetricsSnapshot();
  }

  const cpuPercent = calculateCpuPercent(raw);
  const { memoryUsageBytes, memoryLimitBytes, memoryPercent } =
    calculateMemoryMetrics(raw);
  const { networkRxBytes, networkTxBytes } = calculateNetworkIo(raw);
  const { blockReadBytes, blockWriteBytes } = calculateBlockIo(raw);

  return {
    timestamp: raw.read || new Date().toISOString(),
    cpuPercent,
    memoryUsageBytes,
    memoryLimitBytes,
    memoryPercent,
    networkRxBytes,
    networkTxBytes,
    blockReadBytes,
    blockWriteBytes,
    pids: raw.pids_stats?.current ?? 0,
  };
}

/**
 * Extracts health state from a Docker container status string (e.g., "Up 2 hours (healthy)").
 */
export function extractHealthFromStatus(statusText?: string): ContainerHealthState {
  if (!statusText) {
    return 'none';
  }
  const lower = statusText.toLowerCase();
  if (lower.includes('(unhealthy)')) {
    return 'unhealthy';
  }
  if (lower.includes('(healthy)')) {
    return 'healthy';
  }
  if (lower.includes('health: starting')) {
    return 'starting';
  }
  return 'none';
}

/**
 * Detects log severity level from log text or stream type.
 */
export function detectLogLevel(
  message: string,
  stream: 'stdout' | 'stderr'
): LogSeverityLevel {
  const upper = message.toUpperCase();
  if (
    upper.includes('ERROR') ||
    upper.includes('FATAL') ||
    upper.includes('EXCEPTION') ||
    upper.includes('PANIC')
  ) {
    return 'ERROR';
  }
  if (upper.includes('WARN') || upper.includes('WARNING')) {
    return 'WARN';
  }
  if (upper.includes('DEBUG') || upper.includes('TRACE')) {
    return 'DEBUG';
  }
  return stream === 'stderr' ? 'WARN' : 'INFO';
}

/**
 * Strips ANSI escape sequences for clean terminal display and searching.
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}

/**
 * Parses a single raw log line (optionally prefixed with an ISO timestamp) into a ContainerLogEntry.
 */
export function parseDockerLogLine(
  rawLine: string,
  stream: 'stdout' | 'stderr',
  indexSeed = 0
): ContainerLogEntry | null {
  const cleaned = stripAnsiCodes(rawLine).replace(/\r$/, '').trim();
  if (!cleaned) {
    return null;
  }

  // Docker timestamps format: 2026-11-15T14:22:01.123456789Z <message>
  const timestampMatch = cleaned.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*(.*)$/
  );

  const timestamp = timestampMatch
    ? timestampMatch[1]
    : new Date().toISOString();
  const message = timestampMatch
    ? timestampMatch[2] || '(empty)'
    : cleaned;

  return {
    id: `${timestamp}-${indexSeed}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    stream,
    message,
    level: detectLogLevel(message, stream),
  };
}

/**
 * Demultiplexes a raw Buffer returned by Docker logs API (handles both 8-byte multiplexed headers and plain TTY buffers).
 */
export function demuxDockerLogBuffer(buffer: Buffer): ContainerLogEntry[] {
  if (!buffer || buffer.length === 0) {
    return [];
  }

  const entries: ContainerLogEntry[] = [];
  let offset = 0;
  let lineCounter = 0;

  // Check if buffer uses Docker's 8-byte multiplexed header format:
  // byte 0 is 0 (stdin), 1 (stdout), or 2 (stderr), and bytes 1..3 are 0x00
  const isMultiplexed =
    buffer.length >= 8 &&
    (buffer[0] === 1 || buffer[0] === 2) &&
    buffer[1] === 0 &&
    buffer[2] === 0 &&
    buffer[3] === 0;

  if (isMultiplexed) {
    while (offset + 8 <= buffer.length) {
      const streamType = buffer[offset] === 2 ? 'stderr' : 'stdout';
      const frameSize = buffer.readUInt32BE(offset + 4);
      offset += 8;

      if (frameSize === 0) {
        continue;
      }

      const end = Math.min(offset + frameSize, buffer.length);
      const chunkText = buffer.subarray(offset, end).toString('utf8');
      offset = end;

      const lines = chunkText.split('\n');
      for (const line of lines) {
        const parsed = parseDockerLogLine(line, streamType, lineCounter++);
        if (parsed) {
          entries.push(parsed);
        }
      }
    }
    return entries;
  }

  // Fallback for TTY containers without 8-byte framing
  const rawText = buffer.toString('utf8');
  for (const line of rawText.split('\n')) {
    const parsed = parseDockerLogLine(line, 'stdout', lineCounter++);
    if (parsed) {
      entries.push(parsed);
    }
  }
  return entries;
}
