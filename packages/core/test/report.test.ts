import { describe, expect, it } from 'vitest';

import { summarize } from '../src/audit.ts';
import { escapeMarkdown, renderFindingsJson, renderFindingsMarkdown } from '../src/report.ts';
import type { AuditResult } from '../src/index.ts';
import type { Rule } from '../src/rule.ts';
import type { Finding, Severity } from '../src/types.ts';

/** Test verisi elle kurulur — kurallara/denetime bağımlı değil, rapor saf fonksiyondur. */
function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'TITLE_LENGTH',
    severity: 'major',
    productId: 'snt-prd-0001',
    variantSku: null,
    field: 'title',
    message: 'Başlık çok kısa: 6 karakter (en az 15 olmalı).',
    fixHint: 'Başlığa ürün tipini ve hedef kitleyi ekleyin.',
    evidence: null,
    ...overrides,
  };
}

function makeResult(findings: readonly Finding[], productCount = 1): AuditResult {
  return { findings, summary: summarize(findings, productCount) };
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'TITLE_LENGTH',
    severity: 'major',
    appliesTo: ['shopify'],
    title: 'Başlık uzunluğu',
    description: 'Test kuralı.',
    check: () => [],
    ...overrides,
  };
}

function countLinesStartingWith(text: string, prefix: string): number {
  return text.split('\n').filter((line) => line.startsWith(prefix)).length;
}

/** Tablo satırındaki kaçışlanmamış `|` sayısı (Markdown sütun sınırları). */
function countTablePipes(line: string): number {
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '|' && line[index - 1] !== '\\') {
      count += 1;
    }
  }
  return count;
}

/** Ayrıştırma tek noktadan: geçersiz JSON'da `JSON.parse` fırlatır, test kırılır. */
function parseReport(json: string): ParsedReport {
  return JSON.parse(json) as ParsedReport;
}

interface ParsedReport {
  generatedBy: string;
  summary: {
    productCount: number;
    findingCount: number;
    bySeverity: Record<Severity, number>;
    byRule: Record<string, number>;
  };
  findings: readonly Finding[];
}

describe('escapeMarkdown', () => {
  it('kaçışlanması gereken karakterlerin önüne ters eğik çizgi koyar', () => {
    expect(escapeMarkdown('a|b*c`d_e[f]g<h>i')).toBe('a\\|b\\*c\\`d\\_e\\[f\\]g\\<h\\>i');
  });

  it('satır sonlarını (tek veya çok) boşluğa indirger', () => {
    expect(escapeMarkdown('satir1\nsatir2')).toBe('satir1 satir2');
    expect(escapeMarkdown('a\r\nb')).toBe('a b');
    expect(escapeMarkdown('a\n\nb')).toBe('a b');
  });

  it('özel karakter içermeyen metni değiştirmeden bırakır', () => {
    expect(escapeMarkdown('Antrasit Yün Kazak 2024')).toBe('Antrasit Yün Kazak 2024');
    expect(escapeMarkdown('')).toBe('');
  });
});

describe('renderFindingsJson', () => {
  const findings = [
    makeFinding({ ruleId: 'Z_RULE', severity: 'critical', evidence: 'değer' }),
    makeFinding({ ruleId: 'A_RULE', severity: 'minor', variantSku: 'SNT-0001-02' }),
  ];
  const result = makeResult(findings, 3);

  it('geçerli JSON ve beklenen sözleşme alanlarını döner', () => {
    const json = renderFindingsJson(result);
    const parsed = parseReport(json);
    expect(parsed.generatedBy).toBe('pazaryeri-denetci-mcp');
    expect(parsed.summary.productCount).toBe(3);
    expect(parsed.summary.findingCount).toBe(2);
    expect(parsed.findings).toHaveLength(2);
  });

  it('findings sırasını ve alanları olduğu gibi korur', () => {
    const parsed = parseReport(renderFindingsJson(result));
    expect(parsed.findings.map((finding) => finding.ruleId)).toEqual(['Z_RULE', 'A_RULE']);
    expect(parsed.findings[0]).toEqual(findings[0]);
    expect(parsed.findings[1]?.variantSku).toBe('SNT-0001-02');
  });

  it('iki boşluk girinti kullanır ve \\n ile biter', () => {
    const json = renderFindingsJson(result);
    expect(json).toContain('\n  "generatedBy"');
    expect(json).toContain('\n    "productCount"');
    expect(json).not.toContain('\t');
    expect(json.endsWith('\n')).toBe(true);
  });

  it('aynı girdi için iki çağrı birebir aynı çıktıyı verir (deterministik)', () => {
    const first = renderFindingsJson(result);
    const second = renderFindingsJson(result);
    expect(second).toBe(first);
  });

  it('byRule anahtarlarını alfabetik sıraya koyar', () => {
    const parsed = parseReport(renderFindingsJson(result));
    expect(Object.keys(parsed.summary.byRule)).toEqual(['A_RULE', 'Z_RULE']);
  });

  it('maxFindings verilse bile tüm bulguları içerir', () => {
    const parsed = parseReport(renderFindingsJson(result, { maxFindings: 1 }));
    expect(parsed.findings).toHaveLength(2);
  });
});

describe('renderFindingsMarkdown — genel yapı', () => {
  it('boş bulgu listesinde net bir satır yazar ve sıfır sayaçları gösterir', () => {
    const markdown = renderFindingsMarkdown(makeResult([], 0));
    expect(markdown).toContain('# Katalog Denetim Raporu');
    expect(markdown).toContain('## Özet');
    expect(markdown).toContain('## Bulgular');
    expect(markdown).toContain('| Şiddet | Bulgu |');
    expect(markdown).toContain('| kritik | 0 |');
    expect(markdown).toContain('| orta | 0 |');
    expect(markdown).toContain('| düşük | 0 |');
    expect(markdown).not.toContain('**Toplam**');
    expect(markdown).toContain('- Bulgu yok. 🎉');
    expect(markdown).toContain('---');
    expect(markdown).toContain('pazaryeri-denetci-mcp');
  });

  it('özel başlığı kullanır, boş başlıkta varsayılana düşer', () => {
    const result = makeResult([]);
    expect(renderFindingsMarkdown(result, { title: 'Sipariş Öncesi Kontrol' })).toContain(
      '# Sipariş Öncesi Kontrol',
    );
    expect(renderFindingsMarkdown(result, { title: '   ' })).toContain('# Katalog Denetim Raporu');
  });

  it('aynı girdi için iki çağrı birebir aynı çıktıyı verir (deterministik)', () => {
    const result = makeResult([makeFinding(), makeFinding({ severity: 'critical' })]);
    expect(renderFindingsMarkdown(result)).toBe(renderFindingsMarkdown(result));
  });

  it('şiddet dağılımı satırlarını ve toplam satırını yazar', () => {
    const result = makeResult([
      makeFinding({ severity: 'critical' }),
      makeFinding({ severity: 'major' }),
      makeFinding({ severity: 'major' }),
    ]);
    const markdown = renderFindingsMarkdown(result);
    expect(markdown).toContain('| kritik | 1 |');
    expect(markdown).toContain('| orta | 2 |');
    expect(markdown).toContain('| düşük | 0 |');
    expect(markdown).toContain('| **Toplam** | 3 |');
  });
});

describe('renderFindingsMarkdown — bulgu maddesi', () => {
  it('tek bulguyu beklenen madde biçiminde yazar', () => {
    const markdown = renderFindingsMarkdown(makeResult([makeFinding()]));
    expect(markdown).toContain('- **orta** · `TITLE_LENGTH` · `snt-prd-0001`');
    expect(markdown).toContain('  alan: title');
    expect(markdown).toContain('  sorun: Başlık çok kısa');
    expect(markdown).toContain('  öneri: Başlığa ürün tipini');
    expect(markdown).not.toContain('varyant:');
    expect(markdown).not.toContain('kanıt:');
  });

  it('varyant ve kanıt yalnızca doluyken yazılır', () => {
    const withData = renderFindingsMarkdown(
      makeResult([makeFinding({ variantSku: 'SNT-0001-02', evidence: 'kısa kanıt metni' })]),
    );
    expect(withData).toContain('  varyant: SNT-0001-02');
    expect(withData).toContain('  kanıt: kısa kanıt metni');

    const blank = renderFindingsMarkdown(
      makeResult([makeFinding({ variantSku: '   ', evidence: '   ' })]),
    );
    expect(blank).not.toContain('varyant:');
    expect(blank).not.toContain('kanıt:');
  });

  it('bulguları girdi sırasına göre listeler (şiddet sıralı veri)', () => {
    const result = makeResult([
      makeFinding({ severity: 'critical', ruleId: 'A' }),
      makeFinding({ severity: 'major', ruleId: 'B' }),
      makeFinding({ severity: 'minor', ruleId: 'C' }),
    ]);
    const markdown = renderFindingsMarkdown(result);
    const critical = markdown.indexOf('- **kritik**');
    const major = markdown.indexOf('- **orta**');
    const minor = markdown.indexOf('- **düşük**');
    expect(critical).toBeGreaterThan(-1);
    expect(critical).toBeLessThan(major);
    expect(major).toBeLessThan(minor);
  });

  it('120 karakterden uzun kanıtı kısaltır', () => {
    const longEvidence = 'a'.repeat(200);
    const markdown = renderFindingsMarkdown(makeResult([makeFinding({ evidence: longEvidence })]));
    expect(markdown).toContain('kanıt:');
    expect(markdown).toContain('…');
    expect(markdown).not.toContain(longEvidence);
  });
});

describe('renderFindingsMarkdown — maxFindings', () => {
  const many = Array.from({ length: 60 }, (_, index) =>
    makeFinding({ productId: `snt-prd-${String(index).padStart(4, '0')}` }),
  );

  it('varsayılan olarak 50 bulgu listeler ve kalanı bildirir', () => {
    const markdown = renderFindingsMarkdown(makeResult(many));
    expect(countLinesStartingWith(markdown, '- **')).toBe(50);
    expect(markdown).toContain('- … ve 10 bulgu daha (raporda kısaltıldı).');
  });

  it('açık bir sınır verildiğinde kalanı doğru sayar', () => {
    const markdown = renderFindingsMarkdown(makeResult(many.slice(0, 3)), { maxFindings: 2 });
    expect(countLinesStartingWith(markdown, '- **')).toBe(2);
    expect(markdown).toContain('- … ve 1 bulgu daha (raporda kısaltıldı).');
  });

  it('sıfırda ve negatifte bulgu listelemez ama kalanı bildirir', () => {
    const result = makeResult(many.slice(0, 3));
    for (const maxFindings of [0, -5]) {
      const markdown = renderFindingsMarkdown(result, { maxFindings });
      expect(countLinesStartingWith(markdown, '- **')).toBe(0);
      expect(markdown).toContain('- … ve 3 bulgu daha (raporda kısaltıldı).');
    }
  });

  it('sınır bulgu sayısından büyükse kısaltma satırı yazılmaz', () => {
    const markdown = renderFindingsMarkdown(makeResult(many.slice(0, 2)), { maxFindings: 10 });
    expect(countLinesStartingWith(markdown, '- **')).toBe(2);
    expect(markdown).not.toContain('bulgu daha');
  });
});

describe('renderFindingsMarkdown — kural dağılımı ve tablo güvenliği', () => {
  it('kural dağılımı satırlarını alfabetik sırada yazar', () => {
    const result = makeResult([
      makeFinding({ ruleId: 'Z_RULE' }),
      makeFinding({ ruleId: 'A_RULE' }),
      makeFinding({ ruleId: 'M_RULE' }),
    ]);
    const markdown = renderFindingsMarkdown(result);
    const a = markdown.indexOf('| `A_RULE` | 1 |');
    const m = markdown.indexOf('| `M_RULE` | 1 |');
    const z = markdown.indexOf('| `Z_RULE` | 1 |');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(m);
    expect(m).toBeLessThan(z);
  });

  it('rules verilmişse kuralın Türkçe başlığını tabloya ekler', () => {
    const rules = [makeRule({ id: 'A_RULE', title: 'Alfa kuralı' })];
    const markdown = renderFindingsMarkdown(makeResult([makeFinding({ ruleId: 'A_RULE' })]), {
      rules,
    });
    expect(markdown).toContain('| `A_RULE` — Alfa kuralı | 1 |');
  });

  it('kanıt metnindeki `|` tablo sütunlarını bozmaz', () => {
    const result = makeResult([
      makeFinding({ evidence: 'renk|beden|görsel' }),
      makeFinding({ ruleId: 'Z_RULE', evidence: 'a|b' }),
    ]);
    const markdown = renderFindingsMarkdown(result);

    expect(markdown).toContain('kanıt: renk\\|beden\\|görsel');

    const tableLines = markdown.split('\n').filter((line) => line.startsWith('|'));
    expect(tableLines.length).toBeGreaterThan(0);
    for (const line of tableLines) {
      expect(countTablePipes(line)).toBe(3);
    }
  });
});
