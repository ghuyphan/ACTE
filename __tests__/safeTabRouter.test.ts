import { safeTabRouterOverride } from '../components/navigation/SafeExpoTabs';

describe('safeTabRouterOverride', () => {
  const routerOptions = {
    routeNames: ['index', 'map'],
    routeParamList: {},
    routeGetIdList: {},
  };

  const createRouter = (overrides: Record<string, unknown>) =>
    safeTabRouterOverride({
      getInitialState: jest.fn(),
      getRehydratedState: jest.fn((nextState) => nextState),
      getStateForAction: jest.fn(() => null),
      ...overrides,
    } as any) as any;

  it('rehydrates missing tab state from the router initial state', () => {
    const initialState = {
      key: 'tab-1',
      stale: false,
      type: 'tab',
      index: 0,
      routeNames: ['index'],
      routes: [{ key: 'index-1', name: 'index' }],
      history: [],
      preloadedRouteKeys: [],
    };
    const router = createRouter({
      getInitialState: jest.fn(() => initialState),
    });

    expect(router.getRehydratedState(undefined, routerOptions)).toBe(initialState);
  });

  it('delegates non-empty rehydration state to the original router', () => {
    const state = {
      key: 'tab-1',
      stale: true,
      type: 'tab',
      index: 0,
      routeNames: ['index'],
      routes: [{ key: 'index-1', name: 'index' }],
      history: [],
      preloadedRouteKeys: [],
    } as const;
    const rehydratedState = {
      ...state,
      stale: false,
    };
    const getRehydratedState = jest.fn(() => rehydratedState);
    const router = createRouter({ getRehydratedState });

    expect(router.getRehydratedState(state, routerOptions)).toBe(rehydratedState);
    expect(getRehydratedState).toHaveBeenCalledWith(state, routerOptions);
  });

  it('keeps Expo Router replace actions working as tab jumps', () => {
    const state = {
      key: 'tab-1',
      index: 1,
      history: [{ key: 'index-1' }, { key: 'map-1' }],
    };
    const router = createRouter({
      getStateForAction: jest.fn(() => state),
    });

    expect(router.getStateForAction(state, { type: 'REPLACE' }, routerOptions)).toEqual({
      ...state,
      key: 'tab-1-replace',
      history: [{ key: 'map-1' }],
    });
  });

  it('delegates non-replace actions to the original router', () => {
    const state = {
      key: 'tab-1',
      index: 0,
      history: [{ key: 'index-1' }],
    };
    const nextState = {
      ...state,
      index: 1,
      history: [{ key: 'index-1' }, { key: 'map-1' }],
    };
    const getStateForAction = jest.fn(() => nextState);
    const router = createRouter({ getStateForAction });

    expect(
      router.getStateForAction(
        state,
        { type: 'JUMP_TO', payload: { name: 'map' } },
        routerOptions
      )
    ).toBe(nextState);
    expect(getStateForAction).toHaveBeenCalledWith(
      state,
      { type: 'JUMP_TO', payload: { name: 'map' } },
      routerOptions
    );
  });

  it('ignores actions targeted at a different navigator', () => {
    const state = {
      key: 'tab-1',
      index: 0,
      history: [{ key: 'index-1' }],
    };
    const getStateForAction = jest.fn();
    const router = createRouter({ getStateForAction });

    expect(
      router.getStateForAction(state, { type: 'REPLACE', target: 'drawer-1' }, routerOptions)
    ).toBeNull();
    expect(getStateForAction).not.toHaveBeenCalled();
  });
});
