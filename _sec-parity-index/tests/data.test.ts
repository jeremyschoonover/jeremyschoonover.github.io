import { describe, expect, it } from 'vitest';
import { easternDate, gamesFor, normalizeCfbdGame } from '../src/lib/data';

describe('CFBD normalizer', () => {
  it('reads v2 camelCase records', () => {
    const g = normalizeCfbdGame({
      id: 401, week: 7, startDate: '2026-10-17T23:30:00.000Z', completed: true, neutralSite: false, conferenceGame: true,
      homeTeam: 'Tennessee', homeConference: 'SEC', homeClassification: 'fbs', homePoints: 23,
      awayTeam: 'Alabama', awayConference: 'SEC', awayClassification: 'fbs', awayPoints: 20,
    });
    expect(g).toMatchObject({ id: '401', home: 'Tennessee', away: 'Alabama', homePoints: 23, date: '2026-10-17', homeConf: 'SEC' });
  });

  it('reads v1 snake_case records', () => {
    const g = normalizeCfbdGame({
      id: 9, week: 1, start_date: '2026-09-05T16:00:00.000Z', completed: true, home_team: 'A', away_team: 'B',
      home_points: 10, away_points: 3, home_conference: 'ACC', away_conference: 'ACC', home_division: 'fbs', away_division: 'fbs',
    });
    expect(g).toMatchObject({ home: 'A', away: 'B', homePoints: 10, awayPoints: 3, homeConf: 'ACC' });
  });

  it('drops unplayed, tied and FCS games', () => {
    expect(normalizeCfbdGame({ homeTeam: 'A', awayTeam: 'B', homePoints: null, awayPoints: null, completed: false })).toBeNull();
    expect(normalizeCfbdGame({ homeTeam: 'A', awayTeam: 'B', homePoints: 7, awayPoints: 7, completed: true })).toBeNull();
    expect(normalizeCfbdGame({ homeTeam: 'A', awayTeam: 'B', homePoints: 50, awayPoints: 7, completed: true, awayClassification: 'fcs' })).toBeNull();
  });

  it('keeps late-night kickoffs on their Eastern calendar day', () => {
    expect(easternDate('2026-10-18T02:30:00.000Z')).toBe('2026-10-17');
  });

  it('scopes conference views to league games', () => {
    const base = { id: '1', week: 1, date: '2026-09-05', homePoints: 1, awayPoints: 0, neutral: false, conferenceGame: false };
    const games = [
      { ...base, home: 'A', away: 'B', homeConf: 'SEC', awayConf: 'SEC' },
      { ...base, home: 'A', away: 'C', homeConf: 'SEC', awayConf: 'ACC' },
    ];
    expect(gamesFor(games, 'SEC')).toHaveLength(1);
    expect(gamesFor(games, 'FBS')).toHaveLength(2);
  });
});
