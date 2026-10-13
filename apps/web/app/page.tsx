import Link from 'next/link';

import { severityLabelTr, topFindings } from '@pazaryeri-denetci/core';
import type { Severity } from '@pazaryeri-denetci/core';

import { RULE_BY_ID, productTitleMap, runDemoAudit, topRules } from '@/lib/audit';
import {
  CATALOG_PROFILES,
  DEFAULT_PROFILE_ID,
  PROFILE_LIST,
  resolveProfile,
} from '@/lib/catalog-profiles';

/** Listelenen en kritik bulgu sayısı ve en sık kural sayısı. */
const TOP_FINDING_LIMIT = 20;
const TOP_RULE_LIMIT = 5;

const CARD_CLASS = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-5';

const SEVERITY_BADGE: Readonly<Record<Severity, string>> = {
  critical: 'bg-rose-500/15 text-rose-200 ring-rose-400/40',
  major: 'bg-amber-500/15 text-amber-200 ring-amber-400/40',
  minor: 'bg-sky-500/15 text-sky-200 ring-sky-400/40',
};

const SEVERITY_VALUE: Readonly<Record<Severity, string>> = {
  critical: 'text-rose-300',
  major: 'text-amber-300',
  minor: 'text-sky-300',
};

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function SeverityBadge({ severity }: { readonly severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SEVERITY_BADGE[severity]}`}
    >
      {severityLabelTr(severity)}
    </span>
  );
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  readonly label: string;
  readonly value: number;
  readonly valueClass?: string;
}) {
  return (
    <div className={CARD_CLASS}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${valueClass ?? 'text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawProfile = params['profil'];
  const requestedProfile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  const resolvedProfile = resolveProfile(requestedProfile);
  const profile = resolvedProfile ?? CATALOG_PROFILES[DEFAULT_PROFILE_ID];
  const invalidProfileRequested = requestedProfile !== undefined && resolvedProfile === undefined;

  const audit = runDemoAudit(profile);
  const { summary } = audit;
  const findBySeverity = summary.bySeverity;
  const titles = productTitleMap(profile);
  const criticalFindings = topFindings(audit, TOP_FINDING_LIMIT);
  const frequentRules = topRules(summary, TOP_RULE_LIMIT);
  const shownFindings = criticalFindings.length;

  const shareLabel = (count: number): string =>
    summary.findingCount === 0
      ? '—'
      : `%${String(Math.round((count / summary.findingCount) * 100))}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-indigo-300">
          pazaryeri-denetci-mcp · Next.js demosu
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Pazaryeri Katalog Denetçisi
        </h1>
        <p className="max-w-3xl text-slate-300">
          Üç sentetik katalog profilinden birini seçin; {RULE_BY_ID.size} deterministik kural
          katalog genelinde koşar, bulgular şiddete göre sıralanır ve rapor JSON ya da Markdown
          olarak indirilebilir. Tüm hesaplama sunucuda, saf fonksiyonlarla yapılır.
        </p>
      </header>

      <section
        aria-label="Veri ve kural uyarısı"
        className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-100"
      >
        <h2 className="text-base font-semibold text-amber-200">
          Uyarı: buradaki veri ve kurallar bağlayıcı değildir
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Katalog, seed&apos;li bir üreticiyle oluşturulmuş <strong>tamamen sentetik</strong>{' '}
            ürünlerden oluşur; gerçek mağaza, müşteri veya ürün verisi içermez.
          </li>
          <li>
            Kurallar, eşikler ve zorunlu alanlar <strong>örnek ve yapılandırılabilirdir</strong>;
            her pazaryerinin gerçek şartlarını yansıttığı iddia edilmez.
          </li>
          <li>
            Üretime almadan önce <strong>resmî pazaryeri dokümantasyonundan doğrulanmalıdır</strong>
            . Bu demo hiçbir uygunluk veya uyumluluk garantisi vermez.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Katalog profili
        </h2>
        <nav className="flex flex-wrap gap-3" aria-label="Katalog profilleri">
          {PROFILE_LIST.map((item) => {
            const active = item.id === profile.id;
            return (
              <Link
                key={item.id}
                href={`/?profil=${item.id}`}
                aria-current={active ? 'page' : undefined}
                className={`w-full rounded-xl border p-4 transition sm:w-64 ${
                  active
                    ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-50'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
                }`}
              >
                <span className="block text-base font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs text-slate-400">{item.description}</span>
              </Link>
            );
          })}
        </nav>
        {invalidProfileRequested ? (
          <p className="text-sm text-rose-300">
            Geçersiz profil istendi (&quot;{requestedProfile}&quot;); varsayılan{' '}
            <strong>{CATALOG_PROFILES[DEFAULT_PROFILE_ID].label}</strong> profili gösteriliyor.
          </p>
        ) : null}
        <p className="text-xs text-slate-500">
          seed {profile.seed} · {profile.productCount} ürün · etiketli hata{' '}
          {audit.injectedDefectCount} · ürün başına en fazla bir enjekte hata (etiket–bulgu
          eşleşmesi için)
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-label="Denetim özeti">
        <StatCard label="Ürün" value={summary.productCount} />
        <StatCard label="Toplam bulgu" value={summary.findingCount} />
        <StatCard
          label="Kritik"
          value={findBySeverity.critical}
          valueClass={SEVERITY_VALUE.critical}
        />
        <StatCard label="Orta" value={findBySeverity.major} valueClass={SEVERITY_VALUE.major} />
        <StatCard label="Düşük" value={findBySeverity.minor} valueClass={SEVERITY_VALUE.minor} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white">En sık görülen {TOP_RULE_LIMIT} kural</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Kural
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Şiddet
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Bulgu
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Payı
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {frequentRules.map((rule) => (
                <tr key={rule.ruleId}>
                  <td className="px-4 py-3">
                    <span className="block text-slate-100">{rule.title}</span>
                    <span className="block font-mono text-xs text-slate-500">{rule.ruleId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={rule.severity} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-100">{rule.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                    {shareLabel(rule.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white">
          En kritik {shownFindings} bulgu
          <span className="ml-2 text-sm font-normal text-slate-400">
            (toplam {summary.findingCount} bulgu, şiddete göre sıralı)
          </span>
        </h2>
        {shownFindings === 0 ? (
          <p className={CARD_CLASS}>Bu profilde bulgu yok.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {criticalFindings.map((finding, index) => {
              const rule = RULE_BY_ID.get(finding.ruleId);
              const productTitle = titles.get(finding.productId) ?? finding.productId;
              return (
                <li
                  key={`${finding.ruleId}-${finding.productId}-${finding.field}-${String(index)}`}
                  className={CARD_CLASS}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={finding.severity} />
                    <span className="text-sm font-medium text-slate-100">
                      {rule?.title ?? finding.ruleId}
                    </span>
                    <span className="font-mono text-xs text-slate-500">{finding.ruleId}</span>
                    <span className="font-mono text-xs text-slate-500">· {finding.field}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="font-medium text-slate-100">{productTitle}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">
                      {finding.productId}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{finding.message}</p>
                  <p className="mt-1 text-sm text-emerald-300">
                    <span className="font-medium text-emerald-200">Öneri: </span>
                    {finding.fixHint}
                  </p>
                  {finding.variantSku !== null && finding.variantSku.trim() !== '' ? (
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      varyant: {finding.variantSku}
                    </p>
                  ) : null}
                  {finding.evidence !== null && finding.evidence.trim() !== '' ? (
                    <p className="mt-2 break-words rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-400">
                      kanıt: {finding.evidence}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Rapor indirme">
        <a
          href={`/api/rapor?profil=${profile.id}`}
          className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 transition hover:border-emerald-400 hover:bg-emerald-500/15"
        >
          <span className="block text-base font-semibold text-emerald-100">
            Markdown raporunu indir
          </span>
          <span className="mt-1 block font-mono text-xs text-emerald-200/80">
            /api/rapor?profil={profile.id} → katalog-denetim-raporu-{profile.id}.md
          </span>
        </a>
        <a
          href={`/api/denetim?profil=${profile.id}`}
          className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-5 transition hover:border-sky-400 hover:bg-sky-500/15"
        >
          <span className="block text-base font-semibold text-sky-100">JSON çıktısını gör</span>
          <span className="mt-1 block font-mono text-xs text-sky-200/80">
            /api/denetim?profil={profile.id} → özet + tüm bulgular (JSON)
          </span>
        </a>
      </section>

      <footer className="border-t border-slate-800 pt-6 text-xs text-slate-500">
        <p>
          Denetim saf fonksiyonlarla yapılır: aynı seed ve aynı profil her koşuda birebir aynı bulgu
          listesini üretir. Kurallar örnek niteliğindedir ve resmî pazaryeri dokümantasyonundan
          doğrulanmalıdır.
        </p>
      </footer>
    </main>
  );
}
