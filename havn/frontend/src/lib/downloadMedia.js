export function getDownloadUrl(url) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com/")) return url;
  return url.replace("/upload/", "/upload/fl_attachment/");
}
