import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);

// Vitest resolves with `mainFields: []` (Node semantics), so Testing Library
// would load as CJS and `require` React through Node, while the app under test
// gets its React through Vite's ESM graph — two React copies in one process,
// which surfaces as "Invalid hook call" in every hook test. Resolving Testing
// Library to its ESM build (processed by Vite, so its `react` imports come from
// the same graph) keeps a single React instance. The app is the only workspace
// in the repository, so npm hoists its React 18 to the root and no path pin is
// needed.
const testingLibraryDir = path.dirname(
  require.resolve('@testing-library/react/package.json'),
);
const testingLibraryModule = (
  require('@testing-library/react/package.json') as { module: string }
).module;
const testingLibraryEsm = path.join(testingLibraryDir, testingLibraryModule);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    alias: {
      '@testing-library/react': testingLibraryEsm,
    },
  },
});
