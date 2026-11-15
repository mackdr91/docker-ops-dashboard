/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: API route for listing registered Docker hosts and adding new custom Socket, TCP, or SSH hosts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { addDockerHost, listDockerHosts } from '@/lib/host-registry';
import { checkHostConnection } from '@/lib/docker-service';
import type { DockerConnectionType } from '@/types/docker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const checkStatus =
      request.nextUrl.searchParams.get('check') === 'true';
    const hosts = listDockerHosts();

    if (!checkStatus) {
      return NextResponse.json({ hosts });
    }

    const statuses = await Promise.all(
      hosts.map(async (h) => {
        const { status } = await checkHostConnection(h.id);
        return status;
      })
    );

    return NextResponse.json({ hosts, statuses });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list Docker hosts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      type?: DockerConnectionType;
      endpoint?: string;
    };

    const newHost = addDockerHost({
      name: body.name || '',
      type: body.type || 'tcp',
      endpoint: body.endpoint || '',
    });

    const { status } = await checkHostConnection(newHost.id);

    return NextResponse.json(
      {
        host: newHost,
        status,
        hosts: listDockerHosts(),
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to add Docker host';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
