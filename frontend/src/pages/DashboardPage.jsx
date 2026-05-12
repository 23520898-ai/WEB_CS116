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
    if (!row.submission_id) {
      alert("Cannot delete: no valid submission ID for this entry.");
      return;
    }
    try {
      await adminDeleteSubmission(row.submission_id, token);
      await load();
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  return (
    <div className="page-grid">
      <header className="hero">
        <h2>Leaderboard</h2>
      </header>

      {error && <p className="error" style={{color: 'red'}}>{error}</p>}

      <div className="leaderboard-grid">
        <div className="leaderboard-section">
          <LeaderboardTable
            title="Task 1 - PIR"
            rows={pirRows}
            metricsConfig={METRIC_CONFIG.pir}
            isAdmin={isAdmin}
            onDelete={handleDelete}
          />
        </div>

        <div className="leaderboard-section">
          <LeaderboardTable
            title="Task 2 - Forecast"
            rows={forecastRows}
            metricsConfig={METRIC_CONFIG.forecast}
            isAdmin={isAdmin}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;