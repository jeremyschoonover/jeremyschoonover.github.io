export type ConferenceId = 'SEC' | 'Big Ten' | 'Big 12' | 'ACC' | 'FBS';

export interface Team {
  /** CollegeFootballData school name, used as the stable id. */
  id: string;
  abbr: string;
  conf: Exclude<ConferenceId, 'FBS'> | string;
  color: string;
  /** Text color drawn on top of `color`. */
  ink: string;
}

export const CONFERENCES: { id: ConferenceId; label: string; short: string }[] = [
  { id: 'SEC', label: 'Southeastern Conference', short: 'SEC' },
  { id: 'Big Ten', label: 'Big Ten Conference', short: 'Big Ten' },
  { id: 'Big 12', label: 'Big 12 Conference', short: 'Big 12' },
  { id: 'ACC', label: 'Atlantic Coast Conference', short: 'ACC' },
  { id: 'FBS', label: 'All FBS', short: 'All FBS' },
];

const W = '#FFFFFF';
const K = '#141413';

const t = (id: string, abbr: string, conf: string, color: string, ink = W): Team => ({ id, abbr, conf, color, ink });

export const TEAMS: Team[] = [
  // SEC
  t('Georgia', 'UGA', 'SEC', '#BA0C2F'),
  t('Oklahoma', 'OU', 'SEC', '#841617'),
  t('Texas', 'TEX', 'SEC', '#BF5700'),
  t('Tennessee', 'TENN', 'SEC', '#FF8200', K),
  t('Alabama', 'BAMA', 'SEC', '#9E1B32'),
  t('Kentucky', 'UK', 'SEC', '#0033A0'),
  t('LSU', 'LSU', 'SEC', '#461D7C'),
  t('Mississippi State', 'MSU', 'SEC', '#5D1725'),
  t('South Carolina', 'SC', 'SEC', '#73000A'),
  t('Florida', 'UF', 'SEC', '#0021A5'),
  t('Auburn', 'AUB', 'SEC', '#0C2340'),
  t('Missouri', 'MIZ', 'SEC', '#F1B82D', K),
  t('Ole Miss', 'MISS', 'SEC', '#CE1126'),
  t('Texas A&M', 'TAMU', 'SEC', '#500000'),
  t('Vanderbilt', 'VAN', 'SEC', '#866D4B'),
  t('Arkansas', 'ARK', 'SEC', '#9D2235'),
  // Big Ten
  t('Illinois', 'ILL', 'Big Ten', '#E84A27'),
  t('Indiana', 'IU', 'Big Ten', '#990000'),
  t('Iowa', 'IOWA', 'Big Ten', '#FFCD00', K),
  t('Maryland', 'MD', 'Big Ten', '#E03A3E'),
  t('Michigan', 'MICH', 'Big Ten', '#00274C'),
  t('Michigan State', 'MSU', 'Big Ten', '#18453B'),
  t('Minnesota', 'MINN', 'Big Ten', '#7A0019'),
  t('Nebraska', 'NEB', 'Big Ten', '#E41C38'),
  t('Northwestern', 'NU', 'Big Ten', '#4E2A84'),
  t('Ohio State', 'OSU', 'Big Ten', '#BB0000'),
  t('Penn State', 'PSU', 'Big Ten', '#041E42'),
  t('Purdue', 'PUR', 'Big Ten', '#CEB888', K),
  t('Rutgers', 'RU', 'Big Ten', '#CC0033'),
  t('Wisconsin', 'WIS', 'Big Ten', '#C5050C'),
  t('UCLA', 'UCLA', 'Big Ten', '#2D68C4'),
  t('USC', 'USC', 'Big Ten', '#990000'),
  t('Oregon', 'ORE', 'Big Ten', '#154733'),
  t('Washington', 'UW', 'Big Ten', '#4B2E83'),
  // Big 12
  t('Arizona', 'ARIZ', 'Big 12', '#CC0033'),
  t('Arizona State', 'ASU', 'Big 12', '#8C1D40'),
  t('Baylor', 'BAY', 'Big 12', '#154734'),
  t('BYU', 'BYU', 'Big 12', '#002E5D'),
  t('UCF', 'UCF', 'Big 12', '#BA9B37', K),
  t('Cincinnati', 'CIN', 'Big 12', '#E00122'),
  t('Colorado', 'COLO', 'Big 12', '#CFB87C', K),
  t('Houston', 'HOU', 'Big 12', '#C8102E'),
  t('Iowa State', 'ISU', 'Big 12', '#C8102E'),
  t('Kansas', 'KU', 'Big 12', '#0051BA'),
  t('Kansas State', 'KSU', 'Big 12', '#512888'),
  t('Oklahoma State', 'OKST', 'Big 12', '#FF7300', K),
  t('TCU', 'TCU', 'Big 12', '#4D1979'),
  t('Texas Tech', 'TTU', 'Big 12', '#CC0000'),
  t('Utah', 'UTAH', 'Big 12', '#CC0000'),
  t('West Virginia', 'WVU', 'Big 12', '#002855'),
  // ACC
  t('Boston College', 'BC', 'ACC', '#8A100B'),
  t('California', 'CAL', 'ACC', '#003262'),
  t('Clemson', 'CLEM', 'ACC', '#F56600', K),
  t('Duke', 'DUKE', 'ACC', '#003087'),
  t('Florida State', 'FSU', 'ACC', '#782F40'),
  t('Georgia Tech', 'GT', 'ACC', '#B3A369', K),
  t('Louisville', 'LOU', 'ACC', '#AD0000'),
  t('Miami', 'MIA', 'ACC', '#005030'),
  t('NC State', 'NCST', 'ACC', '#CC0000'),
  t('North Carolina', 'UNC', 'ACC', '#7BAFD4', K),
  t('Pittsburgh', 'PITT', 'ACC', '#003594'),
  t('SMU', 'SMU', 'ACC', '#0033A0'),
  t('Stanford', 'STAN', 'ACC', '#8C1515'),
  t('Syracuse', 'SYR', 'ACC', '#F76900', K),
  t('Virginia', 'UVA', 'ACC', '#232D4B'),
  t('Virginia Tech', 'VT', 'ACC', '#861F41'),
  t('Wake Forest', 'WAKE', 'ACC', '#9E7E38', K),
];

const BY_ID = new Map(TEAMS.map((x) => [x.id, x]));

/** Abbreviation for a school we have no metadata for: initials, or the first four letters. */
function fallbackAbbr(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  return name.slice(0, 4).toUpperCase();
}

export function teamInfo(id: string, conf = 'FBS'): Team {
  return BY_ID.get(id) ?? { id, abbr: fallbackAbbr(id), conf, color: '#E7E3D9', ink: K };
}

export function conferenceTeams(conf: ConferenceId): Team[] {
  return TEAMS.filter((x) => x.conf === conf);
}
