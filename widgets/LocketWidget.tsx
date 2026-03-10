import { Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
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
    isIdleState: boolean;
    idleText: string;
    savedCountText: string;
    memoryReminderText: string;
    family?: string;
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
        noteCount,
        isIdleState,
        family,
    } = props.props ?? {};

    const isLarge = asString(family) === 'systemLarge';
    const safeText = truncate(asString(text), isLarge ? 140 : 72);
    const safeNoteCount = typeof noteCount === 'number' ? noteCount : 0;
    const isPhoto = safeText.length === 0;
    const showIdle = safeNoteCount <= 0 || (isIdleState && !safeText);
    const bodyText = showIdle ? 'Ảnh chả thương em?' : (isPhoto ? '📸 Nhớ tấm này nha' : safeText);
    const compactPad = isLarge ? 18 : 14;
    const bodyFontSize = isLarge ? 30 : 24;
    const backgroundColors = showIdle
        ? ['#FFF8F1', '#FEEBD9']
        : isPhoto
            ? ['#FFF8F1', '#FBE9D8']
            : ['#FFFCF7', '#FFF1E0'];

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
                <Spacer />

                <Text
                    modifiers={[
                        font({ weight: 'semibold', size: bodyFontSize }),
                        foregroundStyle('#2A1A11'),
                        frame({ maxWidth: 9999 }),
                        lineLimit(isLarge ? 3 : 2),
                        lineSpacing(2),
                        multilineTextAlignment('leading'),
                        padding({ horizontal: 2 }),
                    ]}
                >
                    {bodyText}
                </Text>
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
