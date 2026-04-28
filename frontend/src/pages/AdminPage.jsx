import { useEffect, useState } from "react";

import { adminGetSubmissions, adminGetTeams, adminResetTeamPassword } from "../services/api";

function AdminPage({ token }) {
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [resetPassword, setResetPassword] = useState("12345678");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [teamRows, submissionRows] = await Promise.all([
        adminGetTeams(token),
        adminGetSubmissions(token),
      ]);
      setTeams(teamRows);
      setSubmissions(submissionRows.slice(0, 80));
      if (teamRows.length > 0 && !selectedTeamId) {
        setSelectedTeamId(String(teamRows[0].id));
      }
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const onResetPassword = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await adminResetTeamPassword(Number(selectedTeamId), resetPassword, token);
      setMessage("Team password reset successfully.");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="panel admin-panel">
      <div className="panel-header">
        <h2>Admin Center</h2>
        <button onClick={load}>Refresh</button>
      </div>

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <h3>Reset Team Password</h3>
      <form onSubmit={onResetPassword}>
        <label>
          Team
          <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
            {teams.map((team) => (
              <option value={team.id} key={team.id}>
                {team.name} - account {team.member_account}
              </option>
            ))}
          </select>
        </label>
        <label>
          New password
          <input
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit">Reset password</button>
      </form>

      <h3>Active Teams</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Account</th>
              <th>Members</th>
              <th>Submissions today</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id}>
                <td>{team.name}</td>
                <td>{team.member_account}</td>
                <td>
                  <pre>{JSON.stringify(team.member_profiles || [], null, 2)}</pre>
                </td>
                <td>{team.submissions_today}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Recent Submissions</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Task</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Metrics</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((row) => (
              <tr key={row.id}>
                <td>{row.team_name}</td>
                <td>{row.task}</td>
                <td>{row.status}</td>
                <td>{new Date(row.submitted_at).toLocaleString()}</td>
                <td>
                  <pre>{JSON.stringify(row.metrics || {}, null, 2)}</pre>
                  {row.error_message ? <p className="error">{row.error_message}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AdminPage;
