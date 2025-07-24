import express from "express";
import { createNews, updateNews } from "../controllers/news.controller.js";
import News from "../models/News.js";
const router = express.Router();

// Use controller functions for create and update routes
router.post("/create", createNews);
router.put("/update/:id", updateNews);

// 
router.use(async (req, res, next) => {
  try {
    const currentTime = new Date().getTime();
    const oneHour = 24 * 60 * 60 * 1000; // 1 giờ tính bằng milliseconds
    const expiredPosts = await News.find({
      createdAt: { $lt: new Date(currentTime - oneHour) },
    });
    if (expiredPosts.length > 0) {
      await News.deleteMany({
        _id: { $in: expiredPosts.map((post) => post._id) },
      });
      console.log(`Deleted ${expiredPosts.length} expired posts at ${new Date().toLocaleString()}`);
    }
    next(); 
  } catch (error) {
    console.error("Error cleaning expired posts:", error);
    next(); 
  }
});

// Lấy danh sách bài viết công khai từ tất cả người dùng (có phân trang)
router.get("/public", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const currentTime = new Date().getTime();
    const oneHour = 24 * 60 * 60 * 1000; // 1 giờ tính bằng milliseconds

    const news = await News.find({
      privacy: "public",
      createdAt: { $gte: new Date(currentTime - oneHour) }, // Chỉ lấy bài viết trong 1 giờ
    })
      .sort({ pinned: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("likes")
      .populate("comments.userId");
    res.json(news);
  } catch (error) {
    console.error("Server error fetching public posts:", error); // Log lỗi chi tiết
    res.status(500).json({ message: "Failed to load public posts" });
  }
});

// Lấy danh sách bài viết của user (có phân trang)
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const currentTime = new Date().getTime();
    const oneHour = 24 * 60 * 60 * 1000; // 1 giờ tính bằng milliseconds

    const news = await News.find({
      userId,
      privacy: "public",
      createdAt: { $gte: new Date(currentTime - oneHour) }, // Chỉ lấy bài viết trong 1 giờ
    })
      .sort({ pinned: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("likes")
      .populate("comments.userId");
    res.json(news);
  } catch (error) {
    console.error("Server error fetching user posts:", error); // Log lỗi chi tiết
    res.status(500).json({ message: "Failed to load posts" });
  }
});

// Xoá bài viết
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await News.findByIdAndDelete(id);
    res.sendStatus(200);
  } catch (error) {
    console.error("Server error deleting post:", error); // Log lỗi chi tiết
    res.status(500).json({ message: "Failed to delete post" });
  }
});

// Like/Unlike bài viết
router.post("/like/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const news = await News.findById(id);
    if (!news) return res.status(404).json({ message: "Post not found" });
    if (news.likes.includes(userId)) {
      news.likes.pull(userId);
    } else {
      news.likes.push(userId);
    }
    await news.save();
    res.json({ likes: news.likes });
  } catch (error) {
    console.error("Server error liking post:", error); // Log lỗi chi tiết
    res.status(500).json({ message: "Failed to like post" });
  }
});

// Bình luận bài viết
router.post("/comment/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, content } = req.body;
    if (!userId || !userName || !content) {
      return res.status(400).json({ message: "Missing comment data" });
    }
    const news = await News.findById(id);
    if (!news) return res.status(404).json({ message: "Post not found" });
    news.comments.push({ userId, userName, content });
    await news.save();
    res.json({ comments: news.comments });
  } catch (error) {
    console.error("Server error commenting post:", error); // Log lỗi chi tiết
    res.status(500).json({ message: "Failed to comment" });
  }
});

export default router;