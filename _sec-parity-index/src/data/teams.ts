export interface Team {
  /** CollegeFootballData school name, used as the stable id. */
  id: string;
  abbr: string;
  /** ESPN team id, used to fetch the logo at build time. */
  espn: number;
  color: string;
  /** Text color drawn on top of `color`. */
  ink: string;
}

const W = '#FFFFFF';
const K = '#141413';

const t = (id: string, abbr: string, espn: number, color: string, ink = W): Team => ({ id, abbr, espn, color, ink });

export const TEAMS: Team[] = [
  t('Georgia', 'UGA', 61, '#BA0C2F'),
  t('Oklahoma', 'OU', 201, '#841617'),
  t('Texas', 'TEX', 251, '#BF5700'),
  t('Tennessee', 'TENN', 2633, '#FF8200', K),
  t('Alabama', 'BAMA', 333, '#9E1B32'),
  t('Kentucky', 'UK', 96, '#0033A0'),
  t('LSU', 'LSU', 99, '#461D7C'),
  t('Mississippi State', 'MSU', 344, '#5D1725'),
  t('South Carolina', 'SC', 2579, '#73000A'),
  t('Florida', 'UF', 57, '#0021A5'),
  t('Auburn', 'AUB', 2, '#0C2340'),
  t('Missouri', 'MIZ', 142, '#F1B82D', K),
  t('Ole Miss', 'MISS', 145, '#CE1126'),
  t('Texas A&M', 'TAMU', 245, '#500000'),
  t('Vanderbilt', 'VAN', 238, '#866D4B'),
  t('Arkansas', 'ARK', 8, '#9D2235'),
];

const BY_ID = new Map(TEAMS.map((x) => [x.id, x]));

/** Abbreviation for a school we have no metadata for: initials, or the first four letters. */
function fallbackAbbr(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  return name.slice(0, 4).toUpperCase();
}

export function teamInfo(id: string): Team {
  return BY_ID.get(id) ?? { id, abbr: fallbackAbbr(id), espn: 0, color: '#E7E3D9', ink: K };
}
