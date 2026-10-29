import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../lib/theme";

export default function ActionButton({ title, onPress, busy = false, disabled = false, secondary = false, style }) {
  const theme = useTheme();
  return (
    <Pressable disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [
      styles.button,
      { backgroundColor: secondary ? theme.surface : theme.primary, borderColor: secondary ? theme.border : theme.primary, opacity: pressed ? 0.82 : disabled || busy ? 0.58 : 1 },
      style,
    ]}>
      {busy ? <ActivityIndicator color={secondary ? theme.primary : theme.white} /> : <Text allowFontScaling style={[styles.label, { color: secondary ? theme.text : theme.white }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }, label: { fontSize: 16, fontWeight: "700", textAlign: "center" } });
