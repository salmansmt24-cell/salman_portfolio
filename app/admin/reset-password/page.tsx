"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setToken(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!token) return setMessage("Reset link is missing or invalid.");
    if (password.length < 12) return setMessage("Use at least 12 characters for your new password.");
    if (password !== confirm) return setMessage("The passwords do not match.");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Password reset failed.");
      window.history.replaceState(null, "", window.location.pathname);
      setMessage("Password updated successfully. Redirecting to Admin Login…");
      setPassword("");
      setConfirm("");
      setTimeout(() => router.replace("/admin/login"), 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 14, margin: "8px 0 18px", border: "1px solid #d7e1ee", borderRadius: 10, fontSize: 15 };
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f6fb", fontFamily: "Arial,sans-serif" }}>
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 430, background: "#fff", padding: 32, borderRadius: 18, boxShadow: "0 18px 55px #18345c16" }}>
      <h1 style={{ color: "#172b4d", fontSize: 25 }}>Set a new admin password</h1>
      <p style={{ color: "#718096", fontSize: 13, lineHeight: 1.6 }}>Choose a strong password with at least 12 characters. This one-time link expires after 30 minutes.</p>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700 }}>New password</label>
      <input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} style={input} />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700 }}>Confirm new password</label>
      <input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={e => setConfirm(e.target.value)} style={input} />
      {message && <p role="status" style={{ color: message.startsWith("Password updated") ? "#087443" : "#b42318", fontSize: 13 }}>{message}</p>}
      <button disabled={busy || !token} style={{ width: "100%", padding: 14, border: 0, borderRadius: 10, background: "#315eb5", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: busy || !token ? .65 : 1 }}>
        {busy ? "Updating…" : "Update password"}
      </button>
      {!token && <p style={{ color: "#b42318", fontSize: 12, marginTop: 14 }}>The one-time reset token is missing from this link.</p>}
    </form>
  </main>;
}
