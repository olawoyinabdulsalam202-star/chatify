import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import Logo from "../components/Logo";
import { MailIcon, LoaderIcon, LockIcon } from "lucide-react";
import { Link } from "react-router";

function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const { login, isLoggingIn } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-800 overflow-hidden flex flex-col md:flex-row md:min-h-[560px]">
        {/* Mobile brand strip — replaces the side panel on small screens */}
        <div className="md:hidden bg-cyan-500 text-white px-6 py-6">
          <Logo tone="invert" size={30} />
        </div>

        {/* FORM SIDE */}
        <div className="md:w-1/2 p-8 sm:p-10 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-100 mb-2">Welcome back</h2>
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

            <div className="mt-6 text-center">
              <Link to="/signup" className="auth-link">
                New here? Create an account
              </Link>
            </div>
          </div>
        </div>

        {/* BRAND SIDE */}
        <div className="hidden md:flex md:w-1/2 bg-cyan-500 text-white p-10 flex-col justify-between">
          <Logo tone="invert" size={40} />
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-4">A calmer place to talk.</h1>
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
