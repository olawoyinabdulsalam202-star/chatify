import axios from "axios";
import { API_URL } from "./config";

// withCredentials so the httpOnly jwt cookie the backend sets on login is sent
// with every admin request — the admin routes are gated by protectRoute +
// requireAdmin, both of which read that cookie.
export const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});
