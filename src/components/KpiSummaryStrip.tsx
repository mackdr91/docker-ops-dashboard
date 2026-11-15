/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Summary KPI telemetry cards displaying fleet status, aggregate CPU load, memory allocation, and network/disk throughput.
 */

'use client';

import React from 'react';
import {
  Box,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  ShieldAlert,
} from 'lucide-react';
import { formatBytes, formatPercent } from '@/lib/formatters';
import type { DockerHostStatus, FleetKpiSummary } from '@/types/docker';

interface KpiSummaryStripProps {
  kpi: FleetKpiSummary;
  hostStatus: DockerHostStatus | null;
}

export function KpiSummaryStrip({ kpi, hostStatus }: KpiSummaryStripProps) {
  const hostMemory = kpi.hostTotalMemoryBytes || hostStatus?.totalMemoryBytes || 0;
  const memoryUtilizationPercent =
    hostMemory > 0
      ? Math.min(100, (kpi.aggregateMemoryUsageBytes / hostMemory) * 100)
      : 0;

  const cpuCores = hostStatus?.cpus || 1;
  const maxCpuCapacity = cpuCores * 100;
  const normalizedCpuBar = Math.min(
    100,
    (kpi.aggregateCpuPercent / maxCpuCapacity) * 100
  );

  return (
    <section
      aria-label="Fleet Summary Telemetry KPIs"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* Card 1: Fleet Status */}
      <div className="border border-cyber-border bg-cyber-panel/90 p-4 transition hover:border-cyber-cyan/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
            01 // CONTAINER FLEET
          </span>
          <Box className="h-4 w-4 text-cyber-cyan" />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white">
            {kpi.runningContainers}
          </span>
          <span className="text-sm text-slate-400">
            / {kpi.totalContainers} ACTIVE
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="border border-cyber-green/40 bg-cyber-green/10 px-2 py-0.5 text-cyber-green">
            RUN: {kpi.runningContainers}
          </span>
          <span className="border border-cyber-amber/40 bg-cyber-amber/10 px-2 py-0.5 text-cyber-amber">
            PAUSE: {kpi.pausedContainers}
          </span>
          <span className="border border-cyber-red/40 bg-cyber-red/10 px-2 py-0.5 text-cyber-red">
            EXIT: {kpi.stoppedContainers}
          </span>
          {kpi.unhealthyContainers > 0 && (
            <span className="inline-flex items-center gap-1 border border-cyber-red bg-cyber-red/20 px-2 py-0.5 font-bold text-cyber-red">
              <ShieldAlert className="h-3 w-3" />
              UNHEALTHY: {kpi.unhealthyContainers}
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Aggregate CPU Telemetry */}
      <div className="border border-cyber-border bg-cyber-panel/90 p-4 transition hover:border-cyber-cyan/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
            02 // AGGREGATE CPU LOAD
          </span>
          <Cpu className="h-4 w-4 text-cyber-cyan" />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-3xl font-bold tracking-tight text-cyber-cyan">
            {formatPercent(kpi.aggregateCpuPercent, 1)}
          </span>
          <span className="text-xs text-slate-400">
            {cpuCores} HOST {cpuCores === 1 ? 'CORE' : 'CORES'}
          </span>
        </div>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden bg-cyber-bg border border-cyber-border">
            <div
              className="h-full bg-cyber-cyan transition-all duration-300"
              style={{ width: `${Math.max(normalizedCpuBar, 2)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            CAPACITY NORMALIZED: {formatPercent(normalizedCpuBar, 1)} OF {maxCpuCapacity}%
          </p>
        </div>
      </div>

      {/* Card 3: Aggregate Memory Allocation */}
      <div className="border border-cyber-border bg-cyber-panel/90 p-4 transition hover:border-cyber-cyan/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-green">
            03 // MEMORY ALLOCATION
          </span>
          <MemoryStick className="h-4 w-4 text-cyber-green" />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-3xl font-bold tracking-tight text-cyber-green">
            {formatBytes(kpi.aggregateMemoryUsageBytes)}
          </span>
          <span className="text-xs text-slate-400">
            {hostMemory > 0 ? `/ ${formatBytes(hostMemory)}` : 'ACTIVE RSS'}
          </span>
        </div>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden bg-cyber-bg border border-cyber-border">
            <div
              className={`h-full transition-all duration-300 ${
                memoryUtilizationPercent > 85
                  ? 'bg-cyber-red'
                  : memoryUtilizationPercent > 65
                  ? 'bg-cyber-amber'
                  : 'bg-cyber-green'
              }`}
              style={{ width: `${Math.max(memoryUtilizationPercent, 2)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            HOST RAM UTILIZATION: {formatPercent(memoryUtilizationPercent, 1)}
          </p>
        </div>
      </div>

      {/* Card 4: Network & Disk Block Throughput */}
      <div className="border border-cyber-border bg-cyber-panel/90 p-4 transition hover:border-cyber-cyan/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-amber">
            04 // NET &amp; BLOCK I/O
          </span>
          <Network className="h-4 w-4 text-cyber-amber" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="border border-cyber-border bg-cyber-bg p-2">
            <div className="text-[10px] text-slate-400">NET RX / TX</div>
            <div className="mt-1 font-semibold text-cyber-cyan">
              ↓ {formatBytes(kpi.aggregateNetworkRxBytes)}
            </div>
            <div className="font-semibold text-cyber-green">
              ↑ {formatBytes(kpi.aggregateNetworkTxBytes)}
            </div>
          </div>
          <div className="border border-cyber-border bg-cyber-bg p-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <HardDrive className="h-3 w-3 text-cyber-amber" />
              <span>BLK R / W</span>
            </div>
            <div className="mt-1 font-semibold text-cyber-amber">
              R: {formatBytes(kpi.aggregateBlockReadBytes)}
            </div>
            <div className="font-semibold text-slate-200">
              W: {formatBytes(kpi.aggregateBlockWriteBytes)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
