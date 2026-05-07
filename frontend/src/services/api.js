const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export function getApiBase() {
  return API_BASE;
}

async function request(path, options = {}, token) {
  const headers = {
    ...(options.headers || {}),
  };

  // Nếu body là FormData thì trình duyệt sẽ tự set Content-Type và Boundary
  if (options.body && !(options.body instanceof FormData)) {
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
      const text = await res.text();
      try {
        const body = JSON.parse(text);
        detail = body.detail || JSON.stringify(body);
      } catch {
        if (text) detail = text;
      }
    } catch {
      // ignore read error
    }
    throw new Error(detail);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res;
}

// ================= AUTH =================
export function login(username, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function forgotPassword(username) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function resetPassword(token, newPassword) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
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

// ================= LEADERBOARD =================
export function getLeaderboardPir() {
  return request("/api/leaderboard/pir");
}

export function getLeaderboardForecast() {
  return request("/api/leaderboard/forecast");
}

// ================= SUBMIT =================
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

// ================= ADMIN =================
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

// --- GROUND TRUTH ---
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

// Returns { exists: bool, filename: string } for the given task's ground truth
export function adminGetGroundTruth(task, token) {
  return request(`/api/admin/ground-truth/${task}`, {}, token);
}

export function adminDeleteGroundTruth(task, token) {
  return request(
    `/api/admin/ground-truth/${task}`,
    {
      method: "DELETE",
    },
    token
  );
}

// --- TRAIN DATA ---
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

// --- DELETE SUBMISSION ---
export function adminDeleteSubmission(submissionId, token) {
  return request(
    `/api/admin/submissions/${submissionId}`,
    {
      method: "DELETE",
    },
    token
  );
}

export function getSubmissionFileUrl(submissionId, token) {
  return `${API_BASE}/api/submissions/${submissionId}/file?token=${encodeURIComponent(token)}`;
}