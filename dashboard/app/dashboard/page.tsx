"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, removeToken } from "@/lib/api";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { LogOut, TrendingUp, Receipt, Wallet } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  food: "#f97316",
  transport: "#3b82f6",
  shopping: "#a855f7",
  bills: "#ef4444",
  entertainment: "#eab308",
  health: "#22c55e",
  other: "#6b7280",
};

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍔", transport: "🚗", shopping: "🛍️",
  bills: "📄", entertainment: "🎬", health: "💊", other: "📦",
};

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push("/"); return; }
    Promise.all([api.getSummary(), api.getHistory(), api.getMonthlyTrend()])
      .then(([s, h, t]) => { setSummary(s); setHistory(h); setTrend(t); })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => { removeToken(); router.push("/"); };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading your dashboard...</p>
    </div>
  );

  const pieData = Object.entries(summary?.breakdown || {}).map(([name, value]) => ({
    name, value,
  }));

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">💰 MoneyBot</h1>
          <p className="text-gray-400 text-sm">{summary?.month}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon={<Wallet size={20} />} label="Total Spent" value={`${summary?.total?.toLocaleString()} EGP`} />
        <StatCard icon={<Receipt size={20} />} label="Transactions" value={summary?.count} />
        <StatCard icon={<TrendingUp size={20} />} label="Top Category"
          value={`${CATEGORY_EMOJI[Object.entries(summary?.breakdown || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0]]} ${Object.entries(summary?.breakdown || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "—"}`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Pie Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name ? CATEGORY_EMOJI[name] ?? name : ''}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#6b7280"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => `${v.toLocaleString()} EGP`} contentStyle={{ background: "#111827", border: "none" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">6-Month Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `${v.toLocaleString()} EGP`} contentStyle={{ background: "#111827", border: "none" }} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        <div className="flex flex-col gap-3">
          {history.slice(0, 10).map((e) => (
            <div key={e.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{CATEGORY_EMOJI[e.category] || "📦"}</span>
                <div>
                  <p className="font-medium text-sm">{e.merchant || e.category}</p>
                  <p className="text-gray-500 text-xs">{new Date(e.created_at).toLocaleDateString("en-GB")}</p>
                </div>
              </div>
              <span className="font-semibold text-orange-400">{e.amount.toLocaleString()} {e.currency}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
      <div className="text-blue-400">{icon}</div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-white font-bold text-lg">{value}</p>
      </div>
    </div>
  );
}