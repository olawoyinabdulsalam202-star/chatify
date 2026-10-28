import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import Logo from "../components/Logo";
import { LockIcon, MailIcon, AtSignIcon, LoaderIcon } from "lucide-react";
import { Link } from "react-router";

function SignUpPage() {
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const { signup, isSigningUp } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    signup(formData);
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-800 overflow-hidden flex flex-col md:flex-row md:min-h-[560px]">
        {/* BRAND SIDE */}
        <div className="hidden md:flex md:w-1/2 bg-cyan-500 text-white p-10 flex-col justify-between order-first">
          <Logo tone="invert" size={40} />
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-4">Find your quiet corner.</h1>
            <p className="text-white/85 text-lg max-w-sm">
              Set up in seconds. No phone number, no ads, no algorithm deciding what you see.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-white/15">
              Private
            </span>
            <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-white/15">
              Easy setup
            </span>
            <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-white/15">
              Free
            </span>
          </div>
        </div>

        {/* Mobile brand strip */}
        <div className="md:hidden bg-cyan-500 text-white px-6 py-6">
          <Logo tone="invert" size={30} />
        </div>

        {/* FORM SIDE */}
        <div className="md:w-1/2 p-8 sm:p-10 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-100 mb-2">Create your account</h2>
              <p className="text-slate-400">Join Havn and start talking.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="auth-input-label">Username</label>
                <div className="relative">
                  <AtSignIcon className="auth-input-icon" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        // Constrain the field to exactly what a handle may hold, so
                        // what you type is what gets claimed — no surprise rejection.
                        username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""),
                      })
                    }
                    className="input"
                    placeholder="ghostcode"
                    maxLength={30}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Letters, numbers, dots and underscores. This is how people add you.
                </p>
              </div>

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
                    placeholder="Choose a password"
                  />
                </div>
              </div>

              <button className="auth-btn" type="submit" disabled={isSigningUp}>
                {isSigningUp ? <LoaderIcon className="w-5 h-5 animate-spin mx-auto" /> : "Create account"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="auth-link">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default SignUpPage;
