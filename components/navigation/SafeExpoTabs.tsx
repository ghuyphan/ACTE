import {
  createBottomTabNavigator,
  type BottomTabNavigationEventMap,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import type {
  NavigationAction,
  ParamListBase,
  PartialState,
  Router,
  RouterConfigOptions,
  TabNavigationState,
} from '@react-navigation/routers';
import { withLayoutContext } from 'expo-router';
import type { ComponentProps } from 'react';

const BottomTabNavigator = createBottomTabNavigator().Navigator;

export function safeTabRouterOverride<Action extends NavigationAction>(
  original: Router<TabNavigationState<ParamListBase>, Action>
): Partial<Router<TabNavigationState<ParamListBase>, Action>> {
  return {
    ...original,
    getRehydratedState: (
      state:
        | PartialState<TabNavigationState<ParamListBase>>
        | TabNavigationState<ParamListBase>
        | undefined,
      options: RouterConfigOptions
    ) => {
      if (state == null) {
        return original.getInitialState(options);
      }

      return original.getRehydratedState(state, options);
    },
    getStateForAction: (state, action, options) => {
      if (action.target && action.target !== state.key) {
        return null;
      }

      if (action.type !== 'REPLACE') {
        return original.getStateForAction(state, action, options);
      }

      let nextState = original.getStateForAction(
        state,
        {
          ...action,
          type: 'JUMP_TO',
        } as Action,
        options
      );

      if (!nextState || nextState.index === undefined || !Array.isArray(nextState.history)) {
        return null;
      }

      if (nextState.index === 0) {
        return nextState;
      }

      const previousIndex = nextState.index - 1;
      return {
        ...nextState,
        key: `${nextState.key}-replace`,
        history: [
          ...nextState.history.slice(0, previousIndex),
          ...nextState.history.slice(nextState.index),
        ],
      };
    },
  };
}

const ExpoSafeTabs = withLayoutContext<
  BottomTabNavigationOptions,
  typeof BottomTabNavigator,
  TabNavigationState<ParamListBase>,
  BottomTabNavigationEventMap
>(BottomTabNavigator);

const SafeExpoTabs = Object.assign(
  (props: ComponentProps<typeof ExpoSafeTabs>) => (
    <ExpoSafeTabs {...props} UNSTABLE_router={safeTabRouterOverride} />
  ),
  {
    Screen: ExpoSafeTabs.Screen,
  }
);

export default SafeExpoTabs;
