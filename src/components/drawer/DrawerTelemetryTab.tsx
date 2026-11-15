/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Real-time container telemetry tab rendering instantaneous KPI counters and Recharts area/line graphs for CPU, memory, network, and disk I/O.
 */

'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBytes, formatPercent } from '@/lib/formatters';
import type { ContainerMetricsSnapshot } from '@/types/docker';

export interface TelemetryChartPoint {
  timeLabel: string;
  cpuPercent: number;
  memoryMb: number;
  memoryPercent: number;
  netRxKb: number;
  netTxKb: number;
  blkReadKb: number;
  blkWriteKb: number;
}

interface DrawerTelemetryTabProps {
  currentMetrics: ContainerMetricsSnapshot;
  chartHistory: TelemetryChartPoint[];
}

export function DrawerTelemetryTab({
  currentMetrics,
  chartHistory,
}: DrawerTelemetryTabProps) {
  return (
    <div className="space-y-6">
      {/* Instantaneous Telemetry Readout Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-cyber-border bg-cyber-bg p-3">
          <div className="text-[10px] uppercase text-slate-400">
            CPU UTILIZATION
          </div>
          <div className="mt-1 text-xl font-bold text-cyber-cyan">
            {formatPercent(currentMetrics.cpuPercent, 2)}
          </div>
          <div className="text-[10px] text-slate-500">
            ACTIVE PIDS: {currentMetrics.pids}
          </div>
        </div>

        <div className="border border-cyber-border bg-cyber-bg p-3">
          <div className="text-[10px] uppercase text-slate-400">MEMORY RSS</div>
          <div className="mt-1 text-xl font-bold text-cyber-green">
            {formatBytes(currentMetrics.memoryUsageBytes)}
          </div>
          <div className="text-[10px] text-slate-500">
            LIMIT: {formatBytes(currentMetrics.memoryLimitBytes)} (
            {formatPercent(currentMetrics.memoryPercent, 1)})
          </div>
        </div>

        <div className="border border-cyber-border bg-cyber-bg p-3">
          <div className="text-[10px] uppercase text-slate-400">
            NETWORK RX / TX
          </div>
          <div className="mt-1 text-sm font-bold text-cyber-cyan">
            ↓ {formatBytes(currentMetrics.networkRxBytes)}
          </div>
          <div className="text-sm font-bold text-cyber-green">
            ↑ {formatBytes(currentMetrics.networkTxBytes)}
          </div>
        </div>

        <div className="border border-cyber-border bg-cyber-bg p-3">
          <div className="text-[10px] uppercase text-slate-400">
            BLOCK DISK R / W
          </div>
          <div className="mt-1 text-sm font-bold text-cyber-amber">
            R: {formatBytes(currentMetrics.blockReadBytes)}
          </div>
          <div className="text-sm font-bold text-slate-200">
            W: {formatBytes(currentMetrics.blockWriteBytes)}
          </div>
        </div>
      </div>

      {/* CPU, Memory, Network & Block I/O Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border border-cyber-border bg-cyber-bg p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-cyber-cyan">
            CPU LOAD STREAM (%)
          </h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartHistory}>
                <CartesianGrid stroke="#162238" strokeDasharray="3 3" />
                <XAxis
                  dataKey="timeLabel"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0d14',
                    borderColor: '#00f0ff',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpuPercent"
                  name="CPU %"
                  stroke="#00f0ff"
                  fill="#00f0ff"
                  fillOpacity={0.2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-cyber-border bg-cyber-bg p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-cyber-green">
            MEMORY RSS STREAM (MB)
          </h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartHistory}>
                <CartesianGrid stroke="#162238" strokeDasharray="3 3" />
                <XAxis
                  dataKey="timeLabel"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0d14',
                    borderColor: '#00ff9d',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="memoryMb"
                  name="Memory (MB)"
                  stroke="#00ff9d"
                  fill="#00ff9d"
                  fillOpacity={0.2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-cyber-border bg-cyber-bg p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-cyber-cyan">
            NETWORK CUMULATIVE I/O (KB)
          </h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartHistory}>
                <CartesianGrid stroke="#162238" strokeDasharray="3 3" />
                <XAxis
                  dataKey="timeLabel"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0d14',
                    borderColor: '#162238',
                    fontSize: '11px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="netRxKb"
                  name="RX (KB)"
                  stroke="#00f0ff"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="netTxKb"
                  name="TX (KB)"
                  stroke="#00ff9d"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-cyber-border bg-cyber-bg p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-cyber-amber">
            DISK BLOCK I/O (KB)
          </h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartHistory}>
                <CartesianGrid stroke="#162238" strokeDasharray="3 3" />
                <XAxis
                  dataKey="timeLabel"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0d14',
                    borderColor: '#ffb800',
                    fontSize: '11px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="blkReadKb"
                  name="Block Read (KB)"
                  stroke="#ffb800"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="blkWriteKb"
                  name="Block Write (KB)"
                  stroke="#b829ff"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
