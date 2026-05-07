import { useState } from "react";
import logoUIT from "../images.jpg";
import { forgotPassword, resetPassword } from "../services/api";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("NHOM01");
  const [password, setPassword] = useState("12345678");
  const [forgotUsername, setForgotUsername] = useState("NHOM01");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const clearMessages = () => {
    setInfo("");
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      await onLogin(username, password);
    } catch {
      setError("Sign in failed");
    }
  };

  const onForgot = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      const res = await forgotPassword(forgotUsername);
      if (res.reset_token) {
        setResetToken(res.reset_token);
        setInfo(`Reset token created. Expiry: ${res.expires_at}`);
      } else {
        setInfo(res.detail || "If the account exists, a reset token was sent.");
      }
    } catch (err) {
      setError(err.message || "Cannot create reset token");
    }
  };

  const onReset = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      const res = await resetPassword(resetToken, newPassword);
      setInfo(res.detail || "Password has been reset");
      setNewPassword("");
      setResetToken("");
    } catch (err) {
      setError(err.message || "Cannot reset password");
    }
  };

  return (
    <div className="login-shell">
      <div className="panel login-panel" style={{ display: "grid", gap: "1rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <img src={logoUIT} alt="UIT Logo" style={{ maxWidth: "100px" }} />
        </div>
        <h1 style={{ textAlign: "center" }}>CS116 Challenge Portal</h1>
        <p>Sign in with your team account to submit files and track rankings.</p>
        {error ? <p className="error-floating">{error}</p> : null}
        {info ? <p className="success">{info}</p> : null}

        <form onSubmit={submit} style={{ display: "grid", gap: "0.8rem" }}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="NHOM01"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="12345678"
            />
          </label>
          <button type="submit">Sign in</button>
        </form>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem", display: "grid", gap: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Forgot password</h3>
          <form onSubmit={onForgot} style={{ display: "grid", gap: "0.8rem" }}>
            <label>
              Username
              <input
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                placeholder="NHOM01"
              />
            </label>
            <button type="submit">Create reset token</button>
          </form>

          <form onSubmit={onReset} style={{ display: "grid", gap: "0.8rem" }}>
            <label>
              Reset token
              <input
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste token here"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />
            </label>
            <button type="submit">Reset password</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
