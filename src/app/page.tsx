/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Main Next.js entry page rendering the Cyberpunk / Terminal Ops Docker Dashboard.
 */

import { DockerDashboardClient } from '@/components/DockerDashboardClient';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <DockerDashboardClient />
    </main>
  );
}
