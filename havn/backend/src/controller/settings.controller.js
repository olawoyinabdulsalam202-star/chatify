import User from "../modules/User.js";

const DEFAULT_PREFS = {
  messages: true,
  groups: true,
  status: true,
  friends: true,
  reactions: true,
};

export const getNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("notificationPrefs").lean();
    res.status(200).json({ notificationPrefs: { ...DEFAULT_PREFS, ...(user?.notificationPrefs || {}) } });
  } catch (error) {
    console.log("Error loading notification settings:", error.message);
    res.status(500).json({ message: "Couldn't load notification settings." });
  }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    const prefs = {};
    for (const key of Object.keys(DEFAULT_PREFS)) {
      if (typeof req.body?.[key] === "boolean") prefs[`notificationPrefs.${key}`] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: prefs }, { new: true })
      .select("notificationPrefs")
      .lean();
    res.status(200).json({ notificationPrefs: { ...DEFAULT_PREFS, ...(user?.notificationPrefs || {}) } });
  } catch (error) {
    console.log("Error saving notification settings:", error.message);
    res.status(500).json({ message: "Couldn't save notification settings." });
  }
};
