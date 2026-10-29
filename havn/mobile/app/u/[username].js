import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppScreen from "../../components/AppScreen";
import ActionButton from "../../components/ActionButton";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import LoadingView from "../../components/LoadingView";
import { api } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useAuthStore } from "../../stores/useAuthStore";

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const authUser = useAuthStore((state) => state.authUser);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/public/u/${encodeURIComponent(String(username || ""))}`).then(setProfile).catch((err) => setError(err.message)); }, [username]);
  const message = async () => {
    if (!authUser) { router.push({ pathname: "/login", params: { redirect: `/u/${username}` } }); return; }
    try {
      const people = await api(`/friends/search?q=${encodeURIComponent(String(username))}`);
      const person = people.find((entry) => entry.username?.toLowerCase() === String(username).toLowerCase());
      if (!person) throw new Error("This profile could not be opened as a chat.");
      router.push({ pathname: "/chat/[id]", params: { id: person._id, person: JSON.stringify(person) } });
    } catch (err) { setError(err.message); }
  };
  const openApp = () => Linking.openURL(`https://havn.kairos-va.com/u/${encodeURIComponent(String(username))}`).catch(() => {});
  if (!profile && !error) return <AppScreen><LoadingView label="Loading profile" /></AppScreen>;
  return <AppScreen style={styles.screen}>
    <Pressable onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {profile ? <><Avatar uri={profile.profilePic} name={profile.fullName || profile.username} size={92} /><Text allowFontScaling style={[styles.name, { color: theme.text }]}>{profile.fullName || profile.username}</Text><Text allowFontScaling style={{ color: theme.muted }}>@{profile.username}</Text>{!!profile.bio && <Text allowFontScaling style={[styles.bio, { color: theme.text }]}>{profile.bio}</Text>}
        <ActionButton title="Message on Havn" onPress={message} style={styles.button} />
        <ActionButton title="Open in app" secondary onPress={openApp} style={styles.button} />
        <Pressable onPress={() => Linking.openURL("https://havn.kairos-va.com/download").catch(() => {})} style={styles.download}><Text allowFontScaling style={{ color: theme.primary, fontWeight: "700" }}>Download Havn</Text></Pressable>
      </> : <Text allowFontScaling style={{ color: theme.danger }}>{error}</Text>}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({ screen: { padding: 18 }, back: { width: 44, height: 44, justifyContent: "center" }, card: { width: "100%", maxWidth: 480, alignSelf: "center", alignItems: "center", borderRadius: 26, padding: 24, marginTop: 18 }, name: { fontSize: 24, fontWeight: "800", marginTop: 16, textAlign: "center" }, bio: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 14 }, button: { alignSelf: "stretch", marginTop: 16 }, download: { minHeight: 44, justifyContent: "center", padding: 8, marginTop: 5 } });
