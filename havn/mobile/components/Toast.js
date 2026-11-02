import { useEffect, useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import { useTheme } from "../lib/theme";
import { dismissToast, useToastState } from "../lib/toast";

export default function Toast() {
  const item = useToastState();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const offset = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!item) return;
    offset.setValue(-24); opacity.setValue(0);
    Animated.parallel([Animated.spring(offset, { toValue: 0, useNativeDriver: true, damping: 18 }), Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true })]).start();
  }, [item?.id]);
  const pan = useRef(PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8, onPanResponderRelease: (_, gesture) => { if (Math.abs(gesture.dx) > 45 || Math.abs(gesture.dy) > 35) dismissToast(); } })).current;
  if (!item) return null;
  const color = item.type === "error" ? theme.danger : item.type === "success" ? theme.success : theme.primary;
  const icon = item.type === "error" ? "close" : item.type === "success" ? "check" : "info";
  return <Animated.View {...pan.panHandlers} style={[styles.wrap, { top: insets.top + 10, opacity, transform: [{ translateY: offset }] }]}><View style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }]}><Icon name={icon} size={18} color={color} /><Text numberOfLines={3} style={[styles.text, { color: theme.text, fontFamily: theme.fontFamily }]}>{item.message}</Text></View></Animated.View>;
}

const styles = StyleSheet.create({ wrap: { position: "absolute", left: 15, right: 15, zIndex: 1000, alignItems: "center" }, pill: { maxWidth: 500, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, elevation: 8 }, text: { flexShrink: 1, fontSize: 14, fontWeight: "600" } });
