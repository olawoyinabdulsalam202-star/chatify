import { useRef, useState } from "react";
import { Animated, StyleSheet, View, Vibration } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import Icon from "./Icon";

export default function SwipeReplyRow({ children, own, onReply, theme }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [showIcon, setShowIcon] = useState(false);
  const triggered = useRef(false);
  const revealAt = own ? -62 : 62;
  const onGestureEvent = Animated.event([{ nativeEvent: { translationX: translateX } }], {
    useNativeDriver: true,
    listener: ({ nativeEvent }) => {
      const crossed = own ? nativeEvent.translationX <= revealAt : nativeEvent.translationX >= revealAt;
      if (crossed !== triggered.current) {
        triggered.current = crossed;
        setShowIcon(crossed);
        if (crossed) Vibration.vibrate(10);
      }
    },
  });
  const onHandlerStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state !== State.END && nativeEvent.state !== State.CANCELLED && nativeEvent.state !== State.FAILED) return;
    if (triggered.current) onReply?.();
    triggered.current = false;
    setShowIcon(false);
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, stiffness: 260, damping: 22, mass: 0.7 }).start();
  };
  const direction = own ? { right: 12 } : { left: 12 };
  return <View style={styles.wrap}>
    {showIcon && <View pointerEvents="none" style={[styles.replyIcon, direction]}><Icon name="reply" size={18} color={theme.primary} /></View>}
    <PanGestureHandler activeOffsetX={own ? [-14, 0] : [0, 14]} failOffsetY={[-12, 12]} onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
      <Animated.View style={{ transform: [{ translateX }] }}>{children}</Animated.View>
    </PanGestureHandler>
  </View>;
}

const styles = StyleSheet.create({ wrap: { width: "100%", justifyContent: "center" }, replyIcon: { position: "absolute", top: "50%", width: 34, height: 34, marginTop: -17, borderRadius: 17, backgroundColor: "rgba(127,127,127,0.16)", alignItems: "center", justifyContent: "center" } });
