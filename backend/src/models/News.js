import mongoose from "mongoose";

const NewsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    media: [
      {
        type: String, // Lưu base64 hoặc URL của ảnh/video
      },
    ],
    privacy: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        userName: { type: String, required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        replies: [
          {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            userName: { type: String, required: true },
            content: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
          },
        ],
      },
    ],
    pinned: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// Index để tối ưu hóa truy vấn
NewsSchema.index({ userId: 1, createdAt: -1 }); // Sắp xếp theo thời gian giảm dần cho user
NewsSchema.index({ pinned: -1, createdAt: -1 }); // Ưu tiên bài ghim

// Thêm TTL index để tự động xóa sau 24 giờ (dựa trên createdAt)
NewsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 }); // 86400 giây = 24 giờ

const News = mongoose.model("News", NewsSchema);
export default News;