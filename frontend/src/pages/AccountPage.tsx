import { useEffect, useState } from "react";
import api from "@/api";

import { useNavigate } from "react-router-dom";
import useAuth from "@/hooks/useAuth";

const API_URL = import.meta.env.VITE_API_URL;

type Me = {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  is_admin: boolean;
};

type Msg = { text: string; isError: boolean } | null;

export default function AccountPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const mismatch = newPwd.length > 0 && confirmPwd.length > 0 && newPwd !== confirmPwd;

  // Fetch current user
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await api.get<Me>(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMe(res.data);
        setFullName(res.data.full_name ?? "");
        setEmail(res.data.email);
      } catch {
        logout();
        navigate("/login");
      }
    })();
  }, [token, navigate, logout]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSavingProfile(true);
    setMsg(null);
    try {
      const res = await api.patch<Me>(
        `${API_URL}/me`,
        { full_name: fullName, email: email.trim().toLowerCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMe(res.data);
      setMsg({ text: "Profile updated.", isError: false });
      setShowProfileModal(false);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.detail || "Update failed.", isError: true });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (mismatch) {
      setMsg({ text: "Passwords do not match.", isError: true });
      return;
    }

    setSavingPwd(true);
    setMsg(null);
    try {
      await api.post(
        `${API_URL}/change-password`,
        { old_password: oldPwd, new_password: newPwd },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsg({ text: "Password changed. Please log in again.", isError: false });
      setShowPasswordModal(false);
      logout();
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.detail || "Change password failed.", isError: true });
    } finally {
      setSavingPwd(false);
    }
  };

  if (!me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 flex justify-center">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Account</h1>

        {msg && (
          <p className={`text-sm mb-4 ${msg.isError ? "text-red-600" : "text-green-600"}`}>
            {msg.text}
          </p>
        )}

        {/* Overview list */}
        <ul className="divide-y divide-gray-200">
            <InfoRow label="Full Name" value={me.full_name || "—"} onEdit={() => setShowProfileModal(true)} />
            <InfoRow label="Username" value={me.username} readOnly />
            <InfoRow label="Email" value={me.email} onEdit={() => setShowProfileModal(true)} />
            <InfoRow label="Password" value="********" onEdit={() => setShowPasswordModal(true)} />
        </ul>

        {/* Admin badge */}
        {me.is_admin && (
          <p className="mt-4 text-xs text-gray-500">
            You are an administrator.
          </p>
        )}
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <Modal title="Edit Profile" onClose={() => setShowProfileModal(false)}>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-500"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className={`px-4 py-2 rounded-md text-white ${
                  savingProfile ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {savingProfile ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <Modal title="Change Password" onClose={() => setShowPasswordModal(false)}>
          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <label htmlFor="oldPwd" className="text-sm font-medium mb-1 block">
                Current Password
              </label>
              <input
                id="oldPwd"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 border-gray-300 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="newPwd" className="text-sm font-medium mb-1 block">
                New Password
              </label>
              <input
                id="newPwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 border-gray-300 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPwd" className="text-sm font-medium mb-1 block">
                Confirm Password
              </label>
              <input
                id="confirmPwd"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
                  mismatch
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-blue-500"
                }`}
                required
              />
              {mismatch && (
                <p className="text-xs text-red-600 mt-1">Passwords don’t match.</p>
              )}
              {!mismatch && confirmPwd && newPwd && (
                <p className="text-xs text-green-600 mt-1">Passwords match ✔</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPwd || mismatch}
                className={`px-4 py-2 rounded-md text-white ${
                  savingPwd || mismatch
                    ? "bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {savingPwd ? "Saving…" : "Update"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------- Small helpers ------------------------- */

type InfoRowProps = {
  label: string;
  value: string;
  readOnly?: boolean;
  onEdit?: () => void;
};

const InfoRow = ({ label, value, readOnly = false, onEdit }: InfoRowProps) => {
  const canEdit = !readOnly && !!onEdit;
  return (
    <li
      className={`py-4 flex items-center justify-between group ${canEdit ? "cursor-pointer" : ""}`}
      onClick={canEdit ? onEdit : undefined}
    >
      <span className="w-32 shrink-0 text-gray-500 text-sm">{label}</span>
      <span className="flex-1 text-right font-medium text-gray-800 relative">
        {value}
        {canEdit && (
          <span className="absolute right-0 -bottom-5 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to edit
          </span>
        )}
      </span>
    </li>
  );
};


type ModalProps = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

const Modal = ({ title, children, onClose }: ModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
};
