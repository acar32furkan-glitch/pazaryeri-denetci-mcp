import type { NextConfig } from 'next';

/**
 * Workspace paketleri derlenmiş çıktı yayınlamıyor (`exports` doğrudan `src/*.ts`'i gösteriyor),
 * bu yüzden Next'in onları transpile etmesi gerekir.
 */
const nextConfig: NextConfig = {
  transpilePackages: [
    '@pazaryeri-denetci/core',
    '@pazaryeri-denetci/mock-data',
    '@pazaryeri-denetci/catalog-io',
  ],
};

export default nextConfig;
