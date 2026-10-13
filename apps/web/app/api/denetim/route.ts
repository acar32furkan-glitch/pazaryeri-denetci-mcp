import { runDemoAudit } from '@/lib/audit';
import { PROFILE_IDS, resolveProfile } from '@/lib/catalog-profiles';

/** İstek parametresine göre profil seçildiği için statik üretim yok. */
export const dynamic = 'force-dynamic';

/**
 * `GET /api/denetim?profil=<kucuk|orta|buyuk>`
 *
 * Seçilen profil için özeti ve şiddete göre sıralı **tüm** bulguları JSON döner.
 * Geçersiz/eksik profilde 400 ve Türkçe hata mesajı verir.
 */
export function GET(request: Request): Response {
  const profileParam = new URL(request.url).searchParams.get('profil');
  const profile = resolveProfile(profileParam);

  if (profile === undefined) {
    return Response.json(
      {
        hata: 'Geçersiz profil parametresi.',
        alinan: profileParam,
        gecerliProfiller: PROFILE_IDS,
        ornek: '/api/denetim?profil=orta',
      },
      { status: 400 },
    );
  }

  const audit = runDemoAudit(profile);

  return Response.json({
    profil: profile.id,
    seed: profile.seed,
    productCount: profile.productCount,
    injectedDefectCount: audit.injectedDefectCount,
    summary: audit.summary,
    findings: audit.findings,
  });
}
