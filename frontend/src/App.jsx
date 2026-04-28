import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { getLeaderboardForecast, getLeaderboardPir, getMyTeam, login } from "./services/api";
import AdminPage from "./pages/AdminPage";
import DashboardPage from "./pages/DashboardPage";
import DataPage from "./pages/DataPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import DocsPage from "./pages/DocsPage";
import SubmitPage from "./pages/SubmitPage";
import TeamPage from "./pages/TeamPage";

function ProtectedLayout({ token, me, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [submittedGroupCount, setSubmittedGroupCount] = useState(0);
  if (!token) return <Navigate to="/login" replace />;

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
          ...pirRows.map((row) => row.team_name),
          ...forecastRows.map((row) => row.team_name),
        ]);
        setSubmittedGroupCount(names.size);
      } catch (e) {
        if (!mounted) return;
        setSubmittedGroupCount(0);
      }
    };

    loadCounts();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const navItems = [
    { to: "/", label: "Dashboard" },
    { to: "/submit", label: "Submit" },
    { to: "/history", label: "History" },
    { to: "/team", label: "Team" },
    { to: "/data", label: "Data" },
    { to: "/docs", label: "Docs" },
  ];
  if (me?.current_user_role === "admin") {
    navItems.push({ to: "/admin", label: "Admin" });
  }

  const pageTitleMap = {
    "/": "Machine Learning Portal",
    "/submit": "Submit Predictions",
    "/history": "Submission History",
    "/team": "Team Management",
    "/data": "2025 Training Data",
    "/docs": "Usage Documentation",
    "/admin": "Admin Center",
  };

  const currentTitle = pageTitleMap[location.pathname] || "CS116 Portal";

  return (
    <div className="app-canvas">
      <div className="app-shell">
      <aside className="sidebar">
        <h2>drive.</h2>
        <p className="sidebar-subtitle">ML Challenge Workspace</p>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-user">{me ? `${me.name} (${me.current_user_role})` : "Loading profile"}</p>
          <button onClick={onLogout}>Logout</button>
        </div>
      </aside>
      <main className="content">
        <header className="content-head">
          <h1>{currentTitle}</h1>
          <button className="primary-cta" onClick={() => navigate("/submit")}>Upload new file</button>
        </header>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/submit" element={<SubmitPage token={token} />} />
          <Route path="/history" element={<HistoryPage token={token} />} />
          <Route path="/team" element={<TeamPage token={token} />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route
            path="/admin"
            element={me?.current_user_role === "admin" ? <AdminPage token={token} /> : <Navigate to="/" replace />}
          />
        </Routes>
      </main>
      <aside className="right-rail">
        <div className="search-box">Live challenge status</div>
        <h3>Statistic</h3>
        <div className="stat-card">
          <p>Your submissions today</p>
          <strong>{me?.submissions_today ?? 0}</strong>
        </div>
        <div className="stat-card">
          <p>Remaining submissions today</p>
          <strong>{me?.remaining_submissions_today ?? 0}</strong>
        </div>
        <div className="stat-card">
          <p>Groups already submitted</p>
          <strong>{submittedGroupCount}</strong>
        </div>
        <div className="promo-box">
          <p>Scoring focus</p>
          <small>PIR ranks by Precision@10. Forecast ranks by MAPE Sales (lower is better).</small>
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

  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    getMyTeam(token)
      .then(setMe)
      .catch((e) => {
        setError(e.message);
        localStorage.removeItem("ml_token");
        setToken("");
      });
  }, [token]);

  const onLogin = async (username, password) => {
    try {
      const res = await login(username, password);
      localStorage.setItem("ml_token", res.access_token);
      setToken(res.access_token);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const onLogout = () => {
    localStorage.removeItem("ml_token");
    setToken("");
    setMe(null);
  };

  return (
    <>
      {error ? <p className="error-floating">{error}</p> : null}
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <LoginPage onLogin={onLogin} />}
        />
        <Route path="/*" element={<ProtectedLayout token={token} me={me} onLogout={onLogout} />} />
      </Routes>
    </>
  );
}

export default App;
