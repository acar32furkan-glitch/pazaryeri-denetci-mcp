import { describe, expect, it } from 'vitest';

import { auditCatalog, auditProduct, checkGtin, RULE_CATALOG } from '@pazaryeri-denetci/core';

import { DEFECT_KINDS, generateCatalog, generateCleanCatalog } from '../src/index.ts';
import type { DefectKind } from '../src/index.ts';

const SMALL = { seed: 42, productCount: 100, defectsPerKind: 4 } as const;

describe('generateCatalog — determinizm', () => {
  it('aynı seed birebir aynı katalog ve etiketleri üretir', () => {
    const first = generateCatalog(SMALL);
    const second = generateCatalog(SMALL);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('farklı seed farklı katalog üretir', () => {
    const first = generateCatalog(SMALL);
    const second = generateCatalog({ ...SMALL, seed: 43 });
    expect(JSON.stringify(second.catalog)).not.toBe(JSON.stringify(first.catalog));
  });

  it('hata yerleşimi seed ile değişir ama tür sayıları sabit kalır', () => {
    const first = generateCatalog({ seed: 42, productCount: 100, defectsPerKind: 4 });
    const second = generateCatalog({ seed: 7, productCount: 100, defectsPerKind: 4 });
    expect(first.defects.map((defect) => defect.productId)).not.toEqual(
      second.defects.map((defect) => defect.productId),
    );
    expect(first.meta.byKind).toEqual(second.meta.byKind);
    expect(first.defects).toHaveLength(DEFECT_KINDS.length * 4);
  });
});

describe('generateCatalog — etiketler', () => {
  const generated = generateCatalog(SMALL);

  it('etiket sayısı tür × adet kadar', () => {
    expect(generated.defects).toHaveLength(DEFECT_KINDS.length * SMALL.defectsPerKind);
    expect(generated.meta.injectedCount).toBe(generated.defects.length);
    for (const kind of DEFECT_KINDS) {
      expect(generated.meta.byKind[kind]).toBe(SMALL.defectsPerKind);
    }
  });

  it('her ürüne en fazla bir hata yazılır (eval eşleşmesi bire bir olsun)', () => {
    const productIds = generated.defects.map((defect) => defect.productId);
    expect(new Set(productIds).size).toBe(productIds.length);
  });

  it('her etiketin beklenen kuralı ve detayı doludur', () => {
    for (const defect of generated.defects) {
      expect(defect.expectedRuleId.length).toBeGreaterThan(0);
      expect(defect.detail.length).toBeGreaterThan(0);
      expect(defect.field.length).toBeGreaterThan(0);
    }
  });

  it('etiket, üründeki gerçek bozukluğu doğru tarif ediyor', () => {
    for (const defect of generated.defects) {
      const product = generated.catalog.products.find(
        (candidate) => candidate.id === defect.productId,
      );
      expect(product, `ürün yok: ${defect.productId}`).toBeDefined();
      if (product === undefined) continue;
      switch (defect.kind) {
        case 'TITLE_TOO_SHORT':
          expect(product.title.trim().length).toBeLessThan(15);
          break;
        case 'TITLE_TOO_LONG':
          expect(product.title.trim().length).toBeGreaterThan(70);
          break;
        case 'DESC_EMPTY':
          expect(product.descriptionHtml).toMatch(/^(<p>&nbsp;<\/p>)?$/u);
          break;
        case 'SEO_META_NULL':
          expect(product.seo).toEqual({ title: null, description: null });
          break;
        case 'IMAGE_ALT_NULL':
          expect(product.images.some((image) => image.altText === null)).toBe(true);
          break;
        case 'SKU_NULL':
          expect(product.variants.some((variant) => variant.sku === null)).toBe(true);
          break;
        case 'BARCODE_CHECKSUM_BROKEN':
          expect(product.variants.some((variant) => !checkGtin(variant.barcode).valid)).toBe(true);
          break;
      }
    }
  });

  it('enjekte edilen hata YALNIZCA beklenen kuralı tetikler (yanlış pozitif yok)', () => {
    expect(RULE_CATALOG.length).toBeGreaterThan(0);
    // Katalog düzeyinde denetim: ürünler arası SKU çakışması yalnızca indeksle görülebilir.
    const result = auditCatalog(generated.catalog);
    const rulesByProduct = new Map<string, string[]>();
    for (const finding of result.findings) {
      const list = rulesByProduct.get(finding.productId) ?? [];
      list.push(finding.ruleId);
      rulesByProduct.set(finding.productId, list);
    }
    for (const defect of generated.defects) {
      expect(
        rulesByProduct.get(defect.productId) ?? [],
        `${defect.kind} → beklenen ${defect.expectedRuleId}`,
      ).toEqual([defect.expectedRuleId]);
    }
  });

  it('hatasız ürünlerde hiçbir kural tetiklenmez', () => {
    const defectiveIds = new Set(generated.defects.map((defect) => defect.productId));
    const cleanProducts = generated.catalog.products.filter(
      (product) => !defectiveIds.has(product.id),
    );
    expect(cleanProducts.length).toBeGreaterThan(0);
    for (const product of cleanProducts) {
      expect(auditProduct(product)).toEqual([]);
    }
  });
});

describe('generateCatalog — uç durumlar', () => {
  it('yetersiz ürün sayısında açık hata verir', () => {
    expect(() => generateCatalog({ seed: 1, productCount: 5, defectsPerKind: 2 })).toThrow(
      /yetmiyor/,
    );
  });

  it('bilinmeyen hata türünü reddeder', () => {
    expect(() =>
      generateCatalog({
        seed: 1,
        productCount: 10,
        defectsPerKind: 1,
        defectKinds: ['YOK' as DefectKind],
      }),
    ).toThrow(/bilinmeyen hata türü/);
  });

  it('sıfır/negatif ürün sayısını reddeder', () => {
    expect(() => generateCatalog({ seed: 1, productCount: 0 })).toThrow(/pozitif/);
  });

  it('hata türü listesi boşsa hatasız katalog üretir', () => {
    const generated = generateCatalog({
      seed: 5,
      productCount: 12,
      defectKinds: [],
      defectsPerKind: 0,
    });
    expect(generated.defects).toEqual([]);
    expect(generated.catalog.products).toHaveLength(12);
  });
});

describe('generateCatalog — besleme tutarlılığı', () => {
  it('her varyantın her kanalda bir satırı vardır ve fiyat/stok ürünle aynıdır', () => {
    // Bu test üreticinin TABAN ÇİZGİSİNİ doğrular; hata enjeksiyonu bilinçli olarak veriyi
    // bozduğu için burada hatasız katalog kullanılır.
    const { catalog } = generateCatalog({
      seed: 42,
      productCount: 30,
      defectKinds: [],
      defectsPerKind: 0,
      channels: ['trendyol', 'n11'],
    });
    const bySku = new Map<string, number>();
    for (const listing of catalog.listings) {
      if (listing.sku !== null) bySku.set(listing.sku, (bySku.get(listing.sku) ?? 0) + 1);
    }
    for (const product of catalog.products) {
      for (const variant of product.variants) {
        if (variant.sku === null) continue;
        expect(bySku.get(variant.sku)).toBe(2);
        const row = catalog.listings.find((listing) => listing.sku === variant.sku);
        expect(row?.price).toBe(variant.price);
        expect(row?.stock).toBe(variant.inventoryQuantity);
      }
    }
  });
});

describe('generateCleanCatalog — taban çizgisi', () => {
  it('hatasız katalog beklenen değişmezleri sağlar', () => {
    const catalog = generateCleanCatalog({ seed: 99, productCount: 30 });
    const skus = new Set<string>();
    const handles = new Set<string>();
    for (const product of catalog.products) {
      expect(product.title.trim().length).toBeGreaterThanOrEqual(15);
      expect(product.title.trim().length).toBeLessThanOrEqual(70);
      expect(product.handle).toMatch(/^[a-z0-9-]+$/u);
      handles.add(product.handle);
      expect(product.seo.title).not.toBeNull();
      expect(product.seo.description).not.toBeNull();
      expect(product.images.length).toBeGreaterThanOrEqual(3);
      for (const image of product.images) {
        expect(image.altText ?? '').not.toBe('');
      }
      for (const variant of product.variants) {
        expect(variant.sku ?? '').not.toBe('');
        skus.add(variant.sku ?? '');
        expect(variant.barcode ?? '').toMatch(/^\d{8}$|^\d{12,14}$/u);
        expect(variant.price).toBeGreaterThan(0);
      }
    }
    expect(handles.size).toBe(catalog.products.length);
    expect(skus.size).toBeGreaterThan(0);
  });
});
