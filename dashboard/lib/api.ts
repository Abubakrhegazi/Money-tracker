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

async function fetchWithAuth(endpoint: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = "/";
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
  }
  return res.json();
}

export const api = {
  getSummary: () => fetchWithAuth("/expenses/summary"),
  getHistory: () => fetchWithAuth("/expenses/history"),
  getMonthlyTrend: () => fetchWithAuth("/expenses/monthly-trend"),
  getBudget: () => fetchWithAuth("/budget"),
  setBudget: (amount: number, currency: string = "EGP") =>
    fetchWithAuthPost("/budget", { amount, currency }),
  telegramAuth: (data: object) =>
    fetch(`${API_URL}/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
};