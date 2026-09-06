import { useState } from "react";
import { ShieldCheckIcon, MailIcon, LockIcon, LoaderIcon } from "lucide-react";
import { useAdminAuthStore } from "../store/useAdminAuthStore";

function LoginPage() {
  const { login, isLoggingIn } = useAdminAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    login({ email: email.trim(), password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500 flex items-center justify-center mb-4">
            <ShieldCheckIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">Havn Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in with an admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-cyan-500 text-white rounded-lg py-2.5 font-medium hover:bg-cyan-600 focus:ring-2 focus:ring-cyan-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoggingIn ? <LoaderIcon className="w-5 h-5 animate-spin" /> : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
