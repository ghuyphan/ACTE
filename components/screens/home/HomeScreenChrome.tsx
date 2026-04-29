import { memo, type ComponentProps } from 'react';

import DualCaptureComposer from '../../home/capture/DualCaptureComposer';
import HomeHeaderSearch from '../../home/HomeHeaderSearch';
import SharedManageSheet from '../../home/SharedManageSheet';
import AppSheetAlert from '../../sheets/AppSheetAlert';

type HomeScreenChromeProps = {
  dualCaptureComposerProps: ComponentProps<typeof DualCaptureComposer>;
  headerSearchProps: ComponentProps<typeof HomeHeaderSearch>;
  sharedManageSheetProps: ComponentProps<typeof SharedManageSheet> | null;
  alertProps: ComponentProps<typeof AppSheetAlert>;
};

const HomeScreenChrome = memo(function HomeScreenChrome({
  dualCaptureComposerProps,
  headerSearchProps,
  sharedManageSheetProps,
  alertProps,
}: HomeScreenChromeProps) {
  return (
    <>
      <DualCaptureComposer {...dualCaptureComposerProps} />
      <HomeHeaderSearch {...headerSearchProps} />
      {sharedManageSheetProps ? <SharedManageSheet {...sharedManageSheetProps} /> : null}
      {alertProps.visible ? <AppSheetAlert {...alertProps} /> : null}
    </>
  );
});

export default HomeScreenChrome;
