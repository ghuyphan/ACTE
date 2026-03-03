import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, containerRelativeFrame, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

const LocketWidget = () => {
    'widget';

    return (
        <VStack modifiers={[background('#FF0000'), containerRelativeFrame({ axes: 'both' })]}>
            <Spacer />
            <Text modifiers={[font({ weight: 'bold', size: 24 }), foregroundStyle('#FFFFFF')]}>
                HELLO EXPO 2
            </Text>
            <Spacer />
        </VStack>
    );
};

const Widget = createWidget('LocketWidget', LocketWidget);

export default Widget;

Widget.updateSnapshot({});
