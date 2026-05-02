import { useEffect, useState } from "react";
import LeaderboardTable from "../components/LeaderboardTable";
import {
  getLeaderboardForecast,
  getLeaderboardPir,
  adminDeleteSubmission,
} from "../services/api";

const METRIC_CONFIG = {
  pir: {
    precision_at_10: { label: "Precision@10", better: "higher" },
    total_correct_recommendations: { label: "Total Correct", better: "higher" }, // THÊM DÒNG NÀY
    map: { label: "MAP", better: "higher" },
    iou: { label: "IoU", better: "higher" },
    reciprocal_rank_first_hit: { label: "RR First Hit", better: "higher" },
  },
  forecast: {
    mape_sales: { label: "MAPE Sales", better: "lower" },
    mae_sales: { label: "MAE Sales", better: "lower" },
    mape_revenue: { label: "MAPE Revenue", better: "lower" },
    mae_revenue: { label: "MAE Revenue", better: "lower" },
  },
};

function DashboardPage({ token, me }) {
  const [pirRows, setPirRows] = useState([]);
  const [forecastRows, setForecastRows] = useState([]);
  const [pirMetric, setPirMetric] = useState("precision_at_10");
  const [forecastMetric, setForecastMetric] = useState("mape_sales");
  const [error, setError] = useState("");
  
  const isAdmin = me?.current_user_role === "admin";

  const load = async () => {
    try {
      const [pir, forecast] = await Promise.all([
        getLeaderboardPir(),
        getLeaderboardForecast(),
      ]);
      setPirRows(pir || []);
      setForecastRows(forecast || []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (row) => {
    try {
      // row.submission_id là ID từ API leaderboard
      await adminDeleteSubmission(row.submission_id, token);
      await load(); 
    } catch (e) {
      alert("Error: " + (e.response?.data?.detail || e.message));
    }
  };

  const sortRows = (rows, task, metricKey) => {
    const config = METRIC_CONFIG[task][metricKey];
    if (!rows) return [];

    return [...rows]
      .map((row) => ({
        ...row,
        dynamicScore: row.secondary_metrics?.[metricKey] ?? 0,
      }))
      .sort((a, b) => {
        return config.better === "higher"
          ? b.dynamicScore - a.dynamicScore
          : a.dynamicScore - b.dynamicScore;
      })
      .map((row, idx) => ({
        ...row,
        rank: idx + 1,
        primary_score: row.dynamicScore,
      }));
  };

  return (
    <div className="page-grid">
      <header className="hero">
        <h2>Leaderboard</h2>
      </header>

      {error && <p className="error" style={{color: 'red'}}>{error}</p>}

      <div className="leaderboard-grid">
        <div className="leaderboard-section">
          <div className="metric-selector" style={{marginBottom: '10px'}}>
            <label>Sort PIR by: </label>
            <select value={pirMetric} onChange={(e) => setPirMetric(e.target.value)}>
              {Object.entries(METRIC_CONFIG.pir).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <LeaderboardTable
            title="Task 1 - PIR"
            primaryLabel={METRIC_CONFIG.pir[pirMetric].label}
            rows={sortRows(pirRows, "pir", pirMetric)}
            isAdmin={isAdmin}
            onDelete={handleDelete}
          />
        </div>

        <div className="leaderboard-section">
          <div className="metric-selector" style={{marginBottom: '10px'}}>
            <label>Sort Forecast by: </label>
            <select value={forecastMetric} onChange={(e) => setForecastMetric(e.target.value)}>
              {Object.entries(METRIC_CONFIG.forecast).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <LeaderboardTable
            title="Task 2 - Forecast"
            primaryLabel={METRIC_CONFIG.forecast[forecastMetric].label}
            rows={sortRows(forecastRows, "forecast", forecastMetric)}
            isAdmin={isAdmin}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;