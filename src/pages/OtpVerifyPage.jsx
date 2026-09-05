import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import Logo from "../components/Logo";
import { LoaderIcon } from "lucide-react";

function OtpVerifyPage() {
  const { pendingVerificationEmail, verifyOtp, resendOtp, isVerifyingOtp } = useAuthStore();
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!otp.trim()) return;
    verifyOtp({ email: pendingVerificationEmail, otp: otp.trim() });
  };

  const handleResend = () => {
    if (resendCooldown) return;
    resendOtp(pendingVerificationEmail);
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 60_000);
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 flex flex-col items-center">
        <Logo variant="mark" size={44} className="mb-5" />
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Verify your email</h2>
        <p className="text-slate-400 text-center mb-6">
          We sent a 6-digit code to{" "}
          <span className="text-slate-200">{pendingVerificationEmail}</span>
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

          <button type="submit" className="auth-btn" disabled={isVerifyingOtp}>
            {isVerifyingOtp ? <LoaderIcon className="w-5 h-5 animate-spin mx-auto" /> : "Verify"}
          </button>
        </form>

        <button
          onClick={handleResend}
          disabled={resendCooldown}
          className="text-cyan-400 hover:text-cyan-300 text-sm mt-4 disabled:opacity-50"
        >
          {resendCooldown ? "Code sent — wait a bit before resending" : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export default OtpVerifyPage;
