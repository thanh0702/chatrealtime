import axios from "axios";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dd6lplyft/upload";
const UPLOAD_PRESET = "talkify_unsigned_preset"; // Replace with your Cloudinary unsigned upload preset

// Helper function to convert base64 string to File object
function base64ToFile(base64String, filename) {
  const arr = base64String.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  try {
    const response = await axios.post(CLOUDINARY_URL, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

export { base64ToFile };
