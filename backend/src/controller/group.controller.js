import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import { getBotUserId, maybeReplyToGroupMessage } from "../lib/bot.js";
import Group from "../modules/Group.js";
import GroupInvite from "../modules/GroupInvite.js";
import Message from "../modules/Message.js";
import User from "../modules/User.js";
import { PUBLIC_USER_FIELDS, anonymizeGroupForViewer } from "../lib/publicFields.js";
import { sendPushToUser, previewText } from "../lib/push.js";

// Shared by createGroup and inviteMembers: creates one pending invite per
// target user (skipping anyone already a member or already invited) and
// notifies them over socket if they're online.
const sendInvites = async (group, fromUser, targetIds) => {
  const existingMemberIds = new Set(group.members.map((m) => m.userId.toString()));
  const alreadyInvited = new Set(
    (await GroupInvite.find({ groupId: group._id, status: "pending" }).select("to")).map((i) =>
      i.to.toString()
    )
  );

  const toInvite = targetIds.filter(
    (id) => !existingMemberIds.has(id) && !alreadyInvited.has(id) && id !== fromUser._id.toString()
  );
  if (toInvite.length === 0) return [];

  const invites = await GroupInvite.insertMany(
    toInvite.map((to) => ({ groupId: group._id, from: fromUser._id, to })),
    { ordered: false }
  ).catch((err) => {
    // Duplicate-key races (two admins inviting the same person at once) are
    // fine to swallow — the invite already exists either way.
    if (err.writeErrors) return err.insertedDocs || [];
    throw err;
  });

  invites.forEach((invite) => {
    const socketId = getReceiverSocketId(invite.to.toString());
    if (socketId) {
      io.to(socketId).emit("groupInviteReceived", {
        inviteId: invite._id,
        group: { _id: group._id, name: group.name, avatar: group.avatar, type: group.type },
        from: { _id: fromUser._id, fullName: fromUser.fullName, profilePic: fromUser.profilePic },
      });
    }
  });

  return invites;
};

// Returns the group as a given viewer is allowed to see it: populated (so
// names are present) and anonymized (so only admins get the real ones).
// Used for the REST replies on endpoints that mutate membership, which
// otherwise answered with bare ObjectIds and blanked every name in the UI.
const groupForViewer = async (groupId, viewerId) => {
  const populated = await Group.findById(groupId).populate("members.userId", PUBLIC_USER_FIELDS);
  if (!populated) return null;
  return anonymizeGroupForViewer(populated, viewerId);
};

// Broadcasts a group change to its members, with each member receiving the
// roster they're allowed to see.
//
// This exists for two reasons. First, the controllers work with unpopulated
// documents, so emitting `group` directly sent members.userId as bare ObjectIds
// — the client then had no names to show and fell back to the literal string
// "Member" for everyone, including for admins. Re-populating here is what keeps
// names on screen after a promote/remove.
//
// Second, one broadcast can't serve both audiences: admins need real names,
// everyone else must not receive them at all. So this fans out per member
// instead of a single io.to(room).emit.
const emitGroupUpdate = async (groupId) => {
  const populated = await Group.findById(groupId).populate("members.userId", PUBLIC_USER_FIELDS);
  if (!populated) return;

  populated.members.forEach((m) => {
    const uid = String(m.userId?._id || m.userId);
    io.to(`user:${uid}`).emit("groupUpdated", anonymizeGroupForViewer(populated, uid));
  });
};

export const createGroup = async (req, res) => {
  try {
    const { name, description, avatar, type, memberIds } = req.body;
    const creatorId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required." });
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "Invite at least one person." });
    }

    const validMembers = await User.find({ _id: { $in: memberIds } }).select("_id");
    const validIds = validMembers.map((u) => u._id.toString()).filter((id) => id !== creatorId.toString());

    let avatarUrl = "";
    if (avatar) {
      const uploadResponse = await cloudinary.uploader.upload(avatar);
      avatarUrl = uploadResponse.secure_url;
    }

    // Only the creator joins immediately. Everyone else has to accept an
    // invite first — see sendInvites below.
    const members = [{ userId: creatorId, role: "admin" }];

    // The bot joins every ordinary group automatically, but is never added
    // to channels — channels stay pure broadcast, same as WhatsApp.
    const resolvedType = type === "channel" ? "channel" : "group";
    const botId = getBotUserId();
    if (resolvedType === "group" && botId) {
      members.push({ userId: botId, role: "member" });
    }

    const group = await Group.create({
      name: name.trim(),
      description: description?.trim() || "",
      avatar: avatarUrl,
      type: resolvedType,
      createdBy: creatorId,
      creatorIsBadged: !!req.user.isBadged,
      members,
    });

    // Put every joined member's connected sockets into the group room
    // immediately (invited people join their socket room only once they accept).
    members.forEach((m) => {
      io.in(`user:${m.userId}`).socketsJoin(`group:${group._id}`);
    });
    io.to(`group:${group._id}`).emit("groupCreated", group);

    await sendInvites(group, req.user, validIds);

    res.status(201).json(group);
  } catch (error) {
    console.log("Error in createGroup controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ "members.userId": req.user._id }).sort({ updatedAt: -1 });
    res.status(200).json(groups);
  } catch (error) {
    console.log("Error in getMyGroups controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    // Allowlist, not "-password": group members must not learn each other's
    // emails just by opening the group info panel.
    const group = await Group.findById(id).populate("members.userId", PUBLIC_USER_FIELDS);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!group.isMember(req.user._id)) {
      return res.status(403).json({ message: "You are not a member of this group." });
    }
    // Admins get the real roster (they have to identify people to promote or
    // hand the group over to). Everyone else gets "Member" for all names, done
    // server-side so the real ones never reach the browser at all.
    res.status(200).json(anonymizeGroupForViewer(group, req.user._id));
  } catch (error) {
    console.log("Error in getGroupDetails controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, avatar, botEnabled } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ message: "Only admins can update this group." });
    }

    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (botEnabled !== undefined) group.botEnabled = Boolean(botEnabled);
    if (avatar) {
      const uploadResponse = await cloudinary.uploader.upload(avatar);
      group.avatar = uploadResponse.secure_url;
    }

    await group.save();
    await emitGroupUpdate(group._id);
    res.status(200).json(await groupForViewer(group._id, req.user._id));
  } catch (error) {
    console.log("Error in updateGroup controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const inviteMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIds } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ message: "Only admins can invite members." });
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "No members provided." });
    }

    const validMembers = await User.find({ _id: { $in: memberIds } }).select("_id");
    const validIds = validMembers.map((u) => u._id.toString());

    const invites = await sendInvites(group, req.user, validIds);

    res.status(200).json({ message: `${invites.length} invite(s) sent.`, invited: invites.length });
  } catch (error) {
    console.log("Error in inviteMembers controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Pending invites addressed to the logged-in user, newest first.
export const getMyGroupInvites = async (req, res) => {
  try {
    const invites = await GroupInvite.find({ to: req.user._id, status: "pending" })
      .sort({ createdAt: -1 })
      .populate("groupId", "name avatar type")
      .populate("from", "fullName profilePic isBadged");

    res.status(200).json(
      invites
        .filter((i) => i.groupId) // group might have been deleted since the invite was sent
        .map((i) => ({
          inviteId: i._id,
          group: { _id: i.groupId._id, name: i.groupId.name, avatar: i.groupId.avatar, type: i.groupId.type },
          from: { _id: i.from._id, fullName: i.from.fullName, profilePic: i.from.profilePic, isBadged: i.from.isBadged },
        }))
    );
  } catch (error) {
    console.log("Error in getMyGroupInvites controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const respondToGroupInvite = async (req, res) => {
  try {
    const { id: inviteId } = req.params;
    const { action } = req.body; // "accept" | "decline"
    const userId = req.user._id;

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const invite = await GroupInvite.findById(inviteId);
    if (!invite || !invite.to.equals(userId)) {
      return res.status(404).json({ message: "Invite not found" });
    }
    if (invite.status !== "pending") {
      return res.status(400).json({ message: "This invite has already been handled." });
    }

    if (action === "decline") {
      await invite.deleteOne();
      return res.status(200).json({ message: "Invite declined" });
    }

    const group = await Group.findById(invite.groupId);
    if (!group) {
      await invite.deleteOne();
      return res.status(404).json({ message: "This group no longer exists." });
    }

    if (!group.isMember(userId)) {
      group.members.push({ userId, role: "member" });
      await group.save();
    }
    await invite.deleteOne();

    io.in(`user:${userId}`).socketsJoin(`group:${group._id}`);
    await emitGroupUpdate(group._id);

    res.status(200).json(await groupForViewer(group._id, userId));
  } catch (error) {
    console.log("Error in respondToGroupInvite controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const cancelGroupInvite = async (req, res) => {
  try {
    const { id, inviteId } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ message: "Only admins can cancel invites." });
    }

    const invite = await GroupInvite.findOne({ _id: inviteId, groupId: id });
    if (!invite) return res.status(404).json({ message: "Invite not found." });

    await invite.deleteOne();
    res.status(200).json({ message: "Invite cancelled" });
  } catch (error) {
    console.log("Error in cancelGroupInvite controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Pending invites for a group, visible to that group's admins (so the UI
// can show "invited, waiting to accept" instead of the person just vanishing).
export const getGroupPendingInvites = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ message: "Only admins can view pending invites." });
    }

    const invites = await GroupInvite.find({ groupId: id, status: "pending" })
      .sort({ createdAt: -1 })
      .populate("to", "fullName profilePic isBadged");

    res.status(200).json(
      invites.map((i) => ({
        inviteId: i._id,
        to: { _id: i.to._id, fullName: i.to.fullName, profilePic: i.to.profilePic, isBadged: i.to.isBadged },
      }))
    );
  } catch (error) {
    console.log("Error in getGroupPendingInvites controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    // Optional: when the last admin leaves they may name their successor.
    // Without one, succession falls back to the longest-standing member.
    const { newAdminId } = req.body || {};
    const requesterId = req.user._id;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (group.isSystemChannel) {
      return res.status(400).json({ message: "You can't leave the Announcements channel." });
    }

    const isSelf = requesterId.toString() === memberId;
    if (!isSelf && !group.isAdmin(requesterId)) {
      return res.status(403).json({ message: "Only admins can remove other members." });
    }
    if (group.createdBy.toString() === memberId && !isSelf) {
      return res.status(400).json({ message: "Cannot remove the group creator." });
    }

    const leaver = group.members.find((m) => m.userId.toString() === memberId);
    if (!leaver) return res.status(404).json({ message: "Member not found in this group." });

    const remaining = group.members.filter((m) => m.userId.toString() !== memberId);

    // Last member out deletes the group rather than leaving an unreachable
    // orphan with messages nobody can ever read or clean up.
    if (remaining.length === 0) {
      await Message.deleteMany({ groupId: group._id });
      await GroupInvite.deleteMany({ groupId: group._id });
      await group.deleteOne();
      io.in(`user:${memberId}`).socketsLeave(`group:${group._id}`);
      io.to(`group:${group._id}`).emit("groupDeleted", { groupId: group._id });
      return res.status(200).json({ deleted: true, groupId: group._id });
    }

    group.members = remaining;

    // Succession. A group with no admin is permanently unmanageable — nobody
    // can invite, remove, promote, or change settings — so if the departing
    // member was the last admin, someone has to inherit it.
    const stillHasAdmin = remaining.some((m) => m.role === "admin");
    let promoted = null;
    if (!stillHasAdmin) {
      // Prefer the successor the leaver picked, as long as they're a real
      // remaining member and not the bot. Otherwise the longest-standing human.
      //
      // isBot lives on the User document, not on the member subdocument, and
      // members.userId isn't populated here — so the bot has to be identified
      // by id. Comparing m.isBot would always be undefined and could hand the
      // group to the AI assistant, which can't administer anything.
      const botId = getBotUserId();
      const humans = remaining.filter((m) => !botId || m.userId.toString() !== botId.toString());
      const chosen =
        (newAdminId && remaining.find((m) => m.userId.toString() === newAdminId.toString())) ||
        [...(humans.length ? humans : remaining)].sort(
          (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)
        )[0];

      if (chosen) {
        chosen.role = "admin";
        promoted = chosen.userId.toString();
      }
    }

    // The creator carries delete rights, so that has to move too — otherwise
    // the new admin can run the group but can never delete it, and the delete
    // permission stays with someone who already walked out.
    if (group.createdBy.toString() === memberId) {
      const heir = promoted || remaining.find((m) => m.role === "admin")?.userId?.toString();
      if (heir) {
        group.createdBy = heir;
        const heirUser = await User.findById(heir).select("isBadged");
        group.creatorIsBadged = Boolean(heirUser?.isBadged);
      }
    }

    await group.save();

    io.in(`user:${memberId}`).socketsLeave(`group:${group._id}`);
    await emitGroupUpdate(group._id);

    res.status(200).json(await groupForViewer(group._id, requesterId));
  } catch (error) {
    console.log("Error in removeMember controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const setMemberRole = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body; // "admin" | "member"

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ message: "Only admins can change roles." });
    }
    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const member = group.members.find((m) => m.userId.toString() === memberId);
    if (!member) return res.status(404).json({ message: "Member not found in this group." });

    member.role = role;
    await group.save();

    await emitGroupUpdate(group._id);
    res.status(200).json(await groupForViewer(group._id, req.user._id));
  } catch (error) {
    console.log("Error in setMemberRole controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (group.isSystemChannel) {
      return res.status(400).json({ message: "The Announcements channel can't be deleted." });
    }
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the creator can delete this group." });
    }

    await Message.deleteMany({ groupId: group._id });
    await GroupInvite.deleteMany({ groupId: group._id });
    await group.deleteOne();

    io.to(`group:${id}`).emit("groupDeleted", { groupId: id });
    res.status(200).json({ message: "Group deleted." });
  } catch (error) {
    console.log("Error in deleteGroup controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!group.isMember(req.user._id)) {
      return res.status(403).json({ message: "You are not a member of this group." });
    }

    const messages = await Message.find({ groupId: id })
      .sort({ createdAt: 1 })
      .populate("senderId", "fullName profilePic isBadged isBot");

    // View-once media never travels in the history payload — the URL is only
    // ever handed out by the open endpoint, one viewer at a time. Each message
    // instead carries whether *this* member has already used their view, since
    // "once" is per-person in a group and the client can't work that out from a
    // shared viewers list it isn't allowed to see.
    const viewerId = String(req.user._id);
    const shaped = messages.map((m) => {
      if (!m.viewOnce) return m;
      const plain = m.toObject();
      const openedByMe = (plain.viewOnceViewers || []).some(
        (v) => String(v.userId) === viewerId
      );
      return {
        ...plain,
        image: undefined,
        video: undefined,
        viewOnceOpenedByMe: openedByMe,
        viewOnceViewerCount: (plain.viewOnceViewers || []).length,
        // The raw list identifies who opened it, which would leak the roster in
        // a group where members are anonymous to each other.
        viewOnceViewers: undefined,
      };
    });

    res.status(200).json(shaped);
  } catch (error) {
    console.log("Error in getGroupMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { text, image, video, videoDuration, gif, sticker, audio, audioDuration, replyToId, viewOnce } =
      req.body;
    const senderId = req.user._id;

    if (!text && !image && !video && !gif && !sticker && !audio) {
      return res.status(400).json({ message: "Text, image, video, gif, sticker, or audio is required." });
    }
    if (viewOnce && !image && !video) {
      return res.status(400).json({ message: "View-once is only supported for photos and videos." });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!group.isMember(senderId)) {
      return res.status(403).json({ message: "You are not a member of this group." });
    }
    if (group.type === "channel" && !group.isAdmin(senderId)) {
      return res.status(403).json({ message: "Only admins can post in this channel." });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl;
    if (audio) {
      // Transcode to mp3 so the note plays everywhere: MediaRecorder's webm/opus
      // can't be decoded on Safari/iOS, which left voice notes silent on the
      // receiver's side.
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "video",
        format: "mp3",
      });
      audioUrl = uploadResponse.secure_url;
    }

    let videoUrl;
    if (video) {
      const uploadResponse = await cloudinary.uploader.upload(video, {
        resource_type: "video",
        eager: [{ quality: "auto", fetch_format: "auto" }],
      });
      videoUrl = uploadResponse.secure_url;
    }

    let replyTo;
    if (replyToId) {
      const original = await Message.findById(replyToId);
      if (original) {
        replyTo = {
          messageId: original._id,
          senderId: original.senderId,
          text: original.isDeleted
            ? "This message was deleted"
            : original.text ||
              (original.image
                ? "📷 Photo"
                : original.audio
                ? "🎤 Voice note"
                : original.sticker
                ? "Sticker"
                : "GIF"),
        };
      }
    }

    const newMessage = await Message.create({
      senderId,
      groupId,
      text,
      image: imageUrl,
      video: videoUrl,
      videoDuration,
      gif,
      sticker,
      audio: audioUrl,
      audioDuration,
      replyTo,
      viewOnce: !!viewOnce,
      viewOnceIsVideo: !!(viewOnce && videoUrl),
    });
    await newMessage.populate("senderId", "fullName profilePic isBadged isBot");

    // Redact the media from the broadcast for view-once messages. Shipping the
    // URL to the room would let anyone read it straight out of the socket
    // payload without ever "opening" it — members must go through the open
    // endpoint, which is what records the view and eventually destroys it.
    if (newMessage.viewOnce && (newMessage.image || newMessage.video)) {
      const redacted = newMessage.toObject();
      redacted.image = undefined;
      redacted.video = undefined;
      io.to(`group:${groupId}`).emit("newGroupMessage", redacted);
      // The sender's own REST reply is redacted too, so their client can't
      // cache a copy the recipients had to earn.
      res.status(201).json(redacted);
    } else {
      io.to(`group:${groupId}`).emit("newGroupMessage", newMessage);
      res.status(201).json(newMessage);
    }

    // Push to every member except the sender and the bot, so a closed app still
    // notifies. The group name is the title and the sender's name leads the
    // body — the same shape WhatsApp uses, and it means a member can tell which
    // group a notification came from without opening anything.
    //
    // Group rosters are anonymous to ordinary members, but a notification only
    // ever goes to the person it's about, and they're told who messaged them in
    // a group they're already in — the same thing they'd see in the message
    // list. No roster is revealed.
    const botId = getBotUserId();
    const recipients = group.members
      .map((m) => String(m.userId))
      .filter((uid) => uid !== String(senderId) && (!botId || uid !== String(botId)));

    recipients.forEach((uid) => {
      sendPushToUser(uid, {
        title: group.name,
        body: `${req.user.fullName}: ${previewText(newMessage)}`,
        // One tag per group collapses a burst of messages into a single
        // notification instead of stacking one per message.
        tag: `group-${groupId}`,
        url: "/",
        groupId: String(groupId),
        kind: "group",
      });
    });

    // Fire-and-forget: bot only replies in ordinary groups, and only when
    // mentioned by name — see maybeReplyToGroupMessage for the gating logic.
    maybeReplyToGroupMessage(group, newMessage).catch((err) =>
      console.log("Bot reply error:", err.message)
    );
  } catch (error) {
    console.log("Error in sendGroupMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
