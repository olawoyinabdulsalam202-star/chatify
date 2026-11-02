import { useWindowDimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { presenceLabel } from "../lib/lastSeen";

export default function GroupInfoSheet({ visible, onClose, theme, group, currentUserId, isAdmin, canDelete, onlineUsers = [], editName, setEditName, editDescription, setEditDescription, hasChanges, onSave, contacts = [], onLoadContacts, onInvite, onManageMember, onLeave, onDelete, onChoosePhoto }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.avoid} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.background, height: Math.min(height * 0.9, 680), maxHeight: height * 0.9 }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.headerButton}><Icon name="back" color={theme.text} /></Pressable>
            <Text style={{ color: theme.text, fontFamily: theme.fontFamily, fontWeight: "800", fontSize: 18 }}>Group info</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close group info" onPress={onClose} style={styles.headerButton}><Icon name="close" color={theme.text} /></Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            <View style={[styles.profile, { borderBottomColor: theme.border }]}>
              <Pressable disabled={!isAdmin} onPress={onChoosePhoto}><Avatar uri={group.avatar} name={group.name} size={62} /></Pressable>
              <Text style={{ color: theme.text, fontFamily: theme.fontFamily, fontSize: 17, fontWeight: "700", marginTop: 10 }}>{group.name}</Text>
              <Text style={{ color: theme.muted, fontFamily: theme.fontFamily, marginTop: 3 }}>{group.members?.length || 0}{" \u00B7 "}{group.type === "channel" ? "Channel" : "Group"}</Text>
            </View>
            {isAdmin && <View style={styles.fields}>
              <TextInput value={editName} onChangeText={setEditName} placeholder="Group name" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} />
              <TextInput value={editDescription} onChangeText={setEditDescription} placeholder="Description" placeholderTextColor={theme.muted} multiline style={[styles.input, styles.description, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} />
              <Pressable disabled={!hasChanges} onPress={onSave} style={[styles.button, { backgroundColor: theme.primary, opacity: hasChanges ? 1 : 0.45 }]}><Text style={styles.primaryText}>Save changes</Text></Pressable>
              <Pressable onPress={onLoadContacts} style={[styles.button, { borderColor: theme.border, borderWidth: 1 }]}><Text style={{ color: theme.primary, fontFamily: theme.fontFamily, fontWeight: "700" }}>Add members</Text></Pressable>
              {contacts.filter((person) => !(group.members || []).some((member) => String(member.userId?._id || member.userId) === String(person._id))).slice(0, 8).map((person) => <Pressable key={person._id} onPress={() => onInvite(person._id)} style={styles.inviteRow}><Avatar uri={person.profilePic} name={person.fullName || person.username} size={38} /><Text numberOfLines={1} style={{ color: theme.text, fontFamily: theme.fontFamily, flex: 1 }}>Invite {person.fullName || person.username}</Text><Icon name="plus" color={theme.primary} size={18} /></Pressable>)}
            </View>}
            <Text style={[styles.memberHeading, { color: theme.text, fontFamily: theme.fontFamily }]}>Members</Text>
            {(group.members || []).map((member, index) => {
              const memberId = String(member.userId?._id || member.userId);
              const online = onlineUsers.includes(memberId);
              return <Pressable key={memberId || index} disabled={!isAdmin} onPress={() => onManageMember(member)} style={[styles.member, { borderBottomColor: theme.border }]}>
                <Avatar uri={member.userId?.profilePic} name={member.userId?.fullName || "Member"} size={42} online={online} showOnline={online} />
                <View style={styles.memberCopy}><Text numberOfLines={1} style={{ color: theme.text, fontFamily: theme.fontFamily }}>{member.userId?.fullName || "Member"}</Text><Text numberOfLines={1} style={{ color: online ? theme.success : theme.muted, fontFamily: theme.fontFamily, fontSize: 11 }}>{presenceLabel({ online, lastSeenAt: member.userId?.lastSeenAt })}</Text></View>
                <Text style={{ color: theme.muted, fontFamily: theme.fontFamily, fontSize: 12 }}>{member.role || "member"}{isAdmin && memberId !== String(currentUserId) ? " \u00B7 Manage" : ""}</Text>
              </Pressable>;
            })}
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable onPress={onLeave} style={[styles.button, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}><Text style={{ color: theme.text, fontFamily: theme.fontFamily, fontWeight: "700" }}>Leave group</Text></Pressable>
            {canDelete && <Pressable onPress={onDelete} style={[styles.button, { backgroundColor: theme.danger }]}><Text style={styles.primaryText}>Delete group</Text></Pressable>}
          </View>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({ avoid: { flex: 1, justifyContent: "flex-end" }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }, sheet: { width: "100%", flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 17 }, header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth }, headerButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, scroll: { flex: 1, minHeight: 0 }, content: { paddingBottom: 12 }, profile: { alignItems: "center", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth }, fields: { gap: 8, paddingVertical: 12 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, description: { minHeight: 72, textAlignVertical: "top" }, button: { width: "100%", minHeight: 48, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }, primaryText: { color: "#FFFFFF", fontWeight: "700" }, inviteRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }, memberHeading: { fontSize: 15, fontWeight: "700", paddingTop: 12, paddingBottom: 7 }, member: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: StyleSheet.hairlineWidth }, memberCopy: { flex: 1, minWidth: 0 }, footer: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 } });
