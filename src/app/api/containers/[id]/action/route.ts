/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: API route executing container lifecycle operations (start, stop, restart, pause, unpause, remove).
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeContainerAction } from '@/lib/docker-service';
import type { ContainerLifecycleAction } from '@/types/docker';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS: ContainerLifecycleAction[] = [
  'start',
  'stop',
  'restart',
  'pause',
  'unpause',
  'remove',
];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      action?: ContainerLifecycleAction;
      hostId?: string;
    };

    const action = body.action;
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        {
          error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const result = await executeContainerAction(
      body.hostId || 'local',
      id,
      action
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Container lifecycle operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
