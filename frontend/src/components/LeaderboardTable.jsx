import React from "react";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function LeaderboardTable({
  title,
  primaryLabel,
  rows,
  isAdmin = false,
  onDelete,
}) {
  const handleDeleteClick = (row) => {
    if (!isAdmin || !onDelete) return;

    const ok = window.confirm(
      `Are you sure you want to delete submission of team "${row.team_name}"?`
    );
    if (ok) {
      onDelete(row);
    }
  };

  return (
    <section className="panel leaderboard-panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <span className="panel-tag">{primaryLabel}</span>
      </div>
      
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>{primaryLabel}</th>
              <th>Last Submission</th>
              {isAdmin && <th>Action (Admin)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '20px' }}>No submissions yet</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${title}-${row.rank}-${row.team_name}`}>
                  <td>
                    <span className="rank-pill">#{row.rank}</span>
                  </td>
                  <td className="team-name">{row.team_name}</td>
                  <td className="primary-score">
                    {row.primary_score != null ? Number(row.primary_score).toFixed(4) : "-"}
                  </td>
                  <td>{formatDate(row.last_submission_at)}</td>

                  {isAdmin && (
                    <td style={{ padding: '10px' }}>
                      <button 
                        onClick={() => handleDeleteClick(row)}
                        style={{ 
                          background: '#e74c3c', 
                          color: '#fff', 
                          border: 'none', 
                          padding: '5px 12px', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontSize: '12px'
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