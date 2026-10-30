import { useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { PinchGestureHandler, State } from "react-native-gesture-handler";
import { Image } from "expo-image";
import Icon from "./Icon";

export default function PhotoViewer({ uri, onClose }) {
  const pinch = useRef(new Animated.Value(1)).current;
  const base = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(pinch, base);
  const onGestureEvent = Animated.event([{ nativeEvent: { scale: pinch } }], { useNativeDriver: true });
  const onStateChange = ({ nativeEvent }) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      base.setValue(Math.max(1, Math.min(5, base.__getValue() * (nativeEvent.scale || 1))));
      pinch.setValue(1);
    }
  };
  return <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.viewer}><Pressable onPress={onClose} accessibilityLabel="Close image" style={styles.close}><Icon name="close" color="#FFFFFF" size={26} /></Pressable>
      {!!uri && <PinchGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onStateChange}><Animated.View style={[styles.imageWrap, { transform: [{ scale }] }]}><Image source={{ uri }} contentFit="contain" style={styles.image} /></Animated.View></PinchGestureHandler>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({ viewer: { flex: 1, backgroundColor: "#000000", justifyContent: "center", alignItems: "center", overflow: "hidden" }, imageWrap: { width: "100%", height: "100%" }, image: { width: "100%", height: "100%" }, close: { position: "absolute", zIndex: 2, right: 16, top: 42, width: 48, height: 48, alignItems: "center", justifyContent: "center" } });
