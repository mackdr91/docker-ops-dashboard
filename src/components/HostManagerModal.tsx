/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Native modal dialog for managing multi-host Docker connections (Local Socket, Remote TCP, and Remote SSH).
 */

'use client';

import React, { useCallback, useId, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import { useNativeModalDialog } from '@/hooks/useNativeModalDialog';
import type { DockerConnectionType, DockerHostConfig } from '@/types/docker';

interface HostManagerModalProps {
  isOpen: boolean;
  hosts: DockerHostConfig[];
  selectedHostId: string;
  onClose: () => void;
  onSelectHost: (hostId: string) => void;
  onHostsUpdated: (hosts: DockerHostConfig[], newHostId?: string) => void;
}

export function HostManagerModal({
  isOpen,
  hosts,
  selectedHostId,
  onClose,
  onSelectHost,
  onHostsUpdated,
}: HostManagerModalProps) {
  const titleId = useId();
  const [name, setName] = useState('');
  const [type, setType] = useState<DockerConnectionType>('tcp');
  const [endpoint, setEndpoint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleModalClose = useCallback(() => {
    setErrorMsg(null);
    onClose();
  }, [onClose]);

  const dialogRef = useNativeModalDialog(isOpen, handleModalClose);

  const handleAddHost = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, endpoint }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add Docker host');
      }

      setName('');
      setEndpoint('');
      onHostsUpdated(data.hosts, data.host?.id);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to register host'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHost = async (hostId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/hosts/${encodeURIComponent(hostId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete host');
      }
      onHostsUpdated(
        data.hosts,
        selectedHostId === hostId ? 'local' : selectedHostId
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove host');
    }
  };

  const placeholderByType: Record<DockerConnectionType, string> = {
    socket: '/var/run/docker.sock',
    tcp: 'http://192.168.1.50:2375',
    ssh: 'ssh://root@10.0.0.15:22',
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="w-full max-w-2xl border border-cyber-cyan bg-cyber-panel p-0 text-slate-100 shadow-cyber-cyan"
    >
      <div className="p-6">
        <div className="flex items-center justify-between border-b border-cyber-border pb-4">
          <div className="flex items-center gap-2.5">
            <Server className="h-5 w-5 text-cyber-cyan" />
            <h2
              id={titleId}
              className="text-base font-bold uppercase tracking-wider text-white"
            >
              DOCKER ENGINE // MULTI-HOST REGISTRY
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close host registry modal"
            className="border border-cyber-border bg-cyber-bg p-1.5 text-slate-400 hover:border-cyber-cyan hover:text-cyber-cyan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Registered Hosts List */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-cyber-cyan">
            CONFIGURED NODES ({hosts.length})
          </h3>
          <div className="cyber-scroller mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
            {hosts.map((host) => {
              const isSelected = host.id === selectedHostId;
              return (
                <div
                  key={host.id}
                  className={`flex flex-wrap items-center justify-between gap-2 border p-3 text-xs ${
                    isSelected
                      ? 'border-cyber-cyan bg-cyber-cyan/10'
                      : 'border-cyber-border bg-cyber-bg'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{host.name}</span>
                      <span className="border border-cyber-border bg-cyber-panel px-1.5 py-0.5 text-[10px] uppercase text-cyber-cyan">
                        {host.type}
                      </span>
                      {host.isDefault && (
                        <span className="border border-cyber-green/40 bg-cyber-green/10 px-1.5 py-0.5 text-[10px] text-cyber-green">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {host.endpoint}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectHost(host.id);
                        dialogRef.current?.close();
                      }}
                      className={`inline-flex items-center gap-1 border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                        isSelected
                          ? 'border-cyber-green bg-cyber-green/20 text-cyber-green'
                          : 'border-cyber-border bg-cyber-panel text-slate-200 hover:border-cyber-cyan hover:text-cyber-cyan'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{isSelected ? 'ACTIVE' : 'CONNECT'}</span>
                    </button>

                    {!host.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDeleteHost(host.id)}
                        aria-label={`Remove host ${host.name}`}
                        className="border border-cyber-red/50 bg-cyber-red/10 p-1.5 text-cyber-red hover:bg-cyber-red hover:text-black"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add New Host Form */}
        <form
          onSubmit={handleAddHost}
          className="mt-6 border-t border-cyber-border pt-4"
        >
          <h3 className="text-xs font-semibold uppercase tracking-widest text-cyber-cyan">
            REGISTER NEW REMOTE / SOCKET HOST
          </h3>

          {errorMsg && (
            <div className="mt-2 border border-cyber-red bg-cyber-red/10 p-2.5 text-xs text-cyber-red">
              ERROR: {errorMsg}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                NODE ALIAS
              </label>
              <input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PROD-CLUSTER-01"
                className="mt-1 w-full border border-cyber-border bg-cyber-bg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyber-cyan focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                PROTOCOL
              </label>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as DockerConnectionType)
                }
                className="mt-1 w-full border border-cyber-border bg-cyber-bg px-3 py-2 text-xs uppercase text-white focus:border-cyber-cyan focus:outline-none"
              >
                <option value="tcp">TCP / HTTP(S)</option>
                <option value="ssh">SSH TUNNEL</option>
                <option value="socket">UNIX SOCKET</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                ENDPOINT URI / PATH
              </label>
              <input
                type="text"
                required
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={placeholderByType[type]}
                className="mt-1 w-full border border-cyber-border bg-cyber-bg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyber-cyan focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="border border-cyber-border bg-cyber-bg px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white"
            >
              CLOSE
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 border border-cyber-cyan bg-cyber-cyan/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cyber-cyan transition hover:bg-cyber-cyan hover:text-black disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'REGISTERING...' : 'REGISTER HOST'}</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
