/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Tailwind CSS configuration defining the Cyberpunk / Terminal Ops color palette, glow shadows, and monospace typography.
 */

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#050508',
          panel: '#0a0d14',
          surface: '#0f1522',
          border: '#162238',
          cyan: '#00f0ff',
          green: '#00ff9d',
          amber: '#ffb800',
          red: '#ff0055',
          purple: '#b829ff',
          muted: '#64748b',
        },
      },
      fontFamily: {
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'JetBrains Mono',
          'Fira Code',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'cyber-cyan': '0 0 15px -3px rgba(0, 240, 255, 0.25)',
        'cyber-green': '0 0 15px -3px rgba(0, 255, 157, 0.25)',
        'cyber-red': '0 0 15px -3px rgba(255, 0, 85, 0.25)',
        'cyber-amber': '0 0 15px -3px rgba(255, 184, 0, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
