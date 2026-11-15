/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Live terminal log viewer tab with search, severity/stream filtering, line wrapping, stream pause/resume, and log file export.
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Pause,
  Play,
  Search,
  WrapText,
} from 'lucide-react';
import type {
  ContainerLogEntry,
  ContainerSummaryItem,
  LogSeverityLevel,
} from '@/types/docker';

interface DrawerLogsTabProps {
  container: ContainerSummaryItem;
  logs: ContainerLogEntry[];
  logsPaused: boolean;
  onTogglePause: () => void;
  onClearLogs: () => void;
}

export function DrawerLogsTab({
  container,
  logs,
  logsPaused,
  onTogglePause,
  onClearLogs,
}: DrawerLogsTabProps) {
  const [logSearch, setLogSearch] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<
    'ALL' | LogSeverityLevel
  >('ALL');
  const [logStreamFilter, setLogStreamFilter] = useState<
    'ALL' | 'stdout' | 'stderr'
  >('ALL');
  const [wrapLines, setWrapLines] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!logsPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, logsPaused]);

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

  return (
    <div className="flex h-[calc(100vh-230px)] flex-col space-y-3">
      {/* Log Filter & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-cyber-border bg-cyber-bg p-3">
        <div className="relative min-w-[200px] flex-1">
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
          <select
            aria-label="Filter logs by severity"
            value={logLevelFilter}
            onChange={(e) =>
              setLogLevelFilter(e.target.value as 'ALL' | LogSeverityLevel)
            }
            className="border border-cyber-border bg-cyber-panel px-2.5 py-1.5 text-xs uppercase text-white focus:border-cyber-cyan focus:outline-none"
          >
            <option value="ALL">LEVEL: ALL</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="DEBUG">DEBUG</option>
          </select>

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

          <button
            type="button"
            onClick={onTogglePause}
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

          <button
            type="button"
            onClick={onClearLogs}
            className="border border-cyber-border bg-cyber-panel px-2.5 py-1.5 text-xs uppercase text-slate-300 hover:border-cyber-red hover:text-cyber-red"
          >
            CLEAR
          </button>

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
                <span className={`shrink-0 text-[10px] font-bold ${levelColor}`}>
                  [{entry.level}]
                </span>
                <span className="text-slate-200">{entry.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
