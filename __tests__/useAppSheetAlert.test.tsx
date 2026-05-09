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

    act(() => {
      result.current.hideAlert();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs the previous close callback when replacing a visible alert', () => {
    const firstOnClose = jest.fn();
    const secondOnClose = jest.fn();
    const { result } = renderHook(() => useAppSheetAlert());

    act(() => {
      result.current.showAlert({
        title: 'First',
        message: 'First message',
        primaryAction: { label: 'Continue' },
        onClose: firstOnClose,
      });
    });

    act(() => {
      result.current.showAlert({
        title: 'Second',
        message: 'Second message',
        primaryAction: { label: 'Done' },
        onClose: secondOnClose,
      });
    });

    expect(firstOnClose).toHaveBeenCalledTimes(1);
    expect(result.current.alertProps.visible).toBe(true);
    expect(result.current.alertProps.title).toBe('Second');
    expect(secondOnClose).not.toHaveBeenCalled();

    act(() => {
      result.current.hideAlert();
    });

    expect(firstOnClose).toHaveBeenCalledTimes(1);
    expect(secondOnClose).toHaveBeenCalledTimes(1);
  });
});
