import { describe, expect, it } from 'vitest';

import { descUnsafeHtmlRule } from '../../src/index.ts';
import { makeProduct } from '../factories.ts';

function check(descriptionHtml: string) {
  return descUnsafeHtmlRule.check({ product: makeProduct({ descriptionHtml }), listings: [] });
}

describe('DESC_UNSAFE_HTML', () => {
  it('geçen durum: temiz biçimlendirme HTML kabul edilir', () => {
    expect(check('<p>Yumuşak <strong>yün</strong> kazak; <em>nefes alan</em> doku.</p>')).toEqual(
      [],
    );
  });

  it('kalan durum: <script> etiketi critical bulgu üretir', () => {
    const findings = check('<script>alert(1)</script>');
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.ruleId).toBe('DESC_UNSAFE_HTML');
    expect(finding?.severity).toBe('critical');
    expect(finding?.field).toBe('descriptionHtml');
    expect(finding?.variantSku).toBeNull();
    expect(finding?.message).toContain('çalıştırılabilir içerik');
  });

  it('kalan durum: satır içi olay işleyicisi (onerror)', () => {
    const findings = check('<img src=x onerror=alert(1)>');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.field).toBe('descriptionHtml');
  });

  it('kalan durum: javascript: bağlantısı', () => {
    const findings = check('<a href="javascript:alert(1)">tıkla</a>');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.field).toBe('descriptionHtml');
  });

  it('kalan durum: onclick olay işleyicisi', () => {
    const findings = check('<div onclick="x()">metin</div>');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('critical');
  });
});
