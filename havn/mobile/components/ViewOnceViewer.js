import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import Icon from "./Icon";

function VideoContent({ uri }) {
  const player = useVideoPlayer(uri, (instance) => { instance.play(); });
  return <VideoView player={player} style={styles.media} contentFit="contain" nativeControls />;
}

export default function ViewOnceViewer({ visible, media, theme, onClose }) {
  useEffect(() => {
    if (!visible || media?.videoUrl) return undefined;
    const timeout = setTimeout(onClose, 15_000);
    return () => clearTimeout(timeout);
  }, [visible, media?.videoUrl, onClose]);
  return <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.screen}>
      <Pressable accessibilityLabel="Close view-once media" onPress={onClose} style={styles.close}><Icon name="close" color="#FFFFFF" size={23} /></Pressable>
      {media?.videoUrl ? <VideoContent uri={media.videoUrl} /> : media?.imageUrl ? <Image source={{ uri: media.imageUrl }} contentFit="contain" style={styles.media} /> : null}
      <Text style={styles.notice}>This {media?.videoUrl ? "video" : "photo"} can only be opened once.</Text>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }, media: { width: "100%", height: "80%" }, close: { position: "absolute", zIndex: 1, right: 16, top: 45, width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "rgba(0,0,0,0.55)" }, notice: { position: "absolute", bottom: 32, color: "#FFFFFF", opacity: 0.7, fontSize: 12 } });
