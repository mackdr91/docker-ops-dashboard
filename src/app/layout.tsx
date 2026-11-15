/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Root Next.js App Router layout configuring metadata and Cyberpunk monospace styling.
 */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CYBER-DOCKER // Terminal Ops Dashboard',
  description:
    'High-contrast Cyberpunk / Terminal Ops multi-host Docker container monitoring and lifecycle control center.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-cyber-cyan/30 selection:text-cyber-cyan">
        {children}
      </body>
    </html>
  );
}
