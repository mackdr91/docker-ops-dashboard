/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: API route returning the complete fleet overview, container inventory, and live KPI metrics for a target Docker host.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardOverview } from '@/lib/docker-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const hostId = request.nextUrl.searchParams.get('hostId') || 'local';
    const overview = await getDashboardOverview(hostId);
    return NextResponse.json(overview);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to retrieve Docker container overview';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
