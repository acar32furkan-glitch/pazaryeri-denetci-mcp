import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME } from '../src/index.ts';

describe('mock-data paketi (Faz 0 iskeleti)', () => {
  it('paket adını dışa aktarır', () => {
    expect(PACKAGE_NAME).toBe('@pazaryeri-denetci/mock-data');
  });
});
