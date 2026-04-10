import { fireEvent, render } from '@testing-library/react-native';

const mockUseLocalSearchParams = jest.fn();
const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(),
  replace: jest.fn(),
};
const mockAuthState = {
  isAuthAvailable: true,
  user: { uid: 'user-1' } as { uid: string } | null,
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => mockRouter,
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../components/notes/NoteDetailSheet', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return function MockNoteDetailSheet(props: { onClosed: () => void }) {
    return (
      <Pressable testID="close-note-detail" onPress={props.onClosed}>
        <Text>close</Text>
      </Pressable>
    );
  };
});

jest.mock('../components/shared/SharedPostDetailSheet', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return function MockSharedPostDetailSheet(props: { onClosed: () => void }) {
    return (
      <Pressable testID="close-shared-detail" onPress={props.onClosed}>
        <Text>close</Text>
      </Pressable>
    );
  };
});

describe('detail routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canGoBack.mockReturnValue(false);
    mockAuthState.user = { uid: 'user-1' };
  });

  it('falls back to /notes when the note route has no back stack', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'note-1' });
    const NoteDetailRoute = require('../app/note/[id]').default;

    const screen = render(<NoteDetailRoute />);
    fireEvent.press(screen.getByTestId('close-note-detail'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/notes');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('falls back to /shared when the shared route has no back stack', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'post-1' });
    const SharedPostDetailRoute = require('../app/shared/[id]').default;

    const screen = render(<SharedPostDetailRoute />);
    fireEvent.press(screen.getByTestId('close-shared-detail'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/shared');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('routes signed-out shared detail deep links through auth with a return route', () => {
    mockAuthState.user = null;
    mockUseLocalSearchParams.mockReturnValue({ id: 'post-1' });
    const SharedPostDetailRoute = require('../app/shared/[id]').default;

    render(<SharedPostDetailRoute />);

    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/auth',
      params: {
        returnTo: '/shared/post-1',
      },
    });
  });
});
