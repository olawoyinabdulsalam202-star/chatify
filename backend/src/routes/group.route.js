import express from "express";
import {
  createGroup,
  getMyGroups,
  getGroupDetails,
  updateGroup,
  inviteMembers,
  getGroupPendingInvites,
  cancelGroupInvite,
  removeMember,
  setMemberRole,
  deleteGroup,
  getGroupMessages,
  sendGroupMessage,
  getMyGroupInvites,
  respondToGroupInvite,
} from "../controller/group.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.post("/", createGroup);
router.get("/", getMyGroups);

// Invites addressed to me — must come before "/:id" or "invites" would be
// parsed as a group id.
router.get("/invites", getMyGroupInvites);
router.put("/invites/:id/respond", respondToGroupInvite);

router.get("/:id", getGroupDetails);
router.put("/:id", updateGroup);
router.delete("/:id", deleteGroup);

router.post("/:id/invites", inviteMembers);
router.get("/:id/invites", getGroupPendingInvites);
router.delete("/:id/invites/:inviteId", cancelGroupInvite);

router.delete("/:id/members/:memberId", removeMember);
router.put("/:id/members/:memberId/role", setMemberRole);

router.get("/:id/messages", getGroupMessages);
router.post("/:id/messages", sendGroupMessage);

export default router;
