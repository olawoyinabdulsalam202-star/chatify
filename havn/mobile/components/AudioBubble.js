import { showDialog } from "../lib/dialog";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useTheme } from "../lib/theme";
import Icon from "./Icon";

const SPEEDS = [1, 1.5, 2];

function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
}

export default function AudioBubble({ src, duration, own }) {
  const theme = useTheme();
  const player = useAudioPlayer(src || null, { updateInterval: 180 });
  const status = useAudioPlayerStatus(player);
  const [speedIndex, setSpeedIndex] = useState(0);
  const total = Number(duration) > 0 ? Number(duration) : Number(status.duration) || 0;
  const current = Math.max(0, Number(status.currentTime) || 0);
  const progress = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
  const activeColor = own ? "#FFFFFF" : theme.primary;

  useEffect(() => {
    if (!status.didJustFinish) return;
    player.seekTo(0).catch(() => {});
  }, [player, status.didJustFinish]);

  const toggle = () => {
    if (!src) return;
    if (status.playing) player.pause();
    else {
      try { player.play(); }
      catch { showDialog("Audio", "Couldn't play this voice note."); }
    }
  };

  const changeSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    player.setPlaybackRate(SPEEDS[next]);
  };

  return <View style={[styles.container, { backgroundColor: own ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.045)" }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"} onPress={toggle} style={[styles.playButton, { backgroundColor: own ? "rgba(255,255,255,0.2)" : "rgba(194,65,12,0.12)" }]}>
      <Icon name={status.playing ? "pause" : "play"} color={activeColor} size={19} />
    </Pressable>
    <View style={styles.trackColumn}>
      <View style={[styles.track, { backgroundColor: own ? "rgba(255,255,255,0.33)" : "rgba(80,70,60,0.18)" }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: activeColor }]} />
      </View>
      <Text style={[styles.duration, { color: own ? "rgba(255,255,255,0.82)" : theme.muted }]}>{formatDuration(current > 0 ? current : total)}{total > 0 && current > 0 ? ` / ${formatDuration(total)}` : ""}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Playback speed ${SPEEDS[speedIndex]} times`} onPress={changeSpeed} style={[styles.speed, { backgroundColor: own ? "rgba(255,255,255,0.2)" : "rgba(194,65,12,0.12)" }]}>
      <Text style={{ color: activeColor, fontSize: 11, fontWeight: "700" }}>{SPEEDS[speedIndex]}x</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({ container: { minWidth: 210, maxWidth: 255, padding: 8, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 9 }, playButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }, trackColumn: { flex: 1, minWidth: 0, gap: 5 }, track: { height: 5, borderRadius: 4, overflow: "hidden" }, fill: { height: "100%", borderRadius: 4 }, duration: { fontSize: 10, fontVariant: ["tabular-nums"] }, speed: { minWidth: 42, height: 34, borderRadius: 13, alignItems: "center", justifyContent: "center" } });
