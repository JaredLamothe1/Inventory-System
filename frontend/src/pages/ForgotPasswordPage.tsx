import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";


const API_URL = import.meta.env.VITE_API_URL; // e.g. https://inventory-system.onrender.com

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await api.post(`${API_URL}/request-password-reset`, { email });
      // Backend always returns success-y message (even if email not found)
      setMsg({
        text: res.data?.message ?? "If this email exists, a reset link was sent.",
        isError: false,
      });
      setEmail("");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setMsg({
        text: detail || "Something went wrong. Please try again.",
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">Forgot Password</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col">
            <label htmlFor="email" className="text-sm font-medium mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={`w-full text-white font-semibold py-2 rounded transition ${
              loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          {msg && (
            <p
              className={`text-sm text-center mt-4 ${
                msg.isError ? "text-red-600" : "text-green-600"
              }`}
            >
              {msg.text}
            </p>
          )}

          <p className="text-center mt-4 text-sm text-gray-600">
            Remembered your password?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-blue-600 hover:underline"
            >
              Log in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
