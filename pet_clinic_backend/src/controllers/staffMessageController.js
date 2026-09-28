const model = require("../models/staffMessageModel");

async function list(req, res, next) {
  try {
    const currentUserId = req.query.currentUserId || req.user?.userId || req.user?.user_id || req.query.senderId;
    const otherUserId = req.query.otherUserId || req.query.receiverId;

    if (!currentUserId) {
      return res.status(400).json({ success: false, message: "currentUserId is required" });
    }

    const rows = await model.listBetweenUsers(currentUserId, otherUserId);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const senderId = req.body.sender_id || req.body.senderId || req.user?.userId || req.user?.user_id || req.user?.id;
    const receiverId = req.body.receiver_id || req.body.receiverId;
    const messageText = req.body.message_text || req.body.message || req.body.text || "";
    const attachmentData = req.body.attachment_data || req.body.attachmentData || req.body.fileData || null;
    const attachmentName = req.body.attachment_name || req.body.attachmentName || req.body.fileName || null;
    const attachmentType = req.body.attachment_type || req.body.attachmentType || req.body.fileType || null;
    const attachmentSize = req.body.attachment_size || req.body.attachmentSize || req.body.fileSize || null;

    if (!senderId) {
      return res.status(400).json({ success: false, message: "Sender ID is required" });
    }
    if (!messageText && !attachmentData) {
      return res.status(400).json({ success: false, message: "Message content or attachment is required" });
    }

    const result = await model.create({
      sender_id: senderId,
      receiver_id: receiverId,
      message_text: messageText,
      attachment_data: attachmentData,
      attachment_name: attachmentName,
      attachment_type: attachmentType,
      attachment_size: attachmentSize,
    });

    res.status(201).json({ success: true, data: result, message: "Message sent successfully" });
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const { senderId, receiverId } = req.body;
    if (!senderId || !receiverId) {
      return res.status(400).json({ success: false, message: "senderId and receiverId are required" });
    }
    await model.markAsRead(senderId, receiverId);
    res.json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    next(error);
  }
}

async function conversations(req, res, next) {
  try {
    const currentUserId = req.query.currentUserId || req.user?.userId || req.user?.user_id;
    if (!currentUserId) {
      return res.status(400).json({ success: false, message: "currentUserId is required" });
    }
    const rows = await model.getRecentConversations(currentUserId);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  create,
  markRead,
  conversations,
};
