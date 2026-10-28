import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import Logo from "../components/Logo";
import { MailIcon, LoaderIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";

function ForgotPasswordPage() {
  const { forgotPassword, isRequestingReset } = useAuthStore();
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await forgotPassword(email.trim());
    if (ok) navigate("/reset-password");
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 flex flex-col items-center">
        <Logo variant="mark" size={44} className="mb-5" />
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Reset your password</h2>
        <p className="text-slate-400 text-center mb-6">
          Enter your email and we'll send you a 6-digit code to reset it.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <MailIcon className="auth-input-icon" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={isRequestingReset}>
            {isRequestingReset ? (
              <LoaderIcon className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              "Send reset code"
            )}
          </button>
        </form>

        <Link to="/login" className="auth-link mt-4">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
