/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Main client orchestrator managing multi-host switching, periodic telemetry polling, filtering, lifecycle actions, and drawer/modal states.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Terminal } from 'lucide-react';
import {
  TopCommandBar,
  type ContainerStateFilter,
  type InventoryViewMode,
} from '@/components/TopCommandBar';
import { KpiSummaryStrip } from '@/components/KpiSummaryStrip';
import { ContainerInventory } from '@/components/ContainerInventory';
import { ContainerDetailDrawer } from '@/components/ContainerDetailDrawer';
import { HostManagerModal } from '@/components/HostManagerModal';
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog';
import type {
  ContainerLifecycleAction,
  ContainerSummaryItem,
  DashboardOverviewResponse,
  DockerHostConfig,
  FleetKpiSummary,
} from '@/types/docker';

const EMPTY_KPI: FleetKpiSummary = {
  totalContainers: 0,
  runningContainers: 0,
  pausedContainers: 0,
  stoppedContainers: 0,
  unhealthyContainers: 0,
  aggregateCpuPercent: 0,
  aggregateMemoryUsageBytes: 0,
  hostTotalMemoryBytes: 0,
  aggregateNetworkRxBytes: 0,
  aggregateNetworkTxBytes: 0,
  aggregateBlockReadBytes: 0,
  aggregateBlockWriteBytes: 0,
};

export function DockerDashboardClient() {
  const [hosts, setHosts] = useState<DockerHostConfig[]>([
    {
      id: 'local',
      name: 'LOCAL // UNIX SOCKET',
      type: 'socket',
      endpoint: '/var/run/docker.sock',
      isDefault: true,
      createdAt: '2026-11-15T00:00:00.000Z',
    },
  ]);
  const [selectedHostId, setSelectedHostId] = useState<string>('local');
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Filter & View state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<ContainerStateFilter>('ALL');
  const [viewMode, setViewMode] = useState<InventoryViewMode>('TABLE');

  // Drawer & Modals state
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(
    null
  );
  const [isHostModalOpen, setIsHostModalOpen] = useState<boolean>(false);
  const [confirmRemoveContainer, setConfirmRemoveContainer] =
    useState<ContainerSummaryItem | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  // Action feedback notification banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchHosts = useCallback(async () => {
    try {
      const res = await fetch('/api/hosts');
      const data = await res.json();
      if (Array.isArray(data.hosts)) {
        setHosts(data.hosts);
      }
    } catch {
      // Keep default host list if network request fails
    }
  }, []);

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const res = await fetch(
          `/api/containers?hostId=${encodeURIComponent(selectedHostId)}`
        );
        const data = (await res.json()) as DashboardOverviewResponse;
        if (res.ok && data.hostStatus) {
          setOverview(data);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to fetch Docker fleet overview';
        setFeedback({ type: 'error', message });
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [selectedHostId]
  );

  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

  useEffect(() => {
    fetchOverview(false);
  }, [fetchOverview]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchOverview(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchOverview]);

  // Auto-dismiss success banners after 4 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleLifecycleAction = async (
    container: ContainerSummaryItem,
    action: ContainerLifecycleAction
  ) => {
    setPendingActionId(container.id);
    setFeedback(null);

    try {
      const res = await fetch(
        `/api/containers/${encodeURIComponent(container.id)}/action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            hostId: selectedHostId,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} container`);
      }

      if (action === 'remove' && selectedContainerId === container.id) {
        setSelectedContainerId(null);
      }

      setFeedback({
        type: 'success',
        message: `COMMAND EXECUTED // [${action.toUpperCase()}] ON CONTAINER "${
          container.name
        }" (${container.shortId})`,
      });
      await fetchOverview(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : `Failed to ${action} container`;
      setFeedback({
        type: 'error',
        message: `OPS ERROR // ${message}`,
      });
    } finally {
      setPendingActionId(null);
      setConfirmRemoveContainer(null);
    }
  };

  const allContainers = useMemo(
    () => overview?.containers || [],
    [overview?.containers]
  );

  const counts = useMemo(() => {
    return {
      all: allContainers.length,
      running: allContainers.filter((c) => c.state === 'running').length,
      paused: allContainers.filter((c) => c.state === 'paused').length,
      stopped: allContainers.filter(
        (c) => c.state !== 'running' && c.state !== 'paused'
      ).length,
    };
  }, [allContainers]);

  const filteredContainers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allContainers.filter((c) => {
      if (stateFilter === 'RUNNING' && c.state !== 'running') return false;
      if (stateFilter === 'PAUSED' && c.state !== 'paused') return false;
      if (
        stateFilter === 'STOPPED' &&
        (c.state === 'running' || c.state === 'paused')
      ) {
        return false;
      }

      if (!q) return true;

      const portsText = c.ports
        .map((p) => `${p.publicPort || ''}:${p.privatePort}`)
        .join(' ');

      return (
        c.name.toLowerCase().includes(q) ||
        c.shortId.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q) ||
        (c.composeProject || '').toLowerCase().includes(q) ||
        portsText.includes(q)
      );
    });
  }, [allContainers, searchQuery, stateFilter]);

  const activeContainer = useMemo(() => {
    if (!selectedContainerId) return null;
    return (
      allContainers.find((c) => c.id === selectedContainerId) || null
    );
  }, [allContainers, selectedContainerId]);

  const hostStatus = overview?.hostStatus || null;
  const kpi = overview?.kpi || EMPTY_KPI;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* Top Command Bar */}
        <TopCommandBar
          hosts={hosts}
          selectedHostId={selectedHostId}
          hostStatus={hostStatus}
          searchQuery={searchQuery}
          stateFilter={stateFilter}
          viewMode={viewMode}
          autoRefresh={autoRefresh}
          isLoading={isLoading}
          counts={counts}
          onSelectHost={(hostId) => {
            setSelectedContainerId(null);
            setSelectedHostId(hostId);
          }}
          onOpenHostModal={() => setIsHostModalOpen(true)}
          onSearchChange={setSearchQuery}
          onStateFilterChange={setStateFilter}
          onViewModeChange={setViewMode}
          onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
          onManualRefresh={() => fetchOverview(false)}
        />

        {/* Host Connection Error Alert (if daemon unreachable) */}
        {hostStatus && !hostStatus.connected && (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-cyber-red bg-cyber-red/10 p-4 text-xs text-cyber-red shadow-cyber-red">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold uppercase tracking-wider">
                  DOCKER ENGINE CONNECTION FAILED // {hostStatus.host.name} (
                  {hostStatus.host.endpoint})
                </p>
                <p className="mt-0.5 text-slate-300">
                  {hostStatus.errorMessage ||
                    'Verify Docker Desktop / Engine is running or select another host node.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsHostModalOpen(true)}
              className="border border-cyber-red bg-cyber-red/20 px-3 py-1.5 font-bold uppercase tracking-wider text-white hover:bg-cyber-red hover:text-black"
            >
              CONFIGURE HOSTS
            </button>
          </div>
        )}

        {/* Operation Feedback Banner */}
        {feedback && (
          <div
            className={`flex items-center justify-between border px-4 py-2.5 text-xs font-semibold tracking-wider ${
              feedback.type === 'success'
                ? 'border-cyber-green bg-cyber-green/10 text-cyber-green'
                : 'border-cyber-red bg-cyber-red/10 text-cyber-red'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-[10px] uppercase underline"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Summary KPI Telemetry Strip */}
        <KpiSummaryStrip kpi={kpi} hostStatus={hostStatus} />

        {/* Main Container Inventory Section */}
        <section aria-label="Container Fleet Inventory">
          <div className="mb-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-cyber-cyan">
              <Terminal className="h-4 w-4" />
              <span className="font-bold uppercase tracking-widest">
                ACTIVE TELEMETRY INVENTORY // SHOWING {filteredContainers.length}{' '}
                OF {allContainers.length} CONTAINERS
              </span>
            </div>
            {overview?.timestamp && (
              <span className="text-[11px] text-slate-400">
                LAST SYNC:{' '}
                {new Date(overview.timestamp).toLocaleTimeString([], {
                  hour12: false,
                })}
              </span>
            )}
          </div>

          <ContainerInventory
            containers={filteredContainers}
            viewMode={viewMode}
            selectedContainerId={selectedContainerId}
            pendingActionId={pendingActionId}
            onSelectContainer={(c) => setSelectedContainerId(c.id)}
            onTriggerAction={handleLifecycleAction}
            onRequestRemove={(c) => setConfirmRemoveContainer(c)}
          />
        </section>
      </div>

      {/* Slide-Over Detail Drawer */}
      <ContainerDetailDrawer
        container={activeContainer}
        hostId={selectedHostId}
        pendingActionId={pendingActionId}
        onClose={() => setSelectedContainerId(null)}
        onTriggerAction={handleLifecycleAction}
        onRequestRemove={(c) => setConfirmRemoveContainer(c)}
      />

      {/* Multi-Host Manager Native Dialog Modal */}
      <HostManagerModal
        isOpen={isHostModalOpen}
        hosts={hosts}
        selectedHostId={selectedHostId}
        onClose={() => setIsHostModalOpen(false)}
        onSelectHost={(hostId) => {
          setSelectedContainerId(null);
          setSelectedHostId(hostId);
        }}
        onHostsUpdated={(updatedHosts, newHostId) => {
          setHosts(updatedHosts);
          if (newHostId) {
            setSelectedContainerId(null);
            setSelectedHostId(newHostId);
          }
        }}
      />

      {/* Destructive Action Confirmation Native Dialog Modal */}
      <ConfirmActionDialog
        container={confirmRemoveContainer}
        isProcessing={Boolean(
          confirmRemoveContainer &&
            pendingActionId === confirmRemoveContainer.id
        )}
        onCancel={() => setConfirmRemoveContainer(null)}
        onConfirmRemove={(c) => handleLifecycleAction(c, 'remove')}
      />
    </div>
  );
}
