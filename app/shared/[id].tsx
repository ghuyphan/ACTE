import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import SharedPostDetailSheet from '../../components/shared/SharedPostDetailSheet';

export default function SharedPostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  if (!id) {
    return null;
  }

  return (
    <SharedPostDetailSheet
      postId={id}
      visible={visible}
      onClose={() => {
        setVisible(false);
      }}
      onClosed={() => {
        router.back();
      }}
    />
  );
}
