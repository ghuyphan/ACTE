import { act, renderHook } from '@testing-library/react-native';
import { useAppSheetAlert } from '../hooks/useAppSheetAlert';

describe('useAppSheetAlert', () => {
  it('calls the dismiss callback exactly once when the alert is hidden', () => {
    const onClose = jest.fn();
    const { result } = renderHook(() => useAppSheetAlert());

    act(() => {
      result.current.showAlert({
        title: 'Heads up',
        message: 'Testing alert dismissal',
        primaryAction: { label: 'Done' },
        onClose,
      });
    });

    expect(result.current.alertProps.visible).toBe(true);

    act(() => {
      result.current.hideAlert();
    });

    expect(result.current.alertProps.visible).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
