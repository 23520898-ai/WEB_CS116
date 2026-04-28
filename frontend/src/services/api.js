const API_BASE = import.meta.env.VITE_API_BASE || "";

export function getApiBase() {
  return API_BASE;
}

async function request(path, options = {}, token) {
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let detail = "Request failed";
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch (e) {
      detail = await res.text();
    }
    throw new Error(detail);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res;
}

export function login(username, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getMyTeam(token) {
  return request("/api/teams/me", {}, token);
}

export function updateMyTeamProfile(payload, token) {
  return request(
    "/api/teams/me/profile",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token
  );
}

export function changePassword(currentPassword, newPassword, token) {
  return request(
    "/api/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
    token
  );
}

export function getLeaderboardPir() {
  return request("/api/leaderboard/pir");
}

export function getLeaderboardForecast() {
  return request("/api/leaderboard/forecast");
}

export function submitPir(file, token) {
  const formData = new FormData();
  formData.append("file", file);
  return request(
    "/api/submit/pir",
    {
      method: "POST",
      body: formData,
    },
    token
  );
}

export function submitForecast(file, token) {
  const formData = new FormData();
  formData.append("file", file);
  return request(
    "/api/submit/forecast",
    {
      method: "POST",
      body: formData,
    },
    token
  );
}

export function getSubmissions(token) {
  return request("/api/submissions", {}, token);
}

export function adminGetTeams(token) {
  return request("/api/admin/teams", {}, token);
}

export function adminGetSubmissions(token) {
  return request("/api/admin/submissions", {}, token);
}

export function adminGetSubmissionLimit(token) {
  return request("/api/admin/settings/submission-limit", {}, token);
}

export function adminResetTeamPassword(teamId, newPassword, token) {
  return request(
    `/api/admin/teams/${teamId}/reset-password`,
    {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    },
    token
  );
}

export function adminUpdateSubmissionLimit(submissionLimitPerDay, token) {
  return request(
    "/api/admin/settings/submission-limit",
    {
      method: "PUT",
      body: JSON.stringify({ submission_limit_per_day: submissionLimitPerDay }),
    },
    token
  );
}

export function adminUploadGroundTruth(task, file, token) {
  const formData = new FormData();
  formData.append("file", file);
  return request(
    `/api/admin/ground-truth/${task}`,
    {
      method: "POST",
      body: formData,
    },
    token
  );
}

export function adminUploadTrainData(task, file, token) {
  const formData = new FormData();
  formData.append("file", file);
  return request(
    `/api/admin/train-data/${task}`,
    {
      method: "POST",
      body: formData,
    },
    token
  );
}

export function getSubmissionFileUrl(submissionId, token) {
  return `${API_BASE}/api/submissions/${submissionId}/file?token=${encodeURIComponent(token)}`;
}
