import { useEffect } from "react";
import { useRouter } from "expo-router";
import ChatListScreen from "../screens/ChatListScreen";
import { useAuthStore } from "../stores/useAuthStore";

export default function IndexScreen() {
  const authUser = useAuthStore((state) => state.authUser);
  const router = useRouter();
  useEffect(() => { if (!authUser) router.replace("/login"); }, [authUser, router]);
  return authUser ? <ChatListScreen /> : null;
}
