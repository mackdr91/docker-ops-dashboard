/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: API route for inspecting low-level container configuration, environment variables, mounts, and network bindings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { inspectContainerDetails } from '@/lib/docker-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const hostId = request.nextUrl.searchParams.get('hostId') || 'local';
    const detail = await inspectContainerDetails(hostId, id);
    return NextResponse.json({ detail });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to inspect Docker container';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
