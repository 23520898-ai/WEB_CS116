import { useEffect, useState } from "react";

import LeaderboardTable from "../components/LeaderboardTable";
import { getLeaderboardForecast, getLeaderboardPir } from "../services/api";

function DashboardPage() {
  const [pirRows, setPirRows] = useState([]);
  const [forecastRows, setForecastRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [pir, forecast] = await Promise.all([
          getLeaderboardPir(),
          getLeaderboardForecast(),
        ]);
        if (!mounted) return;
        setPirRows(pir);
        setForecastRows(forecast);
        setError("");
      } catch (e) {
        if (!mounted) return;
        setError(e.message);
      }
    };

    load();
    const timer = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="page-grid">
      <header className="hero">
        <h2>Recently used</h2>
        <p>
          Leaderboards refresh every 5 seconds for Task 1 (PIR) and Task 2
          (Forecasting), so groups can compare scores with each other in real time.
        </p>
        <div className="recent-cards">
          <article className="recent-card recent-card-active">
            <small>CHALLENGE</small>
            <h3>PIR Competition</h3>
            <p>Track total hits, IoU, reciprocal rank, Precision@10, and MAP.</p>
          </article>
          <article className="recent-card">
            <small>CHALLENGE</small>
            <h3>Forecast Sprint</h3>
            <p>Lower MAPE Sales to secure top positions.</p>
          </article>
          <article className="recent-card">
            <small>SYNC</small>
            <h3>Realtime Ranking</h3>
            <p>Polling runs every 5 seconds.</p>
          </article>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="leaderboard-grid">
        <LeaderboardTable
          title="Task 1 - PIR"
          primaryLabel="Precision@10"
          rows={pirRows}
        />
        <LeaderboardTable
          title="Task 2 - Forecast"
          primaryLabel="MAPE Sales"
          rows={forecastRows}
        />
      </div>
    </div>
  );
}

export default DashboardPage;
