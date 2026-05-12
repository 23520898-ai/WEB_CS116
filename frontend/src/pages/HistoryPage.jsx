import { useEffect, useState, useCallback, useMemo } from "react";
import { getSubmissions } from "../services/api";

const METRIC_CONFIG = {
  pir: [
    { key: "total_correct_recommendations", label: "Total Correct" },
    { key: "precision_at_10", label: "Precision@10" },
    { key: "map", label: "MAP" },
    { key: "iou", label: "IoU" },
    { key: "reciprocal_rank_first_hit", label: "RR First Hit" },
  ],
  forecast: [
    { key: "mape_sales", label: "MAPE Sales" },
    { key: "mae_sales", label: "MAE Sales" },
    { key: "mape_revenue", label: "MAPE Revenue" },
    { key: "mae_revenue", label: "MAE Revenue" },
  ],
};

function SubmissionTable({ rows, metrics }) {
  const [sortKey, setSortKey] = useState("submission_number");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === "status") {
        const cmp = (a.status ?? "").localeCompare(b.status ?? "");
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortKey === "submitted_at") {
        const av = new Date(a.submitted_at).getTime();
        const bv = new Date(b.submitted_at).getTime();
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (sortKey === "submission_number") {
        return sortDir === "asc"
          ? a.submission_number - b.submission_number
          : b.submission_number - a.submission_number;
      }
      const nullFill = sortDir === "asc" ? Infinity : -Infinity;
      const av = a.metrics?.[sortKey] ?? nullFill;
      const bv = b.metrics?.[sortKey] ?? nullFill;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortKey, sortDir]);

  const thStyle = (key) => ({
    padding: "10px",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    borderBottom: "2px solid #dee2e6",
    background: sortKey === key ? "#e8f0fe" : undefined,
  });

  const indicator = (key) => {
    if (sortKey !== key) return <span style={{ color: "#bbb", marginLeft: 3 }}>↕</span>;
    return <span style={{ marginLeft: 3 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", background: "#f8f9fa" }}>
            <th style={thStyle("submission_number")} onClick={() => handleSort("submission_number")}>
              #{indicator("submission_number")}
            </th>
            <th style={thStyle("status")} onClick={() => handleSort("status")}>
              Status{indicator("status")}
            </th>
            {metrics.map((m) => (
              <th key={m.key} style={thStyle(m.key)} onClick={() => handleSort(m.key)}>
                {m.label}{indicator(m.key)}
              </th>
            ))}
            <th style={thStyle("submitted_at")} onClick={() => handleSort("submitted_at")}>
              Submitted At{indicator("submitted_at")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={3 + metrics.length} style={{ textAlign: "center", padding: "20px" }}>
                No submissions yet.
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "10px" }}>{row.submission_number}</td>
                <td style={{ padding: "10px" }}>
                  <span
                    style={{
                      color: row.status === "success" ? "green" : row.status === "failed" ? "red" : "orange",
                      fontWeight: "bold",
                    }}
                  >
                    {row.status.toUpperCase()}
                  </span>
                </td>
                {metrics.map((m) => (
                  <td
                    key={m.key}
                    style={{
                      padding: "10px",
                      fontWeight: sortKey === m.key ? "bold" : "normal",
                      color: sortKey === m.key ? "#2c3e50" : "#555",
                    }}
                  >
                    {row.metrics?.[m.key] != null ? Number(row.metrics[m.key]).toFixed(4) : "—"}
                  </td>
                ))}
                <td style={{ padding: "10px", color: "#666" }}>
                  {new Date(row.submitted_at).toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HistoryPage({ token }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

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
    const timer = setInterval(loadSubmissions, 15000);
    return () => clearInterval(timer);
  }, [loadSubmissions]);

  const pirRows = rows.filter((r) => r.task === "pir");
  const forecastRows = rows.filter((r) => r.task === "forecast");

  return (
    <section className="panel history-panel" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Submission History</h2>
        <button onClick={loadSubmissions} className="btn-small">Refresh Now</button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginTop: "20px", border: "1px solid #eee", padding: "15px", borderRadius: "8px" }}>
        <h3 style={{ margin: "0 0 12px" }}>PIR Submissions</h3>
        <SubmissionTable rows={pirRows} metrics={METRIC_CONFIG.pir} />
      </div>

      <div style={{ marginTop: "30px", border: "1px solid #eee", padding: "15px", borderRadius: "8px" }}>
        <h3 style={{ margin: "0 0 12px" }}>Forecast Submissions</h3>
        <SubmissionTable rows={forecastRows} metrics={METRIC_CONFIG.forecast} />
      </div>
    </section>
  );
}

export default HistoryPage;