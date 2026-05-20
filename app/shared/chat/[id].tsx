import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import SharedPostChatScreen from '../../../components/screens/shared/SharedPostChatScreen';
import { useAuth } from '../../../hooks/useAuth';

export default function SharedPostChatRoute() {
  const { friendUid, id, responseId } = useLocalSearchParams<{
    friendUid?: string;
    id: string;
    responseId?: string;
  }>();
  const router = useRouter();
  const { isAuthAvailable, isReady: authReady, user } = useAuth();

  useEffect(() => {
    if (!id || !authReady || user || !isAuthAvailable) {
      return;
    }

    const returnToParams: string[] = [];
    if (responseId) {
      returnToParams.push(`responseId=${encodeURIComponent(responseId)}`);
    }
    if (friendUid) {
      returnToParams.push(`friendUid=${encodeURIComponent(friendUid)}`);
    }
    const returnToQuery = returnToParams.join('&');

    router.replace({
      pathname: '/auth',
      params: {
        returnTo: `/shared/chat/${id}${returnToQuery ? `?${returnToQuery}` : ''}`,
      },
    });
  }, [authReady, friendUid, id, isAuthAvailable, responseId, router, user]);

  if (!id || (!authReady && isAuthAvailable) || (!user && isAuthAvailable)) {
    return null;
  }

  return <SharedPostChatScreen directFriendUid={friendUid} initialResponseId={responseId} postId={id} />;
}
