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

interface WidgetProps {
    noteType: 'text' | 'photo';
    text: string;
    locationName: string;
    date: string;
    noteCount: number;
    nearbyPlacesCount: number;
    backgroundImageUrl?: string; // Currently not supported natively by expo-widgets JS side
    backgroundImageBase64?: string;
    hasDoodle: boolean;
    doodleStrokesJson?: string | null;
    isIdleState: boolean;
    idleText: string;
    savedCountText: string;
    nearbyPlacesLabelText: string;
    memoryReminderText: string;
    accessorySaveMemoryText: string;
    accessoryAddFirstPlaceText: string;
    accessoryMemoryNearbyText: string;
    accessoryOpenAppText: string;
    accessoryAddLabelText: string;
    accessorySavedLabelText: string;
    accessoryNearLabelText: string;
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

function getTextLayout(isLarge: boolean, trimmedLength: number): WidgetTextLayout {
    if (isLarge) {
        if (trimmedLength <= 60) {
            return { fontSize: 27, lineLimit: 3, lineSpacing: 2.8, horizontalPadding: 30, bottomOffset: 0, topPadding: 28, alignment: 'leading' };
        }
        if (trimmedLength <= 120) {
            return { fontSize: 23, lineLimit: 4, lineSpacing: 2.2, horizontalPadding: 30, bottomOffset: 0, topPadding: 28, alignment: 'leading' };
        }
        return { fontSize: 21, lineLimit: 4, lineSpacing: 1.8, horizontalPadding: 28, bottomOffset: 0, topPadding: 26, alignment: 'leading' };
    }

    if (trimmedLength <= 28) {
        return { fontSize: 16.5, lineLimit: 4, lineSpacing: 1.8, horizontalPadding: 14, bottomOffset: 8, topPadding: 0, alignment: 'center' };
    }
    if (trimmedLength <= 64) {
        return { fontSize: 15, lineLimit: 4, lineSpacing: 1.3, horizontalPadding: 14, bottomOffset: 8, topPadding: 0, alignment: 'center' };
    }
    return { fontSize: 14, lineLimit: 4, lineSpacing: 1.1, horizontalPadding: 14, bottomOffset: 8, topPadding: 0, alignment: 'center' };
}

function getFallbackCountLabel(noteCount: number): string {
    return `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`;
}

const LocketWidget = (props: { props: WidgetProps }) => {
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
        family,
    } = props.props ?? {};

    const familyName = asString(family);
    const isLarge = familyName === 'systemLarge';
    const isAccessoryInline = familyName === 'accessoryInline';
    const isAccessoryCircular = familyName === 'accessoryCircular';
    const isAccessoryRectangular = familyName === 'accessoryRectangular';
    const safeText = truncate(asString(text), isLarge ? 140 : 72);
    const safeNoteCount = typeof noteCount === 'number' ? noteCount : 0;
    const safeNearbyPlacesCount = typeof nearbyPlacesCount === 'number' ? nearbyPlacesCount : 0;
    const countLabel = asString(savedCountText) || getFallbackCountLabel(safeNoteCount);
    const compactLocationName = asString(locationName).split(',')[0]?.trim() ?? '';
    const hasImage = Boolean(asString(backgroundImageUrl) || asString(backgroundImageBase64));
    const showIdle = safeNoteCount <= 0 || (isIdleState && !safeText && !hasImage);
    const isTextNote = !showIdle && !hasImage && safeText.length > 0;
    const isPhoto = !showIdle && hasImage;
    const bodyText = showIdle
        ? asString(idleText) || 'The right note will appear when you are nearby.'
        : safeText || asString(memoryReminderText) || 'A quiet reminder from here.';
    const eyebrowText = !showIdle ? asString(locationName) : '';
    const backgroundColors = isTextNote || showIdle
        ? ['#F5EFE8', '#ECE5DC']
        : ['#5A4D42', '#2F2926'];
    const usesTextSurface = isTextNote || showIdle || !hasImage;
    const compactPad = isLarge ? 18 : usesTextSurface ? 12 : 14;
    const showCountBadge = showIdle && safeNoteCount > 0;
    const textLayout = getTextLayout(isLarge, bodyText.trim().length);
    const footerIconName = usesTextSurface ? 'doc.text' : 'photo';
    const eyebrowColor = usesTextSurface ? '#6E5E4F' : '#FFF8F0';
    const nearbyLabelCount = Math.max(safeNearbyPlacesCount, showIdle ? 0 : 1);
    const nearbyPlacesLabel = asString(nearbyPlacesLabelText) || (nearbyLabelCount === 1 ? '1 place nearby' : `${nearbyLabelCount} places nearby`);
    const accessorySymbolName = safeNoteCount <= 0 ? 'plus.circle.fill' : showIdle ? 'bookmark.fill' : 'location.fill';
    const accessoryNoteExcerpt = bodyText.length <= (showIdle ? 26 : 32)
        ? bodyText
        : `${bodyText.slice(0, (showIdle ? 26 : 32) - 1)}…`;
    const accessoryTitle = safeNoteCount <= 0
        ? asString(accessorySaveMemoryText) || 'Save a memory'
        : compactLocationName || (showIdle ? countLabel : asString(accessoryMemoryNearbyText) || 'Memory nearby');
    const accessorySubtitle = safeNoteCount <= 0
        ? asString(accessoryAddFirstPlaceText) || 'Add your first place'
        : accessoryNoteExcerpt || (showIdle ? asString(accessoryOpenAppText) || 'Open Noto' : nearbyPlacesLabel);
    const accessoryInlineText = safeNoteCount <= 0
        ? asString(accessorySaveMemoryText) || 'Save a memory'
        : showIdle
            ? countLabel
            : compactLocationName
                ? `${asString(accessoryNearLabelText) || 'Near'} ${compactLocationName}`
                : asString(accessoryMemoryNearbyText) || 'Memory nearby';
    const accessoryCircularValue = safeNoteCount <= 0 ? '+' : showIdle ? `${safeNoteCount}` : `${nearbyLabelCount}`;
    const accessoryCircularCaption = safeNoteCount <= 0
        ? asString(accessoryAddLabelText) || 'Add'
        : showIdle
            ? asString(accessorySavedLabelText) || 'Saved'
            : asString(accessoryNearLabelText) || 'Near';

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
                padding({ horizontal: isLarge ? 12 : 10, vertical: isLarge ? 6 : 5 }),
            ]}
        >
            <Text
                modifiers={[
                    font({ weight: 'medium', size: isLarge ? 11 : 10, design: 'default' }),
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
                padding({ horizontal: 18, vertical: onDarkSurface ? 12 : 10 }),
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
                                        font({ weight: 'regular', size: textLayout.fontSize, design: 'serif' }),
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
                                        font({ weight: 'regular', size: textLayout.fontSize, design: 'serif' }),
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
    updateSnapshot: (snapshot: { props: WidgetProps }) => void;
};

function createFallbackWidget(): WidgetModule {
    return {
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
