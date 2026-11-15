/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Slide-over detail drawer orchestrating real-time SSE telemetry streams, live terminal log streaming, and low-level container inspection.
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  FileCode2,
  Play,
  RotateCw,
  Square,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import {
  DrawerTelemetryTab,
  type TelemetryChartPoint,
} from '@/components/drawer/DrawerTelemetryTab';
import { DrawerLogsTab } from '@/components/drawer/DrawerLogsTab';
import { DrawerInspectTab } from '@/components/drawer/DrawerInspectTab';
import type {
  ContainerInspectDetail,
  ContainerLifecycleAction,
  ContainerLogEntry,
  ContainerMetricsSnapshot,
  ContainerSummaryItem,
} from '@/types/docker';

type DrawerTab = 'TELEMETRY' | 'LOGS' | 'INSPECT';

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

  // Inspect state
  const [inspectDetail, setInspectDetail] =
    useState<ContainerInspectDetail | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

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

        setChartHistory((prev) => [
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
        ]);
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

  // Connect to Live Logs SSE Stream when drawer is open and stream is not paused
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
        // Keep previous state
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
            <span>01 {'//'} REAL-TIME TELEMETRY</span>
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
            <span>03 {'//'} INSPECT &amp; METADATA</span>
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="cyber-scroller flex-1 overflow-y-auto p-6">
          {activeTab === 'TELEMETRY' && (
            <DrawerTelemetryTab
              currentMetrics={currentMetrics}
              chartHistory={chartHistory}
            />
          )}

          {activeTab === 'LOGS' && (
            <DrawerLogsTab
              container={container}
              logs={logs}
              logsPaused={logsPaused}
              onTogglePause={() => setLogsPaused((p) => !p)}
              onClearLogs={() => setLogs([])}
            />
          )}

          {activeTab === 'INSPECT' && (
            <DrawerInspectTab
              inspectDetail={inspectDetail}
              inspectLoading={inspectLoading}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
