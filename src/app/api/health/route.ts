/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Health check API route for container orchestration and Railway deployment readiness.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'docker-ops-dashboard',
    timestamp: new Date().toISOString(),
  });
}
