import News from "../models/News.js";
import cloudinary from "../lib/cloudinary.js";

// Helper function to upload media array to Cloudinary
async function uploadMediaArray(mediaArray) {
  const uploadedUrls = [];
  for (const media of mediaArray) {
    if (typeof media === "string" && media.startsWith("data:")) {
      // base64 string, upload to Cloudinary
      try {
        const uploadResponse = await cloudinary.uploader.upload(media, {
          folder: "talkify/news",
          resource_type: "auto",
        });
        uploadedUrls.push(uploadResponse.secure_url);
      } catch (error) {
        console.error("Cloudinary upload error:", error);
        // fallback: keep original media string
        uploadedUrls.push(media);
      }
    } else if (typeof media === "string") {
      // already a URL, keep as is
      uploadedUrls.push(media);
    }
  }
  return uploadedUrls;
}

// Create a new news post
export const createNews = async (req, res) => {
  try {
    const { userId, userName, content, media = [], privacy } = req.body;
    const uploadedMedia = await uploadMediaArray(media);
    const news = new News({ userId, userName, content, media: uploadedMedia, privacy });
    await news.save();
    res.status(201).json(news);
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
};

// Update an existing news post
export const updateNews = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, media = [], privacy, userId } = req.body;

    const news = await News.findById(id);
    if (!news) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (news.userId.toString() !== userId) {
      return res.status(403).json({ message: "You are not authorized to update this post" });
    }

    const uploadedMedia = await uploadMediaArray(media);

    news.content = content;
    news.media = uploadedMedia;
    news.privacy = privacy;

    await news.save();

    res.json(news);
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({ message: "Failed to update post" });
  }
};

// Additional controller methods can be added here as needed
