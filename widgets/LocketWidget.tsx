import { HStack, Image, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
    background,
    containerRelativeFrame,
    cornerRadius,
    font,
    foregroundStyle,
    frame,
    lineLimit,
    lineSpacing,
    multilineTextAlignment,
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
    backgroundImageUrl?: string; // Currently not supported natively by expo-widgets JS side
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

    const isPhoto = text === '📸 Photo Memory' || text === '';
    const hasNote = noteCount > 0;

    // ─── Idle / Empty State ─────────────────────────────
    if (!hasNote || (isIdleState && !text && !locationName)) {
        return (
            <ZStack
                modifiers={[
                    containerRelativeFrame({ axes: 'both' }),
                ]}
            >
                <Rectangle
                    modifiers={[
                        foregroundStyle({
                            type: 'linearGradient',
                            colors: ['#2C2C2E', '#1A1A1C'],
                            startPoint: { x: 0, y: 0 },
                            endPoint: { x: 1, y: 1 }
                        })
                    ]}
                />

                <VStack modifiers={[padding({ all: 32 })]}>
                    <Spacer />

                    <Image systemName="sparkles" size={32} color="#FFCA28" />

                    <Spacer modifiers={[frame({ height: 16 })]} />

                    <Text
                        modifiers={[
                            font({ weight: 'semibold', size: 15 }),
                            foregroundStyle('#FFFFFF'),
                            multilineTextAlignment('center'),
                            lineSpacing(4),
                            padding({ horizontal: 16 })
                        ]}
                    >
                        {idleText || 'Ghi lại trước khi nàng giận nè💛'}
                    </Text>

                    <Spacer />
                </VStack>
            </ZStack>
        );
    }

    // ─── Active Memory State ────────────────────────────
    return (
        <ZStack
            modifiers={[
                containerRelativeFrame({ axes: 'both' }),
            ]}
        >
            {/* Premium Gradient Background */}
            <Rectangle
                modifiers={[
                    foregroundStyle({
                        type: 'linearGradient',
                        colors: isPhoto ? ['#1A1A1C', '#000000'] : ['#FFD54F', '#FFB300'],
                        startPoint: { x: 0, y: 0 },
                        endPoint: { x: 0, y: 1 }
                    })
                ]}
            />

            {/* Content layer */}
            <VStack
                modifiers={[
                    padding({ all: 16 }),
                    frame({ maxWidth: 9999, maxHeight: 9999 }),
                ]}
            >
                {/* Header: Cute badge */}
                {locationName ? (
                    <HStack>
                        <Spacer />
                        <HStack
                            modifiers={[
                                padding({ horizontal: 12, vertical: 6 }),
                                background(isPhoto ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                                cornerRadius(14),
                            ]}
                        >
                            <Text
                                modifiers={[
                                    font({ weight: 'medium', size: 12 }),
                                    foregroundStyle(isPhoto ? '#FFFFFF' : '#000000'),
                                    lineLimit(1),
                                ]}
                            >
                                ✨ {isPhoto ? "Ngắm ảnh đỡ nhớ 💛" : "Dành cho em 💛"}
                            </Text>
                        </HStack>
                        <Spacer />
                    </HStack>
                ) : <Spacer />}

                <Spacer modifiers={[frame({ height: 12 })]} />

                {/* Main content */}
                {isPhoto ? (
                    <ZStack
                        modifiers={[
                            frame({ maxWidth: 9999, maxHeight: 9999 }),
                            cornerRadius(16),
                            background('rgba(0,0,0,0.2)'), // fallback placeholder
                        ]}
                    >
                        <VStack>
                            <Image systemName="photo.on.rectangle.angled" size={48} color="#FFFFFF" />
                            <Text
                                modifiers={[
                                    font({ weight: 'medium', size: 16 }),
                                    foregroundStyle('rgba(255,255,255,0.8)'),
                                    padding({ top: 12 }),
                                    shadow({ radius: 3, y: 1, color: 'rgba(0,0,0,0.5)' })
                                ]}
                            >
                                Ảnh Mới 💛
                            </Text>
                        </VStack>
                    </ZStack>
                ) : (
                    <HStack>
                        <Spacer />
                        <Text
                            modifiers={[
                                font({ weight: 'semibold', size: 22 }),
                                foregroundStyle('#1C1C1E'),
                                lineLimit(4),
                                lineSpacing(2),
                                multilineTextAlignment('center'),
                                shadow({ radius: 2, y: 1, color: 'rgba(0,0,0,0.1)' })
                            ]}
                        >
                            {text}
                        </Text>
                        <Spacer />
                    </HStack>
                )}

                <Spacer />
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
