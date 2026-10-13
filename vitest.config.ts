import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    // Paketler derlenmeden (kaynak TS) çalışsın diye açık alias: kurulum sırasına bağımlı değil.
    alias: {
      '@pazaryeri-denetci/core': src('core'),
      '@pazaryeri-denetci/mock-data': src('mock-data'),
      '@pazaryeri-denetci/eval': src('eval'),
      '@pazaryeri-denetci/mcp-server': src('mcp-server'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/index.ts', 'packages/*/src/**/types.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
