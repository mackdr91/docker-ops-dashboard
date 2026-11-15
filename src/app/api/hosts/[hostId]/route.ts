/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: API route for removing a custom Docker host from the multi-host registry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listDockerHosts, removeDockerHost } from '@/lib/host-registry';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ hostId: string }> }
) {
  try {
    const { hostId } = await context.params;
    const removed = removeDockerHost(hostId);

    if (!removed) {
      return NextResponse.json(
        { error: `Docker host '${hostId}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      removed: true,
      hostId,
      hosts: listDockerHosts(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to remove Docker host';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
