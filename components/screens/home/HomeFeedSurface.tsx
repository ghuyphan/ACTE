import { memo, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import NotesFeed from '../../home/NotesFeed';
import SavedNotePolaroidReveal from '../../home/SavedNotePolaroidReveal';

type HomeFeedSurfaceProps = {
  blurBackgroundColor: string;
  notesFeedProps: ComponentProps<typeof NotesFeed>;
  savedRevealProps: ComponentProps<typeof SavedNotePolaroidReveal>;
};

const HomeFeedSurface = memo(function HomeFeedSurface({
  blurBackgroundColor,
  notesFeedProps,
  savedRevealProps,
}: HomeFeedSurfaceProps) {
  return (
    <>
      <View style={[styles.blurTarget, { backgroundColor: blurBackgroundColor }]}>
        <NotesFeed {...notesFeedProps} />
      </View>

      <SavedNotePolaroidReveal {...savedRevealProps} />
    </>
  );
});

const styles = StyleSheet.create({
  blurTarget: {
    flex: 1,
  },
});

export default HomeFeedSurface;
