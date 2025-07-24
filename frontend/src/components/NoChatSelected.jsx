import { useState, useEffect } from "react";
import { LucideGlobe, Heart, MessageCircle, Edit, Trash, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";

const NoChatSelected = () => {
  const { authUser, isLoading: authLoading } = useAuthStore();
  const {
    news,
    createNews,
    likeNews,
    addComment,
    updateNews,
    deleteNews,
    getPublicNews,
    loadMoreNews,
    hasMoreNews,
    isNewsLoading,
    setNews,
  } = useChatStore();

  const [newContent, setNewContent] = useState("");
  const [newMedia, setNewMedia] = useState([]);
  const [newPrivacy, setNewPrivacy] = useState("public");
  const [editNewsId, setEditNewsId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editMedia, setEditMedia] = useState([]);
  const [editPrivacy, setEditPrivacy] = useState("public");
  const [commentInput, setCommentInput] = useState("");
  const [pinnedPost, setPinnedPost] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedUserPosts, setSelectedUserPosts] = useState([]);
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);

  useEffect(() => {
    if (authUser?._id) {
      getPublicNews().catch(() => {
        toast.error("Failed to load posts. Please try again.");
      });
    }
  }, [authUser?._id, getPublicNews]);

  const handleMediaUpload = (e, isEdit = false) => {
    const files = Array.from(e.target.files);
    const maxFiles = 5;
    const maxImageSize = 5 * 1024 * 1024; // 5MB
    const maxVideoSize = 10 * 1024 * 1024; // 10MB

    if (files.length > maxFiles) {
      toast.error(`You can upload a maximum of ${maxFiles} files at a time.`);
      return;
    }

    const validFiles = files.filter((file) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const isValidType = isImage || isVideo;
      const isValidSize = isImage
        ? file.size <= maxImageSize
        : isVideo
        ? file.size <= maxVideoSize
        : false;

      if (!isValidType) {
        toast.error(`File "${file.name}" is not a valid image or video.`);
        return false;
      }
      if (!isValidSize) {
        toast.error(
          `File "${file.name}" exceeds size limit (${
            isImage ? "5MB for images" : "10MB for videos"
          }).`
        );
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      toast.error("No valid files selected. Please upload images or videos only.");
      return;
    }

    Promise.all(
      validFiles.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          })
      )
    )
      .then((base64Files) => {
        if (isEdit) {
          setEditMedia((prev) => [...prev, ...base64Files]);
        } else {
          setNewMedia((prev) => [...prev, ...base64Files]);
        }
        toast.success(`${validFiles.length} file(s) uploaded successfully!`);
      })
      .catch(() => {
        toast.error("Failed to upload media. Please try again.");
      });
  };

  const handleCreateNews = async () => {
    if (!authUser?._id) {
      toast.error("Please log in to post.");
      return;
    }
    if (!newContent.trim() && newMedia.length === 0) {
      toast.error("Content or media is required.");
      return;
    }
    const payload = {
      content: newContent.trim() === "" ? " " : newContent,
      media: newMedia,
      privacy: newPrivacy,
      userId: authUser._id,
      userName: authUser.fullName,
    };
    try {
      await createNews(payload);
      setNewContent("");
      setNewMedia([]);
      setNewPrivacy("public");
      toast.success("Post created successfully!");
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post. Please try again.");
    }
  };

  const handleUpdateNews = async (newsId) => {
    if (!editContent.trim() && editMedia.length === 0) {
      toast.error("Content or media is required.");
      return;
    }
    try {
      const existingMedia = editMedia.filter(
        (m) => typeof m === "string" && (m.startsWith("http") || m.startsWith("/"))
      );
      const newBase64Media = editMedia.filter(
        (m) => typeof m === "string" && m.startsWith("data:")
      );

      const newFiles = newBase64Media.map((base64) => {
        return base64ToFile(base64, "upload");
      });

      const combinedMedia = [...existingMedia, ...newFiles];

      await updateNews(newsId, {
        content: editContent,
        media: combinedMedia,
        privacy: editPrivacy,
        userId: authUser._id,
      });
      setEditNewsId(null);
      setEditContent("");
      setEditMedia([]);
      setEditPrivacy("public");
      toast.success("Post updated successfully!");
    } catch {
      toast.error("Failed to update post. Please try again.");
    }
  };

  const handleDeleteNews = async (newsId) => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      try {
        await deleteNews(newsId);
        toast.success("Post deleted successfully!");
      } catch {
        toast.error("Failed to delete post. Please try again.");
      }
    }
  };

  const handleLike = (newsId) => {
    try {
      likeNews(newsId);
    } catch {
      toast.error("Failed to like post. Please try again.");
    }
  };

  const handleComment = (newsId) => {
    if (commentInput.trim()) {
      try {
        addComment(newsId, commentInput);
        setCommentInput("");
        toast.success("Comment added!");
      } catch {
        toast.error("Failed to add comment. Please try again.");
      }
    }
  };

  const loadMore = () => {
    loadMoreNews().catch(() => {
      toast.error("Failed to load more posts.");
    });
  };

  const formatTimeAgo = (date) => {
    const diff = (Date.now() - new Date(date)) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return new Date(date).toLocaleDateString();
  };

  const representativePosts = Object.values(
    news.reduce((acc, item) => {
      if (
        !acc[item.userId] ||
        new Date(item.createdAt) > new Date(acc[item.userId].createdAt)
      ) {
        acc[item.userId] = item;
      }
      return acc;
    }, {})
  );

  if (authLoading) return <div className="text-center">Loading...</div>;
  if (!authUser) return <div className="text-center">Please log in to continue.</div>;

  return (
    <div className="w-full flex flex-1 flex-col items-center justify-start p-2 bg-base-100/50">
      <div
        className="max-w-2xl w-full text-center space-y-6"
        style={{ maxHeight: "85vh", overflowY: "auto", paddingBottom: 16 }}
      >
        {/* Form táº¡o bĂ i Ä‘Äƒng */}
        <div className="bg-base-200 p-3 rounded-lg mt-2 max-w-2xl w-full flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <img
              src={authUser?.profilePic || "/avatar.png"}
              alt="User Profile"
              className="w-10 h-10 rounded-full object-cover"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="What's on your mind?"
              className="flex-1 p-2 bg-base-100 rounded-lg border resize-none h-16 text-sm"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label
              htmlFor="media-upload"
              className="inline-flex items-center justify-center cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors w-36"
              title="Upload images or videos"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 15a4 4 0 004 4h10a4 4 0 004-4v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 10l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
              <span>Upload Media</span>
              <input
                id="media-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => handleMediaUpload(e, false)}
              />
            </label>
            <select
              value={newPrivacy}
              onChange={(e) => setNewPrivacy(e.target.value)}
              className="p-3 bg-base-100 rounded-lg border text-sm w-36"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="private">Only Me</option>
            </select>
            <button
              onClick={handleCreateNews}
              className="bg-primary text-white p-2 rounded-lg flex-1"
              style={{ minWidth: 100 }}
            >
              Post
            </button>
          </div>
          {newMedia.length > 0 && (
            <div className="flex gap-2 flex-wrap" style={{ width: "100%", padding: 0, margin: 0, boxSizing: "border-box" }}>
              {newMedia.map((media, idx) => {
                const isVideo =
                  media.startsWith("http")
                    ? media.match(/\.(mp4|webm|ogg)$/i)
                    : !media.startsWith("data:image/");
                return (
                  <div key={idx} className="relative group w-24 h-36">
                    {isVideo ? (
                      <video
                        src={media}
                        controls
                        className="h-full object-cover"
                        style={{ aspectRatio: "3 / 4", width: "100%", borderRadius: 0 }}
                      />
                    ) : (
                      <img
                        src={media}
                        alt="Preview"
                        className="h-full object-cover"
                        style={{ aspectRatio: "3 / 4", width: "100%", borderRadius: 0 }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNewMedia((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="absolute top-0 right-0 bg-black bg-opacity-50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove media"
                    >
                      Ă—
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4">
          {isNewsLoading ? (
            <div className="text-center">Loading posts...</div>
          ) : news.length === 0 ? (
            <div className="text-center text-base-content/60">No posts yet.</div>
          ) : (
            <>
              {pinnedPost && news.find((item) => item._id === pinnedPost) && (
                <div className="bg-base-200 p-2 rounded-lg mb-3 border-2 border-yellow-500">
                  <p className="text-sm">{news.find((item) => item._id === pinnedPost).content}</p>
                  <p className="text-xs text-zinc-400 mt-1">Pinned Post</p>
                </div>
              )}
              <div className="relative w-full">
                <button
                  onClick={() => {
                    const container = document.getElementById("posts-scroll-container");
                    if (container) {
                      container.scrollBy({ left: -200, behavior: "smooth" });
                    }
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white w-10 h-10 flex items-center justify-center rounded-full shadow-md hover:bg-gray-400 transition-colors duration-300"
                  aria-label="Scroll Left"
                >
                  â†
                </button>
                <div
                  id="posts-scroll-container"
                  className="flex overflow-x-auto space-x-2 scrollbar-hide scroll-smooth"
                  style={{ scrollSnapType: "x mandatory" }}
                >
                  {representativePosts
                    .filter((item) => item._id !== pinnedPost)
                    .map((item) => {
                      const onlyText = (!item.media || item.media.length === 0) && item.content;
                      const users = useChatStore.getState().users;
                      const user = users.find((u) => u._id === item.userId);
                      const profilePic = user?.profilePic || "/avatar.png";
                      return (
                        <div
                          key={item._id}
                          className={`rounded-lg p-2 relative cursor-pointer transition hover:scale-105 flex-shrink-0 scroll-snap-align-start flex flex-col items-center ${
                            onlyText ? "bg-black text-white w-40 h-80" : "bg-base-200 w-40 h-80"
                          }`}
                          onClick={() => {
                            const userPosts = news
                              .filter((n) => n.userId === item.userId)
                              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                            setSelectedUserPosts(userPosts);
                            setSelectedPostIndex(0);
                            setSelectedPost(userPosts[0]);
                          }}
                          title="Click to view details"
                        >
                          <img
                            src={profilePic}
                            alt={item.userName}
                            className="w-6 h-6 rounded-full object-cover mb-1"
                          />
                          <p className={`text-sm line-clamp-2 ${onlyText ? "text-white" : ""}`}>
                            {item.content}
                          </p>
                          {item.media && item.media.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-2 h-full">
                              {item.media.map((media, idx) =>
                                media.startsWith("http") ? (
                                  media.match(/\.(mp4|webm|ogg)$/i) ? (
                                    <video
                                      key={idx}
                                      src={media}
                                      controls
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                  ) : (
                                    <img
                                      key={idx}
                                      src={media}
                                      alt="Post Media"
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                  )
                                ) : media.startsWith("data:image/") ? (
                                  <img
                                    key={idx}
                                    src={media}
                                    alt="Post Media"
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                ) : (
                                  <video
                                    key={idx}
                                    src={media}
                                    controls
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
                <button
                  onClick={() => {
                    const container = document.getElementById("posts-scroll-container");
                    if (container) {
                      container.scrollBy({ left: 200, behavior: "smooth" });
                    }
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white w-10 h-10 flex items-center justify-center rounded-full shadow-md hover:bg-gray-400 transition-colors duration-300"
                  aria-label="Scroll Right"
                >
                  â†’
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-base-100 rounded-lg p-4 max-w-md w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
              onClick={() => setSelectedPost(null)}
            >
              <X size={22} />
            </button>
            {selectedPostIndex > 0 && (
              <button
                className="absolute left-[-60px] top-1/2 -translate-y-1/2 btn btn-sm"
                onClick={() => {
                  setSelectedPostIndex(selectedPostIndex - 1);
                  setSelectedPost(selectedUserPosts[selectedPostIndex - 1]);
                }}
              >
                Prev
              </button>
            )}
            {selectedPostIndex < selectedUserPosts.length - 1 && (
              <button
                className="absolute right-[-60px] top-1/2 -translate-y-1/2 btn btn-sm"
                onClick={() => {
                  setSelectedPostIndex(selectedPostIndex + 1);
                  setSelectedPost(selectedUserPosts[selectedPostIndex + 1]);
                }}
              >
                Next
              </button>
            )}
            <div className="mb-2 flex items-center gap-2">
              <span className="font-semibold">{selectedPost.userName}</span>
              <span className="text-xs text-zinc-400">{formatTimeAgo(selectedPost.createdAt)}</span>
            </div>
            {(!selectedPost.media || selectedPost.media.length === 0) && (
              <div className="bg-black rounded-lg p-4 mb-2 flex items-center justify-center w-full h-96" style={{ aspectRatio: "3 / 5" }}>
                <p className="text-white text-lg">{selectedPost.content}</p>
              </div>
            )}
            {selectedPost.media && selectedPost.media.length > 0 && (
              <div className="flex flex-col gap-2 mb-2" style={{ width: "100%", padding: 0, margin: 0, boxSizing: "border-box" }}>
                {selectedPost.media.map((media, idx) =>
                  media.startsWith("http") ? (
                    media.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video
                        key={idx}
                        src={media}
                        controls
                        className="h-96 object-cover"
                        style={{ aspectRatio: "3 / 5", width: "100%", borderRadius: 0 }}
                      />
                    ) : (
                      <img
                        key={idx}
                        src={media}
                        alt="Post Media"
                        className="h-96 object-cover"
                        style={{ aspectRatio: "3 / 5", width: "100%", borderRadius: 0 }}
                      />
                    )
                  ) : media.startsWith("data:image/") ? (
                    <img
                      key={idx}
                      src={media}
                      alt="Post Media"
                      className="h-96 object-cover"
                      style={{ aspectRatio: "3 / 5", width: "100%", borderRadius: 0 }}
                    />
                  ) : (
                    <video
                      key={idx}
                      src={media}
                      controls
                      className="h-96 object-cover"
                      style={{ aspectRatio: "3 / 5", width: "100%", borderRadius: 0 }}
                    />
                  )
                )}
                <p className="text-base mt-2">{selectedPost.content}</p>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleLike(selectedPost._id)}
                className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 flex items-center gap-1"
              >
                <Heart size={18} />
                <span>{selectedPost.likes?.length || 0}</span>
              </button>
              {authUser?._id === selectedPost.userId && (
                <button
                  onClick={() => {
                    setEditNewsId(selectedPost._id);
                    setEditContent(selectedPost.content || "");
                    setEditMedia(selectedPost.media || []);
                    setEditPrivacy(selectedPost.privacy || "public");
                    setSelectedPost(null);
                  }}
                  className="bg-yellow-500 text-white p-2 rounded-full"
                >
                  <Edit size={18} />
                </button>
              )}
              {authUser?._id === selectedPost.userId && (
                <button
                  onClick={() => {
                    handleDeleteNews(selectedPost._id);
                    setSelectedPost(null);
                  }}
                  className="bg-red-700 text-white p-2 rounded-full"
                >
                  <Trash size={18} />
                </button>
              )}
            </div>
            <div className="mt-3">
              <span className="font-semibold text-sm">Comments:</span>
              <div className="max-h-32 overflow-y-auto mt-1 mb-2">
                {selectedPost.comments && selectedPost.comments.length > 0 ? (
                  selectedPost.comments.map((c, idx) => (
                    <div key={idx} className="text-xs text-left mb-1">
                      <span className="font-semibold">{c.userName || "User"}:</span> {c.content}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-400">No comments yet.</div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  id={`comment-input-${selectedPost._id}`}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Add a comment..."
                  className="p-1 bg-base-100 rounded-lg border w-full text-xs"
                />
                <button
                  onClick={() => {
                    handleComment(selectedPost._id);
                  }}
                  className="bg-blue-500 text-white p-1 rounded-lg"
                >
                  <MessageCircle size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editNewsId && (
        <div className="mt-2 bg-base-200 p-3 rounded-lg">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="p-2 bg-base-100 rounded-lg border w-full text-sm"
          />
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => handleMediaUpload(e, true)}
            multiple
            className="p-1 bg-base-100 rounded-lg border mt-2"
          />
          {editMedia.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {editMedia.map((media, index) => (
                <div key={index} className="relative group w-full">
                  {media.startsWith("data:image/") || media.match(/\.(png|jpg|jpeg|gif)$/i) ? (
                    <img
                      src={media}
                      alt="Preview"
                      className="w-full h-auto object-cover rounded-lg"
                      style={{ aspectRatio: "3 / 4" }}
                    />
                  ) : (
                    <video
                      src={media}
                      controls
                      className="w-full h-auto object-cover rounded-lg"
                      style={{ aspectRatio: "3 / 4" }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditMedia((prev) => prev.filter((_, i) => i !== index));
                    }}
                    className="absolute top-0 right-0 bg-black bg-opacity-50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove media"
                  >
                    Ă—
                  </button>
                </div>
              ))}
            </div>
          )}
          <select
            value={editPrivacy}
            onChange={(e) => setEditPrivacy(e.target.value)}
            className="p-1 bg-base-100 rounded-lg border mt-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="friends">Friends</option>
            <option value="private">Only Me</option>
          </select>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleUpdateNews(editNewsId)}
              className="bg-blue-500 text-white p-1 rounded-lg"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditNewsId(null);
                setEditContent("");
                setEditMedia([]);
                setEditPrivacy("public");
              }}
              className="bg-gray-500 text-white p-1 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoChatSelected;