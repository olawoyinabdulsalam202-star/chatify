import { api } from "./api";

const IMAGE_FORMATS = "jpg,jpeg,png,webp,gif";

export async function uploadImage(asset) {
  const signed = await api("/uploads/sign", { method: "POST", body: { type: "image" } });
  if (asset.fileSize && asset.fileSize > signed.maxFileSize) throw new Error("This image is larger than the upload limit.");
  const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
  const mimeType = asset.mimeType || `image/${extension === "jpg" ? "jpeg" : extension}`;
  const form = new FormData();
  form.append("file", { uri: asset.uri, name: asset.fileName || `havn-${Date.now()}.${extension}`, type: mimeType });
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);
  form.append("allowed_formats", IMAGE_FORMATS);

  const endpoint = `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`;
  const response = await fetch(endpoint, { method: "POST", body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Could not upload the image.");
  return result.secure_url;
}
