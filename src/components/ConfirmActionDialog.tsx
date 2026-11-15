/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Native modal dialog component for confirming destructive container lifecycle actions such as forced removal.
 */

'use client';

import React, { useId } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useNativeModalDialog } from '@/hooks/useNativeModalDialog';
import type { ContainerSummaryItem } from '@/types/docker';

interface ConfirmActionDialogProps {
  container: ContainerSummaryItem | null;
  isProcessing: boolean;
  onCancel: () => void;
  onConfirmRemove: (container: ContainerSummaryItem) => void;
}

export function ConfirmActionDialog({
  container,
  isProcessing,
  onCancel,
  onConfirmRemove,
}: ConfirmActionDialogProps) {
  const titleId = useId();
  const dialogRef = useNativeModalDialog(Boolean(container), onCancel);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="w-full max-w-md border border-cyber-red bg-cyber-panel p-0 text-slate-100 shadow-cyber-red"
    >
      {container && (
        <div className="p-5">
          <div className="flex items-start justify-between border-b border-cyber-border pb-3">
            <div className="flex items-center gap-2.5 text-cyber-red">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h2
                id={titleId}
                className="text-sm font-bold uppercase tracking-wider"
              >
                CONFIRM CONTAINER TERMINATION
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close confirmation dialog"
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
            <p>
              You are about to permanently remove container{' '}
              <span className="font-bold text-white">{container.name}</span> (
              <code className="text-cyber-cyan">{container.shortId}</code>).
            </p>
            <div className="border border-cyber-red/40 bg-cyber-red/10 p-3 text-[11px] text-cyber-red">
              WARNING: Forced removal (`docker rm -f`) will immediately terminate
              any running process inside this container and delete its writable
              layer.
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-cyber-border pt-4">
            <button
              type="button"
              autoFocus
              disabled={isProcessing}
              onClick={() => dialogRef.current?.close()}
              className="border border-cyber-border bg-cyber-bg px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-cyber-cyan hover:text-cyber-cyan"
            >
              CANCEL // KEEP
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onConfirmRemove(container)}
              className="inline-flex items-center gap-1.5 border border-cyber-red bg-cyber-red/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cyber-red transition hover:bg-cyber-red hover:text-black disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isProcessing ? 'REMOVING...' : 'FORCE REMOVE'}</span>
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
