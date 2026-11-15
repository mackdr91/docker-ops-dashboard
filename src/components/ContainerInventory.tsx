/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Filterable container inventory supporting both a sticky responsive data table and a Cyberpunk card grid with inline lifecycle controls.
 */

'use client';

import React from 'react';
import {
  Activity,
  ExternalLink,
  Layers,
  Pause,
  Play,
  RotateCw,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react';
import { formatBytes, formatPercent } from '@/lib/formatters';
import type { InventoryViewMode } from '@/components/TopCommandBar';
import type {
  ContainerLifecycleAction,
  ContainerPortBinding,
  ContainerSummaryItem,
} from '@/types/docker';

interface ContainerInventoryProps {
  containers: ContainerSummaryItem[];
  viewMode: InventoryViewMode;
  selectedContainerId: string | null;
  pendingActionId: string | null;
  onSelectContainer: (container: ContainerSummaryItem) => void;
  onTriggerAction: (
    container: ContainerSummaryItem,
    action: ContainerLifecycleAction
  ) => void;
  onRequestRemove: (container: ContainerSummaryItem) => void;
}

/**
 * Renders a color-coded Cyberpunk state and health badge.
 */
function StateBadge({
  state,
  health,
}: {
  state: string;
  health: ContainerSummaryItem['health'];
}) {
  const normalized = state.toLowerCase();
  const isRunning = normalized === 'running';
  const isPaused = normalized === 'paused';

  const stateClasses = isRunning
    ? 'border-cyber-green/50 bg-cyber-green/10 text-cyber-green'
    : isPaused
    ? 'border-cyber-amber/50 bg-cyber-amber/10 text-cyber-amber'
    : 'border-cyber-red/50 bg-cyber-red/10 text-cyber-red';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${stateClasses}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isRunning
              ? 'bg-cyber-green animate-pulse'
              : isPaused
              ? 'bg-cyber-amber'
              : 'bg-cyber-red'
          }`}
        />
        {normalized}
      </span>

      {health !== 'none' && (
        <span
          className={`border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
            health === 'healthy'
              ? 'border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan'
              : health === 'unhealthy'
              ? 'border-cyber-red bg-cyber-red/20 text-cyber-red'
              : 'border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber'
          }`}
        >
          {health}
        </span>
      )}
    </div>
  );
}

/**
 * Renders deduplicated port bindings with clickable links for exposed host ports.
 */
function PortBadges({ ports }: { ports: ContainerPortBinding[] }) {
  if (!ports || ports.length === 0) {
    return <span className="text-[11px] text-slate-500">—</span>;
  }

  // Deduplicate IPv4 / IPv6 port entries
  const seen = new Set<string>();
  const uniquePorts = ports.filter((p) => {
    const key = `${p.publicPort || ''}:${p.privatePort}/${p.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="flex flex-wrap gap-1">
      {uniquePorts.slice(0, 4).map((p, idx) => {
        const label = p.publicPort
          ? `${p.publicPort}→${p.privatePort}/${p.type}`
          : `${p.privatePort}/${p.type}`;

        if (p.publicPort) {
          return (
            <a
              key={idx}
              href={`http://localhost:${p.publicPort}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 border border-cyber-cyan/40 bg-cyber-cyan/10 px-1.5 py-0.5 text-[10px] text-cyber-cyan transition hover:bg-cyber-cyan hover:text-black"
              title={`Open http://localhost:${p.publicPort}`}
            >
              <span>{label}</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          );
        }

        return (
          <span
            key={idx}
            className="border border-cyber-border bg-cyber-bg px-1.5 py-0.5 text-[10px] text-slate-400"
          >
            {label}
          </span>
        );
      })}
      {uniquePorts.length > 4 && (
        <span className="border border-cyber-border bg-cyber-bg px-1.5 py-0.5 text-[10px] text-slate-400">
          +{uniquePorts.length - 4}
        </span>
      )}
    </div>
  );
}

/**
 * Renders inline container lifecycle control buttons.
 */
function LifecycleControlBar({
  container,
  isBusy,
  onTriggerAction,
  onRequestRemove,
  onSelectContainer,
}: {
  container: ContainerSummaryItem;
  isBusy: boolean;
  onTriggerAction: (
    container: ContainerSummaryItem,
    action: ContainerLifecycleAction
  ) => void;
  onRequestRemove: (container: ContainerSummaryItem) => void;
  onSelectContainer: (container: ContainerSummaryItem) => void;
}) {
  const state = container.state.toLowerCase();
  const isRunning = state === 'running';
  const isPaused = state === 'paused';

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {!isRunning && !isPaused && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onTriggerAction(container, 'start')}
          title="Start Container"
          aria-label={`Start ${container.name}`}
          className="border border-cyber-green/50 bg-cyber-green/10 p-1.5 text-cyber-green transition hover:bg-cyber-green hover:text-black disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      )}

      {(isRunning || isPaused) && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onTriggerAction(container, 'stop')}
          title="Stop Container"
          aria-label={`Stop ${container.name}`}
          className="border border-cyber-amber/50 bg-cyber-amber/10 p-1.5 text-cyber-amber transition hover:bg-cyber-amber hover:text-black disabled:opacity-40"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        type="button"
        disabled={isBusy}
        onClick={() => onTriggerAction(container, 'restart')}
        title="Restart Container"
        aria-label={`Restart ${container.name}`}
        className="border border-cyber-cyan/50 bg-cyber-cyan/10 p-1.5 text-cyber-cyan transition hover:bg-cyber-cyan hover:text-black disabled:opacity-40"
      >
        <RotateCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
      </button>

      {isRunning && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onTriggerAction(container, 'pause')}
          title="Pause Container"
          aria-label={`Pause ${container.name}`}
          className="border border-cyber-border bg-cyber-bg p-1.5 text-slate-300 transition hover:border-cyber-amber hover:text-cyber-amber disabled:opacity-40"
        >
          <Pause className="h-3.5 w-3.5" />
        </button>
      )}

      {isPaused && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onTriggerAction(container, 'unpause')}
          title="Unpause Container"
          aria-label={`Unpause ${container.name}`}
          className="border border-cyber-green/50 bg-cyber-green/10 p-1.5 text-cyber-green transition hover:bg-cyber-green hover:text-black disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        type="button"
        disabled={isBusy}
        onClick={() => onSelectContainer(container)}
        title="Open Live Telemetry & Terminal Logs Drawer"
        aria-label={`Inspect ${container.name}`}
        className="border border-cyber-border bg-cyber-bg p-1.5 text-cyber-cyan transition hover:border-cyber-cyan hover:bg-cyber-cyan/20 disabled:opacity-40"
      >
        <Terminal className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        disabled={isBusy}
        onClick={() => onRequestRemove(container)}
        title="Force Remove Container"
        aria-label={`Remove ${container.name}`}
        className="border border-cyber-red/50 bg-cyber-red/10 p-1.5 text-cyber-red transition hover:bg-cyber-red hover:text-black disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ContainerInventory({
  containers,
  viewMode,
  selectedContainerId,
  pendingActionId,
  onSelectContainer,
  onTriggerAction,
  onRequestRemove,
}: ContainerInventoryProps) {
  if (containers.length === 0) {
    return (
      <div className="border border-cyber-border bg-cyber-panel/90 p-12 text-center">
        <Activity className="mx-auto h-8 w-8 text-cyber-cyan opacity-60" />
        <p className="mt-3 text-sm font-bold uppercase tracking-widest text-white">
          NO CONTAINERS MATCHING ACTIVE TELEMETRY FILTER
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Adjust your search query, state filter pill, or switch to another Docker
          host node.
        </p>
      </div>
    );
  }

  if (viewMode === 'GRID') {
    return (
      <section
        aria-label="Container Fleet Card Grid"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {containers.map((container) => {
          const isSelected = container.id === selectedContainerId;
          const isBusy = pendingActionId === container.id;
          const cpuPct = Math.min(100, container.metrics.cpuPercent);
          const memPct = Math.min(100, container.metrics.memoryPercent);

          return (
            <article
              key={container.id}
              onClick={() => onSelectContainer(container)}
              className={`cursor-pointer border bg-cyber-panel/95 p-4 transition ${
                isSelected
                  ? 'border-cyber-cyan shadow-cyber-cyan'
                  : 'border-cyber-border hover:border-cyber-cyan/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 border-b border-cyber-border pb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-white">
                      {container.name}
                    </h3>
                    <span className="shrink-0 text-[10px] text-cyber-cyan">
                      #{container.shortId}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
                    {container.image}
                  </p>
                </div>
                <StateBadge state={container.state} health={container.health} />
              </div>

              {/* Compose Stack & Status */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>{container.status}</span>
                {container.composeProject && (
                  <span className="inline-flex items-center gap-1 border border-cyber-border bg-cyber-bg px-1.5 py-0.5 text-[10px] text-cyber-cyan">
                    <Layers className="h-3 w-3" />
                    {container.composeProject}
                  </span>
                )}
              </div>

              {/* CPU & Memory Bars */}
              <div className="mt-3 space-y-2.5 border-t border-cyber-border pt-3 text-xs">
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">CPU TELEMETRY</span>
                    <span className="font-semibold text-cyber-cyan">
                      {formatPercent(container.metrics.cpuPercent, 1)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden bg-cyber-bg border border-cyber-border">
                    <div
                      className="h-full bg-cyber-cyan transition-all duration-300"
                      style={{ width: `${cpuPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">MEMORY RSS</span>
                    <span className="font-semibold text-cyber-green">
                      {formatBytes(container.metrics.memoryUsageBytes)} (
                      {formatPercent(container.metrics.memoryPercent, 1)})
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden bg-cyber-bg border border-cyber-border">
                    <div
                      className="h-full bg-cyber-green transition-all duration-300"
                      style={{ width: `${memPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Ports & Controls Footer */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-cyber-border pt-3">
                <PortBadges ports={container.ports} />
                <LifecycleControlBar
                  container={container}
                  isBusy={isBusy}
                  onTriggerAction={onTriggerAction}
                  onRequestRemove={onRequestRemove}
                  onSelectContainer={onSelectContainer}
                />
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby="container-fleet-caption"
      className="table-wrapper cyber-scroller border border-cyber-border bg-cyber-panel/95"
    >
      <table className="cyber-table text-left text-xs">
        <caption
          id="container-fleet-caption"
          className="sr-only"
        >
          Docker Container Fleet Telemetry and Lifecycle Control Table
        </caption>
        <thead className="bg-cyber-surface text-[11px] uppercase tracking-wider text-cyber-cyan">
          <tr>
            <th className="border-b border-cyber-border px-4 py-3 font-semibold">
              CONTAINER // ID
            </th>
            <th className="border-b border-cyber-border px-4 py-3 font-semibold">
              IMAGE
            </th>
            <th className="border-b border-cyber-border px-4 py-3 font-semibold">
              STATE &amp; UPTIME
            </th>
            <th className="border-b border-cyber-border px-4 py-3 font-semibold">
              CPU %
            </th>
            <th className="border-b border-cyber-border px-4 py-3 font-semibold">
              MEMORY USAGE
            </th>
            <th className="border-b border-cyber-border px-4 py-3 font-semibold">
              NET RX / TX
            </th>
            <th className="border-b border-cyber-border px-4 py-3 font-semibold">
              PORT BINDINGS
            </th>
            <th className="border-b border-cyber-border px-4 py-3 text-right font-semibold">
              OPS CONTROLS
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cyber-border">
          {containers.map((container) => {
            const isSelected = container.id === selectedContainerId;
            const isBusy = pendingActionId === container.id;
            const cpuPct = Math.min(100, container.metrics.cpuPercent);
            const memPct = Math.min(100, container.metrics.memoryPercent);

            return (
              <tr
                key={container.id}
                onClick={() => onSelectContainer(container)}
                className={`cursor-pointer transition ${
                  isSelected
                    ? 'bg-cyber-cyan/10'
                    : 'hover:bg-cyber-surface/70'
                }`}
              >
                {/* Sticky Row Header */}
                <th
                  scope="row"
                  className="px-4 py-3 font-normal text-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold tracking-wide text-white">
                      {container.name}
                    </span>
                    {container.composeProject && (
                      <span className="border border-cyber-border bg-cyber-bg px-1.5 py-0.5 text-[10px] text-cyber-cyan">
                        {container.composeProject}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    ID: <span className="text-cyber-cyan">{container.shortId}</span>
                  </div>
                </th>

                <td className="max-w-[200px] truncate px-4 py-3 text-slate-300" title={container.image}>
                  {container.image}
                </td>

                <td className="px-4 py-3">
                  <StateBadge
                    state={container.state}
                    health={container.health}
                  />
                  <div className="mt-1 text-[10px] text-slate-400">
                    {container.status}
                  </div>
                </td>

                <td className="min-w-[130px] px-4 py-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-cyber-cyan">
                      {formatPercent(container.metrics.cpuPercent, 1)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {container.metrics.pids} PIDs
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden bg-cyber-bg border border-cyber-border">
                    <div
                      className="h-full bg-cyber-cyan transition-all duration-300"
                      style={{ width: `${cpuPct}%` }}
                    />
                  </div>
                </td>

                <td className="min-w-[160px] px-4 py-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-cyber-green">
                      {formatBytes(container.metrics.memoryUsageBytes)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatPercent(container.metrics.memoryPercent, 1)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden bg-cyber-bg border border-cyber-border">
                    <div
                      className="h-full bg-cyber-green transition-all duration-300"
                      style={{ width: `${memPct}%` }}
                    />
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[11px]">
                  <div className="text-cyber-cyan">
                    ↓ {formatBytes(container.metrics.networkRxBytes)}
                  </div>
                  <div className="text-cyber-green">
                    ↑ {formatBytes(container.metrics.networkTxBytes)}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <PortBadges ports={container.ports} />
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="inline-flex justify-end">
                    <LifecycleControlBar
                      container={container}
                      isBusy={isBusy}
                      onTriggerAction={onTriggerAction}
                      onRequestRemove={onRequestRemove}
                      onSelectContainer={onSelectContainer}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
