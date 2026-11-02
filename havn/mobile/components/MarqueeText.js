import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export default function MarqueeText({ children, style, speed = 34, pause = 850 }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const animation = useRef(null);
  const distance = Math.max(0, textWidth - containerWidth);
  useEffect(() => {
    animation.current?.stop();
    translateX.setValue(0);
    if (distance <= 1) return undefined;
    const forward = Animated.timing(translateX, { toValue: -distance, duration: (distance / speed) * 1000, easing: Easing.linear, useNativeDriver: true });
    const reverse = Animated.timing(translateX, { toValue: 0, duration: (distance / speed) * 1000, easing: Easing.linear, useNativeDriver: true });
    animation.current = Animated.loop(Animated.sequence([Animated.delay(pause), forward, Animated.delay(pause), reverse]));
    animation.current.start();
    return () => animation.current?.stop();
  }, [distance, speed, pause, translateX, children]);
  return <View onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)} style={styles.clip}><Animated.View style={{ alignSelf: "flex-start", transform: [{ translateX }] }}><Text allowFontScaling onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)} numberOfLines={1} style={[style, styles.text]}>{children}</Text></Animated.View></View>;
}

const styles = StyleSheet.create({ clip: { flex: 1, minWidth: 0, overflow: "hidden" }, text: { flexShrink: 0 } });
