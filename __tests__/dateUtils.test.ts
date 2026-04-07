import { formatNoteTimestamp } from '../utils/dateUtils';

describe('formatNoteTimestamp', () => {
  const now = new Date('2026-04-07T03:41:00.000Z');

  it('increments past minutes correctly for card timestamps', () => {
    expect(formatNoteTimestamp('2026-04-07T03:40:00.000Z', 'card', now)).toBe('1m');
    expect(formatNoteTimestamp('2026-04-07T03:39:00.000Z', 'card', now)).toBe('2m');
  });

  it('uses whole elapsed units instead of pinning to one minute', () => {
    expect(formatNoteTimestamp('2026-04-07T02:41:00.000Z', 'card', now)).toBe('1h');
    expect(formatNoteTimestamp('2026-04-07T01:41:00.000Z', 'card', now)).toBe('2h');
    expect(formatNoteTimestamp('2026-04-05T03:41:00.000Z', 'card', now)).toBe('2d');
  });
});
