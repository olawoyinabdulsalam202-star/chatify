import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import Icon from "./Icon";

function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
}

export default function VoiceRecorder({ theme, onCancel, onSend }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [starting, setStarting] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          if (!active) return;
          Alert.alert("Microphone access needed", "Allow Havn to use the microphone to record a voice note.");
          onCancelRef.current();
          return;
        }
        if (!active) return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (!active) return;
        await recorder.prepareToRecordAsync();
        if (!active) return;
        recorder.record();
      } catch (startError) {
        if (!active) return;
        Alert.alert("Recording unavailable", startError.message || "Could not start the microphone.");
        onCancelRef.current();
      } finally {
        if (active) setStarting(false);
      }
    };
    start();
    return () => {
      active = false;
      if (recorder.isRecording) recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [recorder]);

  const cancel = async () => {
    try { if (recorder.isRecording) await recorder.stop(); } catch {}
    onCancel();
  };

  const send = async () => {
    if (starting || sending) return;
    setSending(true);
    setError("");
    try {
      const audioDuration = Math.max(1, Math.round((state.durationMillis || 0) / 1000));
      if (recorder.isRecording) await recorder.stop();
      const uri = recorder.uri || recorder.getStatus().url;
      if (!uri) throw new Error("The voice note could not be saved.");
      const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "m4a";
      const mimeType = extension === "3gp" ? "audio/3gpp" : extension === "wav" ? "audio/wav" : "audio/mp4";
      await onSend({ asset: { uri, fileName: `havn-voice-note.${extension}`, mimeType }, audioDuration });
      onCancel();
    } catch (sendError) {
      setError(sendError.message || "Voice note could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={[styles.dot, { backgroundColor: state.isRecording ? theme.danger : theme.muted }]} />
    <View style={styles.textBlock}>
      <Text numberOfLines={1} style={[styles.timer, { color: theme.text }]}>{starting ? "Starting microphone…" : state.isRecording ? `Recording ${formatDuration(state.durationMillis / 1000)}` : `Voice note · ${formatDuration(state.durationMillis / 1000)}`}</Text>
      {!!error && <Text numberOfLines={1} style={[styles.error, { color: theme.danger }]}>{error}</Text>}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Cancel voice note" disabled={sending} onPress={cancel} style={styles.action}><Icon name="trash" color={theme.muted} size={19} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Send voice note" disabled={starting || sending} onPress={send} style={[styles.action, styles.sendAction, { backgroundColor: theme.primary, opacity: starting || sending ? 0.55 : 1 }]}>{sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Icon name="send" color="#FFFFFF" size={18} />}</Pressable>
  </View>;
}

const styles = StyleSheet.create({ row: { flex: 1, minWidth: 0, minHeight: 48, borderWidth: 1, borderRadius: 20, paddingLeft: 11, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 6 }, dot: { width: 9, height: 9, borderRadius: 5 }, textBlock: { flex: 1, minWidth: 0 }, timer: { fontSize: 13, fontWeight: "600" }, error: { fontSize: 10, marginTop: 2 }, action: { width: 42, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, sendAction: { width: 44, height: 44 } });
