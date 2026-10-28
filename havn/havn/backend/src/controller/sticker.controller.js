import cloudinary from "../lib/cloudinary.js";
import Sticker from "../modules/Sticker.js";

// Your own sticker tray, newest first — the "Yours" tab in the picker.
export const getMyStickers = async (req, res) => {
  try {
    const stickers = await Sticker.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(stickers);
  } catch (error) {
    console.log("Error in getMyStickers controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Turn an uploaded image into a sticker. The base64 is uploaded to Cloudinary
// once here; from then on the sticker travels as a hosted URL (like a gif), so
// sending one never re-uploads.
export const createSticker = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ message: "An image is required." });

    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: "havn/stickers",
    });

    const sticker = await Sticker.create({
      ownerId: req.user._id,
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id,
      kind: "created",
    });

    res.status(201).json(sticker);
  } catch (error) {
    console.log("Error in createSticker controller: ", error.message);
    res.status(500).json({ message: error.message || "Couldn't create sticker" });
  }
};

// Favorite a sticker someone sent you, by its hosted URL. Idempotent: saving the
// same one twice returns the existing row instead of erroring on the unique
// index.
export const saveSticker = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: "A sticker url is required." });

    const existing = await Sticker.findOne({ ownerId: req.user._id, url });
    if (existing) return res.status(200).json(existing);

    const sticker = await Sticker.create({
      ownerId: req.user._id,
      url,
      kind: "saved",
    });

    res.status(201).json(sticker);
  } catch (error) {
    // A race between two saves of the same url trips the unique index; treat it
    // as success and hand back the row that won.
    if (error.code === 11000) {
      const sticker = await Sticker.findOne({ ownerId: req.user._id, url: req.body.url });
      return res.status(200).json(sticker);
    }
    console.log("Error in saveSticker controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Remove a sticker from your tray. If you created it, the Cloudinary asset is
// ours to clean up; a saved sticker only drops the row.
export const deleteSticker = async (req, res) => {
  try {
    const { id } = req.params;
    const sticker = await Sticker.findOne({ _id: id, ownerId: req.user._id });
    if (!sticker) return res.status(404).json({ message: "Sticker not found." });

    if (sticker.kind === "created" && sticker.publicId) {
      // Don't let a Cloudinary hiccup strand the row — remove the asset best
      // effort, then delete the record regardless.
      try {
        await cloudinary.uploader.destroy(sticker.publicId);
      } catch (err) {
        console.log("Cloudinary destroy failed for sticker:", err.message);
      }
    }

    await sticker.deleteOne();
    res.status(200).json({ _id: id });
  } catch (error) {
    console.log("Error in deleteSticker controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
