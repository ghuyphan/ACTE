import { resolveNotesModeFromSwipe } from '../components/screens/notes/NotesScreen';

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isAuthAvailable: false,
  }),
}));

jest.mock('../hooks/useNotes', () => ({
  useNotes: () => ({
    notes: [],
    loading: false,
  }),
}));

jest.mock('../hooks/useSharedFeed', () => ({
  useSharedFeedStore: () => ({
    enabled: false,
    loading: false,
    ready: false,
    dataSource: 'cache',
    lastUpdatedAt: null,
    friends: [],
    sharedPosts: [],
    activeInvite: null,
  }),
}));

jest.mock('../hooks/useFeedFocus', () => ({
  useFeedFocus: () => ({
    requestFeedFocus: jest.fn(),
    peekFeedFocus: jest.fn(),
    clearFeedFocus: jest.fn(),
    consumeFeedFocus: jest.fn(),
  }),
}));

jest.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      text: '#000',
      secondaryText: '#666',
      primary: '#f4b942',
      surface: '#f8f5ef',
      border: '#e5dccf',
      danger: '#ff3b30',
    },
    isDark: false,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('../components/notes/DynamicStickerCanvas', () => () => null);
jest.mock('../components/notes/NoteDoodleCanvas', () => () => null);
jest.mock('../components/notes/recap/NotesRecapView', () => () => null);
jest.mock('../components/notes/recap/RecapModeSwitch', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../services/remoteMedia', () => ({
  downloadPhotoFromStorage: jest.fn(),
  SHARED_POST_MEDIA_BUCKET: 'bucket',
}));

describe('resolveNotesModeFromSwipe', () => {
  it('switches from all to recap on a left swipe when recap notes exist', () => {
    expect(resolveNotesModeFromSwipe('all', -60, 0, true)).toBe('recap');
  });

  it('switches from recap back to all on a right swipe when recap notes exist', () => {
    expect(resolveNotesModeFromSwipe('recap', 0, 500, true)).toBe('all');
  });

  it('keeps the current mode when there are no recap notes', () => {
    expect(resolveNotesModeFromSwipe('all', -200, -1000, false)).toBe('all');
  });
});
