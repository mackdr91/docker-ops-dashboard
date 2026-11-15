/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Pure utility functions for formatting byte sizes, transfer rates, percentages, and container uptime strings.
 */

/**
 * Formats a raw byte count into a human-readable string (B, KB, MB, GB, TB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const k = 1024;
  const dm = Math.max(0, decimals);
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k))
  );
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : dm)} ${sizes[i]}`;
}

/**
 * Formats a percentage value with fixed decimal precision and clamping.
 */
export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value) || value < 0) {
    return '0.0%';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Strips the leading slash from a Docker container name if present.
 */
export function normalizeContainerName(rawName?: string): string {
  if (!rawName) {
    return 'unnamed-container';
  }
  return rawName.replace(/^\/+/, '');
}
