import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DeletedSharedPostResponseReaction,
  SharedPostResponse,
  SharedPostResponseReaction,
  SharedPostResponsesConnectionStatus,
  SharedPostResponsesSubscriptionOptions,
} from '../../services/sharedFeedService';
import {
  getRememberedSharedPostResponses,
  hasRememberedSharedPostResponses,
  rememberSharedPostResponses,
} from '../../services/sharedPostResponseMemory';
import {
  areChatResponseListsEqual,
  mergeChatResponses,
  mergeResponseReactions,
  removeResponseReaction,
  type ChatThreadResponse,
} from './useSharedPostChatThread';

type GetSharedPostResponsesPage = (
  postId: string,
  options?: { limit?: number; beforeCreatedAt?: string | null }
) => Promise<SharedPostResponse[]>;

type SubscribeToSharedPostResponses = (
  postId: string,
  options: SharedPostResponsesSubscriptionOptions
) => () => void;

type UseSharedPostChatResponsesOptions = {
  enabled?: boolean;
  getSharedPostResponsesPage: GetSharedPostResponsesPage;
  isOnline: boolean;
  pageSize: number;
  postId: string;
  responseLoadFailedMessage: string;
  subscribeToSharedPostResponses?: SubscribeToSharedPostResponses;
};

function getRememberedResponses(postId: string) {
  return getRememberedSharedPostResponses(postId) as ChatThreadResponse[];
}

function rememberResponses(postId: string, responses: ChatThreadResponse[]) {
  rememberSharedPostResponses(postId, responses);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useSharedPostChatResponses({
  enabled = true,
  getSharedPostResponsesPage,
  isOnline,
  pageSize,
  postId,
  responseLoadFailedMessage,
  subscribeToSharedPostResponses,
}: UseSharedPostChatResponsesOptions) {
  const [responses, setResponses] = useState<ChatThreadResponse[]>(() =>
    getRememberedResponses(postId)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingResponses, setIsLoadingResponses] = useState(
    () => !hasRememberedSharedPostResponses(postId)
  );
  const [isLoadingOlderResponses, setIsLoadingOlderResponses] = useState(false);
  const [hasOlderResponses, setHasOlderResponses] = useState(
    () => getRememberedResponses(postId).length >= pageSize
  );
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isThreadEndVisible, setIsThreadEndVisibleState] = useState(true);
  const [connectionStatus, setConnectionStatus] =
    useState<SharedPostResponsesConnectionStatus>('connecting');
  const pendingResponsesRef = useRef<Map<string, ChatThreadResponse>>(new Map());
  const isThreadEndVisibleRef = useRef(true);

  const updateResponses = useCallback(
    (updater: (current: ChatThreadResponse[]) => ChatThreadResponse[]) => {
      setResponses((current) => {
        const next = updater(current);
        rememberResponses(postId, next);
        return areChatResponseListsEqual(current, next) ? current : next;
      });
    },
    [postId]
  );

  const applyRemoteResponses = useCallback(
    (nextResponses: SharedPostResponse[]) => {
      setResponses((current) => {
        const currentIds = new Set(current.map((response) => response.id));
        const incomingNewCount = nextResponses.filter(
          (response) => !currentIds.has(response.id)
        ).length;
        const next = mergeChatResponses(
          [...current, ...nextResponses],
          Array.from(pendingResponsesRef.current.values())
        );
        rememberResponses(postId, next);
        if (incomingNewCount > 0 && !isThreadEndVisibleRef.current) {
          setNewMessageCount((count) => Math.min(99, count + incomingNewCount));
        }
        return areChatResponseListsEqual(current, next) ? current : next;
      });
    },
    [postId]
  );

  const applyRemoteResponse = useCallback(
    (response: SharedPostResponse) => {
      setResponses((current) => {
        const isIncomingNew = !current.some((item) => item.id === response.id);
        const next = mergeChatResponses(
          [...current, response],
          Array.from(pendingResponsesRef.current.values())
        );
        rememberResponses(postId, next);
        if (isIncomingNew && !isThreadEndVisibleRef.current) {
          setNewMessageCount((count) => Math.min(99, count + 1));
        }
        return areChatResponseListsEqual(current, next) ? current : next;
      });
    },
    [postId]
  );

  const applyRemoteResponseDeleted = useCallback(
    (responseId: string) => {
      setResponses((current) => {
        const next = current.filter((response) => response.id !== responseId);
        if (next.length === current.length) {
          return current;
        }

        pendingResponsesRef.current.delete(responseId);
        rememberResponses(postId, next);
        return next;
      });
    },
    [postId]
  );

  const applyRemoteReaction = useCallback(
    (reaction: SharedPostResponseReaction) => {
      updateResponses((current) => {
        let didChange = false;
        const next = current.map((response) => {
          if (response.id !== reaction.responseId) {
            return response;
          }

          didChange = true;
          return {
            ...response,
            reactions: mergeResponseReactions(response.reactions, [reaction]),
          };
        });

        return didChange ? next : current;
      });
    },
    [updateResponses]
  );

  const applyRemoteReactionDeleted = useCallback(
    (reaction: DeletedSharedPostResponseReaction) => {
      updateResponses((current) => {
        let didChange = false;
        const next = current.map((response) => {
          if (reaction.responseId && response.id !== reaction.responseId) {
            return response;
          }

          const currentReactions = response.reactions ?? [];
          const nextReactions = removeResponseReaction(currentReactions, reaction);
          if (nextReactions.length === currentReactions.length) {
            return response;
          }

          didChange = true;
          return {
            ...response,
            reactions: nextReactions,
          };
        });

        return didChange ? next : current;
      });
    },
    [updateResponses]
  );

  useEffect(() => {
    if (!enabled) {
      pendingResponsesRef.current.clear();
      isThreadEndVisibleRef.current = true;
      setIsThreadEndVisibleState(true);
      setResponses((current) => (current.length > 0 ? [] : current));
      setIsLoadingResponses(false);
      setHasOlderResponses(false);
      setIsLoadingOlderResponses(false);
      setErrorMessage(null);
      setNewMessageCount(0);
      setConnectionStatus('disconnected');
      return undefined;
    }

    const rememberedResponses = getRememberedResponses(postId);
    pendingResponsesRef.current.clear();
    isThreadEndVisibleRef.current = true;
    setIsThreadEndVisibleState(true);
    setResponses(rememberedResponses);
    setIsLoadingResponses(!hasRememberedSharedPostResponses(postId));
    setHasOlderResponses(rememberedResponses.length >= pageSize);
    setIsLoadingOlderResponses(false);
    setErrorMessage(null);
    setNewMessageCount(0);
    setConnectionStatus(isOnline ? 'connecting' : 'disconnected');

    if (!subscribeToSharedPostResponses) {
      let cancelled = false;
      void getSharedPostResponsesPage(postId, { limit: pageSize })
        .then((nextResponses) => {
          if (!cancelled) {
            applyRemoteResponses(nextResponses);
            setHasOlderResponses(nextResponses.length >= pageSize);
            setConnectionStatus('connected');
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setConnectionStatus('disconnected');
            setErrorMessage(getErrorMessage(error, responseLoadFailedMessage));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingResponses(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    try {
      return subscribeToSharedPostResponses(postId, {
        initialPageSize: pageSize,
        onResponses: (nextResponses) => {
          applyRemoteResponses(nextResponses);
          setHasOlderResponses((current) => current || nextResponses.length >= pageSize);
          setIsLoadingResponses(false);
        },
        onResponse: (response) => {
          applyRemoteResponse(response);
          setIsLoadingResponses(false);
        },
        onResponseDeleted: applyRemoteResponseDeleted,
        onReaction: applyRemoteReaction,
        onReactionDeleted: applyRemoteReactionDeleted,
        onError: (error) => {
          setIsLoadingResponses(false);
          setConnectionStatus('disconnected');
          setErrorMessage(getErrorMessage(error, responseLoadFailedMessage));
        },
        onStatus: setConnectionStatus,
      });
    } catch (error) {
      setIsLoadingResponses(false);
      setErrorMessage(getErrorMessage(error, responseLoadFailedMessage));
    }

    return undefined;
  }, [
    applyRemoteResponses,
    applyRemoteResponse,
    applyRemoteResponseDeleted,
    applyRemoteReaction,
    applyRemoteReactionDeleted,
    enabled,
    getSharedPostResponsesPage,
    isOnline,
    pageSize,
    postId,
    responseLoadFailedMessage,
    subscribeToSharedPostResponses,
  ]);

  useEffect(() => {
    if (!isOnline) {
      setConnectionStatus('disconnected');
    }
  }, [isOnline]);

  const loadOlderResponses = useCallback(async () => {
    if (isLoadingOlderResponses || isLoadingResponses || !hasOlderResponses || responses.length === 0) {
      return false;
    }

    const oldestResponse = responses[0];
    if (!oldestResponse) {
      return false;
    }

    setIsLoadingOlderResponses(true);
    try {
      const olderResponses = await getSharedPostResponsesPage(postId, {
        limit: pageSize,
        beforeCreatedAt: oldestResponse.createdAt,
      });
      setHasOlderResponses(olderResponses.length >= pageSize);
      if (olderResponses.length === 0) {
        return false;
      }

      updateResponses((current) => mergeChatResponses([...olderResponses, ...current], []));
      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error, responseLoadFailedMessage));
      return false;
    } finally {
      setIsLoadingOlderResponses(false);
    }
  }, [
    getSharedPostResponsesPage,
    hasOlderResponses,
    isLoadingOlderResponses,
    isLoadingResponses,
    pageSize,
    postId,
    responseLoadFailedMessage,
    responses,
    updateResponses,
  ]);

  const setThreadEndVisible = useCallback((isVisible: boolean) => {
    isThreadEndVisibleRef.current = isVisible;
    setIsThreadEndVisibleState((current) => (current === isVisible ? current : isVisible));
  }, []);

  const clearNewMessageCount = useCallback(() => {
    setNewMessageCount(0);
  }, []);

  return {
    clearNewMessageCount,
    connectionStatus,
    errorMessage,
    hasOlderResponses,
    isLoadingOlderResponses,
    isLoadingResponses,
    isThreadEndVisible,
    isThreadEndVisibleRef,
    loadOlderResponses,
    newMessageCount,
    pendingResponsesRef,
    responses,
    setErrorMessage,
    setThreadEndVisible,
    updateResponses,
  };
}
