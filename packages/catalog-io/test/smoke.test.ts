import { describe, expect, it } from 'vitest';

import * as catalogIo from '../src/index.ts';

describe('catalog-io genel yüzeyi', () => {
  it('paket adını dışa aktarır', () => {
    expect(catalogIo.PACKAGE_NAME).toBe('@pazaryeri-denetci/catalog-io');
  });

  it('beklenen fonksiyonları ve sabiti dışa aktarır', () => {
    expect(typeof catalogIo.detectEncoding).toBe('function');
    expect(typeof catalogIo.decodeBytes).toBe('function');
    expect(typeof catalogIo.parseTrNumber).toBe('function');
    expect(typeof catalogIo.parseTrInteger).toBe('function');
    expect(typeof catalogIo.importCsv).toBe('function');
    expect(typeof catalogIo.exportCatalogJson).toBe('function');
    expect(typeof catalogIo.importCatalogJson).toBe('function');
    expect(catalogIo.MINIMAL_CSV_COLUMNS).toEqual(['handle', 'title', 'price']);
  });
});
