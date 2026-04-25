import { HStack, Image as SwiftUIImage, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
    allowsTightening,
    backgroundOverlay,
    cornerRadius,
    font,
    foregroundStyle,
    frame,
    lineLimit,
    lineSpacing,
    multilineTextAlignment,
    padding,
    truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';
import i18n from '../constants/i18n';
import type { WidgetProps } from '../services/widget/contract';

interface WidgetViewProps extends WidgetProps {
    family?: string;
}

interface WidgetTextLayout {
    fontSize: number;
    lineLimit: number;
    lineSpacing: number;
    horizontalPadding: number;
    bottomOffset: number;
    topPadding: number;
    alignment: 'center' | 'leading';
}

type WidgetSizeName = 'small' | 'medium' | 'large';

interface WidgetFrameMetrics {
    compactPad: number;
    countBadgeHorizontal: number;
    countBadgeVertical: number;
    countBadgeFontSize: number;
    locationChipHorizontal: number;
    locationChipVertical: number;
    locationChipFontSize: number;
    locationIconSize: number;
    footerHorizontal: number;
    footerVertical: number;
    headerBottomPadding: number;
    authorAvatarSize: number;
    authorBadgePadding: number;
    authorChipFontSize: number;
}

const WIDGET_FRAME_METRICS: Record<WidgetSizeName, WidgetFrameMetrics> = {
    small: {
        compactPad: 13,
        countBadgeHorizontal: 10,
        countBadgeVertical: 5,
        countBadgeFontSize: 10,
        locationChipHorizontal: 9,
        locationChipVertical: 4.5,
        locationChipFontSize: 9,
        locationIconSize: 9.5,
        footerHorizontal: 16,
        footerVertical: 10,
        headerBottomPadding: 4,
        authorAvatarSize: 20,
        authorBadgePadding: 3.5,
        authorChipFontSize: 10,
    },
    medium: {
        compactPad: 16,
        countBadgeHorizontal: 11,
        countBadgeVertical: 5.5,
        countBadgeFontSize: 10.5,
        locationChipHorizontal: 11,
        locationChipVertical: 6,
        locationChipFontSize: 10.2,
        locationIconSize: 10,
        footerHorizontal: 18,
        footerVertical: 11,
        headerBottomPadding: 6,
        authorAvatarSize: 22,
        authorBadgePadding: 3.5,
        authorChipFontSize: 10,
    },
    large: {
        compactPad: 20,
        countBadgeHorizontal: 12,
        countBadgeVertical: 6,
        countBadgeFontSize: 11,
        locationChipHorizontal: 12.5,
        locationChipVertical: 7,
        locationChipFontSize: 10.8,
        locationIconSize: 10.5,
        footerHorizontal: 20,
        footerVertical: 12,
        headerBottomPadding: 8,
        authorAvatarSize: 24,
        authorBadgePadding: 3,
        authorChipFontSize: 10.5,
    },
};

function getTextLayout(size: WidgetSizeName, trimmedLength: number): WidgetTextLayout {
    if (size === 'large') {
        if (trimmedLength <= 60) {
            return { fontSize: 27, lineLimit: 3, lineSpacing: 2.8, horizontalPadding: 30, bottomOffset: 0, topPadding: 28, alignment: 'leading' };
        }
        if (trimmedLength <= 120) {
            return { fontSize: 23, lineLimit: 4, lineSpacing: 2.2, horizontalPadding: 30, bottomOffset: 0, topPadding: 28, alignment: 'leading' };
        }
        return { fontSize: 21, lineLimit: 4, lineSpacing: 1.8, horizontalPadding: 28, bottomOffset: 0, topPadding: 26, alignment: 'leading' };
    }

    if (size === 'medium') {
        if (trimmedLength <= 42) {
            return { fontSize: 21, lineLimit: 3, lineSpacing: 2.0, horizontalPadding: 20, bottomOffset: 6, topPadding: 10, alignment: 'leading' };
        }
        if (trimmedLength <= 96) {
            return { fontSize: 18.5, lineLimit: 4, lineSpacing: 1.8, horizontalPadding: 18, bottomOffset: 6, topPadding: 8, alignment: 'leading' };
        }
        return { fontSize: 16.5, lineLimit: 4, lineSpacing: 1.5, horizontalPadding: 17, bottomOffset: 6, topPadding: 8, alignment: 'leading' };
    }

    if (trimmedLength <= 28) {
        return { fontSize: 14.1, lineLimit: 4, lineSpacing: 1.15, horizontalPadding: 14, bottomOffset: 8, topPadding: 0, alignment: 'center' };
    }
    if (trimmedLength <= 64) {
        return { fontSize: 13.4, lineLimit: 4, lineSpacing: 1.0, horizontalPadding: 14, bottomOffset: 8, topPadding: 0, alignment: 'center' };
    }
    return { fontSize: 12.9, lineLimit: 4, lineSpacing: 0.9, horizontalPadding: 14, bottomOffset: 8, topPadding: 0, alignment: 'center' };
}

function getFallbackCountLabel(noteCount: number): string {
    return i18n.t('widget.savedCount', { count: noteCount, defaultValue: `${noteCount} notes saved` });
}

const LocketWidget = (props: { props: WidgetViewProps }) => {
    'widget';

    const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    const truncate = (value: string, maxLength: number) => {
        if (!value) return '';
        if (value.length <= maxLength) return value;
        return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
    };

    const {
        text,
        locationName,
        nearbyPlacesCount,
        backgroundImageUrl,
        backgroundImageBase64,
        backgroundGradientStartColor,
        backgroundGradientEndColor,
        noteCount,
        savedCountText,
        isIdleState,
        idleText,
        memoryReminderText,
        nearbyPlacesLabelText,
        accessorySaveMemoryText,
        accessoryAddFirstPlaceText,
        accessoryMemoryNearbyText,
        accessoryOpenAppText,
        accessoryAddLabelText,
        accessorySavedLabelText,
        accessoryNearLabelText,
        isLivePhoto,
        livePhotoBadgeText,
        isSharedContent,
        authorInitials,
        family,
    } = props.props ?? {};

    const familyName = asString(family);
    const size: WidgetSizeName = familyName === 'systemLarge' ? 'large' : familyName === 'systemMedium' ? 'medium' : 'small';
    const isLarge = size === 'large';
    const isMedium = size === 'medium';
    const isAccessoryInline = familyName === 'accessoryInline';
    const isAccessoryCircular = familyName === 'accessoryCircular';
    const isAccessoryRectangular = familyName === 'accessoryRectangular';
    const safeText = truncate(asString(text), isLarge ? 140 : isMedium ? 108 : 72);
    const safeNoteCount = typeof noteCount === 'number' ? noteCount : 0;
    const safeNearbyPlacesCount = typeof nearbyPlacesCount === 'number' ? nearbyPlacesCount : 0;
    const countLabel = asString(savedCountText) || getFallbackCountLabel(safeNoteCount);
    const compactLocationName = asString(locationName).split(',')[0]?.trim() ?? '';
    const hasImage = Boolean(asString(backgroundImageUrl) || asString(backgroundImageBase64));
    const showIdle = safeNoteCount <= 0 || (isIdleState && !safeText && !hasImage);
    const isTextNote = !showIdle && !hasImage && safeText.length > 0;
    const isPhoto = !showIdle && hasImage;
    const showLivePhotoBadge = isPhoto && Boolean(isLivePhoto);
    const bodyText = showIdle
        ? asString(idleText) || i18n.t('widget.idleText', 'The right note will appear when you are nearby.')
        : safeText || asString(memoryReminderText) || i18n.t('widget.memoryReminder', 'A quiet reminder from here.');
    const eyebrowText = !showIdle ? asString(locationName) : '';
    const backgroundColors = isTextNote || showIdle
        ? [
            asString(backgroundGradientStartColor) || '#F5EFE8',
            asString(backgroundGradientEndColor) || '#ECE5DC'
        ]
        : ['#5A4D42', '#2F2926'];
    const usesTextSurface = isTextNote || showIdle || !hasImage;
    const frameMetrics = WIDGET_FRAME_METRICS[size];
    const compactPad = usesTextSurface ? frameMetrics.compactPad : frameMetrics.compactPad + (isLarge ? 1 : 0);
    const showCountBadge = showIdle && safeNoteCount > 0;
    const textLayout = getTextLayout(size, bodyText.trim().length);
    const footerIconName = usesTextSurface ? 'doc.text' : 'photo';
    const eyebrowColor = usesTextSurface ? '#6E5E4F' : '#FFF8F0';
    const nearbyLabelCount = Math.max(safeNearbyPlacesCount, showIdle ? 0 : 1);
    const nearbyPlacesLabel = asString(nearbyPlacesLabelText)
        || i18n.t(
            nearbyLabelCount === 1 ? 'widget.nearbyPlaceOne' : 'widget.nearbyPlaceOther',
            {
                count: nearbyLabelCount,
                defaultValue: nearbyLabelCount === 1 ? '1 place nearby' : `${nearbyLabelCount} places nearby`,
            }
        );
    const accessorySymbolName = safeNoteCount <= 0 ? 'plus.circle.fill' : showIdle ? 'bookmark.fill' : 'location.fill';
    const accessoryNoteExcerpt = bodyText.length <= (showIdle ? 26 : 32)
        ? bodyText
        : `${bodyText.slice(0, (showIdle ? 26 : 32) - 1)}…`;
    const accessoryTitle = safeNoteCount <= 0
        ? asString(accessorySaveMemoryText) || i18n.t('widget.accessorySaveMemory', 'Save a memory')
        : compactLocationName || (showIdle ? countLabel : asString(accessoryMemoryNearbyText) || i18n.t('widget.accessoryMemoryNearby', 'Memory nearby'));
    const accessorySubtitle = safeNoteCount <= 0
        ? asString(accessoryAddFirstPlaceText) || i18n.t('widget.accessoryAddFirstPlace', 'Add your first place')
        : accessoryNoteExcerpt || (showIdle ? asString(accessoryOpenAppText) || i18n.t('widget.accessoryOpenApp', 'Open Noto') : nearbyPlacesLabel);
    const accessoryInlineText = safeNoteCount <= 0
        ? asString(accessorySaveMemoryText) || i18n.t('widget.accessorySaveMemory', 'Save a memory')
        : showIdle
            ? countLabel
            : compactLocationName
                ? `${asString(accessoryNearLabelText) || i18n.t('widget.accessoryNearLabel', 'Near')} ${compactLocationName}`
                : asString(accessoryMemoryNearbyText) || i18n.t('widget.accessoryMemoryNearby', 'Memory nearby');
    const accessoryCircularValue = safeNoteCount <= 0 ? '+' : showIdle ? `${safeNoteCount}` : `${nearbyLabelCount}`;
    const accessoryCircularCaption = safeNoteCount <= 0
        ? asString(accessoryAddLabelText) || i18n.t('widget.accessoryAddLabel', 'Add')
        : showIdle
            ? asString(accessorySavedLabelText) || i18n.t('widget.accessorySavedLabel', 'Saved')
            : asString(accessoryNearLabelText) || i18n.t('widget.accessoryNearLabel', 'Near');
    const safeAuthorInitials = asString(authorInitials);
    const showAuthorChip = Boolean(!showIdle && isSharedContent && safeAuthorInitials);
    const authorChipBackground = hasImage ? 'rgba(16,12,10,0.32)' : 'rgba(255,249,243,0.82)';
    const authorChipForeground = hasImage ? '#FFF8F0' : '#2A1A11';
    const livePhotoText = asString(livePhotoBadgeText) || i18n.t('widget.livePhotoBadge', 'Live');

    if (isAccessoryInline) {
        return (
            <HStack
                modifiers={[
                    frame({ maxWidth: 9999, maxHeight: 9999 }),
                    padding({ horizontal: 8 }),
                ]}
            >
                <SwiftUIImage systemName={accessorySymbolName} color="#2A1A11" size={12} />
                <Text
                    modifiers={[
                        font({ weight: 'semibold', size: 12, design: 'default' }),
                        foregroundStyle('#2A1A11'),
                        lineLimit(1),
                        padding({ leading: 4 }),
                    ]}
                >
                    {accessoryInlineText}
                </Text>
                <Spacer />
            </HStack>
        );
    }

    if (isAccessoryCircular) {
        return (
            <VStack
                modifiers={[
                    frame({ maxWidth: 9999, maxHeight: 9999 }),
                ]}
            >
                <Spacer />
                <Text
                    modifiers={[
                        font({ weight: 'bold', size: 18, design: 'rounded' }),
                        foregroundStyle('#2A1A11'),
                        lineLimit(1),
                    ]}
                >
                    {accessoryCircularValue}
                </Text>
                <Text
                    modifiers={[
                        font({ weight: 'medium', size: 8, design: 'default' }),
                        foregroundStyle('#6E5E4F'),
                        lineLimit(1),
                    ]}
                >
                    {accessoryCircularCaption}
                </Text>
                <Spacer />
            </VStack>
        );
    }

    if (isAccessoryRectangular) {
        return (
            <HStack
                modifiers={[
                    frame({ maxWidth: 9999, maxHeight: 9999 }),
                    padding({ horizontal: 12, vertical: 8 }),
                ]}
            >
                <VStack
                    modifiers={[
                        frame({ maxWidth: 9999, alignment: 'leading' }),
                    ]}
                >
                    <Text
                        modifiers={[
                            font({ weight: 'semibold', size: 13, design: 'default' }),
                            foregroundStyle('#2A1A11'),
                            frame({ maxWidth: 9999, alignment: 'leading' }),
                            lineLimit(1),
                        ]}
                    >
                        {accessoryTitle}
                    </Text>
                    <Text
                        modifiers={[
                            font({ weight: 'regular', size: 12, design: 'default' }),
                            foregroundStyle('#6E5E4F'),
                            frame({ maxWidth: 9999, alignment: 'leading' }),
                            lineLimit(2),
                            padding({ top: 1 }),
                        ]}
                    >
                        {accessorySubtitle}
                    </Text>
                </VStack>
                <Spacer />
                {showIdle ? (
                    <Text
                        modifiers={[
                            font({ weight: 'bold', size: 18, design: 'rounded' }),
                            foregroundStyle('#2A1A11'),
                            lineLimit(1),
                        ]}
                    >
                        {safeNoteCount <= 0 ? '+' : accessoryCircularValue}
                    </Text>
                ) : null}
            </HStack>
        );
    }

    const renderCountBadge = (onDarkSurface: boolean) => (
        <HStack
            modifiers={[
                backgroundOverlay({ color: onDarkSurface ? 'rgba(255,248,240,0.18)' : 'rgba(255,249,243,0.84)' }),
                cornerRadius(999),
                padding({ horizontal: frameMetrics.countBadgeHorizontal, vertical: frameMetrics.countBadgeVertical }),
            ]}
        >
            <Text
                modifiers={[
                    font({ weight: 'medium', size: frameMetrics.countBadgeFontSize, design: 'default' }),
                    foregroundStyle(onDarkSurface ? '#FFF8F0' : '#6E5E4F'),
                ]}
            >
                {countLabel}
            </Text>
        </HStack>
    );

    const renderFooter = (onDarkSurface: boolean) => (
        <HStack
            modifiers={[
                frame({ maxWidth: 9999 }),
                backgroundOverlay({ color: onDarkSurface ? 'rgba(16,12,10,0.28)' : 'rgba(255,249,243,0.30)' }),
                padding({ horizontal: frameMetrics.footerHorizontal, vertical: onDarkSurface ? frameMetrics.footerVertical : Math.max(10, frameMetrics.footerVertical - 1) }),
            ]}
        >
            {renderCountBadge(onDarkSurface)}
            <Spacer />
            <SwiftUIImage
                systemName={footerIconName}
                color={onDarkSurface ? '#FFF8F0' : '#8A7866'}
                size={13}
            />
        </HStack>
    );

    return (
        <ZStack
            modifiers={[
                frame({ maxWidth: 9999, maxHeight: 9999 }),
                padding({ all: -22 }),
            ]}
        >
            <Rectangle
                modifiers={[
                    frame({ maxWidth: 9999, maxHeight: 9999 }),
                    foregroundStyle({
                        type: 'linearGradient',
                        colors: backgroundColors,
                        startPoint: { x: 0, y: 0 },
                        endPoint: { x: 1, y: 1 }
                    })
                ]}
            />

            <VStack
                modifiers={[
                    padding({ all: compactPad }),
                    frame({ maxWidth: 9999, maxHeight: 9999 }),
                ]}
            >
                {showAuthorChip || showLivePhotoBadge ? (
                    <HStack
                        modifiers={[
                            frame({ maxWidth: 9999 }),
                            padding({ bottom: frameMetrics.headerBottomPadding }),
                        ]}
                    >
                        {showAuthorChip ? (
                            <HStack
                                modifiers={[
                                    backgroundOverlay({ color: authorChipBackground }),
                                    cornerRadius(999),
                                    padding({ all: frameMetrics.authorBadgePadding }),
                                ]}
                            >
                                <Text
                                    modifiers={[
                                        font({ weight: 'bold', size: frameMetrics.authorChipFontSize, design: 'rounded' }),
                                        foregroundStyle(authorChipForeground),
                                        lineLimit(1),
                                        frame({
                                            width: frameMetrics.authorAvatarSize,
                                            height: frameMetrics.authorAvatarSize,
                                            alignment: 'center',
                                        }),
                                    ]}
                                >
                                    {safeAuthorInitials}
                                </Text>
                            </HStack>
                        ) : null}
                        <Spacer />
                        {showLivePhotoBadge ? (
                            <HStack
                                modifiers={[
                                    backgroundOverlay({ color: authorChipBackground }),
                                    cornerRadius(999),
                                    padding({ horizontal: 9, vertical: 5.5 }),
                                ]}
                            >
                                <SwiftUIImage systemName="livephoto" color={authorChipForeground} size={11} />
                                <Text
                                    modifiers={[
                                        font({ weight: 'medium', size: frameMetrics.authorChipFontSize, design: 'default' }),
                                        foregroundStyle(authorChipForeground),
                                        lineLimit(1),
                                        padding({ leading: 5 }),
                                    ]}
                                >
                                    {livePhotoText}
                                </Text>
                            </HStack>
                        ) : null}
                    </HStack>
                ) : null}

                {usesTextSurface ? (
                    isLarge ? (
                        <VStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                            <VStack
                                modifiers={[
                                    frame({ maxWidth: 9999, maxHeight: 9999 }),
                                    padding({
                                        top: textLayout.topPadding,
                                        horizontal: textLayout.horizontalPadding,
                                        bottom: 18,
                                    }),
                                ]}
                            >
                                {eyebrowText ? (
                                    <Text
                                        modifiers={[
                                            font({ weight: 'medium', size: 11, design: 'default' }),
                                            foregroundStyle(eyebrowColor),
                                            frame({ maxWidth: 9999, alignment: 'leading' }),
                                            lineLimit(1),
                                            padding({ bottom: 12 }),
                                        ]}
                                    >
                                        {eyebrowText}
                                    </Text>
                                ) : null}
                                <Text
                                    modifiers={[
                                        font({ weight: 'bold', size: textLayout.fontSize, design: 'default' }),
                                        foregroundStyle('#2A1A11'),
                                        frame({ maxWidth: 9999, alignment: 'leading' }),
                                        lineLimit(textLayout.lineLimit),
                                        lineSpacing(textLayout.lineSpacing),
                                        multilineTextAlignment(textLayout.alignment),
                                    ]}
                                >
                                    {bodyText}
                                </Text>
                                <Spacer />
                            </VStack>
                            {showCountBadge ? renderFooter(false) : null}
                        </VStack>
                    ) : isMedium ? (
                        <VStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                            <VStack
                                modifiers={[
                                    frame({ maxWidth: 9999, maxHeight: 9999 }),
                                    padding({
                                        top: textLayout.topPadding,
                                        horizontal: textLayout.horizontalPadding,
                                        bottom: showCountBadge ? 10 : 6,
                                    }),
                                ]}
                            >
                                {eyebrowText ? (
                                    <Text
                                        modifiers={[
                                            font({ weight: 'medium', size: 10.5, design: 'default' }),
                                            foregroundStyle(eyebrowColor),
                                            frame({ maxWidth: 9999, alignment: 'leading' }),
                                            lineLimit(1),
                                            padding({ bottom: 10 }),
                                        ]}
                                    >
                                        {eyebrowText}
                                    </Text>
                                ) : null}
                                <Text
                                    modifiers={[
                                        font({ weight: 'bold', size: textLayout.fontSize, design: 'default' }),
                                        foregroundStyle('#2A1A11'),
                                        frame({ maxWidth: 9999, alignment: 'leading' }),
                                        lineLimit(textLayout.lineLimit),
                                        lineSpacing(textLayout.lineSpacing),
                                        multilineTextAlignment('leading'),
                                    ]}
                                >
                                    {bodyText}
                                </Text>
                                <Spacer />
                            </VStack>
                            {showCountBadge ? renderFooter(false) : null}
                        </VStack>
                    ) : (
                        <ZStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                            <VStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                                {eyebrowText ? (
                                    <HStack
                                        modifiers={[
                                            frame({ maxWidth: 9999 }),
                                            padding({ horizontal: 2, top: 2, bottom: 8 }),
                                        ]}
                                    >
                                        <Spacer />
                                        <Text
                                            modifiers={[
                                                font({ weight: 'medium', size: 10, design: 'default' }),
                                                foregroundStyle(eyebrowColor),
                                                lineLimit(1),
                                            ]}
                                        >
                                            {eyebrowText}
                                        </Text>
                                        <Spacer />
                                    </HStack>
                                ) : null}

                                <Text
                                    modifiers={[
                                        font({ weight: 'bold', size: textLayout.fontSize, design: 'default' }),
                                        foregroundStyle('#2A1A11'),
                                        frame({ maxWidth: 9999 }),
                                        lineLimit(textLayout.lineLimit),
                                        lineSpacing(textLayout.lineSpacing),
                                        multilineTextAlignment('center'),
                                        allowsTightening(true),
                                        truncationMode('tail'),
                                        padding({
                                            top: eyebrowText ? 2 : 10,
                                            horizontal: textLayout.horizontalPadding,
                                            bottom: showCountBadge ? textLayout.bottomOffset : 0,
                                        }),
                                    ]}
                                >
                                    {bodyText}
                                </Text>

                                <Spacer />
                            </VStack>

                            {showCountBadge ? (
                                <VStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                                    <Spacer />
                                    <HStack
                                        modifiers={[
                                            frame({ maxWidth: 9999 }),
                                            padding({ bottom: 4 }),
                                        ]}
                                    >
                                        <Spacer />
                                        {renderCountBadge(false)}
                                        <Spacer />
                                    </HStack>
                                </VStack>
                            ) : null}
                        </ZStack>
                    )
                ) : (
                    <VStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                        <Spacer />
                        {showCountBadge ? (
                            isLarge ? (
                                renderFooter(true)
                            ) : (
                                <HStack
                                    modifiers={[
                                        frame({ maxWidth: 9999 }),
                                        padding({ bottom: 6 }),
                                    ]}
                                >
                                    <Spacer />
                                    {renderCountBadge(true)}
                                    <Spacer />
                                </HStack>
                            )
                        ) : null}
                    </VStack>
                )}
            </VStack>
        </ZStack>
    );
};

type WidgetModule = {
    updateTimeline: (entries: Array<{ date: Date; props: { props: WidgetViewProps } }>) => void;
    updateSnapshot: (snapshot: { props: WidgetViewProps }) => void;
};

function createFallbackWidget(): WidgetModule {
    return {
        updateTimeline: () => undefined,
        updateSnapshot: () => undefined,
    };
}

function createPlatformWidget(): WidgetModule {
    if (Platform.OS !== 'ios') {
        return createFallbackWidget();
    }

    try {
        const { createWidget } = require('expo-widgets') as {
            createWidget: (name: string, component: typeof LocketWidget) => WidgetModule;
        };
        return createWidget('LocketWidget', LocketWidget);
    } catch (error) {
        console.warn('[LocketWidget] Falling back to no-op widget module:', error);
        return createFallbackWidget();
    }
}

const Widget = createPlatformWidget();

export default Widget;
