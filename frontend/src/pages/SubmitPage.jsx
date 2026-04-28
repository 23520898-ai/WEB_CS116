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

  const remain = teamInfo?.remaining_submissions_today ?? "-";

  return (
    <section className="panel form-panel">
      <h2>Submit File</h2>
      <p>Remaining submissions today: {remain}</p>
      <form onSubmit={onSubmit}>
        <label>
          Select task
          <select value={task} onChange={(e) => setTask(e.target.value)}>
            <option value="pir">Task 1 - PIR (JSON)</option>
            <option value="forecast">Task 2 - Forecast (CSV)</option>
          </select>
        </label>

        <label className="dropzone">
          <span>Drag and drop a file here, or click to browse</span>
          <input
            type="file"
            accept={task === "pir" ? ".json" : ".csv"}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <strong>{file ? file.name : "No file selected"}</strong>
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
