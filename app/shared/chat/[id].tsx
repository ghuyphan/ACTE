import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import SharedPostChatScreen from '../../../components/screens/shared/SharedPostChatScreen';
import { useAuth } from '../../../hooks/useAuth';

export default function SharedPostChatRoute() {
  const { id, responseId } = useLocalSearchParams<{ id: string; responseId?: string }>();
  const router = useRouter();
  const { isAuthAvailable, isReady: authReady, user } = useAuth();

  useEffect(() => {
    if (!id || !authReady || user || !isAuthAvailable) {
      return;
    }

    router.replace({
      pathname: '/auth',
      params: {
        returnTo: responseId
          ? `/shared/chat/${id}?responseId=${encodeURIComponent(responseId)}`
          : `/shared/chat/${id}`,
      },
    });
  }, [authReady, id, isAuthAvailable, responseId, router, user]);

  if (!id || (!authReady && isAuthAvailable) || (!user && isAuthAvailable)) {
    return null;
  }

  return <SharedPostChatScreen initialResponseId={responseId} postId={id} />;
}
