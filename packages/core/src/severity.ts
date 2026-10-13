import type { Severity } from './types.ts';

/** Rapor sıralaması: kritik → orta → düşük. */
export const SEVERITY_ORDER: readonly Severity[] = ['critical', 'major', 'minor'];

export const SEVERITY_LABELS_TR: Readonly<Record<Severity, string>> = {
  critical: 'kritik',
  major: 'orta',
  minor: 'düşük',
};

export function severityRank(severity: Severity): number {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? SEVERITY_ORDER.length : index;
}

export function severityLabelTr(severity: Severity): string {
  return SEVERITY_LABELS_TR[severity];
}
