import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import StoryVideoTrimEditor from "./StoryVideoTrimEditor";
import { uploadImage, uploadVideo, getTransformedVideoUrl, waitForVideoTransform } from "../lib/upload";
import { useTheme } from "../lib/theme";
import { useStoryStore } from "../stores/useStoryStore";

const COLORS = ["#C2410C", "#B45309", "#166534", "#155E75", "#7C2D4A", "#292524"];
const MAX_VIDEO_MB = 15;
const MAX_SOURCE_VIDEO_MB = 100;

export default function CreateStorySheet({ visible, onClose }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [media, setMedia] = useState(null);
  const [posting, setPosting] = useState(false);
  const [preparingVideo, setPreparingVideo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [trimmedDuration, setTrimmedDuration] = useState(0);
  const [videoSource, setVideoSource] = useState(null);
  const [trimOpen, setTrimOpen] = useState(false);
  const [videoClip, setVideoClip] = useState(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");
  const [reduceQuality, setReduceQuality] = useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: mode === "video" ? ["videos"] : ["images"], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (mode === "video") {
      let source = asset;
      try {
        const size = Number(asset.fileSize || new File(asset.uri).size || 0);
        source = { ...asset, fileSize: size };
      } catch {}
      if (source.fileSize > MAX_SOURCE_VIDEO_MB * 1024 * 1024) {
        setError("Choose a video smaller than 100MB.");
        return;
      }
      setVideoSource(source);
      setMedia(null);
      setVideoClip(null);
      setUploadedVideoUrl("");
      setReduceQuality(false);
      setTrimOpen(true);
      setError("");
      return;
    }
    setMedia(asset);
    setError("");
  };

  const previewVideo = async () => {
    try {
      const file = new File(media.uri);
      if (await File.canPreview(file)) await File.preview(file);
      else setError("This video cannot be previewed on this device.");
    } catch { setError("Could not preview this video."); }
  };

  const trimAgain = () => {
    if (!videoSource) return;
    setError("");
    setTrimOpen(true);
  };

  const useTrimmedVideo = (clip) => {
    setMedia(videoSource);
    setVideoClip(clip);
    setTrimmedDuration(clip.endTime - clip.startTime);
    setReduceQuality(clip.lowQuality);
    setTrimOpen(false);
    setError("");
  };

  const post = async () => {
    const caption = text.trim();
    if (mode === "text" ? !caption : !media) return;
    setPosting(true);
    setError("");
    setProgress(0);
    try {
      let payload;
      if (mode === "text") payload = { text: caption, backgroundColor: color };
      else if (mode === "video") {
        const estimate = Number(videoClip?.estimatedBytes || 0) * (!videoClip?.lowQuality && reduceQuality ? 0.64 : 1);
        if (estimate > MAX_VIDEO_MB * 1024 * 1024 && !reduceQuality) {
          setError("This clip may exceed 15MB. Shorten it or lower the quality.");
          return;
        }
        let originalUrl = uploadedVideoUrl;
        if (!originalUrl) {
          originalUrl = await uploadVideo(media, setProgress, { ...videoClip, lowQuality: reduceQuality });
          setUploadedVideoUrl(originalUrl);
        }
        const videoUrl = getTransformedVideoUrl(originalUrl, { ...videoClip, lowQuality: reduceQuality });
        setPreparingVideo(true);
        const actualSize = await waitForVideoTransform(videoUrl);
        setPreparingVideo(false);
        if (actualSize && actualSize > MAX_VIDEO_MB * 1024 * 1024) {
          setError(reduceQuality ? "The trimmed video is still over 15MB. Shorten the clip and try again." : "The trimmed video is still over 15MB. Choose Reduce quality or shorten the clip.");
          return;
        }
        payload = { video: videoUrl, text: caption };
      }
      else {
        const url = await uploadImage(media, setProgress);
        payload = { image: url, text: caption };
      }
      await useStoryStore.getState().create(payload);
      setText("");
      setMedia(null);
      setVideoSource(null);
      setVideoClip(null);
      setUploadedVideoUrl("");
      setTrimOpen(false);
      onClose();
    } catch (uploadError) { setError(uploadError.message || "Could not post this status."); }
    finally { setPreparingVideo(false); setPosting(false); }
  };

  const canPost = mode === "text" ? !!text.trim() : !!media;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" statusBarTranslucent>
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {trimOpen && videoSource ? <StoryVideoTrimEditor asset={videoSource} theme={theme} initialLowQuality={reduceQuality} onCancel={() => setTrimOpen(false)} onComplete={useTrimmedVideo} /> : <>
      <View style={[styles.header, { borderBottomColor: theme.border }]}><Pressable accessibilityLabel="Close" onPress={onClose} style={styles.headerButton}><Icon name="close" color={theme.text} /></Pressable><Text allowFontScaling style={[styles.headerTitle, { color: theme.text }]}>Create story</Text><View style={styles.headerButton} /></View>
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>{[["text", "Text", "info"], ["image", "Image", "image"], ["video", "Video", "camera"]].map(([key, label, icon]) => <Pressable key={key} onPress={() => { setMode(key); setError(""); }} style={[styles.tab, { borderBottomColor: mode === key ? theme.primary : "transparent" }]}><Icon name={icon} size={17} color={mode === key ? theme.primary : theme.muted} /><Text style={{ color: mode === key ? theme.primary : theme.muted, fontWeight: "600" }}>{label}</Text></Pressable>)}</View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(18, insets.bottom + 10) }]} keyboardShouldPersistTaps="handled">
        {mode === "text" ? <>
          <View style={[styles.textCard, { backgroundColor: color }]}><TextInput allowFontScaling value={text} onChangeText={(value) => setText(value.slice(0, 300))} maxLength={300} multiline placeholder="Type a status…" placeholderTextColor="rgba(255,255,255,0.65)" textAlign="center" style={styles.storyInput} /></View>
          <View style={styles.colors}>{COLORS.map((item) => <Pressable accessibilityLabel={"Choose " + item} key={item} onPress={() => setColor(item)} style={[styles.color, { backgroundColor: item, borderColor: color === item ? theme.text : "transparent" }]} />)}</View>
          <Text style={{ color: theme.muted, textAlign: "right", marginTop: 8 }}>{text.length}/300</Text>
        </> : <>
          {media ? <View style={[styles.preview, { backgroundColor: "#171411" }]}>
            {mode === "image" ? <Image source={{ uri: media.uri }} contentFit="contain" style={StyleSheet.absoluteFill} /> : <Pressable onPress={previewVideo} accessibilityLabel="Preview trimmed video" style={styles.videoPreview}><Icon name="play" color="#FFFFFF" size={46} /><Text style={styles.videoName} numberOfLines={2}>{media.fileName || "Trimmed video"}</Text><Text style={styles.videoNote}>Tap to preview the selected clip</Text></Pressable>}
            <Pressable accessibilityLabel="Change media" onPress={pick} style={styles.change}><Text style={styles.changeText}>Change</Text></Pressable>
          </View> : <Pressable onPress={pick} style={[styles.pickBox, { borderColor: theme.border, backgroundColor: theme.surface }]}><Icon name={mode === "video" ? "camera" : "image"} color={theme.primary} size={30} /><Text style={{ color: theme.text, fontWeight: "600", marginTop: 9 }}>Choose {mode === "video" ? "a video" : "a photo"}</Text>{mode === "video" && <Text style={{ color: theme.muted, marginTop: 4 }}>Videos can be trimmed to 30 seconds</Text>}</Pressable>}
          {mode === "video" && !!media && <View style={styles.trimInfo}><Text style={{ color: theme.text, fontWeight: "700" }}>{formatDuration(trimmedDuration)} · about {formatSize(Number(videoClip?.estimatedBytes || 0) * (!videoClip?.lowQuality && reduceQuality ? 0.64 : 1))}{reduceQuality ? " (480p)" : ""}</Text><Pressable onPress={trimAgain} style={[styles.trimButton, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: "700" }}>Edit clip</Text></Pressable></View>}
          {mode === "video" && !!media && !!error && !posting && <Pressable onPress={() => setReduceQuality(true)} style={[styles.trimButton, { borderColor: theme.border, alignSelf: "flex-start", marginTop: 10 }]}><Text style={{ color: theme.primary, fontWeight: "700" }}>{reduceQuality ? "Quality reduced" : "Reduce quality (480p)"}</Text></Pressable>}
          {!!media && <><TextInput allowFontScaling value={text} onChangeText={(value) => setText(value.slice(0, 300))} maxLength={300} placeholder="Add a caption…" placeholderTextColor={theme.muted} style={[styles.caption, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /><Text style={{ color: theme.muted, textAlign: "right", marginTop: 6 }}>{text.length}/300</Text></>}
        </>}
        {!!error && <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text>}
        {posting && mode !== "text" && <View style={[styles.progressTrack, { backgroundColor: theme.border }]}><View style={[styles.progressFill, { backgroundColor: theme.primary, width: Math.max(4, Math.round(progress * 100)) + "%" }]} /></View>}
        <Pressable accessibilityRole="button" disabled={!canPost || posting} onPress={post} style={[styles.post, { backgroundColor: theme.primary, opacity: !canPost || posting ? 0.45 : 1 }]}>{posting ? <><ActivityIndicator color="#FFFFFF" /><Text style={styles.postText}>{mode === "text" ? "Posting…" : preparingVideo ? "Preparing video…" : "Uploading " + Math.round(progress * 100) + "%"}</Text></> : <Text style={styles.postText}>Post story</Text>}</Pressable>
      </ScrollView>
      </>}
    </KeyboardAvoidingView>
  </Modal>;
}

function formatDuration(milliseconds) {
  const seconds = Math.floor((milliseconds || 0) / 1000);
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function formatSize(bytes) {
  const megabytes = bytes / (1024 * 1024);
  return (megabytes < 1 ? megabytes.toFixed(1) : Math.round(megabytes)) + " MB";
}

const styles = StyleSheet.create({ screen: { flex: 1 }, header: { minHeight: 54, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth }, headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerTitle: { fontSize: 18, fontWeight: "700" }, tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth }, tab: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", gap: 5, flexDirection: "row", borderBottomWidth: 2 }, content: { padding: 18 }, textCard: { width: "100%", aspectRatio: 9 / 12, maxHeight: 560, alignSelf: "center", borderRadius: 18, justifyContent: "center", padding: 22 }, storyInput: { minHeight: 110, color: "#FFFFFF", fontSize: 24, fontWeight: "600", textAlignVertical: "center" }, colors: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 18 }, color: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 }, pickBox: { width: "100%", aspectRatio: 9 / 12, maxHeight: 560, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }, preview: { width: "100%", aspectRatio: 9 / 12, maxHeight: 560, borderRadius: 18, overflow: "hidden", alignSelf: "center" }, videoPreview: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, gap: 10 }, videoName: { color: "#FFFFFF", fontWeight: "600", textAlign: "center" }, videoNote: { color: "#FFFFFFAA", fontSize: 12 }, trimInfo: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, trimButton: { minHeight: 38, borderWidth: 1, borderRadius: 11, justifyContent: "center", paddingHorizontal: 11 }, change: { position: "absolute", right: 12, top: 12, backgroundColor: "#0009", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 }, changeText: { color: "#FFFFFF", fontWeight: "600" }, caption: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginTop: 14 }, error: { marginTop: 12, fontSize: 13, lineHeight: 19 }, progressTrack: { height: 4, borderRadius: 4, overflow: "hidden", marginTop: 12 }, progressFill: { height: "100%" }, post: { minHeight: 48, borderRadius: 14, marginTop: 18, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center" }, postText: { color: "#FFFFFF", fontWeight: "700" } });
