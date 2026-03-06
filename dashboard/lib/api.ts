const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function removeToken() {
  localStorage.removeItem("token");
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchWithAuth(endpoint: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = "/";
    throw new ApiError("Unauthorized", 401);
  }
  if (!res.ok) {
    throw new ApiError(`API error: ${res.statusText}`, res.status);
  }
  return res.json();
}

async function fetchWithAuthPost(endpoint: string, body: object) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = "/";
    throw new ApiError("Unauthorized", 401);
  }
  if (!res.ok) {
    throw new ApiError(`API error: ${res.statusText}`, res.status);
  }
  return res.json();
}

async function fetchWithAuthDelete(endpoint: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = "/";
    throw new ApiError("Unauthorized", 401);
  }
  if (!res.ok) {
    throw new ApiError(`API error: ${res.statusText}`, res.status);
  }
  return res.json();
}

export const api = {
  getSummary: () => fetchWithAuth("/expenses/summary"),
  getHistory: () => fetchWithAuth("/expenses/history"),
  getMonthlyTrend: () => fetchWithAuth("/expenses/monthly-trend"),
  getBudget: () => fetchWithAuth("/budget"),
  setBudget: (category: string, amount: number, currency: string = "EGP") =>
    fetchWithAuthPost("/budget", { category, amount, currency }),
  deleteExpense: (id: number) => fetchWithAuthDelete(`/expenses/${id}`),
  deleteBudget: (category: string) => fetchWithAuthDelete(`/budget/${category}`),
  telegramAuth: (data: object) =>
    fetch(`${API_URL}/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
};