import { getApiBase } from "../services/api";

function DataPage() {
  const api = getApiBase();

  return (
    <section className="panel">
      <h2>Download 2025 Training Data</h2>
      <p>Use the links below to download sample training files:</p>
      <ul>
        <li>
          <a href={`${api}/api/download/train/pir`} target="_blank" rel="noreferrer">
            PIR Train Data (JSON)
          </a>
        </li>
        <li>
          <a href={`${api}/api/download/train/forecast`} target="_blank" rel="noreferrer">
            Forecast Train Data (CSV)
          </a>
        </li>
      </ul>
    </section>
  );
}

export default DataPage;
