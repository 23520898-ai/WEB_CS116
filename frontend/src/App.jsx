import { useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  getLeaderboardForecast,
  getLeaderboardPir,
  getMyTeam,
  login,
  changePassword,
} from "./services/api";

import AdminPage from "./pages/AdminPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import DocsPage from "./pages/DocsPage";
import SubmitPage from "./pages/SubmitPage";

function ProtectedLayout({ token, me, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [submittedGroupCount, setSubmittedGroupCount] = useState(0);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    let mounted = true;

    const loadCounts = async () => {
      try {
        const [pirRows, forecastRows] = await Promise.all([
          getLeaderboardPir(),
          getLeaderboardForecast(),
        ]);

        if (!mounted) return;

        const names = new Set([
          ...pirRows.map((r) => r.team_name),
          ...forecastRows.map((r) => r.team_name),
        ]);

        setSubmittedGroupCount(names.size);
      } catch {
        if (mounted) setSubmittedGroupCount(0);
      }
    };

    loadCounts();
    return () => (mounted = false);
  }, [location.pathname]);

  const navItems = [
    { to: "/", label: "Dashboard" },
    { to: "/submit", label: "Submit" },
    { to: "/history", label: "History" },
    { to: "/docs", label: "Docs" },
  ];

  if (me?.current_user_role === "admin") {
    navItems.push({ to: "/admin", label: "Admin" });
  }

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="app-canvas">
      <div className="app-shell">
        <aside className="sidebar">
          <h2>CS116</h2>

          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button onClick={onLogout}>Logout</button>

            <button
              onClick={() => { setShowChangePw((v) => !v); setPwMsg({ text: "", ok: false }); }}
              style={{ background: "transparent", color: "var(--muted)", boxShadow: "none", border: "1px solid var(--line)", fontSize: "0.8rem", padding: "0.45rem 0.7rem" }}
            >
              {showChangePw ? "✕ Cancel" : "Change Password"}
            </button>

            {showChangePw && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await changePassword(pwCurrent, pwNew, token);
                    setPwMsg({ text: "Password updated!", ok: true });
                    setPwCurrent("");
                    setPwNew("");
                    setTimeout(() => setShowChangePw(false), 1500);
                  } catch (err) {
                    setPwMsg({ text: err.message, ok: false });
                  }
                }}
                style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
              >
                <input
                  type="password"
                  placeholder="Current password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  required
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  required
                  minLength={8}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
                />
                <button type="submit" style={{ fontSize: "0.8rem", padding: "0.45rem" }}>Update</button>
                {pwMsg.text && (
                  <p style={{ margin: 0, fontSize: "0.75rem", color: pwMsg.ok ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                    {pwMsg.text}
                  </p>
                )}
              </form>
            )}
          </div>
        </aside>

        <main className="content">
          <Routes>
            <Route path="/" element={<DashboardPage token={token} me={me} />} />
            <Route path="/submit" element={<SubmitPage token={token} />} />
            <Route path="/history" element={<HistoryPage token={token} />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route
              path="/admin"
              element={
                me?.current_user_role === "admin" ? (
                  <AdminPage token={token} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
          </Routes>
        </main>

        <aside className="right-rail">
          <h3>Quick Stats</h3>
          {me?.current_user_role === "admin" ? (
            <div className="stat-card">
              <p>Nhóm đã nộp</p>
              <strong>{submittedGroupCount}</strong>
            </div>
          ) : (
            <>
              <div className="stat-card">
                <p>Nhóm</p>
                <strong>{me?.name ?? "—"}</strong>
              </div>
              <div className="stat-card">
                <p>Bài nộp hôm nay</p>
                <strong>{me?.submissions_today ?? 0}</strong>
              </div>
              <div className="stat-card">
                <p>Lượt còn lại (Task 1 - PIR)</p>
                <strong>{me?.pir_remaining_today ?? "—"}</strong>
              </div>
              <div className="stat-card">
                <p>Lượt còn lại (Task 2 - Forecast)</p>
                <strong>{me?.forecast_remaining_today ?? "—"}</strong>
              </div>
              <div className="stat-card">
                <p>Giới hạn mỗi ngày / task</p>
                <strong>{me?.submission_limit_per_day ?? 3}</strong>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("ml_token") || "");
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate(); 

  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }

    getMyTeam(token)
      .then(setMe)
      .catch(() => {
        localStorage.removeItem("ml_token");
        setToken("");
      });

    const timer = setInterval(() => {
      getMyTeam(token).then(setMe).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [token]);

  const onLogin = async (username, password) => {
    try {
      const res = await login(username, password);
      localStorage.setItem("ml_token", res.access_token);
      setToken(res.access_token);
      navigate("/"); 
    } catch (e) {
      setError(e.message);
    }
  };

  const onLogout = () => {
    localStorage.removeItem("ml_token");
    setToken("");
    setMe(null);
    navigate("/login"); 
  };

  return (
    <>
      {error && <p className="error" onClick={() => setError("")}>{error}</p>}

      <Routes>
        <Route
          path="/login"
          element={
            token ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onLogin={onLogin} />
            )
          }
        />

        <Route
          path="/*"
          element={<ProtectedLayout token={token} me={me} onLogout={onLogout} />}
        />
      </Routes>
    </>
  );
}

export default App;