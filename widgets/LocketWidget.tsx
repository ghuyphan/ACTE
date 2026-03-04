import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
    background,
    containerRelativeFrame,
    cornerRadius,
    font,
    foregroundStyle,
    lineLimit,
    padding,
    shadow
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

interface WidgetProps {
    text: string;
    locationName: string;
    date: string;
    noteCount: number;
    nearbyPlacesCount: number;
    backgroundImageUrl?: string;
    isIdleState: boolean;
    idleText: string;
    savedCountText: string;
    memoryReminderText: string;
}

const LocketWidget = (props: { props: WidgetProps }) => {
    'widget';

    const {
        text, locationName, date, noteCount, nearbyPlacesCount,
        isIdleState, idleText, savedCountText, memoryReminderText,
    } = props.props ?? {};

    // Fallback detection (if text is empty, it's either idle or a photo in previous format)
    const isPhoto = text === '📸 Photo Memory' || text === '';
    const hasNote = noteCount > 0;

    // Idle / Empty State (Dark Premium Theme)
    if (!hasNote || (isIdleState && !text && !locationName)) {
        return (
            <VStack
                modifiers={[
                    containerRelativeFrame({ axes: 'both' }),
                    background('#1C1C1E'), // Native full-bleed background
                    cornerRadius(20),
                    padding({ all: 20 }),
                ]}
            >
                <Spacer />
                <Text
                    modifiers={[
                        font({ weight: 'heavy', size: 24 }),
                        foregroundStyle('#FFC107'), // Brand yellow
                    ]}
                >
                    ACTE 💛
                </Text>
                <Text
                    modifiers={[
                        font({ weight: 'medium', size: 14 }),
                        foregroundStyle('rgba(255,255,255,0.6)'),
                        padding({ top: 4 })
                    ]}
                >
                    {idleText || 'Note it down before she gets upset 💛'}
                </Text>
                <Spacer />
                <Text
                    modifiers={[
                        font({ weight: 'bold', size: 11 }),
                        foregroundStyle('rgba(255,255,255,0.3)'),
                    ]}
                >
                    {savedCountText || `${noteCount} notes saved`}
                </Text>
            </VStack>
        );
    }

    // Active Memory State (Rich Warm Theme)
    return (
        <VStack
            modifiers={[
                containerRelativeFrame({ axes: 'both' }),
                background('#FFC107'), // Native full-bleed background
                cornerRadius(20),
                padding({ all: 16 }),
            ]}
        >
            {/* Header: Location Pill */}
            {locationName ? (
                <HStack modifiers={[padding({ bottom: 8 })]}>
                    <Text
                        modifiers={[
                            font({ weight: 'bold', size: 12 }),
                            foregroundStyle('#FFFFFF'),
                            background('rgba(0,0,0,0.25)'), // Translucent pill style
                            cornerRadius(12),
                            padding({ horizontal: 8, vertical: 4 }),
                            lineLimit(1),
                        ]}
                    >
                        📍 {locationName}{nearbyPlacesCount > 0 ? ` (+${nearbyPlacesCount})` : ''}
                    </Text>
                    <Spacer />
                </HStack>
            ) : <Spacer />}

            <Spacer />

            {/* Main Content */}
            {isPhoto ? (
                <Text
                    modifiers={[
                        font({ weight: 'heavy', size: 20 }),
                        foregroundStyle('#1C1C1E'),
                        shadow({ radius: 1, color: 'rgba(255,255,255,0.4)', x: 0, y: 1 }) // Letterpress effect
                    ]}
                >
                    📸 Nhấn để xem ảnh nè
                </Text>
            ) : (
                <Text
                    modifiers={[
                        font({ weight: 'heavy', size: 20 }),
                        foregroundStyle('#1C1C1E'),
                        lineLimit(3),
                        shadow({ radius: 1, color: 'rgba(255,255,255,0.4)', x: 0, y: 1 })
                    ]}
                >
                    {text}
                </Text>
            )}

            <Spacer />

            {/* Footer: Date & Metadata */}
            <Text
                modifiers={[
                    font({ weight: 'bold', size: 13 }),
                    foregroundStyle('rgba(0,0,0,0.5)'),
                ]}
            >
                {isIdleState ? (memoryReminderText || 'A memory reminds you 💛') : date}
                {!isIdleState && noteCount > 1 ? ` • ${savedCountText || `${noteCount} notes`}` : ''}
            </Text>
        </VStack>
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
