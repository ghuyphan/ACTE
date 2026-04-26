import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { RelativeTimeNowProvider, useRelativeTimeNow } from '../hooks/useRelativeTimeNow';

describe('useRelativeTimeNow', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('uses a provided screen-level clock without starting a per-consumer timer', () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const providedNow = new Date('2026-04-26T10:30:00.000Z');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RelativeTimeNowProvider now={providedNow}>{children}</RelativeTimeNowProvider>
    );

    const { result } = renderHook(() => useRelativeTimeNow(), { wrapper });

    expect(result.current).toBe(providedNow);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
