import { create } from "zustand";
import toast from "react-hot-toast";
import {
  axiosInstance,
  fetchFriends,
  fetchSentRequests,
  fetchReceivedRequests,
  acceptFriendRequest as apiAcceptFriendRequest,
  declineFriendRequest as apiDeclineFriendRequest,
  cancelFriendRequest as apiCancelFriendRequest,
  searchUsers as apiSearchUsers,
  sendFriendRequest as apiSendFriendRequest,
  unfriend as apiUnfriend,
} from "../lib/axios";
import { uploadToCloudinary, base64ToFile } from "../lib/cloudinaryUpload";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  typingUsers: [],
  friends: [],
  isFriendsLoading: false,
  sentRequests: [],
  receivedRequests: [],
  isSentRequestsLoading: false,
  isReceivedRequestsLoading: false,
  globalSearchResults: [],
  isGlobalSearchLoading: false,
  news: [],
  isNewsLoading: false,
  hasMoreNews: true,
  newsPage: 1,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      const sortedUsers = res.data.sort((a, b) => {
        const aTime = a.lastMessage
          ? new Date(a.lastMessage.createdAt).getTime()
          : 0;
        const bTime = b.lastMessage
          ? new Date(b.lastMessage.createdAt).getTime()
          : 0;
        return bTime - aTime;
      });
      set({ users: sortedUsers });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, users } = get();
    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      const newMessage = res.data;
      set({ messages: [...messages, newMessage] });

      const updatedUsers = users
        .map((user) =>
          user._id === selectedUser._id
            ? {
                ...user,
                lastMessage: {
                  text: newMessage.text,
                  image: newMessage.image,
                  sticker: newMessage.sticker,
                  createdAt: newMessage.createdAt,
                  isSentByLoggedInUser: true,
                },
              }
            : user
        )
        .sort((a, b) => {
          const aTime = a.lastMessage
            ? new Date(a.lastMessage.createdAt).getTime()
            : 0;
          const bTime = b.lastMessage
            ? new Date(b.lastMessage.createdAt).getTime()
            : 0;
          return bTime - aTime;
        });
      set({ users: updatedUsers });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  revokeMessage: async (messageId) => {
    const { messages, users, selectedUser } = get();
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);
      const revokedMessage = res.data;

      // Cập nhật messages
      const updatedMessages = messages.map((msg) =>
        msg._id === messageId ? revokedMessage : msg
      );
      set({ messages: updatedMessages });

      // Chỉ cập nhật lastMessage nếu là last message thực sự
      if (selectedUser && isLastMessage(messages, revokedMessage)) {
        const updatedUsers = users.map((user) => {
          if (user._id === selectedUser._id) {
            return {
              ...user,
              lastMessage: {
                text: "You have revoked a message",
                image: null,
                sticker: null,
                createdAt: revokedMessage.createdAt,
                revoked: true,
                isSentByLoggedInUser: true,
              },
            };
          }
          return user;
        });
        set({ users: updatedUsers });
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error(
          error.response?.data?.error ||
            "You cannot revoke this message because the receiver does not allow messages from strangers and you are not friends."
        );
      } else {
        toast.error(error.response?.data?.error || "Failed to revoke message.");
      }
    }
  },

  editMessage: async (messageId, newText) => {
    const { messages, users, selectedUser } = get();
    try {
      const res = await axiosInstance.put(`/messages/${messageId}`, {
        text: newText,
      });
      const editedMessage = res.data;

      // Cập nhật messages
      const updatedMessages = messages.map((msg) =>
        msg._id === messageId ? editedMessage : msg
      );
      set({ messages: updatedMessages });

      // Chỉ cập nhật lastMessage nếu là last message thực sự
      if (selectedUser && isLastMessage(messages, editedMessage)) {
        const updatedUsers = users.map((user) => {
          if (user._id === selectedUser._id) {
            return {
              ...user,
              lastMessage: {
                text: editedMessage.text,
                image: editedMessage.image,
                sticker: editedMessage.sticker,
                createdAt: editedMessage.createdAt,
                edited: true,
                isSentByLoggedInUser: true,
              },
            };
          }
          return user;
        });
        set({ users: updatedUsers });
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error(
          error.response?.data?.error ||
            "You cannot edit this message because the receiver does not allow messages from strangers and you are not friends."
        );
      } else {
        toast.error(error.response?.data?.error || "Failed to edit message.");
      }
    }
  },

  getPublicNews: async () => {
    set({ isNewsLoading: true });
    try {
      console.log("Fetching public news...");
      const res = await axiosInstance.get("/news/public");
      console.log("Public news response:", res.data);
      set({
        news: res.data,
        hasMoreNews: res.data.length > 0,
        newsPage: 1,
        isNewsLoading: false,
      });
    } catch (error) {
      console.error("Error fetching public news:", error.response ? error.response.data : error.message);
      set({ isNewsLoading: false });
      toast.error(error?.response?.data?.message || "Failed to load public posts");
    }
  },

  getNews: async (userId, page = 1) => {
    set({ isNewsLoading: true });
    try {
      const res = await axiosInstance.get(`/news/user/${userId}?page=${page}`);
      set((state) => ({
        news: page === 1 ? res.data : [...state.news, ...res.data],
        hasMoreNews: res.data.length > 0,
        newsPage: page,
      }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load posts");
    } finally {
      set({ isNewsLoading: false });
    }
  },

  loadMoreNews: async (userId) => {
    const { newsPage, hasMoreNews } = get();
    if (!hasMoreNews) return;
    await get().getNews(userId, newsPage + 1);
  },

  createNews: async (payload) => {
    try {
      // Upload media files to Cloudinary first
      const uploadedMediaUrls = [];
      for (const media of payload.media) {
        if (media instanceof File) {
          const url = await uploadToCloudinary(media);
          uploadedMediaUrls.push(url);
        } else if (typeof media === "string") {
          // Convert base64 string to File object before upload
          const file = base64ToFile(media, "upload");
          const url = await uploadToCloudinary(file);
          uploadedMediaUrls.push(url);
        }
      }
      const newPayload = { ...payload, media: uploadedMediaUrls };

      const res = await axiosInstance.post("/news/create", newPayload);
      set((state) => ({
        news: [res.data, ...state.news],
      }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to create post");
      throw error;
    }
  },

  likeNews: async (newsId) => {
    try {
      const { authUser } = useAuthStore.getState();
      const res = await axiosInstance.post(`/news/like/${newsId}`, { userId: authUser._id });
      set((state) => {
        const updatedNews = state.news.map((item) =>
          item._id === newsId ? { ...item, likes: res.data.likes } : item
        );
        return { news: [...updatedNews] };
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to like post");
    }
  },

  addComment: async (newsId, comment) => {
    try {
      const { authUser } = useAuthStore.getState();
      const res = await axiosInstance.post(`/news/comment/${newsId}`, {
        userId: authUser._id,
        userName: authUser.fullName,
        content: comment,
      });
      set((state) => {
        const updatedNews = state.news.map((item) =>
          item._id === newsId ? { ...item, comments: res.data.comments } : item
        );
        return { news: [...updatedNews] };
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to comment");
    }
  },

  updateNews: async (newsId, payload) => {
    try {
      // Upload media files to Cloudinary first
      const uploadedMediaUrls = [];
      for (const media of payload.media) {
        if (media instanceof File) {
          const url = await uploadToCloudinary(media);
          uploadedMediaUrls.push(url);
        } else if (typeof media === "string") {
          // Convert base64 string to File object before upload
          const file = base64ToFile(media, "upload");
          const url = await uploadToCloudinary(file);
          uploadedMediaUrls.push(url);
        }
      }
      const newPayload = { ...payload, media: uploadedMediaUrls };

      const res = await axiosInstance.put(`/news/update/${newsId}`, newPayload);
      set((state) => ({
        news: state.news.map((item) =>
          item._id === newsId ? res.data : item
        ),
      }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update post");
      throw error;
    }
  },

  deleteNews: async (newsId) => {
    try {
      await axiosInstance.delete(`/news/delete/${newsId}`);
      set((state) => ({
        news: state.news.filter((item) => item._id !== newsId),
      }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete post");
      throw error;
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("messageRevoked");
    socket.off("messageEdited");

    socket.on("newMessage", async (newMessage) => {
      const { selectedUser, messages, users } = get();
      const loggedInUserId = useAuthStore.getState().authUser?._id;

      const relatedUserId =
        newMessage.senderId === loggedInUserId
          ? newMessage.receiverId
          : newMessage.senderId;

      // Nếu user lạ chưa có trong danh sách users, chỉ fetch user đó và thêm vào đầu danh sách
      if (!users.some((u) => u._id === relatedUserId)) {
        try {
          const res = await axiosInstance.get(`/auth/users/${relatedUserId}`);
          const foundUser = res.data;
          if (foundUser) {
            const userToAdd = {
              ...foundUser,
              lastMessage: {
                text: newMessage.text,
                image: newMessage.image,
                sticker: newMessage.sticker,
                createdAt: newMessage.createdAt,
                isSentByLoggedInUser: newMessage.senderId === loggedInUserId,
              },
            };
            set((state) => ({ users: [userToAdd, ...state.users] }));
          }
        } catch (err) {
          // Nếu fetch user lỗi, fallback: fetch lại toàn bộ users như cũ
          get().getUsers();
        }
      } else {
        // Nếu user đã có, update lastMessage như cũ
        let updatedUsers = users.map((user) => {
          if (user._id === relatedUserId) {
            return {
              ...user,
              lastMessage: {
                text: newMessage.text,
                image: newMessage.image,
                sticker: newMessage.sticker,
                createdAt: newMessage.createdAt,
                isSentByLoggedInUser: newMessage.senderId === loggedInUserId,
              },
            };
          }
          return user;
        });
        // Đẩy user có tin nhắn mới lên đầu
        const idx = updatedUsers.findIndex((u) => u._id === relatedUserId);
        if (idx > -1) {
          const [userToTop] = updatedUsers.splice(idx, 1);
          updatedUsers = [userToTop, ...updatedUsers];
        }
        set((state) => ({ users: [...updatedUsers] }));
      }

      if (
        selectedUser &&
        (newMessage.senderId === selectedUser._id ||
          newMessage.receiverId === selectedUser._id)
      ) {
        set({ messages: [...messages, newMessage] });

        if (newMessage.senderId === selectedUser._id) {
          set((state) => ({
            typingUsers: state.typingUsers.filter(
              (id) => id !== newMessage.senderId
            ),
          }));
        }
      }
    });

    // Handle message revoked event
    socket.on("messageRevoked", async (revokedMessage) => {
      const { users, selectedUser, messages } = get();
      const loggedInUserId = useAuthStore.getState().authUser?._id;

      const relatedUserId =
        revokedMessage.senderId === loggedInUserId
          ? revokedMessage.receiverId
          : revokedMessage.senderId;

      let updated = false;
      const updatedUsers = users.map((user) => {
        if (
          user._id === relatedUserId &&
          user.lastMessage &&
          user.lastMessage._id === revokedMessage._id
        ) {
          updated = true;
          const isSentByLoggedInUser =
            revokedMessage.senderId === loggedInUserId;
          return {
            ...user,
            lastMessage: {
              ...user.lastMessage,
              text: isSentByLoggedInUser
                ? "You have revoked a message"
                : "The other party has revoked a message",
              image: null,
              sticker: null,
              revoked: true,
              isSentByLoggedInUser,
              createdAt: revokedMessage.createdAt,
            },
          };
        }
        return user;
      });
      set({ users: updatedUsers });

      // Nếu không cập nhật được (do lastMessage._id không trùng), fetch lại users từ backend (không nháy loading)
      if (!updated) {
        try {
          const res = await axiosInstance.get("/messages/users");
          const sortedUsers = res.data.sort((a, b) => {
            const aTime = a.lastMessage
              ? new Date(a.lastMessage.createdAt).getTime()
              : 0;
            const bTime = b.lastMessage
              ? new Date(b.lastMessage.createdAt).getTime()
              : 0;
            return bTime - aTime;
          });
          set({ users: sortedUsers });
        } catch (error) {
          // ignore
        }
      }

      // Nếu đang mở đoạn chat này thì cập nhật messages
      if (
        selectedUser &&
        (selectedUser._id === revokedMessage.senderId ||
          selectedUser._id === revokedMessage.receiverId)
      ) {
        // Cập nhật cả message gốc và các message reply tới message này
        const updatedMessages = messages.map((msg) => {
          if (msg._id === revokedMessage._id) return revokedMessage;
          // Nếu là reply tới message vừa revoke, cập nhật lại trường replyTo
          if (msg.replyTo && msg.replyTo._id === revokedMessage._id) {
            return {
              ...msg,
              replyTo: revokedMessage,
            };
          }
          return msg;
        });
        set({ messages: updatedMessages });
      }
    });

    // Handle message edited event
    socket.on("messageEdited", async (editedMessage) => {
      const { users, selectedUser, messages } = get();
      const loggedInUserId = useAuthStore.getState().authUser?._id;

      const relatedUserId =
        editedMessage.senderId === loggedInUserId
          ? editedMessage.receiverId
          : editedMessage.senderId;

      let updated = false;
      const updatedUsers = users.map((user) => {
        if (
          user._id === relatedUserId &&
          user.lastMessage &&
          user.lastMessage._id === editedMessage._id
        ) {
          updated = true;
          const isSentByLoggedInUser =
            editedMessage.senderId === loggedInUserId;
          return {
            ...user,
            lastMessage: {
              ...user.lastMessage,
              text: editedMessage.text,
              image: editedMessage.image,
              sticker: editedMessage.sticker,
              edited: true,
              isSentByLoggedInUser,
              createdAt: editedMessage.createdAt,
            },
          };
        }
        return user;
      });
      set({ users: updatedUsers });

      // Nếu không cập nhật được (do lastMessage._id không trùng), fetch lại users từ backend (không nháy loading)
      if (!updated) {
        try {
          const res = await axiosInstance.get("/messages/users");
          const sortedUsers = res.data.sort((a, b) => {
            const aTime = a.lastMessage
              ? new Date(a.lastMessage.createdAt).getTime()
              : 0;
            const bTime = b.lastMessage
              ? new Date(b.lastMessage.createdAt).getTime()
              : 0;
            return bTime - aTime;
          });
          set({ users: sortedUsers });
        } catch (error) {
          // ignore
        }
      }

      // Nếu đang mở đoạn chat này thì cập nhật messages
      if (
        selectedUser &&
        (selectedUser._id === editedMessage.senderId ||
          selectedUser._id === editedMessage.receiverId)
      ) {
        // Cập nhật cả message gốc và các message reply tới message này
        const updatedMessages = messages.map((msg) => {
          if (msg._id === editedMessage._id) return editedMessage;
          // Nếu là reply tới message vừa edit, cập nhật lại trường replyTo
          if (msg.replyTo && msg.replyTo._id === editedMessage._id) {
            return {
              ...msg,
              replyTo: editedMessage,
            };
          }
          return msg;
        });
        set({ messages: updatedMessages });
      }
    });

    // Handle typing event
    socket.on("typing", (senderId) => {
      const { selectedUser } = get();
      if (selectedUser && senderId === selectedUser._id) {
        set((state) => {
          if (!state.typingUsers.includes(senderId)) {
            return { typingUsers: [...state.typingUsers, senderId] };
          }
          return state;
        });
      }
    });

    socket.on("stopTyping", (senderId) => {
      const { selectedUser } = get();
      if (selectedUser && senderId === selectedUser._id) {
        set((state) => ({
          typingUsers: state.typingUsers.filter((id) => id !== senderId),
        }));
      }
    });

    // Handle friendship updates
    socket.on("friendshipUpdate", (update) => {
      const { type } = update;
      console.log("Friendship update in chat store:", type);

      // Refresh relevant data based on update type
      if (
        type === "new_received_request" ||
        type ==="request_accepted" ||
        type === "request_declined" ||
        type === "request_cancelled" ||
        type === "unfriended"
      ) {
        // Small delay to ensure backend has processed the update
        setTimeout(() => {
          get().fetchFriends();
          get().fetchSentRequests();
          get().fetchReceivedRequests();
        }, 100);
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("typing");
      socket.off("stopTyping");
      socket.off("messageRevoked");
      socket.off("messageEdited");
    }

    set({ typingUsers: [] });
  },

  sendTypingStatus: (isTyping) => {
    const socket = useAuthStore.getState().socket;
    const { authUser } = useAuthStore.getState();
    const { selectedUser } = get();

    if (!socket || !authUser || !selectedUser) return;

    if (isTyping) {
      socket.emit("typing", {
        receiverId: selectedUser._id,
        senderId: authUser._id,
      });
    } else {
      socket.emit("stopTyping", {
        receiverId: selectedUser._id,
        senderId: authUser._id,
      });
    }
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser, typingUsers: [] });
  },

  fetchFriends: async () => {
    set({ isFriendsLoading: true });
    try {
      const data = await fetchFriends();
      set({ friends: data });
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Error fetching friends list"
      );
    } finally {
      set({ isFriendsLoading: false });
    }
  },

  fetchSentRequests: async () => {
    set({ isSentRequestsLoading: true });
    try {
      const data = await fetchSentRequests();
      set({ sentRequests: data });
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Error fetching sent requests"
      );
    } finally {
      set({ isSentRequestsLoading: false });
    }
  },

  fetchReceivedRequests: async () => {
    set({ isReceivedRequestsLoading: true });
    try {
      const data = await fetchReceivedRequests();
      set({ receivedRequests: data });
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Error fetching received requests"
      );
    } finally {
      set({ isReceivedRequestsLoading: false });
    }
  },

  acceptFriendRequest: async (requesterId) => {
    try {
      await apiAcceptFriendRequest(requesterId);
      await get().fetchReceivedRequests();
      await get().fetchFriends();
      toast.success("Friend request accepted");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Error accepting friend request"
      );
    }
  },

  declineFriendRequest: async (requesterId) => {
    try {
      await apiDeclineFriendRequest(requesterId);
      await get().fetchReceivedRequests();
      toast.success("Friend request declined");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Error declining friend request"
      );
    }
  },

  cancelFriendRequest: async (recipientId) => {
    try {
      await apiCancelFriendRequest(recipientId);
      await get().fetchSentRequests();
      toast.success("Friend request cancelled");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Error cancelling friend request"
      );
    }
  },

  searchUsersGlobal: async (query, excludeFriends = false) => {
    set({ isGlobalSearchLoading: true });
    try {
      const data = await apiSearchUsers(query, excludeFriends);
      set({ globalSearchResults: data });
    } catch (error) {
      set({ globalSearchResults: [] });
    } finally {
      set({ isGlobalSearchLoading: false });
    }
  },

  sendFriendRequest: async (recipientId) => {
    try {
      await apiSendFriendRequest(recipientId);
      toast.success("Friend request sent");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Error sending friend request"
      );
    }
  },

  unfriend: async (friendId) => {
    try {
      await apiUnfriend(friendId);
      await get().fetchFriends();
      toast.success("Unfriended successfully");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Error unfriending");
    }
  },

  reset: () =>
    set({
      messages: [],
      users: [],
      selectedUser: null,
      isUsersLoading: false,
      isMessagesLoading: false,
      typingUsers: [],
      friends: [],
      isFriendsLoading: false,
      sentRequests: [],
      receivedRequests: [],
      isSentRequestsLoading: false,
      isReceivedRequestsLoading: false,
      globalSearchResults: [],
      isGlobalSearchLoading: false,
      news: [],
      isNewsLoading: false,
      hasMoreNews: true,
      newsPage: 1,
    }),
}));

// Thêm hàm tiện ích kiểm tra last message
const isLastMessage = (messages, message) => {
  if (!messages.length) return false;
  return messages[messages.length - 1]._id === message._id;
};