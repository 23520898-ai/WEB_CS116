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
} from "./services/api";

import AdminPage from "./pages/AdminPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import DocsPage from "./pages/DocsPage";
import SubmitPage from "./pages/SubmitPage";
import logoUIT from "./images.jpg";

function ProtectedLayout({ token, me, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [submittedGroupCount, setSubmittedGroupCount] = useState(0);

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

  const pageTitleMap = {
    "/": "Machine Learning Portal",
    "/submit": "Submit Predictions",
    "/history": "Submission History",
    "/docs": "Usage Documentation",
    "/admin": "Admin Center",
  };

  const currentTitle = pageTitleMap[location.pathname] || "CS116 Portal";

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="app-canvas">
      <div className="app-shell">
        <aside className="sidebar">
          <img src={logoUIT} alt="UIT Logo" style={{ width: "100%", maxWidth: "100px", marginBottom: "1rem", alignSelf: "center", display: "block" }} />

          <nav>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className="nav-link">
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button onClick={onLogout}>Logout</button>
        </aside>

        <main className="content">
          <header className="content-head">
            <h1>{currentTitle}</h1>

            <button onClick={() => navigate("/submit")}>
              Upload new file
            </button>
          </header>

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
          <div className="stat-card">
            <p>Bài nộp hôm nay</p>
            <strong>{me?.submissions_today ?? 0}</strong>
          </div>
          <div className="stat-card">
            <p>Lượt còn lại</p>
            <strong>{me?.remaining_submissions_today ?? 0}</strong>
          </div>
          <div className="stat-card">
            <p>Nhóm đã nộp</p>
            <strong>{submittedGroupCount}</strong>
          </div>
          <div className="stat-card">
            <p>Giới hạn mỗi ngày</p>
            <strong>{me?.submission_limit_per_day ?? 3}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("ml_token") || "");
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate(); // Thêm navigate ở đây

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
  }, [token]);

  const onLogin = async (username, password) => {
    try {
      const res = await login(username, password);
      localStorage.setItem("ml_token", res.access_token);
      setToken(res.access_token);
      navigate("/"); // Chuyển hướng sau khi login
    } catch (e) {
      setError(e.message);
    }
  };

  const onLogout = () => {
    localStorage.removeItem("ml_token");
    setToken("");
    setMe(null);
    navigate("/login"); // FIX: Chuyển hướng ngay lập tức về trang login
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