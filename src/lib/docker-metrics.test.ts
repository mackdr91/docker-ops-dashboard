/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Unit tests for Docker CPU, memory, network, disk I/O calculations and multiplexed log parsing.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateBlockIo,
  calculateCpuPercent,
  calculateMemoryMetrics,
  calculateNetworkIo,
  demuxDockerLogBuffer,
  extractHealthFromStatus,
  parseContainerStats,
} from './docker-metrics';

describe('docker-metrics calculation engine', () => {
  it('computes CPU usage percentage accurately across multiple cores', () => {
    const cpuPercent = calculateCpuPercent({
      cpu_stats: {
        cpu_usage: { total_usage: 250_000_000 },
        system_cpu_usage: 2_000_000_000,
        online_cpus: 4,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 150_000_000 },
        system_cpu_usage: 1_000_000_000,
        online_cpus: 4,
      },
    });
    // (100M / 1000M) * 4 * 100 = 40%
    expect(cpuPercent).toBe(40);
  });

  it('computes active memory excluding inactive_file cache', () => {
    const mem = calculateMemoryMetrics({
      memory_stats: {
        usage: 500 * 1024 * 1024,
        limit: 1000 * 1024 * 1024,
        stats: {
          inactive_file: 100 * 1024 * 1024,
        },
      },
    });
    expect(mem.memoryUsageBytes).toBe(400 * 1024 * 1024);
    expect(mem.memoryPercent).toBe(40);
  });

  it('sums network and block I/O across interfaces and operations', () => {
    const net = calculateNetworkIo({
      networks: {
        eth0: { rx_bytes: 1200, tx_bytes: 800 },
        eth1: { rx_bytes: 300, tx_bytes: 200 },
      },
    });
    expect(net).toEqual({ networkRxBytes: 1500, networkTxBytes: 1000 });

    const blk = calculateBlockIo({
      blkio_stats: {
        io_service_bytes_recursive: [
          { op: 'Read', value: 4096 },
          { op: 'Write', value: 8192 },
        ],
      },
    });
    expect(blk).toEqual({ blockReadBytes: 4096, blockWriteBytes: 8192 });
  });

  it('parses full container stats snapshot safely', () => {
    const snapshot = parseContainerStats(null);
    expect(snapshot.cpuPercent).toBe(0);
    expect(snapshot.memoryUsageBytes).toBe(0);
  });

  it('extracts container health state from status string', () => {
    expect(extractHealthFromStatus('Up 10 minutes (healthy)')).toBe('healthy');
    expect(extractHealthFromStatus('Up 4 minutes (unhealthy)')).toBe('unhealthy');
    expect(extractHealthFromStatus('Up 15 seconds (health: starting)')).toBe(
      'starting'
    );
    expect(extractHealthFromStatus('Up 2 hours')).toBe('none');
  });

  it('demultiplexes 8-byte Docker stream frames accurately', () => {
    const payload = '2026-11-15T14:00:00.000000000Z ERROR Database timeout\n';
    const payloadBuf = Buffer.from(payload, 'utf8');
    const header = Buffer.alloc(8);
    header[0] = 2; // stderr
    header.writeUInt32BE(payloadBuf.length, 4);

    const entries = demuxDockerLogBuffer(Buffer.concat([header, payloadBuf]));
    expect(entries).toHaveLength(1);
    expect(entries[0].stream).toBe('stderr');
    expect(entries[0].level).toBe('ERROR');
    expect(entries[0].message).toBe('ERROR Database timeout');
  });
});
