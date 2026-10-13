import { describe, expect, it } from 'vitest';

import { decodeBytes, detectEncoding, hasUtf8Bom } from '../src/index.ts';
import { utf8, win1254 } from './fixtures.ts';

describe('detectEncoding', () => {
  it('boş bayt dizisinde utf-8 döner', () => {
    expect(detectEncoding(new Uint8Array(0))).toBe('utf-8');
  });

  it('UTF-8 BOM varlığında utf-8 döner', () => {
    const bytes = utf8('handle,title\n', true);
    expect(hasUtf8Bom(bytes)).toBe(true);
    expect(detectEncoding(bytes)).toBe('utf-8');
  });

  it('BOM olmadan da geçerli UTF-8 dizilerinde utf-8 döner', () => {
    expect(detectEncoding(utf8('şçğıöü İI'))).toBe('utf-8');
    expect(detectEncoding(utf8('plain ascii,199.90'))).toBe('utf-8');
  });

  it('geçersiz UTF-8 ama Windows-1254 anlamlı baytlarda windows-1254 döner', () => {
    // 0xFD `ı`, 0xFE `ş`, 0xE7 `ç` — hiçbiri tek başına geçerli UTF-8 değildir.
    expect(detectEncoding(Uint8Array.from([0xfd, 0xfe, 0xe7]))).toBe('windows-1254');
    expect(detectEncoding(win1254('ılık şapka çadır'))).toBe('windows-1254');
  });
});

describe('decodeBytes', () => {
  it('UTF-8 BOM\u2019unu kaldırır ve hadBom bildirir', () => {
    expect(decodeBytes(utf8('handle,title\n', true))).toEqual({
      text: 'handle,title\n',
      encoding: 'utf-8',
      hadBom: true,
    });
  });

  it('BOM\u2019suz UTF-8 metni aynen çözer', () => {
    const result = decodeBytes(utf8('şçğıöü'));
    expect(result.text).toBe('şçğıöü');
    expect(result.encoding).toBe('utf-8');
    expect(result.hadBom).toBe(false);
  });

  it('Windows-1254 baytlarını Türkçe karakterlere çevirir', () => {
    const result = decodeBytes(win1254('Fıstık Şölen Çadır'));
    expect(result.encoding).toBe('windows-1254');
    expect(result.hadBom).toBe(false);
    expect(result.text).toBe('Fıstık Şölen Çadır');
  });

  it('boş girdide boş metin döner', () => {
    expect(decodeBytes(new Uint8Array(0))).toEqual({
      text: '',
      encoding: 'utf-8',
      hadBom: false,
    });
  });
});
