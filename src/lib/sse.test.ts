/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Unit tests for Server-Sent Events (SSE) wire frame encoding and HTTP response headers.
 */

import { describe, expect, it } from 'vitest';
import { encodeSseFrame, SSE_RESPONSE_HEADERS } from './sse';

describe('sse utility', () => {
  it('encodes event and JSON payload into SSE wire format', () => {
    const encoded = encodeSseFrame('stats', { cpuPercent: 18.5 });
    const text = new TextDecoder().decode(encoded);
    expect(text).toBe('event: stats\ndata: {"cpuPercent":18.5}\n\n');
  });

  it('defines non-buffered SSE response headers', () => {
    expect(SSE_RESPONSE_HEADERS['Content-Type']).toContain('text/event-stream');
    expect(SSE_RESPONSE_HEADERS['Cache-Control']).toContain('no-cache');
  });
});
