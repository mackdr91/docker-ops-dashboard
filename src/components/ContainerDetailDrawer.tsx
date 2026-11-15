/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Slide-over detail drawer providing real-time Recharts SSE telemetry graphs, live terminal log streaming with search/filtering, and container configuration inspection.
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  Pause,
  Play,
  RotateCw,
  Search,
  Square,
  Terminal,
  Trash2,
  WrapText,
  X,
} from 'lucide-react';
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
import type {
  ContainerInspectDetail,
  ContainerLifecycleAction,
  ContainerLogEntry,
  ContainerMetricsSnapshot,
  ContainerSummaryItem,
  LogSeverityLevel,
} from '@/types/docker';

type DrawerTab = 'TELEMETRY' | 'LOGS' | 'INSPECT';

interface TelemetryChartPoint {
  timeLabel: string;
  cpuPercent: number;
  memoryMb: number;
  memoryPercent: number;
  netRxKb: number;
  netTxKb: number;
  blkReadKb: number;
  blkWriteKb: number;
}

interface ContainerDetailDrawerProps {
  container: ContainerSummaryItem | null;
  hostId: string;
  pendingActionId: string | null;
  onClose: () => void;
  onTriggerAction: (
    container: ContainerSummaryItem,
    action: ContainerLifecycleAction
  ) => void;
  onRequestRemove: (container: ContainerSummaryItem) => void;
}

function isSensitiveEnvKey(envEntry: string): boolean {
  const key = envEntry.split('=')[0]?.toUpperCase() || '';
  return (
    key.includes('SECRET') ||
    key.includes('PASSWORD') ||
    key.includes('PASS') ||
    key.includes('TOKEN') ||
    key.includes('KEY') ||
    key.includes('AUTH')
  );
}

export function ContainerDetailDrawer({
  container,
  hostId,
  pendingActionId,
  onClose,
  onTriggerAction,
  onRequestRemove,
}: ContainerDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('TELEMETRY');

  // Telemetry SSE state
  const [latestStats, setLatestStats] =
    useState<ContainerMetricsSnapshot | null>(null);
  const [chartHistory, setChartHistory] = useState<TelemetryChartPoint[]>([]);
  const [statsStreamConnected, setStatsStreamConnected] = useState(false);

  // Logs SSE state
  const [logs, setLogs] = useState<ContainerLogEntry[]>([]);
  const [logsPaused, setLogsPaused] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<
    'ALL' | LogSeverityLevel
  >('ALL');
  const [logStreamFilter, setLogStreamFilter] = useState<
    'ALL' | 'stdout' | 'stderr'
  >('ALL');
  const [wrapLines, setWrapLines] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Inspect state
  const [inspectDetail, setInspectDetail] =
    useState<ContainerInspectDetail | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [revealSecrets, setRevealSecrets] = useState(false);

  const containerId = container?.id || null;
  const isRunning = container?.state.toLowerCase() === 'running';
  const isPaused = container?.state.toLowerCase() === 'paused';
  const isBusy = Boolean(container && pendingActionId === container.id);

  // Seed initial telemetry point when container changes
  useEffect(() => {
    if (!container) {
      setLatestStats(null);
      setChartHistory([]);
      setLogs([]);
      setInspectDetail(null);
      return;
    }

    setLatestStats(container.metrics);
    const nowLabel = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setChartHistory([
      {
        timeLabel: nowLabel,
        cpuPercent: container.metrics.cpuPercent,
        memoryMb: Number(
          (container.metrics.memoryUsageBytes / (1024 * 1024)).toFixed(1)
        ),
        memoryPercent: container.metrics.memoryPercent,
        netRxKb: Number((container.metrics.networkRxBytes / 1024).toFixed(1)),
        netTxKb: Number((container.metrics.networkTxBytes / 1024).toFixed(1)),
        blkReadKb: Number((container.metrics.blockReadBytes / 1024).toFixed(1)),
        blkWriteKb: Number(
          (container.metrics.blockWriteBytes / 1024).toFixed(1)
        ),
      },
    ]);
  }, [containerId, container]);

  // Connect to Live Stats SSE Stream when drawer is open and container is running
  useEffect(() => {
    if (!containerId || !isRunning) {
      setStatsStreamConnected(false);
      return;
    }

    const url = `/api/containers/${encodeURIComponent(
      containerId
    )}/stats/stream?hostId=${encodeURIComponent(hostId)}`;
    const es = new EventSource(url);

    es.onopen = () => {
      setStatsStreamConnected(true);
    };

    es.addEventListener('stats', (event: MessageEvent) => {
      try {
        const snap = JSON.parse(event.data) as ContainerMetricsSnapshot;
        setLatestStats(snap);

        const timeLabel = new Date(snap.timestamp).toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        setChartHistory((prev) => {
          const next = [
            ...prev.slice(-29),
            {
              timeLabel,
              cpuPercent: snap.cpuPercent,
              memoryMb: Number(
                (snap.memoryUsageBytes / (1024 * 1024)).toFixed(1)
              ),
              memoryPercent: snap.memoryPercent,
              netRxKb: Number((snap.networkRxBytes / 1024).toFixed(1)),
              netTxKb: Number((snap.networkTxBytes / 1024).toFixed(1)),
              blkReadKb: Number((snap.blockReadBytes / 1024).toFixed(1)),
              blkWriteKb: Number((snap.blockWriteBytes / 1024).toFixed(1)),
            },
          ];
          return next;
        });
      } catch {
        // Ignore malformed frame
      }
    });

    es.onerror = () => {
      setStatsStreamConnected(false);
    };

    return () => {
      es.close();
      setStatsStreamConnected(false);
    };
  }, [containerId, hostId, isRunning]);

  // Connect to Live Logs SSE Stream when on LOGS tab (or pre-buffer when drawer opens)
  useEffect(() => {
    if (!containerId || logsPaused) {
      return;
    }

    const url = `/api/containers/${encodeURIComponent(
      containerId
    )}/logs/stream?hostId=${encodeURIComponent(hostId)}&tail=200`;
    const es = new EventSource(url);

    es.addEventListener('logs', (event: MessageEvent) => {
      try {
        const incoming = JSON.parse(event.data) as ContainerLogEntry[];
        if (Array.isArray(incoming) && incoming.length > 0) {
          setLogs((prev) => [...prev, ...incoming].slice(-600));
        }
      } catch {
        // Ignore malformed log payload
      }
    });

    return () => {
      es.close();
    };
  }, [containerId, hostId, logsPaused]);

  // Auto-scroll log viewer when new logs arrive and stream is not paused
  useEffect(() => {
    if (!logsPaused && activeTab === 'LOGS' && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, logsPaused, activeTab]);

  // Fetch Container Inspect Metadata when containerId changes
  useEffect(() => {
    if (!containerId) return;
    let cancelled = false;
    setInspectLoading(true);

    fetch(
      `/api/containers/${encodeURIComponent(
        containerId
      )}?hostId=${encodeURIComponent(hostId)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.detail) {
          setInspectDetail(data.detail);
        }
      })
      .catch(() => {
        // Keep previous or empty state
      })
      .finally(() => {
        if (!cancelled) {
          setInspectLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [containerId, hostId]);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (logLevelFilter !== 'ALL' && entry.level !== logLevelFilter) {
        return false;
      }
      if (logStreamFilter !== 'ALL' && entry.stream !== logStreamFilter) {
        return false;
      }
      if (
        logSearch.trim() &&
        !entry.message.toLowerCase().includes(logSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [logs, logLevelFilter, logStreamFilter, logSearch]);

  const handleDownloadLogs = () => {
    if (!container) return;
    const content = filteredLogs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.stream.toUpperCase()}] [${l.level}] ${
            l.message
          }`
      )
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${container.name}-${container.shortId}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!container) {
    return null;
  }

  const currentMetrics = latestStats || container.metrics;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        aria-label={`Container Telemetry and Logs Drawer for ${container.name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-4xl flex-col border-l border-cyber-cyan bg-cyber-panel shadow-cyber-cyan"
      >
        {/* Top Drawer Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyber-border bg-cyber-surface px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyber-cyan">
                CONTAINER INSPECTOR {'//'} #{container.shortId}
              </span>
              {statsStreamConnected && (
                <span className="inline-flex items-center gap-1 border border-cyber-green/50 bg-cyber-green/10 px-1.5 py-0.5 text-[10px] text-cyber-green">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyber-green animate-ping" />
                  SSE LIVE
                </span>
              )}
            </div>
            <h2 className="mt-0.5 truncate text-lg font-bold text-white">
              {container.name}
            </h2>
            <p className="truncate text-xs text-slate-400">{container.image}</p>
          </div>

          {/* Drawer Quick Lifecycle Actions & Close */}
          <div className="flex items-center gap-2">
            {!isRunning && !isPaused && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onTriggerAction(container, 'start')}
                className="inline-flex items-center gap-1 border border-cyber-green bg-cyber-green/15 px-3 py-1.5 text-xs font-bold uppercase text-cyber-green hover:bg-cyber-green hover:text-black disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                <span>START</span>
              </button>
            )}

            {(isRunning || isPaused) && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onTriggerAction(container, 'stop')}
                className="inline-flex items-center gap-1 border border-cyber-amber bg-cyber-amber/15 px-3 py-1.5 text-xs font-bold uppercase text-cyber-amber hover:bg-cyber-amber hover:text-black disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5" />
                <span>STOP</span>
              </button>
            )}

            <button
              type="button"
              disabled={isBusy}
              onClick={() => onTriggerAction(container, 'restart')}
              className="inline-flex items-center gap-1 border border-cyber-cyan bg-cyber-cyan/15 px-3 py-1.5 text-xs font-bold uppercase text-cyber-cyan hover:bg-cyber-cyan hover:text-black disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              <span>RESTART</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => onRequestRemove(container)}
              className="inline-flex items-center gap-1 border border-cyber-red bg-cyber-red/15 px-3 py-1.5 text-xs font-bold uppercase text-cyber-red hover:bg-cyber-red hover:text-black disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>REMOVE</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail drawer"
              className="ml-2 border border-cyber-border bg-cyber-bg p-2 text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-cyber-border bg-cyber-bg px-6">
          <button
            type="button"
            onClick={() => setActiveTab('TELEMETRY')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'TELEMETRY'
                ? 'border-cyber-cyan text-cyber-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>01 // REAL-TIME TELEMETRY</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LOGS')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'LOGS'
                ? 'border-cyber-cyan text-cyber-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>02 {'//'} LIVE TERMINAL LOGS ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('INSPECT')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'INSPECT'
                ? 'border-cyber-cyan text-cyber-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FileCode2 className="h-4 w-4" />
            <span>03 // INSPECT &amp; METADATA</span>
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="cyber-scroller flex-1 overflow-y-auto p-6">
          {activeTab === 'TELEMETRY' && (
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
                  <div className="text-[10px] uppercase text-slate-400">
                    MEMORY RSS
                  </div>
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

              {/* CPU & Memory Charts */}
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

                {/* Network RX/TX Chart */}
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

                {/* Disk Block I/O Chart */}
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
          )}

          {activeTab === 'LOGS' && (
            <div className="flex h-[calc(100vh-230px)] flex-col space-y-3">
              {/* Log Filter & Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border border-cyber-border bg-cyber-bg p-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyber-cyan" />
                  <input
                    type="search"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="SEARCH LOG OUTPUT..."
                    aria-label="Filter container log lines"
                    className="w-full border border-cyber-border bg-cyber-panel py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-cyber-cyan focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Severity Filter */}
                  <select
                    aria-label="Filter logs by severity"
                    value={logLevelFilter}
                    onChange={(e) =>
                      setLogLevelFilter(
                        e.target.value as 'ALL' | LogSeverityLevel
                      )
                    }
                    className="border border-cyber-border bg-cyber-panel px-2.5 py-1.5 text-xs uppercase text-white focus:border-cyber-cyan focus:outline-none"
                  >
                    <option value="ALL">LEVEL: ALL</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                    <option value="DEBUG">DEBUG</option>
                  </select>

                  {/* Stream Filter */}
                  <select
                    aria-label="Filter logs by stream"
                    value={logStreamFilter}
                    onChange={(e) =>
                      setLogStreamFilter(
                        e.target.value as 'ALL' | 'stdout' | 'stderr'
                      )
                    }
                    className="border border-cyber-border bg-cyber-panel px-2.5 py-1.5 text-xs uppercase text-white focus:border-cyber-cyan focus:outline-none"
                  >
                    <option value="ALL">STREAM: ALL</option>
                    <option value="stdout">STDOUT</option>
                    <option value="stderr">STDERR</option>
                  </select>

                  {/* Wrap Toggle */}
                  <button
                    type="button"
                    onClick={() => setWrapLines((w) => !w)}
                    className={`inline-flex items-center gap-1 border px-2.5 py-1.5 text-xs font-semibold uppercase ${
                      wrapLines
                        ? 'border-cyber-cyan bg-cyber-cyan/15 text-cyber-cyan'
                        : 'border-cyber-border bg-cyber-panel text-slate-400'
                    }`}
                  >
                    <WrapText className="h-3.5 w-3.5" />
                    <span>WRAP</span>
                  </button>

                  {/* Pause / Resume Stream */}
                  <button
                    type="button"
                    onClick={() => setLogsPaused((p) => !p)}
                    className={`inline-flex items-center gap-1 border px-2.5 py-1.5 text-xs font-semibold uppercase ${
                      logsPaused
                        ? 'border-cyber-amber bg-cyber-amber/15 text-cyber-amber'
                        : 'border-cyber-green bg-cyber-green/15 text-cyber-green'
                    }`}
                  >
                    {logsPaused ? (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>RESUME</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>LIVE</span>
                      </>
                    )}
                  </button>

                  {/* Clear Buffer */}
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    className="border border-cyber-border bg-cyber-panel px-2.5 py-1.5 text-xs uppercase text-slate-300 hover:border-cyber-red hover:text-cyber-red"
                  >
                    CLEAR
                  </button>

                  {/* Download Logs */}
                  <button
                    type="button"
                    onClick={handleDownloadLogs}
                    className="inline-flex items-center gap-1 border border-cyber-cyan/50 bg-cyber-cyan/10 px-2.5 py-1.5 text-xs font-semibold uppercase text-cyber-cyan hover:bg-cyber-cyan hover:text-black"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>EXPORT</span>
                  </button>
                </div>
              </div>

              {/* Monospace Terminal Output Pane */}
              <div
                ref={logContainerRef}
                className="cyber-scroller flex-1 overflow-y-auto border border-cyber-border bg-[#030407] p-4 font-mono text-xs leading-relaxed"
              >
                {filteredLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    NO LOG LINES MATCHING CURRENT TERMINAL BUFFER FILTER.
                  </div>
                ) : (
                  filteredLogs.map((entry) => {
                    const levelColor =
                      entry.level === 'ERROR'
                        ? 'text-cyber-red'
                        : entry.level === 'WARN'
                        ? 'text-cyber-amber'
                        : entry.level === 'DEBUG'
                        ? 'text-cyber-purple'
                        : 'text-cyber-cyan';

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-start gap-2 border-b border-white/[0.03] py-1 hover:bg-white/[0.03] ${
                          wrapLines
                            ? 'whitespace-pre-wrap break-all'
                            : 'whitespace-pre'
                        }`}
                      >
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {entry.timestamp.replace('T', ' ').slice(0, 19)}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-bold uppercase ${
                            entry.stream === 'stderr'
                              ? 'text-cyber-red'
                              : 'text-slate-400'
                          }`}
                        >
                          [{entry.stream}]
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-bold ${levelColor}`}
                        >
                          [{entry.level}]
                        </span>
                        <span className="text-slate-200">{entry.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'INSPECT' && (
            <div className="space-y-6 text-xs">
              {inspectLoading && !inspectDetail ? (
                <div className="border border-cyber-border bg-cyber-bg p-8 text-center text-cyber-cyan">
                  LOADING LOW-LEVEL CONTAINER CONFIGURATION...
                </div>
              ) : inspectDetail ? (
                <>
                  {/* Runtime Metadata Grid */}
                  <div className="border border-cyber-border bg-cyber-bg p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyber-cyan">
                      RUNTIME &amp; PROCESS STATE
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <span className="text-[10px] text-slate-500">
                          FULL CONTAINER ID
                        </span>
                        <p className="truncate font-semibold text-white" title={inspectDetail.id}>
                          {inspectDetail.id}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">
                          HOST PID / EXIT CODE
                        </span>
                        <p className="font-semibold text-cyber-green">
                          PID: {inspectDetail.state.pid} {'//'} EXIT:{' '}
                          {inspectDetail.state.exitCode}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">
                          RESTART POLICY
                        </span>
                        <p className="font-semibold uppercase text-white">
                          {inspectDetail.restartPolicy.name} (MAX:{' '}
                          {inspectDetail.restartPolicy.maximumRetryCount})
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">
                          WORKING DIRECTORY
                        </span>
                        <p className="font-semibold text-white">
                          {inspectDetail.workingDir}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">
                          STARTED AT
                        </span>
                        <p className="font-semibold text-slate-300">
                          {inspectDetail.state.startedAt || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">
                          ENTRYPOINT &amp; CMD
                        </span>
                        <p className="truncate font-semibold text-cyber-cyan">
                          {[
                            ...inspectDetail.entrypoint,
                            ...inspectDetail.command,
                          ].join(' ') || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Network Attachments */}
                  <div className="border border-cyber-border bg-cyber-bg p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyber-cyan">
                      DOCKER NETWORK INTERFACES ({inspectDetail.networks.length})
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {inspectDetail.networks.map((net) => (
                        <div
                          key={net.name}
                          className="border border-cyber-border bg-cyber-panel p-3"
                        >
                          <div className="font-bold uppercase text-white">
                            {net.name}
                          </div>
                          <div className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                            <div>
                              IPv4:{' '}
                              <span className="text-cyber-cyan">
                                {net.ipAddress}
                              </span>
                            </div>
                            <div>GATEWAY: {net.gateway}</div>
                            <div>MAC: {net.macAddress}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Volume & Bind Mounts */}
                  <div className="border border-cyber-border bg-cyber-bg p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyber-cyan">
                      VOLUME &amp; BIND MOUNTS ({inspectDetail.mounts.length})
                    </h3>
                    {inspectDetail.mounts.length === 0 ? (
                      <p className="mt-2 text-slate-500">
                        No volume or bind mounts attached.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {inspectDetail.mounts.map((m, i) => (
                          <div
                            key={i}
                            className="flex flex-wrap items-center justify-between gap-2 border border-cyber-border bg-cyber-panel p-2.5 text-[11px]"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="mr-2 border border-cyber-cyan/40 bg-cyber-cyan/10 px-1.5 py-0.5 text-[10px] uppercase text-cyber-cyan">
                                {m.type}
                              </span>
                              <span className="text-slate-400">{m.source}</span>
                              <span className="mx-2 text-cyber-cyan">→</span>
                              <span className="font-semibold text-white">
                                {m.destination}
                              </span>
                            </div>
                            <span
                              className={`border px-1.5 py-0.5 text-[10px] font-bold ${
                                m.rw
                                  ? 'border-cyber-green/40 text-cyber-green'
                                  : 'border-cyber-amber/40 text-cyber-amber'
                              }`}
                            >
                              {m.rw ? 'RW' : 'RO'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Environment Variables */}
                  <div className="border border-cyber-border bg-cyber-bg p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyber-cyan">
                        ENVIRONMENT VARIABLES ({inspectDetail.env.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setRevealSecrets((r) => !r)}
                        className="inline-flex items-center gap-1 border border-cyber-border bg-cyber-panel px-2.5 py-1 text-[10px] uppercase text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan"
                      >
                        {revealSecrets ? (
                          <>
                            <EyeOff className="h-3 w-3" />
                            <span>MASK SECRETS</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" />
                            <span>REVEAL SECRETS</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {inspectDetail.env.map((envStr, i) => {
                        const eqIdx = envStr.indexOf('=');
                        const k =
                          eqIdx >= 0 ? envStr.slice(0, eqIdx) : envStr;
                        const v = eqIdx >= 0 ? envStr.slice(eqIdx + 1) : '';
                        const sensitive = isSensitiveEnvKey(envStr);

                        return (
                          <div
                            key={i}
                            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cyber-border/50 py-1 text-[11px]"
                          >
                            <span className="font-semibold text-cyber-cyan">
                              {k}
                            </span>
                            <span className="break-all text-slate-300">
                              {sensitive && !revealSecrets
                                ? '••••••••••••••••'
                                : v}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="border border-cyber-red/40 bg-cyber-red/10 p-4 text-cyber-red">
                  Unable to load container inspection metadata.
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
