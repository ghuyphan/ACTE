import { filterNotesByQuery } from '../services/noteSearch';
import { getReminderSignalStrength } from '../services/placeRanking';
import { normalizeForMatching } from '../services/textNormalization';

describe('noteSearch normalization', () => {
  it('matches accentless queries against Vietnamese text and locations', () => {
    const notes = [
      {
        type: 'text' as const,
        content: 'Cà phê sáng ở Đà Nẵng',
        locationName: 'Đà Nẵng',
      },
    ];

    expect(filterNotesByQuery(notes, 'ca phe')).toHaveLength(1);
    expect(filterNotesByQuery(notes, 'da nang')).toHaveLength(1);
  });

  it('normalizes Vietnamese đ characters for matching paths', () => {
    expect(normalizeForMatching('Đà Nẵng')).toBe('da nang');
    expect(
      getReminderSignalStrength({
        type: 'text',
        content: 'Đừng gọi hành cho phần này',
      })
    ).toBe(2);
  });
});
