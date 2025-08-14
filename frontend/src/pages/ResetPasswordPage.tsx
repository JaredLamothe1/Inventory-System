import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";


const API_URL = import.meta.env.VITE_API_URL;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const mismatch = confirm.length > 0 && newPassword !== confirm;

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("token") || "";
    const clean = decodeURIComponent(raw).trim().replace(/ /g, "+").replace(/^['"]|['"]$/g, "");
    setToken(clean);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch) {
      setMsg({ text: "Passwords do not match.", isError: true });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await api.post(`${API_URL}/reset-password-with-token`, {
        token: token.trim().replace(/ /g, "+"),
        new_password: newPassword,
      });
      setMsg({ text: "Password reset successfully. Redirecting…", isError: false });
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Password reset failed.";
      setMsg({ text: detail, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !token || !newPassword || mismatch;

  const inputClass = (bad: boolean) =>
    `w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring ${
      bad ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-4">Reset Password</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium mb-1">Reset Token</label>
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={inputClass(false)}
              required
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-1">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass(false)}
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass(mismatch)}
              required
            />
            {mismatch && (
              <p className="text-xs text-red-600 mt-1">Passwords don’t match.</p>
            )}
            {!mismatch && confirm.length > 0 && newPassword.length > 0 && (
              <p className="text-xs text-green-600 mt-1">Passwords match ✔</p>
            )}
          </div>

          {msg && (
            <p className={`text-sm ${msg.isError ? "text-red-600" : "text-green-600"}`}>
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={disabled}
            className={`w-full py-2 rounded-lg text-white transition ${
              disabled ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
