import { useEffect, useState, useCallback } from "react";
import { getSubmissions } from "../services/api";

const METRIC_CONFIG = {
  pir: [
    "total_correct_recommendations", // THÊM MỚI
    "precision_at_10", 
    "map", 
    "iou", 
    "reciprocal_rank_first_hit"
  ],
  forecast: ["mape_sales", "mae_sales", "mape_revenue", "mae_revenue"],
};

function HistoryPage({ token }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const [pirMetric, setPirMetric] = useState("precision_at_10");
  const [forecastMetric, setForecastMetric] = useState("mape_sales");

  // Đóng gói hàm load để có thể gọi lại nhiều lần
  const loadSubmissions = useCallback(async () => {
    try {
      const data = await getSubmissions(token);
      setRows(data || []);
    } catch (e) {
      setError("Could not load history: " + e.message);
    }
  }, [token]);

  useEffect(() => {
    loadSubmissions();
    
    // Tự động làm mới mỗi 15 giây để cập nhật trạng thái chấm điểm hoặc nếu Admin xóa bài
    const timer = setInterval(loadSubmissions, 15000);
    return () => clearInterval(timer);
  }, [loadSubmissions]);

  const pirRows = rows.filter((r) => r.task === "pir");
  const forecastRows = rows.filter((r) => r.task === "forecast");

  return (
    <section className="panel history-panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Submission History</h2>
        <button onClick={loadSubmissions} className="btn-small">Refresh Now</button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* ================= TASK 1: PIR ================= */}
      <div className="panel" style={{ marginTop: '20px' }}>
        <div className="panel-header">
          <h3 className="panel-title">PIR Submissions</h3>
          <div>
            <label style={{ display: 'inline', marginRight: '8px', fontSize: '12px' }}>VIEW METRIC:</label>
            <select
              value={pirMetric}
              onChange={(e) => setPirMetric(e.target.value)}
            >
              {METRIC_CONFIG.pir.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Score ({pirMetric})</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {pirRows.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No PIR submissions yet.</td></tr>
              ) : (
                pirRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.submission_number}</td>
                    <td>
                      <span className={row.status === 'success' ? 'success' : row.status === 'failed' ? 'error' : ''}>
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="primary-score">
                      {row.metrics?.[pirMetric] != null
                        ? Number(row.metrics[pirMetric]).toFixed(4)
                        : "—"}
                    </td>
                    <td>
                      {new Date(row.submitted_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= TASK 2: FORECAST ================= */}
      <div className="panel" style={{ marginTop: '20px' }}>
        <div className="panel-header">
          <h3 className="panel-title">Forecast Submissions</h3>
          <div>
            <label style={{ display: 'inline', marginRight: '8px', fontSize: '12px' }}>VIEW METRIC:</label>
            <select
              value={forecastMetric}
              onChange={(e) => setForecastMetric(e.target.value)}
            >
              {METRIC_CONFIG.forecast.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Score ({forecastMetric})</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {forecastRows.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No Forecast submissions yet.</td></tr>
              ) : (
                forecastRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.submission_number}</td>
                    <td>
                      <span className={row.status === 'success' ? 'success' : row.status === 'failed' ? 'error' : ''}>
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="primary-score">
                      {row.metrics?.[forecastMetric] != null
                        ? Number(row.metrics[forecastMetric]).toFixed(4)
                        : "—"}
                    </td>
                    <td>
                      {new Date(row.submitted_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default HistoryPage;