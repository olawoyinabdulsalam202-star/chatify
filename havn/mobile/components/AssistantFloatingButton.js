import { Pressable, StyleSheet } from "react-native";
import Icon from "./Icon";

export default function AssistantFloatingButton({ visible, onPress }) {
  if (!visible) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Open Havn AI chat" onPress={onPress} style={styles.button}>
    <Icon name="bot" size={25} color="#FFF7ED" strokeWidth={2} />
  </Pressable>;
}

const styles = StyleSheet.create({ button: { position: "absolute", right: 18, bottom: 72, zIndex: 10, width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: "#C2410C", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", elevation: 7, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } } });
