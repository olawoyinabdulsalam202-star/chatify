import cloudinary from "../lib/cloudinary.js";
import Message from "../modules/Message.js";
import User from "../modules/User.js";


export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);

  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({Message: "server error"});
  }
};
export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;
    const messages = await Message.find({

      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

      res.status(200).json(messages);
}catch (error) {
  console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
}
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    // todo: emit socket event for new message
    res.status(201).json(newMessage);

  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUser = req.user._id

    //find all the messages where the logged-in user is either sender or receiver
    const messages = await Message.find({
      $or: [{senderId: loggedInUser}, {receiverId: loggedInUser}],
    });

    const chatPartnerIds = [
    ...new Set(
      messages.map((msg) =>
        msg.senderId.toString() === loggedInUser.toString() 
         ? msg.receiverId.toString()
            : msg.senderId.toString()
    )
    )
  ];

  const chatPartners = await User.find({_id: {$in: chatPartnerIds}}).select("-password");

  res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Error in getChatPartners:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}