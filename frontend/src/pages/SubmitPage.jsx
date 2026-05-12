import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getMyTeam, submitForecast, submitPir } from "../services/api";

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
      .catch((e) => setError(e.message));
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

  const pirRemain = teamInfo?.pir_remaining_today ?? "-";
  const forecastRemain = teamInfo?.forecast_remaining_today ?? "-";
  const remain = task === "pir" ? pirRemain : forecastRemain;

  return (
    <section className="panel form-panel">
      <h2>Submit File</h2>

      <form onSubmit={onSubmit}>
        <label>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span>Select task</span>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 500 }}>
              Còn lại hôm nay: <strong style={{ color: "var(--text)" }}>{remain}</strong>
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
      {error && <p className="error">{error}</p>}
    </section>
  );
}

export default SubmitPage;
