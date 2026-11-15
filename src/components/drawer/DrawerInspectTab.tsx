/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Container low-level configuration inspector displaying runtime process state, networks, volume mounts, and environment variables with secret masking.
 */

'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ContainerInspectDetail } from '@/types/docker';

interface DrawerInspectTabProps {
  inspectDetail: ContainerInspectDetail | null;
  inspectLoading: boolean;
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

export function DrawerInspectTab({
  inspectDetail,
  inspectLoading,
}: DrawerInspectTabProps) {
  const [revealSecrets, setRevealSecrets] = useState(false);

  if (inspectLoading && !inspectDetail) {
    return (
      <div className="border border-cyber-border bg-cyber-bg p-8 text-center text-xs text-cyber-cyan">
        LOADING LOW-LEVEL CONTAINER CONFIGURATION...
      </div>
    );
  }

  if (!inspectDetail) {
    return (
      <div className="border border-cyber-red/40 bg-cyber-red/10 p-4 text-xs text-cyber-red">
        Unable to load container inspection metadata.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
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
            <p
              className="truncate font-semibold text-white"
              title={inspectDetail.id}
            >
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
            <span className="text-[10px] text-slate-500">RESTART POLICY</span>
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
            <span className="text-[10px] text-slate-500">STARTED AT</span>
            <p className="font-semibold text-slate-300">
              {inspectDetail.state.startedAt || '—'}
            </p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500">
              ENTRYPOINT &amp; CMD
            </span>
            <p className="truncate font-semibold text-cyber-cyan">
              {[...inspectDetail.entrypoint, ...inspectDetail.command].join(
                ' '
              ) || '—'}
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
              <div className="font-bold uppercase text-white">{net.name}</div>
              <div className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                <div>
                  IPv4: <span className="text-cyber-cyan">{net.ipAddress}</span>
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
            const k = eqIdx >= 0 ? envStr.slice(0, eqIdx) : envStr;
            const v = eqIdx >= 0 ? envStr.slice(eqIdx + 1) : '';
            const sensitive = isSensitiveEnvKey(envStr);

            return (
              <div
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cyber-border/50 py-1 text-[11px]"
              >
                <span className="font-semibold text-cyber-cyan">{k}</span>
                <span className="break-all text-slate-300">
                  {sensitive && !revealSecrets ? '••••••••••••••••' : v}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
