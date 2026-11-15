/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Cyberpunk / Terminal Ops top command bar with multi-host selector, search bar, state filters, view mode switcher, and refresh controls.
 */

'use client';

import React from 'react';
import {
  Activity,
  LayoutGrid,
  ListFilter,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Table2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { DockerHostConfig, DockerHostStatus } from '@/types/docker';

export type ContainerStateFilter = 'ALL' | 'RUNNING' | 'PAUSED' | 'STOPPED';
export type InventoryViewMode = 'TABLE' | 'GRID';

interface TopCommandBarProps {
  hosts: DockerHostConfig[];
  selectedHostId: string;
  hostStatus: DockerHostStatus | null;
  searchQuery: string;
  stateFilter: ContainerStateFilter;
  viewMode: InventoryViewMode;
  autoRefresh: boolean;
  isLoading: boolean;
  counts: {
    all: number;
    running: number;
    paused: number;
    stopped: number;
  };
  onSelectHost: (hostId: string) => void;
  onOpenHostModal: () => void;
  onSearchChange: (q: string) => void;
  onStateFilterChange: (filter: ContainerStateFilter) => void;
  onViewModeChange: (mode: InventoryViewMode) => void;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
}

export function TopCommandBar({
  hosts,
  selectedHostId,
  hostStatus,
  searchQuery,
  stateFilter,
  viewMode,
  autoRefresh,
  isLoading,
  counts,
  onSelectHost,
  onOpenHostModal,
  onSearchChange,
  onStateFilterChange,
  onViewModeChange,
  onToggleAutoRefresh,
  onManualRefresh,
}: TopCommandBarProps) {
  const isConnected = Boolean(hostStatus?.connected);

  const filterButtons: Array<{
    key: ContainerStateFilter;
    label: string;
    count: number;
    accentClass: string;
  }> = [
    {
      key: 'ALL',
      label: 'ALL FLEET',
      count: counts.all,
      accentClass: 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10',
    },
    {
      key: 'RUNNING',
      label: 'RUNNING',
      count: counts.running,
      accentClass: 'border-cyber-green text-cyber-green bg-cyber-green/10',
    },
    {
      key: 'PAUSED',
      label: 'PAUSED',
      count: counts.paused,
      accentClass: 'border-cyber-amber text-cyber-amber bg-cyber-amber/10',
    },
    {
      key: 'STOPPED',
      label: 'EXITED',
      count: counts.stopped,
      accentClass: 'border-cyber-red text-cyber-red bg-cyber-red/10',
    },
  ];

  return (
    <header className="border border-cyber-border bg-cyber-panel/95 p-4 shadow-cyber-cyan">
      {/* Upper Telemetry Identity & Host Bar */}
      <div className="flex flex-col gap-4 border-b border-cyber-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-cyber-cyan/60 bg-cyber-cyan/10 text-cyber-cyan shadow-cyber-cyan">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyber-cyan">
                SYS.OPS // DOCKER TELEMETRY MATRIX
              </span>
              {hostStatus?.engineVersion && (
                <span className="border border-cyber-border bg-cyber-surface px-2 py-0.5 text-[10px] text-slate-300">
                  ENGINE v{hostStatus.engineVersion} ({hostStatus.architecture || 'x86_64'})
                </span>
              )}
            </div>
            <h1 className="mt-0.5 text-xl font-bold tracking-wider text-white sm:text-2xl">
              CYBER-DOCKER // TERMINAL OPS
            </h1>
          </div>
        </div>

        {/* Multi-Host Selector & Connection Status */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Connection Status Badge */}
          <div
            className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-semibold tracking-wider ${
              isConnected
                ? 'border-cyber-green/50 bg-cyber-green/10 text-cyber-green'
                : 'border-cyber-red/60 bg-cyber-red/10 text-cyber-red'
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 animate-pulse" />
                <span>
                  LINK ONLINE{' '}
                  {hostStatus?.latencyMs !== null &&
                  hostStatus?.latencyMs !== undefined
                    ? `// ${hostStatus.latencyMs}ms`
                    : ''}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>LINK OFFLINE</span>
              </>
            )}
          </div>

          {/* Host Selector Dropdown */}
          <div className="flex items-center border border-cyber-border bg-cyber-bg">
            <span className="flex items-center gap-1.5 border-r border-cyber-border px-2.5 py-1.5 text-xs text-cyber-cyan">
              <Server className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">NODE:</span>
            </span>
            <select
              aria-label="Select Docker Host Node"
              value={selectedHostId}
              onChange={(e) => onSelectHost(e.target.value)}
              className="bg-cyber-bg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white focus:outline-none"
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id} className="bg-cyber-panel text-white">
                  {h.name} [{h.type.toUpperCase()}]
                </option>
              ))}
            </select>
          </div>

          {/* Manage Hosts Modal Trigger */}
          <button
            type="button"
            onClick={onOpenHostModal}
            className="inline-flex items-center gap-1.5 border border-cyber-cyan/50 bg-cyber-cyan/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyber-cyan transition hover:bg-cyber-cyan/20"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>HOSTS ({hosts.length})</span>
          </button>

          {/* Auto-Refresh Toggle */}
          <button
            type="button"
            onClick={onToggleAutoRefresh}
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
              autoRefresh
                ? 'border-cyber-green/50 bg-cyber-green/10 text-cyber-green'
                : 'border-cyber-border bg-cyber-surface text-slate-400 hover:text-white'
            }`}
            title="Toggle automatic 4-second telemetry polling"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                autoRefresh ? 'bg-cyber-green animate-ping' : 'bg-slate-500'
              }`}
            />
            <span>{autoRefresh ? 'AUTO: 4S' : 'AUTO: OFF'}</span>
          </button>

          {/* Manual Sync Button */}
          <button
            type="button"
            onClick={onManualRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 border border-cyber-border bg-cyber-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-cyber-cyan hover:text-cyber-cyan disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-cyber-cyan' : ''}`}
            />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Lower Search, Filter Pills & View Switcher Bar */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyber-cyan" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="SEARCH CONTAINER NAME, SHORT ID, IMAGE TAG, COMPOSE STACK, OR PORT..."
            aria-label="Filter containers by name, ID, image, stack, or port"
            className="w-full border border-cyber-border bg-cyber-bg py-2 pl-9 pr-4 text-xs tracking-wider text-white placeholder:text-slate-500 focus:border-cyber-cyan focus:outline-none"
          />
        </div>

        {/* Status Filter Pills & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 hidden items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400 xl:inline-flex">
              <ListFilter className="h-3.5 w-3.5 text-cyber-cyan" />
              STATE:
            </span>
            {filterButtons.map((btn) => {
              const active = stateFilter === btn.key;
              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => onStateFilterChange(btn.key)}
                  className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold tracking-wider transition ${
                    active
                      ? btn.accentClass
                      : 'border-cyber-border bg-cyber-bg text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <span>{btn.label}</span>
                  <span className="bg-black/40 px-1.5 py-0.2 text-[10px]">
                    {btn.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table / Grid View Toggle */}
          <div className="flex items-center border border-cyber-border bg-cyber-bg">
            <button
              type="button"
              onClick={() => onViewModeChange('TABLE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                viewMode === 'TABLE'
                  ? 'bg-cyber-cyan/20 text-cyber-cyan'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="High-density Telemetry Table View"
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>TABLE</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('GRID')}
              className={`inline-flex items-center gap-1.5 border-l border-cyber-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                viewMode === 'GRID'
                  ? 'bg-cyber-cyan/20 text-cyber-cyan'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Cyberpunk HUD Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>GRID</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
