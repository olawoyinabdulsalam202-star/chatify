import { useEffect } from "react";
import { LoaderIcon } from "lucide-react";
import { useAdminAuthStore } from "./store/useAdminAuthStore";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

function App() {
  const { authUser, isCheckingAuth, checkAuth } = useAdminAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <LoaderIcon className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return authUser ? <DashboardPage /> : <LoginPage />;
}

export default App;
