import { useEffect, useState } from "react";

import { getApiBase, getSubmissions } from "../services/api";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function HistoryPage({ token }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const data = await getSubmissions(token);
      setRows(data);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, [token]);

  const downloadFile = async (submissionId, filename) => {
    try {
      const response = await fetch(`${getApiBase()}/api/submissions/${submissionId}/file`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to download the file.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Submission History</h2>
        <button onClick={loadData}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Submitted At</th>
              <th>Task</th>
              <th>Status</th>
              <th>Metrics</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.submitted_at)}</td>
                <td>{row.task}</td>
                <td>{row.status}</td>
                <td>
                  <pre>{JSON.stringify(row.metrics || {}, null, 2)}</pre>
                  {row.error_message ? <p className="error">{row.error_message}</p> : null}
                </td>
                <td>
                  <button
                    onClick={() => downloadFile(row.id, row.original_filename)}
                    disabled={row.status === "failed"}
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default HistoryPage;
