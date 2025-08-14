import { useState, useEffect, useCallback } from "react";

type Decoded = { exp?: number; sub?: string };

function decodeExp(token: string): number | undefined {
  try {
    const [, payload] = token.split(".");
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64));
    return json.exp;
  } catch {
    return undefined;
  }
}

export default function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const readToken = useCallback(() => {
    const t = localStorage.getItem("token");
    setToken(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    readToken();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token") readToken();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [readToken]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
  }, []);

  const exp = token ? decodeExp(token) : undefined;
  const isExpired = !exp || Date.now() >= exp * 1000;
  const isAuthenticated = !!token && !isExpired;

  return { token, isAuthenticated, isExpired, loading, setToken, logout };
}
