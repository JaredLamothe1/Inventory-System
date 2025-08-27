import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuth from "@/hooks/useAuth";

// CHANGE THIS if your backend route is different:
const LOGIN_PATH = "/login"; // e.g. "/auth/login"

// Resolve API base once, with a safe dev fallback (no proxy required)
function getApiBase(): string {
  const v = import.meta.env.VITE_API_URL?.trim();
  if (v && v.toLowerCase() !== "undefined") return v.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "http://127.0.0.1:8000"; // dev fallback
  throw new Error("VITE_API_URL is not set for production.");
}

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const { isAuthenticated, loading: authLoading, setToken } = useAuth();

  // If already logged in, bounce to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate("/dashboard", { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    setLoading(true);
    setError("");

    let API_BASE: string;
    try {
      API_BASE = getApiBase();
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "API base URL missing.");
      return;
    }

    try {
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);

      const res = await fetch(`${API_BASE}${LOGIN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        // credentials: "include", // uncomment if using cookie auth
        body: form.toString(),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Invalid username or password.");
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data?.detail || `Unexpected error (${res.status}).`);
        }
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data?.access_token) {
        localStorage.setItem("token", data.access_token);
        setToken?.(data.access_token);
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>

        {error && <div className="mb-4 text-red-500 text-sm text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className={`w-full text-white font-semibold py-2 rounded transition ${
              loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot your password?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
