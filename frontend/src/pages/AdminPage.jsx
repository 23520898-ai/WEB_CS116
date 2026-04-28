import { useEffect, useState } from "react";

import {
  adminGetSubmissions,
  adminGetSubmissionLimit,
  adminGetTeams,
  adminResetTeamPassword,
  adminUploadTrainData,
  adminUpdateSubmissionLimit,
  adminUploadGroundTruth,
} from "../services/api";

function AdminPage({ token }) {
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [resetPassword, setResetPassword] = useState("12345678");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [submissionLimit, setSubmissionLimit] = useState(3);
  const [gtTask, setGtTask] = useState("forecast");
  const [gtFile, setGtFile] = useState(null);
  const [trainTask, setTrainTask] = useState("forecast");
  const [trainFile, setTrainFile] = useState(null);
  const [trainPreview, setTrainPreview] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [teamRows, submissionRows, limitRes] = await Promise.all([
        adminGetTeams(token),
        adminGetSubmissions(token),
        adminGetSubmissionLimit(token),
      ]);
      setTeams(teamRows);
      setSubmissions(submissionRows.slice(0, 80));
      if (teamRows.length > 0 && !selectedTeamId) {
        setSelectedTeamId(String(teamRows[0].id));
      }
      setSubmissionLimit(limitRes.submission_limit_per_day || 3);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [token, selectedTeamId]);

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

  const onUpdateSubmissionLimit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const value = Number(submissionLimit);
      const res = await adminUpdateSubmissionLimit(value, token);
      setSubmissionLimit(res.submission_limit_per_day);
      setMessage(`Submission limit updated to ${res.submission_limit_per_day} per day.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const onUploadGroundTruth = async (e) => {
    e.preventDefault();
    if (!gtFile) {
      setError("Please select a ground truth file.");
      return;
    }
    setMessage("");
    setError("");
    try {
      const res = await adminUploadGroundTruth(gtTask, gtFile, token);
      setMessage(`Ground truth updated: ${res.file}`);
      setGtFile(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const onUploadTrainData = async (e) => {
    e.preventDefault();
    if (!trainFile) {
      setError("Please select a train data file.");
      return;
    }
    setMessage("");
    setError("");
    try {
      const res = await adminUploadTrainData(trainTask, trainFile, token);
      setMessage(`Train data updated: ${res.file}`);
      setTrainPreview(res.preview || null);
      setTrainFile(null);
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

      <h3>Submission Limit Configuration</h3>
      <form onSubmit={onUpdateSubmissionLimit}>
        <label>
          Max submissions per team per day
          <input
            type="number"
            min={1}
            max={100}
            value={submissionLimit}
            onChange={(e) => setSubmissionLimit(e.target.value)}
            required
          />
        </label>
        <button type="submit">Update daily limit</button>
      </form>

      <h3>Upload Ground Truth</h3>
      <form onSubmit={onUploadGroundTruth}>
        <label>
          Task
          <select value={gtTask} onChange={(e) => setGtTask(e.target.value)}>
            <option value="forecast">Forecast</option>
            <option value="pir">PIR</option>
          </select>
        </label>
        <label>
          Ground truth file
          <input
            type="file"
            accept={gtTask === "pir" ? ".json,.parquet" : ".csv,.parquet"}
            onChange={(e) => setGtFile(e.target.files?.[0] || null)}
          />
        </label>
        <button type="submit">Upload ground truth</button>
      </form>

      <h3>Upload Train Data</h3>
      <form onSubmit={onUploadTrainData}>
        <label>
          Task
          <select value={trainTask} onChange={(e) => setTrainTask(e.target.value)}>
            <option value="forecast">Forecast</option>
            <option value="pir">PIR</option>
          </select>
        </label>
        <label>
          Train data file
          <input
            type="file"
            accept={trainTask === "pir" ? ".json,.parquet" : ".csv,.parquet"}
            onChange={(e) => setTrainFile(e.target.files?.[0] || null)}
          />
        </label>
        <button type="submit">Upload train data</button>
      </form>
      {trainPreview ? (
        <div className="panel">
          <h4>Train Data Preview</h4>
          <pre>{JSON.stringify(trainPreview, null, 2)}</pre>
        </div>
      ) : null}

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
