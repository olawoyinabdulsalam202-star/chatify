import { useState } from "react";
import { ShieldCheckIcon, MailIcon, LockIcon, LoaderIcon, KeyRoundIcon } from "lucide-react";
import { useAdminAuthStore } from "../store/useAdminAuthStore";

function LoginPage() {
  const {
    login,
    isLoggingIn,
    forgotPassword,
    resetPassword,
    isRequestingReset,
    isResettingPassword,
  } = useAdminAuthStore();

  // "signin" | "forgot" | "reset". The admin app has no router, so the reset
  // flow lives here as self-contained steps rather than separate pages. The
  // email carries across all three steps.
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resendCooldown, setResendCooldown] = useState(false);

  const handleSignIn = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    login({ email: email.trim(), password });
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await forgotPassword(email.trim());
    if (ok) setMode("reset");
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword) return;
    const ok = await resetPassword({ email: email.trim(), otp: otp.trim(), password: newPassword });
    if (ok) {
      setMode("signin");
      setOtp("");
      setNewPassword("");
      setPassword("");
    }
  };

  const handleResend = () => {
    if (resendCooldown) return;
    forgotPassword(email.trim());
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 60_000);
  };

  const subtitle =
    mode === "forgot"
      ? "Enter your admin email to get a reset code"
      : mode === "reset"
        ? "Enter the code we emailed and a new password"
        : "Sign in with an admin account";

  const buttonClass =
    "w-full bg-cyan-500 text-white rounded-lg py-2.5 font-medium hover:bg-cyan-600 focus:ring-2 focus:ring-cyan-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2";
  const linkClass = "text-sm text-cyan-400 hover:text-cyan-300 disabled:opacity-50";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500 flex items-center justify-center mb-4">
            <ShieldCheckIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">Havn Admin</h1>
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        </div>

        {mode === "signin" && (
          <>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <div className="relative">
                  <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="username"
                    className="input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="input pl-10"
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoggingIn} className={buttonClass}>
                {isLoggingIn ? <LoaderIcon className="w-5 h-5 animate-spin" /> : "Sign in"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setMode("forgot")}
              className={`w-full text-center mt-4 ${linkClass}`}
            >
              Forgot password?
            </button>
          </>
        )}

        {mode === "forgot" && (
          <>
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <div className="relative">
                  <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="username"
                    className="input pl-10"
                  />
                </div>
              </div>

              <button type="submit" disabled={isRequestingReset} className={buttonClass}>
                {isRequestingReset ? (
                  <LoaderIcon className="w-5 h-5 animate-spin" />
                ) : (
                  "Send reset code"
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`w-full text-center mt-4 ${linkClass}`}
            >
              Back to sign in
            </button>
          </>
        )}

        {mode === "reset" && (
          <>
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Reset code</label>
                <div className="relative">
                  <KeyRoundIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit code"
                    className="input pl-10 tracking-widest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">New password</label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    className="input pl-10"
                  />
                </div>
              </div>

              <button type="submit" disabled={isResettingPassword} className={buttonClass}>
                {isResettingPassword ? (
                  <LoaderIcon className="w-5 h-5 animate-spin" />
                ) : (
                  "Reset password"
                )}
              </button>
            </form>

            <div className="flex items-center justify-between mt-4">
              <button type="button" onClick={handleResend} disabled={resendCooldown} className={linkClass}>
                {resendCooldown ? "Code sent — wait a bit" : "Resend code"}
              </button>
              <button type="button" onClick={() => setMode("signin")} className={linkClass}>
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
