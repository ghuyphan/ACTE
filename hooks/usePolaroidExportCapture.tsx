import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type View as RNView } from 'react-native';
import type { Note } from '../services/database';
import {
  captureViewAsImage,
  POLAROID_EXPORT_HEIGHT,
  POLAROID_EXPORT_WIDTH,
} from '../services/polaroidExport';
import PolaroidExportView from '../components/notes/detail/PolaroidExportView';

type CapturePolaroidExportOptions = {
  note: Note;
  fallbackLocationLabel: string;
  fallbackGradient?: readonly [string, string] | null;
  settleDelayMs?: number;
};

type CaptureRequest = CapturePolaroidExportOptions & {
  id: number;
  reject: (error: unknown) => void;
  resolve: (uri: string) => void;
};

type PolaroidExportCaptureContextValue = {
  capturePolaroidExport: (options: CapturePolaroidExportOptions) => Promise<string>;
};

const PolaroidExportCaptureContext = createContext<PolaroidExportCaptureContextValue>({
  capturePolaroidExport: () =>
    Promise.reject(new Error('Polaroid export capture provider is not mounted.')),
});

type PolaroidExportCaptureProviderProps = {
  children: ReactNode;
};

export function PolaroidExportCaptureProvider({
  children,
}: PolaroidExportCaptureProviderProps) {
  const [request, setRequest] = useState<CaptureRequest | null>(null);
  const captureRef = useRef<RNView | null>(null);
  const requestRef = useRef<CaptureRequest | null>(null);
  const requestIdRef = useRef(0);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSettleTimeout = useCallback(() => {
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
  }, []);

  const finishRequest = useCallback((requestId: number) => {
    if (requestRef.current?.id !== requestId) {
      return;
    }

    clearSettleTimeout();
    requestRef.current = null;
    setRequest(null);
  }, [clearSettleTimeout]);

  const capturePolaroidExport = useCallback(
    (options: CapturePolaroidExportOptions) =>
      new Promise<string>((resolve, reject) => {
        if (requestRef.current) {
          reject(new Error('A Polaroid export is already in progress.'));
          return;
        }

        const nextRequest: CaptureRequest = {
          ...options,
          id: requestIdRef.current + 1,
          resolve,
          reject,
        };
        requestIdRef.current = nextRequest.id;
        requestRef.current = nextRequest;
        setRequest(nextRequest);
      }),
    []
  );

  const handleReady = useCallback(() => {
    const activeRequest = requestRef.current;
    if (!activeRequest) {
      return;
    }

    clearSettleTimeout();
    settleTimeoutRef.current = setTimeout(() => {
      void (async () => {
        if (requestRef.current?.id !== activeRequest.id) {
          return;
        }

        try {
          const uri = await captureViewAsImage(captureRef);
          activeRequest.resolve(uri);
        } catch (error) {
          activeRequest.reject(error);
        } finally {
          finishRequest(activeRequest.id);
        }
      })();
    }, activeRequest.settleDelayMs ?? 80);
  }, [clearSettleTimeout, finishRequest]);

  useEffect(() => {
    return () => {
      clearSettleTimeout();
      requestRef.current?.reject(new Error('Polaroid export capture provider unmounted.'));
      requestRef.current = null;
    };
  }, [clearSettleTimeout]);

  return (
    <PolaroidExportCaptureContext.Provider value={{ capturePolaroidExport }}>
      <View style={styles.root}>
        {request ? (
          <View pointerEvents="none" style={styles.captureLayer}>
            <PolaroidExportView
              ref={captureRef}
              note={request.note}
              fallbackLocationLabel={request.fallbackLocationLabel}
              fallbackGradient={request.fallbackGradient}
              onReady={handleReady}
            />
          </View>
        ) : null}
        <View style={styles.content}>{children}</View>
      </View>
    </PolaroidExportCaptureContext.Provider>
  );
}

export function usePolaroidExportCapture() {
  return useContext(PolaroidExportCaptureContext);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  captureLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: POLAROID_EXPORT_WIDTH,
    height: POLAROID_EXPORT_HEIGHT,
    zIndex: -1,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
