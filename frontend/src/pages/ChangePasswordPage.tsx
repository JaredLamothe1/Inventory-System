import { useState } from "react";
import api from "@/api";

import { useNavigate } from "react-router-dom";
import useAuth from "@/hooks/useAuth";

const API_URL = import.meta.env.VITE_API_URL;

export default function ChangePasswordPage() {
  const { token, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const disabled = loading || !oldPassword || !newPassword || mismatch || !token;

  const inputClass = (bad: boolean) =>
    `w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
      bad ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
    }`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMsg({ text: "You are not logged in.", isError: true });
      return;
    }
    if (mismatch) {
      setMsg({ text: "Passwords do not match.", isError: true });
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      const res = await api.post(
        `${API_URL}/change-password`,
        { old_password: oldPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsg({ text: res.data.message || "Password changed.", isError: false });

      logout();
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setMsg({
        text: err.response?.data?.detail || "Change password failed.",
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-center mb-4">Change Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block" htmlFor="oldPassword">
              Current Password
            </label>
            <input
              id="oldPassword"
              type="password"
              className={inputClass(false)}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block" htmlFor="newPassword">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              className={inputClass(false)}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={inputClass(mismatch)}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
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
            className={`w-full text-white font-semibold py-2 rounded transition ${
              disabled ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={disabled}
          >
            {loading ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
