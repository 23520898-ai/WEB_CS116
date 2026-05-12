import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getMyTeam, submitForecast, submitPir } from "../services/api";

function ErrorMessageBox({ message, onClose }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: "8px", padding: "28px 32px",
        maxWidth: "420px", width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⚠️</div>
        <p style={{ margin: "0 0 20px", color: "#721c24", fontWeight: 500, lineHeight: 1.5 }}>
          {message}
        </p>
        <button
          onClick={onClose}
          style={{
            padding: "8px 32px", background: "#dc3545", color: "#fff",
            border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: 600,
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

function SubmitPage({ token }) {
  const [task, setTask] = useState("pir");
  const [file, setFile] = useState(null);
  const [teamInfo, setTeamInfo] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getMyTeam(token)
      .then(setTeamInfo)
      .catch(() => {});
  }, [token]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file before submitting.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result =
        task === "pir" ? await submitPir(file, token) : await submitForecast(file, token);
      setMessage(
        `Submission successful (#${result.submission_number}). Your file is now being evaluated.`
      );
      setTimeout(() => navigate("/history"), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel form-panel">
      <h2>Submit File</h2>

      <ErrorMessageBox message={error} onClose={() => setError("")} />

      <form onSubmit={onSubmit}>
        <label>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span>Select task</span>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 500 }}>
              Còn lại hôm nay: <strong style={{ color: "var(--text)" }}>{task === "pir" ? (teamInfo?.pir_remaining_today ?? "-") : (teamInfo?.forecast_remaining_today ?? "-")}</strong>
            </span>
          </span>
          <select value={task} onChange={(e) => { setTask(e.target.value); setFile(null); }}>
            <option value="pir">Task 1 - PIR (JSON)</option>
            <option value="forecast">Task 2 - Forecast (CSV)</option>
          </select>
        </label>

        <label className="dropzone">
          <input
            type="file"
            accept={task === "pir" ? ".json" : ".csv"}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file
            ? <strong>{file.name}</strong>
            : <span style={{ color: "#888" }}>No file selected</span>
          }
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
      {message && <p className="success">{message}</p>}
    </section>
  );
}

export default SubmitPage;
