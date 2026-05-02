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
      <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3>PIR Submissions</h3>
          <div>
            <label style={{ marginRight: '8px', fontSize: '14px' }}>View Metric:</label>
            <select
              value={pirMetric}
              onChange={(e) => setPirMetric(e.target.value)}
              style={{ padding: '4px' }}
            >
              {METRIC_CONFIG.pir.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f8f9fa' }}>
              <th style={{ padding: '10px' }}>#</th>
              <th style={{ padding: '10px' }}>Status</th>
              <th style={{ padding: '10px' }}>Score ({pirMetric})</th>
              <th style={{ padding: '10px' }}>Submitted At</th>
            </tr>
          </thead>
          <tbody>
            {pirRows.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No PIR submissions yet.</td></tr>
            ) : (
              pirRows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{row.submission_number}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      color: row.status === 'success' ? 'green' : row.status === 'failed' ? 'red' : 'orange',
                      fontWeight: 'bold'
                    }}>
                      {row.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>
                    {row.metrics?.[pirMetric] != null
                      ? Number(row.metrics[pirMetric]).toFixed(4)
                      : "—"}
                  </td>
                  <td style={{ padding: '10px', color: '#666' }}>
                    {new Date(row.submitted_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= TASK 2: FORECAST ================= */}
      <div style={{ marginTop: '30px', border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3>Forecast Submissions</h3>
          <div>
            <label style={{ marginRight: '8px', fontSize: '14px' }}>View Metric:</label>
            <select
              value={forecastMetric}
              onChange={(e) => setForecastMetric(e.target.value)}
              style={{ padding: '4px' }}
            >
              {METRIC_CONFIG.forecast.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f8f9fa' }}>
              <th style={{ padding: '10px' }}>#</th>
              <th style={{ padding: '10px' }}>Status</th>
              <th style={{ padding: '10px' }}>Score ({forecastMetric})</th>
              <th style={{ padding: '10px' }}>Submitted At</th>
            </tr>
          </thead>
          <tbody>
            {forecastRows.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No Forecast submissions yet.</td></tr>
            ) : (
              forecastRows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{row.submission_number}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      color: row.status === 'success' ? 'green' : row.status === 'failed' ? 'red' : 'orange',
                      fontWeight: 'bold'
                    }}>
                      {row.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>
                    {row.metrics?.[forecastMetric] != null
                      ? Number(row.metrics[forecastMetric]).toFixed(4)
                      : "—"}
                  </td>
                  <td style={{ padding: '10px', color: '#666' }}>
                    {new Date(row.submitted_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default HistoryPage;