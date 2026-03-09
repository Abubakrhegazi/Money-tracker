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

async function fetchWithAuthPatch(endpoint: string, body: object) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "PATCH",
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
  updateExpense: (id: number, body: { amount?: number; category?: string; merchant?: string; entry_type?: string }) =>
    fetchWithAuthPatch(`/expenses/${id}`, body),
  deleteExpense: (id: number) => fetchWithAuthDelete(`/expenses/${id}`),
  deleteBudget: (category: string) => fetchWithAuthDelete(`/budget/${category}`),
  getNotificationSettings: () => fetchWithAuth("/notifications/settings"),
  updateNotificationSettings: (settings: Record<string, any>) =>
    fetchWithAuthPost("/notifications/settings", settings),
  telegramAuth: (data: object) =>
    fetch(`${API_URL}/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  getInvestments: () => fetchWithAuth("/investments"),
  checkTicker: (symbol: string) => fetchWithAuth(`/investments/check-ticker?symbol=${encodeURIComponent(symbol)}`),
  createInvestment: (body: {
    asset_name: string;
    asset_type: string;
    amount_invested: number;
    current_value?: number;
    currency?: string;
    notes?: string;
    date?: string;
    grams?: number;
    ticker_symbol?: string;
    coin_id?: string;
    forex_pair?: string;
    price_per_unit?: number;
    karat?: number;
  }) => fetchWithAuthPost("/investments", body),
  updateInvestment: (id: string, body: { current_value?: number; notes?: string }) =>
    fetchWithAuthPatch(`/investments/${id}`, body),
  deleteInvestment: (id: string) => fetchWithAuthDelete(`/investments/${id}`),
  refreshInvestments: () => fetchWithAuthPost("/investments/refresh", {}),
};