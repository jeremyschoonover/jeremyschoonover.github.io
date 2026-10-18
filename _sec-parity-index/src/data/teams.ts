export interface Team {
  /** CollegeFootballData school name, used as the stable id. */
  id: string;
  abbr: string;
  color: string;
  /** Text color drawn on top of `color`. */
  ink: string;
}

const W = '#FFFFFF';
const K = '#141413';

const t = (id: string, abbr: string, color: string, ink = W): Team => ({ id, abbr, color, ink });

export const TEAMS: Team[] = [
  t('Georgia', 'UGA', '#BA0C2F'),
  t('Oklahoma', 'OU', '#841617'),
  t('Texas', 'TEX', '#BF5700'),
  t('Tennessee', 'TENN', '#FF8200', K),
  t('Alabama', 'BAMA', '#9E1B32'),
  t('Kentucky', 'UK', '#0033A0'),
  t('LSU', 'LSU', '#461D7C'),
  t('Mississippi State', 'MSU', '#5D1725'),
  t('South Carolina', 'SC', '#73000A'),
  t('Florida', 'UF', '#0021A5'),
  t('Auburn', 'AUB', '#0C2340'),
  t('Missouri', 'MIZ', '#F1B82D', K),
  t('Ole Miss', 'MISS', '#CE1126'),
  t('Texas A&M', 'TAMU', '#500000'),
  t('Vanderbilt', 'VAN', '#866D4B'),
  t('Arkansas', 'ARK', '#9D2235'),
];

const BY_ID = new Map(TEAMS.map((x) => [x.id, x]));

/** Abbreviation for a school we have no metadata for: initials, or the first four letters. */
function fallbackAbbr(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  return name.slice(0, 4).toUpperCase();
}

export function teamInfo(id: string): Team {
  return BY_ID.get(id) ?? { id, abbr: fallbackAbbr(id), color: '#E7E3D9', ink: K };
}
