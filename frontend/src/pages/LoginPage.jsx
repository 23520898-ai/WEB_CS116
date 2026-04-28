import { useState } from "react";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("NHOM01");
  const [password, setPassword] = useState("12345678");

  const submit = async (e) => {
    e.preventDefault();
    await onLogin(username, password);
  };

  return (
    <div className="login-shell">
      <form className="panel login-panel" onSubmit={submit}>
        <h1>CS116 Challenge Portal</h1>
        <p>Sign in with your team account to submit files and track rankings.</p>
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
    </div>
  );
}

export default LoginPage;
