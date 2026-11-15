/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Server-Sent Events (SSE) endpoint streaming real-time container CPU, memory, network, and disk I/O telemetry.
 */

import { NextRequest } from 'next/server';
import { createDockerClient, getDockerHostById } from '@/lib/host-registry';
import {
  parseContainerStats,
  type RawDockerStatsPayload,
} from '@/lib/docker-metrics';
import { encodeSseFrame, SSE_RESPONSE_HEADERS } from '@/lib/sse';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const hostId = request.nextUrl.searchParams.get('hostId') || 'local';
  const host = getDockerHostById(hostId);
  const client = createDockerClient(host, 15000);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let statsStream: NodeJS.ReadableStream | null = null;

      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encodeSseFrame(event, data));
        } catch {
          closed = true;
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (
          statsStream &&
          'destroy' in statsStream &&
          typeof statsStream.destroy === 'function'
        ) {
          statsStream.destroy();
        }
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      };

      request.signal.addEventListener('abort', cleanup);

      try {
        const container = client.getContainer(id);
        statsStream = (await container.stats({
          stream: true,
        })) as unknown as NodeJS.ReadableStream;

        let buffer = '';

        statsStream.on('data', (chunk: Buffer) => {
          if (closed) return;
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const raw = JSON.parse(trimmed) as RawDockerStatsPayload;
              const snapshot = parseContainerStats(raw);
              sendEvent('stats', snapshot);
            } catch {
              // Ignore partial JSON frame until next chunk arrives
            }
          }
        });

        statsStream.on('error', (err: Error) => {
          sendEvent('error', { message: err.message });
          cleanup();
        });

        statsStream.on('end', cleanup);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to open container stats stream';
        sendEvent('error', { message });
        cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: SSE_RESPONSE_HEADERS,
  });
}
