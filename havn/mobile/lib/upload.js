import { File, UploadType } from "expo-file-system";
import { api } from "./api";

const FORMATS = {
  image: "jpg,jpeg,png,webp,gif",
  video: "mp4,mov,webm,mkv",
};

export async function uploadMedia({ asset, type, onProgress, selection }) {
  if (!asset?.uri) throw new Error("Choose a file to upload.");
  if (!FORMATS[type]) throw new Error("This media type is not supported.");
  const eager = type === "video" && selection ? getVideoTransformation(selection) : "";
  const signed = await api("/uploads/sign", { method: "POST", body: { type, ...(eager ? { eager } : {}) } });
  const file = new File(asset.uri);
  const fileSize = Number(asset.fileSize || file.size || 0);
  const maxFileSize = Number(signed.maxFileSize || 0);
  if (fileSize && maxFileSize && fileSize > maxFileSize) throw new Error("This file is larger than the upload limit.");
  if (type === "video" && fileSize > 100 * 1024 * 1024) throw new Error("Choose a video smaller than 100MB.");

  const extension = asset.fileName?.split(".").pop() || asset.uri.split(".").pop()?.split("?")[0] || (type === "video" ? "mp4" : "jpg");
  if (!FORMATS[type].split(",").includes(extension.toLowerCase())) throw new Error(`This ${type} format is not supported.`);
  const mimeType = asset.mimeType || `${type}/${extension.toLowerCase() === "jpg" ? "jpeg" : extension.toLowerCase()}`;
  const endpoint = `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`;
  const task = file.createUploadTask(endpoint, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType,
    parameters: {
      api_key: String(signed.apiKey),
      timestamp: String(signed.timestamp),
      signature: String(signed.signature),
      folder: String(signed.folder),
      allowed_formats: FORMATS[type],
      ...(eager ? { eager, eager_async: "true" } : {}),
    },
    onProgress: ({ bytesSent, totalBytes }) => onProgress?.(totalBytes > 0 ? bytesSent / totalBytes : 0),
  });

  let response;
  try { response = await task.uploadAsync(); }
  catch { throw new Error("Upload failed. Check your connection and try again."); }
  const result = JSON.parse(response.body || "{}");
  if (response.status < 200 || response.status >= 300 || !result.secure_url) throw new Error(result.error?.message || `Could not upload the ${type}.`);
  onProgress?.(1);
  return result.secure_url;
}

export const uploadImage = (asset, onProgress) => uploadMedia({ asset, type: "image", onProgress });

function formatSeconds(milliseconds) {
  return (Math.max(0, milliseconds) / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function getVideoTransformation(selection) {
  const start = Number(selection?.startTime);
  const end = Number(selection?.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 30_000) {
    throw new Error("Choose a valid video section up to 30 seconds long.");
  }
  const quality = selection.lowQuality ? "q_auto:low,w_480" : "q_auto,w_720";
  return `so_${formatSeconds(start)},eo_${formatSeconds(end)},vc_auto,${selection.muted ? "ac_none," : ""}${quality},f_mp4`;
}

export function getTransformedVideoUrl(originalUrl, selection) {
  const transformation = getVideoTransformation(selection);
  if (!originalUrl?.includes("/upload/")) throw new Error("Cloudinary returned an invalid video URL.");
  return originalUrl.replace("/upload/", `/upload/${transformation}/`);
}

export async function waitForVideoTransform(url, attempts = 12) {
  let lastStatus = 0;
  let lastError = null;
  let terminalError = "";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      lastStatus = response.status;
      if (response.ok) {
        const length = Number(response.headers.get("content-length"));
        return Number.isFinite(length) && length > 0 ? length : null;
      }
      if (![404, 420, 423].includes(response.status) && response.status < 500) {
        terminalError = "Cloudinary could not prepare this video transformation.";
        break;
      }
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 + attempt * 750, 5000)));
  }
  if (terminalError) throw new Error(terminalError);
  if (lastStatus) throw new Error("Video processing is taking longer than expected. Tap Post to retry.");
  if (lastError) throw new Error("Could not confirm the trimmed video is ready. Tap Post to retry.");
  return null;
}

export const uploadVideo = (asset, onProgress, selection) => uploadMedia({ asset, type: "video", onProgress, selection });
