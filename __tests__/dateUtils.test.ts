import { formatChatTimestamp, formatNoteTimestamp } from '../utils/dateUtils';

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

describe('formatChatTimestamp', () => {
  const now = new Date(2026, 4, 5, 15, 45);

  it('uses a time-only label for chats from today', () => {
    expect(formatChatTimestamp(new Date(2026, 4, 5, 15, 13), now)).toBe('3:13 PM');
  });

  it('uses easy scan labels for older chats', () => {
    expect(formatChatTimestamp(new Date(2026, 4, 4, 15, 13), now)).toBe('Yesterday');
    expect(formatChatTimestamp(new Date(2026, 4, 2, 15, 13), now)).toBe('Sat');
    expect(formatChatTimestamp(new Date(2026, 3, 10, 15, 13), now)).toBe('Apr 10');
  });
});
