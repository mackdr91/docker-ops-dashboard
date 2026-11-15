/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Server-Sent Events (SSE) endpoint streaming multiplexed stdout/stderr container logs in real time.
 */

import { NextRequest } from 'next/server';
import { createDockerClient, getDockerHostById } from '@/lib/host-registry';
import { demuxDockerLogBuffer } from '@/lib/docker-metrics';
import { encodeSseFrame, SSE_RESPONSE_HEADERS } from '@/lib/sse';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const hostId = request.nextUrl.searchParams.get('hostId') || 'local';
  const tailParam = Number(request.nextUrl.searchParams.get('tail') || '150');
  const tail = Number.isFinite(tailParam)
    ? Math.min(Math.max(tailParam, 20), 1000)
    : 150;

  const host = getDockerHostById(hostId);
  const client = createDockerClient(host, 15000);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let logStream: NodeJS.ReadableStream | null = null;

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
          logStream &&
          'destroy' in logStream &&
          typeof logStream.destroy === 'function'
        ) {
          logStream.destroy();
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
        const rawResult = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
          timestamps: true,
          tail,
        });

        if (Buffer.isBuffer(rawResult)) {
          const entries = demuxDockerLogBuffer(rawResult);
          if (entries.length > 0) {
            sendEvent('logs', entries);
          }
          cleanup();
          return;
        }

        logStream = rawResult as unknown as NodeJS.ReadableStream;

        logStream.on('data', (chunk: Buffer) => {
          if (closed) return;
          const entries = demuxDockerLogBuffer(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          );
          if (entries.length > 0) {
            sendEvent('logs', entries);
          }
        });

        logStream.on('error', (err: Error) => {
          sendEvent('error', { message: err.message });
          cleanup();
        });

        logStream.on('end', cleanup);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to stream container logs';
        sendEvent('error', { message });
        cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: SSE_RESPONSE_HEADERS,
  });
}
