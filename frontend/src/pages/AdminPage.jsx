import { useEffect, useState } from "react";
import {
  adminGetSubmissions,
  adminGetSubmissionLimit,
  adminGetTeams,
  adminResetTeamPassword,
  adminUpdateSubmissionLimit,
  adminUploadGroundTruth,
  adminDeleteSubmission,
  adminDeleteGroundTruth,
  adminGetGroundTruth,
} from "../services/api";

function AdminPage({ token }) {
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [resetPassword, setResetPassword] = useState("12345678");
  const [submissionLimit, setSubmissionLimit] = useState(3);
  
  const [gtStatus, setGtStatus] = useState({ 
    pir: { exists: false, filename: "-" }, 
    forecast: { exists: false, filename: "-" } 
  });

  const [gtTask, setGtTask] = useState("forecast");
  const [gtFile, setGtFile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [teamRows, subRows, limitRes, pirGT, forecastGT] = await Promise.all([
        adminGetTeams(token).catch(() => []),
        adminGetSubmissions(token).catch(() => []),
        adminGetSubmissionLimit(token).catch(() => ({})),
        adminGetGroundTruth("pir", token).catch(() => ({ exists: false })),
        adminGetGroundTruth("forecast", token).catch(() => ({ exists: false })),
      ]);

      setTeams(teamRows || []);
      setSubmissions(subRows || []);
      setSubmissionLimit(limitRes?.submission_limit_per_day || 3);
      
      setGtStatus({ 
        pir: pirGT || { exists: false, filename: "-" }, 
        forecast: forecastGT || { exists: false, filename: "-" } 
      });
      
      if (teamRows && teamRows.length > 0 && !selectedTeamId) {
        setSelectedTeamId(String(teamRows[0].id));
      }
    } catch (e) {
      console.error("Load error:", e);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  // ================= SETTINGS & PASSWORD =================
  const onUpdateLimit = async (e) => {
    e.preventDefault();
    try {
      await adminUpdateSubmissionLimit(Number(submissionLimit), token);
      setMessage("Updated submission limit successfully");
      setError("");
      load();
    } catch (e) { setError(e.message); }
  };

  const onResetPass = async (e) => {
    e.preventDefault();
    try {
      await adminResetTeamPassword(Number(selectedTeamId), resetPassword, token);
      setMessage(`Password for team reset to: ${resetPassword}`);
      setError("");
    } catch (e) { setError(e.message); }
  };

  // ================= GROUND TRUTH =================
  const onUploadGT = async (e) => {
    e.preventDefault();
    if (!gtFile) return setError("Please select a file first");

    const expectedExt = gtTask === "pir" ? ".json" : ".csv";
    if (!gtFile.name.toLowerCase().endsWith(expectedExt)) {
      setError(`Invalid file format for ${gtTask.toUpperCase()}. Expected a ${expectedExt} file, but got "${gtFile.name}".`);
      return;
    }

    try {
      setMessage("Uploading and processing...");
      setError("");
      await adminUploadGroundTruth(gtTask, gtFile, token);
      
      setGtFile(null);
      const fileInput = e.target.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";

      setMessage(`Success: Ground truth for ${gtTask} has been updated.`);
      setTimeout(load, 1500); // Đợi backend xử lý file xong mới load lại
    } catch (e) {
      // Fix lỗi hiển thị object
      const errMsg = e.response?.data?.detail || e.message;
      setError("Upload failed: " + (typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg));
      setMessage("");
    }
  };

  const onDeleteGT = async (task) => {
    if (!confirm(`Delete GT for ${task}? This will affect current scores.`)) return;
    try {
      await adminDeleteGroundTruth(task, token);
      setMessage(`Deleted ${task} Ground Truth`);
      load();
    } catch (e) { setError(e.message); }
  };

  // ================= SUBMISSIONS =================
  const onDeleteSub = async (id) => {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    try {
      await adminDeleteSubmission(id, token);
      setMessage("Submission deleted successfully");
      setError("");
      load(); // Load lại để cập nhật bảng
    } catch (e) {
      const errMsg = e.response?.data?.detail || e.message;
      setError("Delete failed: " + (typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg));
    }
  };

  return (
    <section className="panel admin-panel" style={{ padding: '20px' }}>
      <h2>Admin Center</h2>
      
      {message && <div style={{ color: '#155724', background: '#d4edda', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>{message}</div>}
      {error && <div style={{ color: '#721c24', background: '#f8d7da', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>{error}</div>}

      {/* --- SETTINGS --- */}
      <div className="admin-section" style={{ marginBottom: '30px' }}>
        <h3>General Settings</h3>
        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
          <form onSubmit={onUpdateLimit} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label>Daily Limit:</label>
            <input type="number" value={submissionLimit} onChange={(e) => setSubmissionLimit(e.target.value)} style={{ width: '60px', padding: '5px' }} />
            <button type="submit">Update</button>
          </form>

          <form onSubmit={onResetPass} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label>Reset Password:</label>
            <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} style={{ padding: '5px' }}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.member_account})</option>)}
            </select>
            <input type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} style={{ width: '100px', padding: '5px' }} />
            <button type="submit">Reset</button>
          </form>
        </div>
      </div>

      <hr />

      {/* --- GROUND TRUTH --- */}
      <div className="admin-section" style={{ marginTop: '20px' }}>
        <h3>Ground Truth Management</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px' }}>Task</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px' }}>Filename</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {["pir", "forecast"].map((task) => (
              <tr key={task} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}><strong>{task.toUpperCase()}</strong></td>
                <td style={{ padding: '12px' }}>
                  {gtStatus[task]?.exists ? (
                    <span style={{ color: '#28a745', fontWeight: 'bold' }}>● Available</span>
                  ) : (
                    <span style={{ color: '#dc3545' }}>○ Missing</span>
                  )}
                </td>
                <td style={{ padding: '12px', color: '#666' }}>{gtStatus[task]?.filename || "-"}</td>
                <td style={{ padding: '12px' }}>
                  <button className="btn-small btn-danger" onClick={() => onDeleteGT(task)} disabled={!gtStatus[task]?.exists}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ background: '#f1f3f5', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
          <h4>Upload New Ground Truth</h4>
          <form onSubmit={onUploadGT} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select value={gtTask} onChange={(e) => setGtTask(e.target.value)} style={{ padding: '8px' }}>
              <option value="forecast">Forecast</option>
              <option value="pir">PIR</option>
            </select>
            <input type="file" onChange={(e) => setGtFile(e.target.files?.[0])} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary" style={{ padding: '8px 20px' }}>Upload & Process</button>
          </form>
        </div>
      </div>

      <hr style={{ margin: '30px 0' }} />

      {/* --- SUBMISSIONS --- */}
      <div className="admin-section">
        <h3>Global Submissions History</h3>
        <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#eee' }}>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Team</th>
                <th style={{ padding: '10px' }}>Task</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px' }}>Submitted At</th>
                <th style={{ padding: '10px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No submissions found.</td></tr>
              ) : (
                submissions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{s.team_name}</td>
                    <td style={{ padding: '10px' }}>{s.task?.toUpperCase()}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: s.status === 'success' ? 'green' : 'red' }}>{s.status}</span>
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{new Date(s.submitted_at).toLocaleString()}</td>
                    <td style={{ padding: '10px' }}>
                      <button className="btn-danger btn-small" onClick={() => onDeleteSub(s.id)}>Delete</button>
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

export default AdminPage;