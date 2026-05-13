import React, { useState, useMemo } from "react";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function LeaderboardTable({
  title,
  rows,
  metricsConfig = {},
  isAdmin = false,
  onDelete,
}) {
  const metricKeys = Object.keys(metricsConfig);
  const firstKey = metricKeys[0] || null;
  const firstDir = firstKey
    ? (metricsConfig[firstKey].better === "higher" ? "desc" : "asc")
    : "desc";

  const [sortKey, setSortKey] = useState(firstKey);
  const [sortDir, setSortDir] = useState(firstDir);

  const handleHeaderClick = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(metricsConfig[key].better === "higher" ? "desc" : "asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const nullVal = sortDir === "asc" ? Infinity : -Infinity;
    return [...rows]
      .sort((a, b) => {
        const av = a.secondary_metrics?.[sortKey] ?? nullVal;
        const bv = b.secondary_metrics?.[sortKey] ?? nullVal;
        return sortDir === "asc" ? av - bv : bv - av;
      })
      .map((row, idx) => ({ ...row, rank: idx + 1 }));
  }, [rows, sortKey, sortDir]);

  const handleDeleteClick = (row) => {
    if (!isAdmin || !onDelete) return;
    const ok = window.confirm(
      `Are you sure you want to delete submission of team "${row.team_name}"?`
    );
    if (ok) onDelete(row);
  };

  const thStyle = (key) => ({
    padding: "10px",
    borderBottom: "2px solid #ddd",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    background: sortKey === key ? "#e8f0fe" : undefined,
  });

  const sortIndicator = (key) => {
    if (sortKey !== key) return <span style={{ color: "#bbb", marginLeft: 4 }}>↕</span>;
    return (
      <span style={{ marginLeft: 4, color: "#2c3e50" }}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <section className="panel leaderboard-panel" style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "20px", background: "#fff" }}>
      <h2 style={{ margin: "0 0 12px" }}>{title}</h2>

      <div className="table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f4f4f4", textAlign: "left" }}>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Rank</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Team</th>
              {metricKeys.map((key) => (
                <th key={key} style={thStyle(key)} onClick={() => handleHeaderClick(key)}>
                  {metricsConfig[key].label}{sortIndicator(key)}
                </th>
              ))}
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Last Submission</th>
              {isAdmin && (
                <th style={{ padding: "10px", borderBottom: "2px solid #ddd", color: "red" }}>
                  Action (Admin)
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={3 + metricKeys.length + (isAdmin ? 1 : 0)} style={{ padding: "20px", textAlign: "center" }}>
                  No submissions yet
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr key={`${title}-${row.rank}-${row.team_name}`} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}>
                    <span className="rank-pill" style={{ fontWeight: "bold" }}>#{row.rank}</span>
                  </td>
                  <td style={{ padding: "10px" }}>{row.team_name}</td>
                  {metricKeys.map((key) => {
                    const val = row.secondary_metrics?.[key];
                    return (
                      <td
                        key={key}
                        style={{
                          padding: "10px",
                          fontWeight: sortKey === key ? "bold" : "normal",
                          color: sortKey === key ? "#2c3e50" : "#555",
                        }}
                      >
                        {val != null ? Number(val).toFixed(4) : "-"}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px" }}>{formatDate(row.last_submission_at)}</td>
                  {isAdmin && (
                    <td style={{ padding: "10px" }}>
                      <button
                        onClick={() => handleDeleteClick(row)}
                        style={{
                          background: "#e74c3c",
                          color: "#fff",
                          border: "none",
                          padding: "5px 12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default LeaderboardTable;