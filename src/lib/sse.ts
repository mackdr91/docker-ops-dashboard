/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Reusable Server-Sent Events (SSE) stream encoder and HTTP response helper.
 */

const encoder = new TextEncoder();

/**
 * Standard HTTP headers required for non-buffered Server-Sent Events (SSE) responses.
 */
export const SSE_RESPONSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * Formats an event name and JSON payload into an SSE wire-protocol frame.
 */
export function encodeSseFrame(event: string, payload: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}
