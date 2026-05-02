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
    <section className="panel leaderboard-panel" style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', background: '#fff' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h2 className="panel-title" style={{ margin: 0 }}>{title}</h2>
        <span style={{ background: '#eee', padding: '5px 10px', borderRadius: '4px' }}>{primaryLabel}</span>
      </div>
      
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
              <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Rank</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Team</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>{primaryLabel}</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Last Submission</th>
              {isAdmin && <th style={{ padding: '10px', borderBottom: '2px solid #ddd', color: 'red' }}>Action (Admin)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} style={{ padding: '20px', textAlign: 'center' }}>No submissions yet</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${title}-${row.rank}-${row.team_name}`} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>
                    <span className="rank-pill" style={{ fontWeight: 'bold' }}>#{row.rank}</span>
                  </td>
                  <td style={{ padding: '10px' }}>{row.team_name}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#2c3e50' }}>
                    {row.primary_score != null ? Number(row.primary_score).toFixed(4) : "-"}
                  </td>
                  <td style={{ padding: '10px' }}>{formatDate(row.last_submission_at)}</td>

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