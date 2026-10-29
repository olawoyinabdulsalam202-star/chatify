import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import Logo from "../components/Logo";
import { MailIcon, LoaderIcon, LockIcon } from "lucide-react";
import { Link } from "react-router";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const { login, isLoggingIn } = useAuthStore();
  const [showQr, setShowQr] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrState, setQrState] = useState("idle");

  const startQr = async () => {
    setQrState("loading");
    try {
      const { data } = await axiosInstance.post("/auth/qr/start");
      setQrCode(data.code);
      setQrState("pending");
    } catch (error) {
      setQrState("idle");
      toast.error(error.response?.data?.message || "Could not start QR login");
    }
  };

  useEffect(() => {
    if (!showQr) return;
    startQr();
  }, [showQr]);

  useEffect(() => {
    if (!qrCode || qrState !== "pending") return;
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const { data } = await axiosInstance.get(`/auth/qr/${qrCode}/status`);
        if (!active) return;
        if (data.status === "approved") {
          setQrState("approved");
          useAuthStore.setState({ authUser: data.user });
          useAuthStore.getState().connectSocket();
          return;
        }
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 410 || error.response?.status === 404) {
          setQrState("expired");
          return;
        }
      }
      timer = window.setTimeout(poll, 2000);
    };
    poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [qrCode, qrState]);

  const handleSubmit = (e) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto overscroll-contain flex items-center justify-center p-2 sm:p-4 bg-slate-900">
      <div className="w-full min-w-0 max-w-5xl rounded-2xl border border-slate-700 bg-slate-800 overflow-hidden flex flex-col md:flex-row md:min-h-[560px]">
        {/* Mobile brand strip — replaces the side panel on small screens */}
        <div className="md:hidden bg-cyan-500 text-white px-6 py-6">
          <Logo tone="invert" size={30} />
        </div>

        {/* FORM SIDE */}
        <div className="min-w-0 md:w-1/2 p-5 sm:p-10 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="auth-heading font-bold text-slate-100 mb-2">Welcome back</h2>
              <p className="text-slate-400">Sign in to pick up where you left off.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="auth-input-label">Email</label>
                <div className="relative">
                  <MailIcon className="auth-input-icon" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="auth-input-label">Password</label>
                <div className="relative">
                  <LockIcon className="auth-input-icon" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <button className="auth-btn" type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? <LoaderIcon className="w-5 h-5 animate-spin mx-auto" /> : "Sign in"}
              </button>
            </form>

            <button type="button" onClick={() => setShowQr((value) => !value)} className="mt-5 w-full rounded-lg border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-700/40">
              {showQr ? "Sign in with password" : "Log in with QR code"}
            </button>
            {showQr && (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-center">
                {qrState === "pending" && qrCode ? (
                  <>
                    <img className="mx-auto h-52 w-52 rounded-lg bg-white p-2" alt="QR code to log in to Havn" src={`https://api.qrserver.com/v1/create-qr-code/?size=208x208&data=${encodeURIComponent(`havn://qr/${qrCode}\nhttps://havn.kairos-va.com/qr/${qrCode}`)}`} />
                    <p className="mt-3 text-sm text-slate-300">Scan this code with Havn on your phone.</p>
                  </>
                ) : qrState === "approved" ? (
                  <p className="py-16 text-sm text-slate-300">Logging you in...</p>
                ) : qrState === "expired" ? (
                  <button type="button" onClick={startQr} className="min-h-10 px-4 text-sm text-cyan-400">Code expired. Refresh QR code</button>
                ) : (
                  <p className="py-16 text-sm text-slate-400">Preparing QR code...</p>
                )}
              </div>
            )}

            <div className="mt-6 text-center space-y-2">
              <Link to="/forgot-password" className="auth-link block">
                Forgot password?
              </Link>
              <Link to="/signup" className="auth-link block">
                New here? Create an account
              </Link>
            </div>
          </div>
        </div>

        {/* BRAND SIDE */}
        <div className="hidden md:flex md:w-1/2 bg-cyan-500 text-white p-10 flex-col justify-between">
          <Logo tone="invert" size={40} />
          <div>
            <h1 className="marketing-heading font-bold leading-tight mb-4 md:!text-4xl md:!leading-tight">A calmer place to talk.</h1>
            <p className="text-white/85 text-lg max-w-sm">
              Messages, voice notes, photos, and calls — private by default, without the noise.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-white/15">
              Private
            </span>
            <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-white/15">
              No tracking
            </span>
            <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-white/15">
              Free
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default LoginPage;
