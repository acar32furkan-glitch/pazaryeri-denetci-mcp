import { runDemoAudit } from '@/lib/audit';
import { PROFILE_IDS, resolveProfile } from '@/lib/catalog-profiles';

/** İstek parametresine göre rapor üretildiği için statik üretim yok. */
export const dynamic = 'force-dynamic';

/**
 * `GET /api/rapor?profil=<kucuk|orta|buyuk>`
 *
 * Türkçe Markdown raporunu indirilebilir dosya olarak döner
 * (`Content-Disposition: attachment; filename="katalog-denetim-raporu-<profil>.md"`).
 * Geçersiz/eksik profilde 400 ve Türkçe hata mesajı verir.
 */
export function GET(request: Request): Response {
  const profileParam = new URL(request.url).searchParams.get('profil');
  const profile = resolveProfile(profileParam);

  if (profile === undefined) {
    return new Response(
      `Geçersiz profil parametresi: "${profileParam ?? ''}". ` +
        `Geçerli değerler: ${PROFILE_IDS.join(', ')}.\n`,
      { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const audit = runDemoAudit(profile);

  return new Response(audit.markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="katalog-denetim-raporu-${profile.id}.md"`,
      'Cache-Control': 'no-store',
    },
  });
}
