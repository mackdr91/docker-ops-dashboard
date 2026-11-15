/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Vitest unit test runner configuration with path alias resolution.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
