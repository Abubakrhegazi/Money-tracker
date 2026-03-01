const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let _adminToken: string | null = null;

export function setAdminToken(token: string) {
    _adminToken = token;
    if (typeof window !== "undefined") {
        sessionStorage.setItem("admin_token", token);
    }
}

export function getAdminToken(): string | null {
    if (_adminToken) return _adminToken;
    if (typeof window !== "undefined") {
        _adminToken = sessionStorage.getItem("admin_token");
    }
    return _adminToken;
}

export function clearAdminToken() {
    _adminToken = null;
    if (typeof window !== "undefined") {
        sessionStorage.removeItem("admin_token");
    }
}

class AdminApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function adminFetch(endpoint: string, options: RequestInit = {}) {
    const token = getAdminToken();
    const res = await fetch(`${API_URL}/admin${endpoint}`, {
        ...options,
        credentials: "include",
        headers: {
            ...options.headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
        },
    });

    if (res.status === 401) {
        // Try refresh
        const refreshRes = await fetch(`${API_URL}/admin/refresh`, {
            method: "POST",
            credentials: "include",
        });
        if (refreshRes.ok) {
            const data = await refreshRes.json();
            setAdminToken(data.token);
            // Retry original request
            const retryRes = await fetch(`${API_URL}/admin${endpoint}`, {
                ...options,
                credentials: "include",
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${data.token}`,
                    "Content-Type": "application/json",
                },
            });
            if (!retryRes.ok) throw new AdminApiError("Unauthorized", 401);
            return retryRes.json();
        }
        clearAdminToken();
        if (typeof window !== "undefined") window.location.href = "/admin/login";
        throw new AdminApiError("Session expired", 401);
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new AdminApiError(body.detail || res.statusText, res.status);
    }
    return res.json();
}

async function adminFetchBlob(endpoint: string) {
    const token = getAdminToken();
    const res = await fetch(`${API_URL}/admin${endpoint}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new AdminApiError("Export failed", res.status);
    return res.blob();
}

export const adminApi = {
    // Auth
    login: async (username: string, password: string) => {
        const res = await fetch(`${API_URL}/admin/login`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({ detail: "Login failed" }));
            throw new AdminApiError(body.detail, res.status);
        }
        return res.json();
    },
    logout: () => adminFetch("/logout", { method: "POST" }),
    me: () => adminFetch("/me"),

    // Users
    getUsers: (params: Record<string, any> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return adminFetch(`/users?${qs}`);
    },
    getUser: (id: string) => adminFetch(`/users/${encodeURIComponent(id)}`),
    deleteUser: (id: string) => adminFetch(`/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
    exportUsers: () => adminFetchBlob("/users/export"),

    // Transactions
    getTransactions: (params: Record<string, any> = {}) => {
        const qs = new URLSearchParams(params).toString();
        return adminFetch(`/transactions?${qs}`);
    },
    exportTransactions: () => adminFetchBlob("/transactions/export"),

    // Stats
    getStats: (days = 30) => adminFetch(`/stats?days=${days}`),

    // Audit
    getAuditLog: (page = 1) => adminFetch(`/audit-log?page=${page}`),

    // Settings
    changePassword: (current: string, newPw: string) =>
        adminFetch("/settings/password", {
            method: "POST",
            body: JSON.stringify({ current_password: current, new_password: newPw }),
        }),
    getSessions: () => adminFetch("/settings/sessions"),
    revokeSession: (id: number) =>
        adminFetch(`/settings/sessions/${id}`, { method: "DELETE" }),
    toggleMaintenance: () => adminFetch("/settings/maintenance", { method: "POST" }),
    getMaintenance: () => adminFetch("/settings/maintenance"),
    getEnvConfig: () => adminFetch("/settings/env"),
};
