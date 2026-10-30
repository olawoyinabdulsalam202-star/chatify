import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";

const MAX_DURATION = 30_000;
const MIN_DURATION = 100;
const MAX_SOURCE_SIZE = 100 * 1024 * 1024;
const MAX_RESULT_SIZE = 15 * 1024 * 1024;

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function formatSize(bytes) {
  const megabytes = bytes / (1024 * 1024);
  return (megabytes < 1 ? megabytes.toFixed(1) : Math.round(megabytes)) + " MB";
}

function TrimHandle({ side, time, duration, width, color, onChange }) {
  const origin = useRef(time);
  const values = useRef({ time, duration, width, onChange });
  values.current = { time, duration, width, onChange };
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { origin.current = values.current.time; },
    onPanResponderMove: (_, gesture) => {
      const current = values.current;
      if (current.width <= 0) return;
      current.onChange(Math.round(origin.current + gesture.dx / current.width * current.duration));
    },
  }), []);
  const left = width > 0 && duration > 0 ? width * time / duration + (side === "start" ? 0 : -22) : 0;
  return <View {...responder.panHandlers} style={[styles.handle, { left, borderColor: color }]}><View style={[styles.handleLine, { backgroundColor: color }]} /></View>;
}

export default function StoryVideoTrimEditor({ asset, theme, initialLowQuality = false, onCancel, onComplete }) {
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useState(Math.max(0, Number(asset.duration) || 0));
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(() => Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(asset.duration) || MAX_DURATION)));
  const [width, setWidth] = useState(0);
  const [frames, setFrames] = useState([]);
  const [muted, setMuted] = useState(false);
  const [lowQuality, setLowQuality] = useState(initialLowQuality);
  const startRef = useRef(start);
  const endRef = useRef(end);
  const player = useVideoPlayer(asset.uri, (instance) => {
    instance.loop = true;
    instance.timeUpdateEventInterval = 0.2;
    instance.play();
  });

  useEffect(() => { startRef.current = start; endRef.current = end; }, [start, end]);
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    if (duration > 0) return undefined;
    const subscription = player.addListener("statusChange", () => {
      if (player.duration > 0) setDuration(Math.round(player.duration * 1000));
    });
    return () => subscription.remove();
  }, [duration, player]);
  useEffect(() => {
    const subscription = player.addListener("timeUpdate", ({ currentTime }) => {
      if (currentTime * 1000 >= endRef.current) {
        player.currentTime = startRef.current / 1000;
        player.play();
      }
    });
    return () => subscription.remove();
  }, [player]);
  useEffect(() => {
    if (!duration) return undefined;
    let active = true;
    Promise.allSettled(Array.from({ length: 10 }, (_, index) => {
      const time = Math.min(duration - 1, Math.floor(duration * index / 10));
      return VideoThumbnails.getThumbnailAsync(asset.uri, { time, quality: 0.45 });
    })).then((results) => {
      if (active) setFrames(results.filter((result) => result.status === "fulfilled").map((result) => result.value));
    });
    setEnd(Math.min(MAX_DURATION, duration));
    return () => { active = false; };
  }, [asset.uri, duration]);
  useEffect(() => {
    if (!duration) return;
    player.currentTime = start / 1000;
    player.play();
  }, [duration, start, player]);

  const setStartBound = (nextValue) => {
    const minDuration = Math.min(MIN_DURATION, duration);
    const next = Math.max(0, Math.min(nextValue, endRef.current - minDuration));
    const adjustedEnd = Math.min(endRef.current, next + MAX_DURATION);
    startRef.current = next;
    endRef.current = adjustedEnd;
    setStart(next);
    setEnd(adjustedEnd);
  };
  const setEndBound = (nextValue) => {
    const minDuration = Math.min(MIN_DURATION, duration);
    const next = Math.max(startRef.current + minDuration, Math.min(nextValue, duration, startRef.current + MAX_DURATION));
    endRef.current = next;
    setEnd(next);
  };

  const selectionDuration = Math.max(0, end - start);
  const sourceWidth = Number(asset.width || 720);
  const outputWidth = lowQuality ? 480 : 720;
  const estimatedBytes = duration > 0 ? Number(asset.fileSize || 0) * selectionDuration / duration * Math.min(1, (outputWidth / sourceWidth) ** 2) * (lowQuality ? 0.32 : 0.5) : 0;
  const sourceTooLarge = Number(asset.fileSize || 0) > MAX_SOURCE_SIZE;
  const startLeft = duration ? width * start / duration : 0;
  const selectionWidth = duration ? width * selectionDuration / duration : width;

  return <View style={[styles.container, { backgroundColor: theme.background }]}>
    <View style={styles.topBar}><Pressable accessibilityLabel="Cancel video trim" onPress={onCancel} style={styles.iconButton}><Icon name="close" color={theme.text} /></Pressable><Text style={[styles.title, { color: theme.text }]}>Trim status</Text><Pressable accessibilityRole="button" accessibilityLabel={muted ? "Unmute video" : "Mute video"} onPress={() => setMuted((value) => !value)} style={[styles.mute, { borderColor: theme.border, backgroundColor: theme.surface }]}><Icon name={muted ? "soundOff" : "sound"} color={theme.text} size={19} /><Text style={{ color: theme.text, fontSize: 12 }}>{muted ? "Muted" : "Mute"}</Text></Pressable></View>
    <VideoView player={player} style={styles.player} contentFit="contain" nativeControls />
    <View style={styles.rangeLabels}><Text style={{ color: theme.text, fontWeight: "700" }}>{formatTime(start)} – {formatTime(end)}</Text><Text style={{ color: theme.muted }}>{formatTime(selectionDuration)} max 0:30</Text></View>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.timeline, { backgroundColor: theme.elevated }]}>
      <View style={styles.frames}>{Array.from({ length: 10 }, (_, index) => frames[index] ? <Image key={String(frames[index].uri || index)} source={{ uri: frames[index].uri }} contentFit="cover" style={styles.frame} /> : <View key={String(index)} style={[styles.frame, styles.emptyFrame]} />)}</View>
      <View pointerEvents="none" style={[styles.selection, { left: startLeft, width: selectionWidth, borderColor: theme.primary }]} />
      <TrimHandle side="start" time={start} duration={duration} width={width} color={theme.primary} onChange={setStartBound} />
      <TrimHandle side="end" time={end} duration={duration} width={width} color={theme.primary} onChange={setEndBound} />
    </View>
    <Text style={{ color: theme.muted, textAlign: "center", marginTop: 16 }}>{formatTime(selectionDuration)} - about {estimatedBytes ? formatSize(estimatedBytes) : "size unavailable"} · {outputWidth}p</Text>
    {estimatedBytes > MAX_RESULT_SIZE && <View style={styles.qualityBox}><Text style={{ color: theme.text, flex: 1, fontSize: 13 }}>This clip may exceed 15MB. Shorten it or lower the quality.</Text>{!lowQuality && <Pressable onPress={() => setLowQuality(true)} style={[styles.qualityButton, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: "700" }}>Reduce quality</Text></Pressable>}</View>}
    {sourceTooLarge && <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>Choose a video smaller than 100MB.</Text>}
    <View style={[styles.footer, { paddingBottom: Math.max(8, insets.bottom) }]}><Pressable onPress={onCancel} style={[styles.cancel, { borderColor: theme.border }]}><Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text></Pressable><Pressable disabled={!duration || sourceTooLarge || selectionDuration > MAX_DURATION || selectionDuration < Math.min(MIN_DURATION, duration)} onPress={() => { player.pause(); onComplete({ startTime: start, endTime: end, muted, lowQuality, estimatedBytes }); }} style={[styles.useClip, { backgroundColor: theme.primary, opacity: !duration || sourceTooLarge ? 0.5 : 1 }]}><Text style={styles.useText}>Use clip</Text></Pressable></View>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 16 }, topBar: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, title: { fontSize: 17, fontWeight: "700" }, mute: { minHeight: 40, paddingHorizontal: 10, borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 5 }, player: { width: "100%", flex: 1, minHeight: 180, maxHeight: "62%", backgroundColor: "#090807", borderRadius: 14, marginTop: 12 }, rangeLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 }, timeline: { height: 62, borderRadius: 9, marginTop: 12, overflow: "hidden", position: "relative" }, frames: { ...StyleSheet.absoluteFillObject, flexDirection: "row" }, frame: { flex: 1, height: 62 }, emptyFrame: { backgroundColor: "#302c28" }, selection: { position: "absolute", top: 0, bottom: 0, borderWidth: 2 }, handle: { position: "absolute", top: 0, bottom: 0, width: 22, zIndex: 3, alignItems: "center", justifyContent: "center" }, handleLine: { height: "100%", width: 4, borderRadius: 3 }, footer: { flexDirection: "row", gap: 10, marginTop: "auto", paddingTop: 18 }, cancel: { minHeight: 48, flex: 1, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, useClip: { minHeight: 48, flex: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, useText: { color: "#FFFFFF", fontWeight: "700" }, error: { textAlign: "center", marginTop: 10, fontSize: 13 }, qualityBox: { marginTop: 12, padding: 10, gap: 8, borderRadius: 12, backgroundColor: "rgba(194,65,12,0.10)" }, qualityButton: { alignSelf: "flex-start", minHeight: 38, borderWidth: 1, borderRadius: 11, justifyContent: "center", paddingHorizontal: 11 } });
