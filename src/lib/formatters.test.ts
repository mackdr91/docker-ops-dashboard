/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Unit tests for telemetry byte, percentage, and container name formatting utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatPercent,
  normalizeContainerName,
} from './formatters';

describe('formatters utility', () => {
  it('formats byte values accurately across units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-50)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('formats percentages safely', () => {
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(-10)).toBe('0.0%');
    expect(formatPercent(42.567, 1)).toBe('42.6%');
  });

  it('normalizes Docker container names by removing leading slashes', () => {
    expect(normalizeContainerName('/redis-cache')).toBe('redis-cache');
    expect(normalizeContainerName('postgres-db')).toBe('postgres-db');
    expect(normalizeContainerName('')).toBe('unnamed-container');
  });
});
