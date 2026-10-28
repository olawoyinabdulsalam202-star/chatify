import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import Logo from "../components/Logo";
import { LockIcon, LoaderIcon } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router";

function ResetPasswordPage() {
  const { pendingResetEmail, resetPassword, forgotPassword, isResettingPassword } = useAuthStore();
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [resendCooldown, setResendCooldown] = useState(false);
  const navigate = useNavigate();

  // This screen is only meaningful right after a code was requested. A refresh
  // or a direct visit loses that, so send the user back to enter their email.
  if (!pendingResetEmail) return <Navigate to="/forgot-password" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!otp.trim() || !password) return;
    const ok = await resetPassword({ email: pendingResetEmail, otp: otp.trim(), password });
    if (ok) navigate("/login");
  };

  const handleResend = () => {
    if (resendCooldown) return;
    forgotPassword(pendingResetEmail);
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 60_000);
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 flex flex-col items-center">
        <Logo variant="mark" size={44} className="mb-5" />
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Enter your code</h2>
        <p className="text-slate-400 text-center mb-6">
          We sent a 6-digit code to{" "}
          <span className="text-slate-200">{pendingResetEmail}</span>. Enter it below with your new
          password.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="------"
            className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-3 text-slate-100 text-center tracking-[0.6em] text-xl outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />

          <div className="relative">
            <LockIcon className="auth-input-icon" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="New password (min 6 characters)"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={isResettingPassword}>
            {isResettingPassword ? (
              <LoaderIcon className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              "Reset password"
            )}
          </button>
        </form>

        <button
          onClick={handleResend}
          disabled={resendCooldown}
          className="text-cyan-400 hover:text-cyan-300 text-sm mt-4 disabled:opacity-50"
        >
          {resendCooldown ? "Code sent — wait a bit before resending" : "Resend code"}
        </button>

        <Link to="/login" className="auth-link mt-3">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
