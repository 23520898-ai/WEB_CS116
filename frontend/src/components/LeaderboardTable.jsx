function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function LeaderboardTable({ title, primaryLabel, rows }) {
  return (
    <section className="panel leaderboard-panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <p className="panel-tag">{primaryLabel}</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>{primaryLabel}</th>
              <th>Secondary Metrics</th>
              <th>Last Submission</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>No submissions yet</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${title}-${row.rank}-${row.team_name}`}>
                  <td>
                    <span className="rank-pill">#{row.rank}</span>
                  </td>
                  <td className="team-name">{row.team_name}</td>
                  <td className="primary-score">{Number(row.primary_score).toFixed(4)}</td>
                  <td>
                    <pre>{JSON.stringify(row.secondary_metrics, null, 2)}</pre>
                  </td>
                  <td>{formatDate(row.last_submission_at)}</td>
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
