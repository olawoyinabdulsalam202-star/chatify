import { showDialog } from "../lib/dialog";
import { useEffect, useRef } from "react";
import { Linking, Pressable, StyleSheet, Text, View, Vibration } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { RTCView } from "react-native-webrtc";
import notifee from "@notifee/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import { useCallStore } from "../stores/useCallStore";
import { useTheme } from "../lib/theme";
import { dismissIncomingCall } from "../lib/callNotifications";

function timeLabel(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export default function CallScreen() {
  useKeepAwake();
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handledPushAction = useRef(false);
  const hadCall = useRef(false);
  const theme = useTheme();
  const callState = useCallStore((state) => state.callState);
  const callType = useCallStore((state) => state.callType);
  const peer = useCallStore((state) => state.peer);
  const callId = useCallStore((state) => state.callId);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const duration = useCallStore((state) => state.duration);
  const muted = useCallStore((state) => state.muted);
  const cameraOff = useCallStore((state) => state.cameraOff);
  const speaker = useCallStore((state) => state.speaker);
  const acceptCall = useCallStore((state) => state.acceptCall);
  const declineCall = useCallStore((state) => state.declineCall);
  const endCall = useCallStore((state) => state.endCall);
  const toggleMute = useCallStore((state) => state.toggleMute);
  const toggleCamera = useCallStore((state) => state.toggleCamera);
  const switchCamera = useCallStore((state) => state.switchCamera);
  const toggleSpeaker = useCallStore((state) => state.toggleSpeaker);
  const tick = useCallStore((state) => state.tick);
  useEffect(() => { if (peer) hadCall.current = true; else if (hadCall.current && callState === "idle") router.back(); }, [peer, callState, router]);
  useEffect(() => {
    if (callState !== "incoming" || handledPushAction.current) return;
    if (params.answer === "1") { handledPushAction.current = true; acceptCall().catch((error) => showDialog("Could not answer", error.message || "Check microphone and camera permissions.")); }
    if (params.decline && String(params.decline) === String(peer?.id)) { handledPushAction.current = true; declineCall(); }
  }, [callState, params.answer, params.decline, peer?.id]);

  useEffect(() => {
    const timer = setInterval(tick, 1000);
    if (callState === "incoming") Vibration.vibrate([0, 900, 500, 900], true);
    return () => { clearInterval(timer); Vibration.cancel(); };
  }, [callState, tick]);
  useEffect(() => { if (callState === "idle" && callId) dismissIncomingCall(callId); }, [callState, callId]);
  useEffect(() => {
    if (callState !== "incoming") return;
    notifee.getNotificationSettings().then((settings) => {
      if (settings.android?.fullScreenIntent === false) showDialog("Allow full-screen calls", "Enable full-screen notifications so Havn can show incoming calls over your lock screen.", [
        { text: "Later", style: "cancel" },
        { text: "Open settings", onPress: () => notifee.openFullScreenIntentSettings().catch(() => Linking.openSettings()) },
      ]);
    }).catch(() => {});
  }, [callState]);

  if (!peer) return <View style={styles.root}><Text style={styles.state}>Waiting for the incoming call...</Text><Pressable onPress={() => router.back()} style={styles.dismiss}><Text style={styles.state}>Close</Text></Pressable></View>;
  const incoming = callState === "incoming";
  const label = incoming ? "Incoming call" : callState === "calling" ? `Calling ${peer.name}...` : callState === "ringingOffline" ? `Ringing ${peer.name}'s phone...` : callState === "ringing" ? `Ringing ${peer.name}...` : callState === "reconnecting" ? "Reconnecting" : callState === "connected" ? timeLabel(duration) : callState === "noAnswer" ? "No answer" : callState === "ended" ? "Ended" : "Connecting";
  const answer = async () => { try { await acceptCall(); } catch (error) { showDialog("Could not answer", error.message || "Check microphone and camera permissions."); } };
  const Control = ({ name, label: text, onPress, active = false, danger = false }) => <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={[styles.control, { backgroundColor: danger ? "#C62828" : active ? theme.primary : "#34312E" }]}><Icon name={name} size={24} color="#FFFFFF" /><Text style={styles.controlText}>{text}</Text></Pressable>;

  return <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    {callType === "video" && remoteStream?.toURL ? <RTCView streamURL={remoteStream.toURL()} objectFit="cover" style={StyleSheet.absoluteFill} /> : <View style={styles.voiceBackdrop} />}
    {callType === "video" && localStream?.toURL && !cameraOff ? <RTCView streamURL={localStream.toURL()} mirror objectFit="cover" style={[styles.localVideo, { top: insets.top + 16 }]} /> : null}
    {(callType !== "video" || !remoteStream) && <View style={styles.person}><Avatar uri={peer.avatar} name={peer.name} size={112} /><Text style={styles.name}>{peer.name}</Text><Text style={styles.state}>{label}</Text></View>}
    {callType === "video" && remoteStream && <View style={styles.namePlate}><Text style={styles.name}>{peer.name}</Text><Text style={styles.state}>{label}</Text></View>}
    {incoming ? <View style={[styles.incomingButtons, { bottom: 32 + insets.bottom }]}><Control name="phone" label="Answer" onPress={answer} active /><Control name="phoneOff" label="Decline" onPress={declineCall} danger /></View> : <View style={[styles.controls, { bottom: 28 + insets.bottom }]}>
      <Control name={muted ? "micOff" : "mic"} label={muted ? "Unmute" : "Mute"} onPress={toggleMute} active={muted} />
      <Control name={speaker ? "sound" : "soundOff"} label="Speaker" onPress={toggleSpeaker} active={speaker} />
      {callType === "video" && <><Control name={cameraOff ? "videoOff" : "video"} label="Camera" onPress={toggleCamera} active={cameraOff} /><Control name="switchCamera" label="Flip" onPress={switchCamera} /></>}
      <Control name="phone" label="End" onPress={endCall} danger />
    </View>}
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#11100F", justifyContent: "center", alignItems: "center" }, dismiss: { padding: 20 }, voiceBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#171411" }, person: { alignItems: "center", gap: 12 }, name: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" }, state: { color: "#D7D0C8", fontSize: 15 }, controls: { position: "absolute", bottom: 48, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 18, paddingHorizontal: 20 }, incomingButtons: { position: "absolute", bottom: 64, left: 24, right: 24, flexDirection: "row", justifyContent: "space-around" }, control: { minWidth: 68, minHeight: 68, borderRadius: 36, alignItems: "center", justifyContent: "center", padding: 9, gap: 4 }, controlText: { color: "#FFFFFF", fontSize: 11 }, localVideo: { position: "absolute", top: 58, right: 18, width: 104, height: 156, borderRadius: 16, overflow: "hidden", backgroundColor: "#292524" }, namePlate: { position: "absolute", top: 52, left: 20, gap: 5 } });
