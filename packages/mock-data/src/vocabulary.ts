/**
 * Sentetik kelime dağarcığı.
 *
 * KURAL: Burada **hiçbir gerçek marka, ürün adı veya mağaza adı yer almaz** (bkz.
 * docs/DECISIONS.md, ADR-003). Tüm satıcı adları kurgusaldır ve ürün adları kategori
 * kelimelerinden türetilir.
 */

export const PRODUCT_NOUNS = [
  'Kazak',
  'Gömlek',
  'Çanta',
  'Atkı',
  'Sweatshirt',
  'Pantolon',
  'Elbise',
  'Cüzdan',
  'Fular',
  'Hırka',
  'Mont',
  'Tişört',
  'Etek',
  'Şapka',
  'Kemer',
  'Bileklik',
  'Kolye',
  'Defter',
  'Kalem Kutusu',
  'Kupa',
] as const;

export const MATERIALS = [
  'Pamuk',
  'Yün',
  'Deri',
  'Keten',
  'Polyester',
  'Viskon',
  'Kanvas',
  'Saten',
  'Şişe Cam',
  'Seramik',
] as const;

export const COLORS = [
  'Kırmızı',
  'Mavi',
  'Yeşil',
  'Antrasit',
  'Ekru',
  'Bordo',
  'Lacivert',
  'Haki',
  'Bej',
  'Gri',
] as const;

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Standart'] as const;

export const TITLE_TAILS = [
  'Kadın Giyim',
  'Erkek Giyim',
  'Unisex Koleksiyon',
  'Kışlık Koleksiyon',
] as const;

export const VENDORS = [
  'Ege Atölye',
  'Anadolu Dokuma',
  'Marmara Deri İşleri',
  'Karadeniz El Sanatları',
  'İç Anadolu Seramik',
] as const;

/** Örnek zorunlu metafield değerleri (Faz 2'de geçersiz değer enjeksiyonu için kullanılır). */
export const AGE_GROUPS = ['0-3 yaş', '4-6 yaş', '7-9 yaş', '10-14 yaş', 'Yetişkin'] as const;

export const CARE_INSTRUCTIONS = [
  '30 derecede hassas yıkamada yıkayın.',
  'Kuru temizleme önerilir.',
  'Serin ve kuru yerde saklayın.',
] as const;

export const DESCRIPTION_FILLERS = [
  'günlük kullanım için uygundur',
  'mevsimlik koleksiyonun bir parçasıdır',
  'el işçiliğiyle tamamlanmıştır',
  'hediyelik olarak da tercih edilebilir',
] as const;
