import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

export default function PublicProfilePage() {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.authUser);
  const [profile, setProfile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([
      axiosInstance.get("/public/u/" + encodeURIComponent(username)),
      axiosInstance.get("/app/version").catch(() => null),
    ]).then(([profileResponse, versionResponse]) => {
      if (!active) return;
      setProfile(profileResponse.data);
      setDownloadUrl(versionResponse?.data?.android?.apkUrl || "");
    }).catch(() => { if (active) setProfile(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [username]);

  const message = async () => {
    if (!authUser) {
      navigate("/login?redirect=" + encodeURIComponent("/u/" + username));
      return;
    }
    try {
      const { data } = await axiosInstance.get("/friends/search?q=" + encodeURIComponent(username));
      const person = data.find((item) => item.username?.toLowerCase() === username.toLowerCase());
      if (!person) return;
      useChatStore.getState().setSelectedUser(person);
      navigate("/");
    } catch {
      navigate("/");
    }
  };

  const fallback = "https://havn.kairos-va.com/u/" + username;
  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 py-10 text-slate-100">
      <section className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
        {loading ? <p className="text-sm text-slate-400">Loading profile...</p> : !profile ? <p className="text-sm text-slate-400">Profile not found.</p> : <>
          <img src={profile.profilePic || "/avatar.svg"} alt="" className="mx-auto h-24 w-24 rounded-full object-cover" />
          <h1 className="mt-4 text-2xl font-semibold">{profile.fullName}</h1>
          <p className="mt-1 text-sm text-slate-400">@{profile.username}{profile.isBadged ? " · Verified" : ""}</p>
          {profile.bio && <p className="mt-4 break-words text-sm text-slate-300">{profile.bio}</p>}
          <button type="button" onClick={message} className="mt-6 min-h-11 w-full rounded-lg bg-cyan-500 px-4 text-sm font-medium text-white">Message on Havn</button>
          <a href={"intent://havn.kairos-va.com/u/" + encodeURIComponent(username) + "#Intent;scheme=https;package=com.kairosva.havn;S.browser_fallback_url=" + encodeURIComponent(fallback) + ";end"} className="mt-3 block min-h-11 rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-200">Open in app</a>
          {downloadUrl && <a href={downloadUrl} className="mt-3 block min-h-11 rounded-lg px-4 py-3 text-sm text-cyan-400">Download Havn for Android</a>}
        </>}
        <Link to="/" className="mt-6 inline-block text-xs text-slate-500">Havn</Link>
      </section>
    </main>
  );
}
