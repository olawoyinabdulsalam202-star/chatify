import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppScreen from "../components/AppScreen";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import { uploadImage } from "../lib/upload";
import { useTheme } from "../lib/theme";
import { useGroupStore } from "../stores/useGroupStore";

export default function CreateGroupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [type, setType] = useState("group");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    api("/messages/contacts").then((result) => setContacts(Array.isArray(result) ? result : [])).catch((error) => Alert.alert("Contacts", error.message));
  }, []);

  const visibleContacts = useMemo(() => contacts.filter((contact) => `${contact.fullName || ""} ${contact.username || ""}`.toLowerCase().includes(search.trim().toLowerCase())), [contacts, search]);
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    setUploadProgress(0);
    try { setAvatar(await uploadImage(result.assets[0], setUploadProgress)); }
    catch (error) { Alert.alert("Photo upload failed", error.message); }
    finally { setUploading(false); }
  };

  const create = async () => {
    if (!name.trim() || !selected.length) return;
    setLoading(true);
    try {
      const group = await api("/groups", { method: "POST", body: { name: name.trim(), description: description.trim(), avatar: avatar || "", type, memberIds: selected } });
      await useGroupStore.getState().load().catch(() => {});
      router.replace(`/group/${group._id}`);
    } catch (error) { Alert.alert("Could not create", error.message); }
    finally { setLoading(false); }
  };

  return <AppScreen style={{ backgroundColor: theme.background }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}><Pressable accessibilityLabel="Close" onPress={() => router.back()} style={styles.iconButton}><Icon name="close" color={theme.text} /></Pressable><View style={{ flex: 1 }}><Text allowFontScaling style={[styles.title, { color: theme.text }]}>{step === 1 ? "Add members" : "Details"}</Text><Text allowFontScaling style={{ color: theme.muted, fontSize: 12 }}>{step === 1 ? "Choose people to invite" : "Set up your group"}</Text></View><Text style={{ color: theme.muted }}>{step} of 2</Text></View>
      {step === 1 ? <>
        <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}><Icon name="search" size={18} color={theme.muted} /><TextInput allowFontScaling value={search} onChangeText={setSearch} placeholder="Search contacts" placeholderTextColor={theme.muted} style={[styles.searchInput, { color: theme.text }]} /></View>
        <FlatList data={visibleContacts} keyExtractor={(item) => String(item._id)} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }} ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: "center", padding: 24 }}>{contacts.length ? "No matching contacts." : "No contacts yet."}</Text>} renderItem={({ item }) => { const active = selected.includes(item._id); return <Pressable onPress={() => toggle(item._id)} style={[styles.contact, { borderBottomColor: theme.border }]}><Avatar uri={item.profilePic} name={item.fullName || item.username} size={42} /><View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5 }}><Text numberOfLines={1} style={{ color: theme.text, fontWeight: "600", flexShrink: 1 }}>{item.fullName || item.username}</Text>{item.isBadged && <Icon name="verified" size={15} color={theme.primary} />}</View><View style={[styles.checkbox, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : "transparent" }]}>{active && <Icon name="check" size={15} color="#FFFFFF" />}</View></Pressable>; }} />
        <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: Math.max(12, insets.bottom) }]}><Pressable disabled={!selected.length} onPress={() => setStep(2)} style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: selected.length ? 1 : 0.45 }]}><Text style={styles.buttonText}>Next ({selected.length} selected)</Text></Pressable></View>
      </> : <>
        <FlatList keyboardShouldPersistTaps="handled" data={[{ key: "details" }]} keyExtractor={(item) => item.key} contentContainerStyle={styles.details} renderItem={() => <>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose group photo" onPress={pickAvatar} style={[styles.avatarPick, { backgroundColor: theme.surface, borderColor: theme.border }]}>{avatar ? <Image source={{ uri: avatar }} style={styles.avatarImage} /> : <Icon name="camera" size={24} color={theme.primary} />}</Pressable>
          {uploading && <View style={styles.uploadStatus}><View style={styles.inline}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted }}>Uploading photo {Math.round(uploadProgress * 100)}%</Text></View><View style={[styles.progressTrack, { backgroundColor: theme.border }]}><View style={[styles.progressFill, { backgroundColor: theme.primary, width: Math.max(4, Math.round(uploadProgress * 100)) + "%" }]} /></View></View>}
          <View style={styles.typeRow}>{[["group", "users", "Group"], ["channel", "message", "Channel"]].map(([value, icon, label]) => <Pressable key={value} onPress={() => setType(value)} style={[styles.typeButton, { borderColor: type === value ? theme.primary : theme.border, backgroundColor: type === value ? theme.primary + "15" : theme.surface }]}><Icon name={icon} size={18} color={type === value ? theme.primary : theme.muted} /><Text style={{ color: type === value ? theme.primary : theme.muted, fontWeight: "600" }}>{label}</Text></Pressable>)}</View>
          <Text allowFontScaling style={{ color: theme.muted, fontSize: 13, lineHeight: 19, marginBottom: 15 }}>{type === "channel" ? "Only you (and other admins) can post. Everyone else can read." : "Anyone in the group can post."}</Text>
          <TextInput allowFontScaling value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={theme.muted} style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} />
          <TextInput allowFontScaling value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={theme.muted} multiline style={[styles.field, styles.description, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} />
        </>} />
        <View style={[styles.footer, styles.actions, { borderTopColor: theme.border, paddingBottom: Math.max(12, insets.bottom) }]}><Pressable onPress={() => setStep(1)} style={[styles.secondaryButton, { borderColor: theme.border }]}><Text style={{ color: theme.text, fontWeight: "600" }}>Back</Text></Pressable><Pressable disabled={!name.trim() || loading || uploading} onPress={create} style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: name.trim() && !loading && !uploading ? 1 : 0.45 }]}>{loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Create</Text>}</Pressable></View>
      </>}
    </KeyboardAvoidingView>
  </AppScreen>;
}

const styles = StyleSheet.create({ header: { minHeight: 70, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth }, title: { fontSize: 19, fontWeight: "700" }, iconButton: { minWidth: 42, minHeight: 42, alignItems: "center", justifyContent: "center" }, search: { minHeight: 46, borderWidth: 1, borderRadius: 13, margin: 16, paddingHorizontal: 12, alignItems: "center", flexDirection: "row", gap: 8 }, searchInput: { flex: 1, minWidth: 0 }, contact: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: StyleSheet.hairlineWidth }, checkbox: { height: 22, width: 22, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" }, footer: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth }, primaryButton: { minHeight: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", flex: 1 }, buttonText: { color: "#FFFFFF", fontWeight: "700" }, details: { padding: 16, paddingBottom: 28 }, avatarPick: { width: 84, height: 84, borderRadius: 42, borderWidth: 1, alignSelf: "center", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 14 }, avatarImage: { width: "100%", height: "100%" }, inline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }, uploadStatus: { marginBottom: 8 }, progressTrack: { height: 4, borderRadius: 4, overflow: "hidden" }, progressFill: { height: "100%" }, typeRow: { flexDirection: "row", gap: 10, marginBottom: 12 }, typeButton: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 12, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" }, field: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, marginBottom: 12 }, description: { minHeight: 84, textAlignVertical: "top", paddingTop: 12 }, actions: { flexDirection: "row", gap: 10 }, secondaryButton: { minHeight: 46, flex: 1, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center" } });
