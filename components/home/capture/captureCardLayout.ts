import { Layout } from '../../../constants/theme';
import {
  BELOW_CARD_SECTION_HEIGHT,
  CARD_SIZE,
  COMPACT_CAPTURE_FOOTER_TOP_PADDING,
  DEFAULT_CAPTURE_FOOTER_TOP_PADDING,
  DOCKED_HEADER_CONTENT_OVERLAP,
} from './captureCardStyles';

export const CAPTURE_PAGE_VISUAL_BOTTOM_INSET = 90;

interface CaptureCardVerticalPaddingOptions {
  topInset: number;
  extraBottomInset?: number;
}

interface CaptureCardContentHeightOptions extends CaptureCardVerticalPaddingOptions {
  snapHeight: number;
}

export function getCaptureCardTopPadding(topInset: number) {
  return topInset + Layout.headerHeight - DOCKED_HEADER_CONTENT_OVERLAP;
}

export function getCaptureCardBottomPadding({
  topInset,
  extraBottomInset = 0,
}: CaptureCardVerticalPaddingOptions) {
  return topInset + CAPTURE_PAGE_VISUAL_BOTTOM_INSET + extraBottomInset;
}

export function getCaptureCardContentHeight({
  snapHeight,
  topInset,
  extraBottomInset = 0,
}: CaptureCardContentHeightOptions) {
  return (
    snapHeight -
    getCaptureCardTopPadding(topInset) -
    getCaptureCardBottomPadding({ topInset, extraBottomInset })
  );
}

export function getCaptureFooterCompactSnapHeightThreshold({
  topInset,
  extraBottomInset = 0,
}: CaptureCardVerticalPaddingOptions) {
  return (
    getCaptureCardTopPadding(topInset) +
    getCaptureCardBottomPadding({ topInset, extraBottomInset }) +
    CARD_SIZE +
    BELOW_CARD_SECTION_HEIGHT
  );
}

export function getCaptureFooterTopPadding({
  snapHeight,
  topInset,
  extraBottomInset = 0,
}: CaptureCardContentHeightOptions) {
  return getCaptureCardContentHeight({
    snapHeight,
    topInset,
    extraBottomInset,
  }) < CARD_SIZE + BELOW_CARD_SECTION_HEIGHT
    ? COMPACT_CAPTURE_FOOTER_TOP_PADDING
    : DEFAULT_CAPTURE_FOOTER_TOP_PADDING;
}
