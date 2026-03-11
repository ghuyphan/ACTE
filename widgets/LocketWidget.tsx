import { HStack, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
    backgroundOverlay,
    cornerRadius,
    font,
    foregroundStyle,
    frame,
    lineLimit,
    lineSpacing,
    multilineTextAlignment,
    padding
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

interface WidgetProps {
    text: string;
    locationName: string;
    date: string;
    noteCount: number;
    nearbyPlacesCount: number;
    backgroundImageUrl?: string; // Currently not supported natively by expo-widgets JS side
    backgroundImageBase64?: string;
    isIdleState: boolean;
    idleText: string;
    savedCountText: string;
    memoryReminderText: string;
    family?: string;
}

interface WidgetTextLayout {
    fontSize: number;
    lineLimit: number;
    lineSpacing: number;
    horizontalPadding: number;
    bottomOffset: number;
}

function getTextLayout(isLarge: boolean, trimmedLength: number): WidgetTextLayout {
    if (isLarge) {
        if (trimmedLength <= 60) {
            return { fontSize: 28, lineLimit: 3, lineSpacing: 2.4, horizontalPadding: 46, bottomOffset: 20 };
        }
        if (trimmedLength <= 120) {
            return { fontSize: 24, lineLimit: 4, lineSpacing: 2, horizontalPadding: 42, bottomOffset: 20 };
        }
        return { fontSize: 22, lineLimit: 4, lineSpacing: 1.6, horizontalPadding: 38, bottomOffset: 20 };
    }

    if (trimmedLength <= 28) {
        return { fontSize: 18, lineLimit: 2, lineSpacing: 2, horizontalPadding: 20, bottomOffset: 10 };
    }
    if (trimmedLength <= 64) {
        return { fontSize: 16, lineLimit: 3, lineSpacing: 1.6, horizontalPadding: 18, bottomOffset: 10 };
    }
    return { fontSize: 15, lineLimit: 3, lineSpacing: 1.2, horizontalPadding: 16, bottomOffset: 10 };
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
        backgroundImageUrl,
        backgroundImageBase64,
        noteCount,
        savedCountText,
        isIdleState,
        family,
    } = props.props ?? {};

    const isLarge = asString(family) === 'systemLarge';
    const safeText = truncate(asString(text), isLarge ? 140 : 72);
    const safeNoteCount = typeof noteCount === 'number' ? noteCount : 0;
    const countLabel = asString(savedCountText) || getFallbackCountLabel(safeNoteCount);
    const hasImage = Boolean(asString(backgroundImageUrl) || asString(backgroundImageBase64));
    const showIdle = safeNoteCount <= 0 || (isIdleState && !safeText && !hasImage);
    const isTextNote = !showIdle && !hasImage && safeText.length > 0;
    const isPhoto = !showIdle && hasImage;
    const bodyText = showIdle ? 'Ảnh chả thương em?' : (isPhoto ? '📸 Nhớ tấm này nha' : safeText);
    const compactPad = isLarge ? 18 : 14;
    const backgroundColors = isTextNote || showIdle
        ? ['#F5EFE8', '#ECE5DC']
        : ['#5A4D42', '#2F2926'];
    const usesTextSurface = isTextNote || showIdle;
    const showCountBadge = !showIdle && safeNoteCount > 0;
    const textLayout = getTextLayout(isLarge, bodyText.trim().length);

    const renderCountBadge = (onDarkSurface: boolean) => (
        <HStack
            modifiers={[
                backgroundOverlay({ color: onDarkSurface ? 'rgba(255,248,240,0.20)' : 'rgba(255,249,243,0.82)' }),
                cornerRadius(999),
                padding({ horizontal: isLarge ? 12 : 10, vertical: isLarge ? 6 : 5 }),
            ]}
        >
            <Text
                modifiers={[
                    font({ weight: 'medium', size: isLarge ? 11 : 10 }),
                    foregroundStyle(onDarkSurface ? '#FFF8F0' : '#6E5E4F'),
                ]}
            >
                {countLabel}
            </Text>
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
                    <ZStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                        <VStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                            <Spacer />

                            <Text
                                modifiers={[
                                    font({ weight: 'medium', size: textLayout.fontSize }),
                                    foregroundStyle('#2A1A11'),
                                    frame({ maxWidth: 9999 }),
                                    lineLimit(textLayout.lineLimit),
                                    lineSpacing(textLayout.lineSpacing),
                                    multilineTextAlignment('center'),
                                    padding({
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
                                {isLarge ? (
                                    <HStack
                                        modifiers={[
                                            frame({ maxWidth: 9999 }),
                                            backgroundOverlay({ color: 'rgba(255,249,243,0.24)' }),
                                            padding({ horizontal: 18, vertical: 10 }),
                                        ]}
                                    >
                                        <Spacer />
                                        {renderCountBadge(false)}
                                        <Spacer />
                                    </HStack>
                                ) : (
                                    <HStack
                                        modifiers={[
                                            frame({ maxWidth: 9999 }),
                                            padding({ bottom: 6 }),
                                        ]}
                                    >
                                        <Spacer />
                                        {renderCountBadge(false)}
                                        <Spacer />
                                    </HStack>
                                )}
                            </VStack>
                        ) : null}
                    </ZStack>
                ) : (
                    <ZStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                        {showCountBadge ? (
                            <VStack modifiers={[frame({ maxWidth: 9999, maxHeight: 9999 })]}>
                                <Spacer />
                                {isLarge ? (
                                    <HStack
                                        modifiers={[
                                            frame({ maxWidth: 9999 }),
                                            backgroundOverlay({ color: 'rgba(16,12,10,0.26)' }),
                                            padding({ horizontal: 18, vertical: 12 }),
                                        ]}
                                    >
                                        <Spacer />
                                        {renderCountBadge(true)}
                                        <Spacer />
                                    </HStack>
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
                                )}
                            </VStack>
                        ) : null}
                    </ZStack>
                )}
            </VStack>
        </ZStack>
    );
};

const Widget = createWidget('LocketWidget', LocketWidget);

export default Widget;

Widget.updateSnapshot({
    props: {
        text: '',
        locationName: '',
        date: '',
        noteCount: 0,
        nearbyPlacesCount: 0,
        isIdleState: true,
        idleText: '',
        savedCountText: '',
        memoryReminderText: '',
    },
});
