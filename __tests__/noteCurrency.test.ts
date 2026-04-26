import {
  compareNoteCurrency,
  isNoteCurrencyAtLeastAsCurrent,
  isNoteCurrencyOlder,
  normalizeLocalRevision,
} from '../services/noteCurrency';

describe('note currency policy', () => {
  it('normalizes revisions before comparing them', () => {
    expect(normalizeLocalRevision(null)).toBe(0);
    expect(normalizeLocalRevision(-3)).toBe(0);
    expect(normalizeLocalRevision(2.9)).toBe(2);
  });

  it('prefers newer timestamps before revision tie-breakers', () => {
    expect(
      compareNoteCurrency(
        { updatedAt: '2026-04-26T11:00:00.000Z', localRevision: 1 },
        { updatedAt: '2026-04-26T10:00:00.000Z', localRevision: 99 }
      )
    ).toBe(1);
  });

  it('uses revision as a tie-breaker for same-timestamp snapshots', () => {
    expect(
      isNoteCurrencyOlder(
        { updatedAt: '2026-04-26T10:00:00.000Z', localRevision: 2 },
        { updatedAt: '2026-04-26T10:00:00.000Z', localRevision: 3 }
      )
    ).toBe(true);
    expect(
      isNoteCurrencyAtLeastAsCurrent(
        { updatedAt: '2026-04-26T10:00:00.000Z', localRevision: 3 },
        { updatedAt: '2026-04-26T10:00:00.000Z', localRevision: 2 }
      )
    ).toBe(true);
  });
});
