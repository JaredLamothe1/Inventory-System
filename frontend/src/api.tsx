import axios, { AxiosInstance } from "axios";

/** Decide the backend base once for the whole app. */
function resolveBaseURL(): string {
  // In dev: use your local FastAPI directly (no proxy needed)
  if (import.meta.env.DEV) {
    const local = (import.meta.env.VITE_API_URL || "").trim();
    return (local && local.toLowerCase() !== "undefined"
      ? local
      : "http://127.0.0.1:8000" // dev fallback
    ).replace(/\/+$/, "");
  }

  // In prod: require VITE_API_URL (set this in Vercel)
  const raw = (import.meta.env.VITE_API_URL || "").trim();
  if (!raw || raw.toLowerCase() === "undefined") {
    console.error("VITE_API_URL is not set for production.");
    return ""; // prevents "/undefined/..." URLs
  }
  return raw.replace(/\/+$/, "");
}

/** Explicitly type as AxiosInstance so TS never mistakes it for a React.FC */
const api: AxiosInstance = axios.create({
  baseURL: resolveBaseURL(),
});

// Attach bearer token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
