"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, removeToken } from "@/lib/api";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  LogOut, TrendingUp, TrendingDown, Receipt, Wallet, Target,
  Check, X, LayoutDashboard, Search, ChevronDown,
  ArrowUpRight, ArrowDownRight, Minus, Settings,
} from "lucide-react";

/* ── Color System ─────────────────────────────────────────── */
const COLORS = {
  violet: { from: "#8b5cf6", to: "#6d28d9" },
  emerald: { from: "#10b981", to: "#059669" },
  amber: { from: "#f59e0b", to: "#d97706" },
  rose: { from: "#f43f5e", to: "#e11d48" },
  sky: { from: "#0ea5e9", to: "#0284c7" },
  slate: { from: "#64748b", to: "#475569" },
};

const CATEGORY_COLORS: Record<string, string> = {
  food: "#f97316", transport: "#0ea5e9", shopping: "#a855f7",
  bills: "#f43f5e", entertainment: "#eab308", health: "#10b981", other: "#64748b",
};

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍔", transport: "🚗", shopping: "🛍️",
  bills: "📄", entertainment: "🎬", health: "💊", other: "📦",
};

/* ── Helpers ──────────────────────────────────────────────── */
function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function budgetColor(pct: number) {
  if (pct >= 90) return { bar: "from-rose-500 to-red-600", text: "text-rose-400" };
  if (pct >= 70) return { bar: "from-amber-400 to-orange-500", text: "text-amber-400" };
  return { bar: "from-emerald-400 to-green-500", text: "text-emerald-400" };
}

/* ── Main Dashboard ───────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [budget, setBudget] = useState<{ amount: number | null; currency: string }>({ amount: null, currency: "EGP" });
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");

  useEffect(() => {
    if (!getToken()) { router.push("/"); return; }
    Promise.all([api.getSummary(), api.getHistory(), api.getMonthlyTrend(), api.getBudget()])
      .then(([s, h, t, b]) => {
        setSummary(s); setHistory(h); setTrend(t); setBudget(b);
        if (b.amount) setBudgetInput(b.amount.toString());
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => { removeToken(); router.push("/"); };

  const saveBudget = async () => {
    const amount = parseFloat(budgetInput.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) return;
    const result = await api.setBudget(amount);
    setBudget(result);
    setEditingBudget(false);
  };

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter(e =>
      (e.merchant || "").toLowerCase().includes(q) ||
      (e.category || "").toLowerCase().includes(q) ||
      e.amount.toString().includes(q)
    );
  }, [history, searchQuery]);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading Aura...</p>
      </div>
    </div>
  );

  const spent = summary?.total || 0;
  const lastMonth = summary?.last_month_total || 0;
  const daysElapsed = summary?.days_in_month || 1;
  const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0;
  const change = pctChange(spent, lastMonth);
  const budgetAmount = budget?.amount;
  const budgetPct = budgetAmount ? Math.min((spent / budgetAmount) * 100, 100) : 0;
  const remaining = budgetAmount ? budgetAmount - spent : null;

  const pieData = Object.entries(summary?.breakdown || {}).map(([name, value]) => ({
    name, value: value as number,
  }));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#0d0d14] p-6">
        <div className="mb-10">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            ✨ Aura
          </h1>
          <p className="text-[11px] text-gray-600 mt-1 tracking-wider uppercase">Spending Tracker</p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeSection === "dashboard"} onClick={() => { setActiveSection("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          <NavItem icon={<Receipt size={18} />} label="Transactions" active={activeSection === "transactions"} onClick={() => { setActiveSection("transactions"); document.getElementById("section-transactions")?.scrollIntoView({ behavior: "smooth" }); }} />
          <NavItem icon={<Target size={18} />} label="Budgets" active={activeSection === "budgets"} onClick={() => { setActiveSection("budgets"); document.getElementById("section-budget")?.scrollIntoView({ behavior: "smooth" }); }} />
          <NavItem icon={<TrendingUp size={18} />} label="Analytics" active={activeSection === "analytics"} onClick={() => { setActiveSection("analytics"); document.getElementById("section-analytics")?.scrollIntoView({ behavior: "smooth" }); }} />
        </nav>

        <div className="border-t border-white/5 pt-4">
          <NavItem icon={<Settings size={18} />} label="Settings" active={activeSection === "settings"} onClick={() => { setActiveSection("settings"); }} />
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Dashboard</h2>
            <p className="text-xs text-gray-500">{summary?.month}</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-full pl-1 pr-3 py-1 transition"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold">
                A
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl py-2 w-44">
                <button
                  onClick={logout}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* ── Stat Cards ──────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStatCard
              label="Total Spent"
              value={`${spent.toLocaleString()}`}
              suffix={summary?.breakdown ? " EGP" : ""}
              trend={change}
              trendLabel="vs last month"
            />
            <BigStatCard
              label="Transactions"
              value={summary?.count?.toString() || "0"}
              neutral
            />
            <BigStatCard
              label="Daily Average"
              value={`${Math.round(dailyAvg).toLocaleString()}`}
              suffix=" EGP"
              neutral
            />
            <BigStatCard
              label="Top Category"
              value={pieData.sort((a, b) => b.value - a.value)[0]?.name || "—"}
              emoji={CATEGORY_EMOJI[pieData.sort((a, b) => b.value - a.value)[0]?.name] || ""}
              neutral
            />
          </div>

          {/* ── Budget Section ──────────────────────────── */}
          <div id="section-budget" className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Target size={18} className="text-violet-400" /> Monthly Budget
              </h2>
              {!editingBudget ? (
                <button
                  onClick={() => { setEditingBudget(true); setBudgetInput(budgetAmount?.toString() || ""); }}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
                  title={budgetAmount ? "Edit budget" : "Set budget"}
                >
                  <Settings size={14} className="text-gray-400" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="5000"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-28 text-white focus:outline-none focus:border-violet-500/50 transition"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                  />
                  <span className="text-gray-500 text-xs">EGP</span>
                  <button onClick={saveBudget} className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center hover:bg-emerald-500/20 transition">
                    <Check size={14} className="text-emerald-400" />
                  </button>
                  <button onClick={() => setEditingBudget(false)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition">
                    <X size={14} className="text-gray-500" />
                  </button>
                </div>
              )}
            </div>

            {budgetAmount ? (
              <>
                {/* Total Budget Bar */}
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">
                    {spent.toLocaleString()} / {budgetAmount.toLocaleString()} {budget.currency}
                  </span>
                  <span className={remaining! >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {remaining! >= 0 ? `${remaining!.toLocaleString()} left` : `${Math.abs(remaining!).toLocaleString()} over`}
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${budgetColor(budgetPct).bar} transition-all duration-700`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-600 text-right mb-6">{budgetPct.toFixed(0)}% used</p>

                {/* Per-category bars */}
                <div className="space-y-3">
                  {pieData.sort((a, b) => b.value - a.value).map(({ name, value }) => {
                    const catPct = budgetAmount ? Math.min((value / budgetAmount) * 100, 100) : 0;
                    const colors = budgetColor(catPct * (100 / Math.max(budgetPct, 1)));
                    return (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400 flex items-center gap-1.5">
                            <span>{CATEGORY_EMOJI[name] || "📦"}</span>
                            <span className="capitalize">{name}</span>
                          </span>
                          <span className="text-gray-500">{value.toLocaleString()} EGP</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${catPct}%`,
                              backgroundColor: CATEGORY_COLORS[name] || "#64748b",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Target size={32} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No budget set</p>
                <p className="text-gray-600 text-xs mt-1">Click the gear icon to set a monthly budget</p>
              </div>
            )}
          </div>

          {/* ── Charts ──────────────────────────────────── */}
          <div id="section-analytics" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-6">
              <h2 className="text-base font-semibold mb-4">Spending by Category</h2>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={85}
                      innerRadius={50}
                      stroke="none"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => `${v.toLocaleString()} EGP`}
                      contentStyle={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "13px" }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      formatter={(value: string) => (
                        <span className="text-xs text-gray-400 capitalize">
                          {CATEGORY_EMOJI[value] || ""} {value} — {(pieData.find(d => d.name === value)?.value || 0).toLocaleString()} EGP
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No spending data yet" />
              )}
            </div>

            {/* Area Chart */}
            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-6">
              <h2 className="text-base font-semibold mb-4">6-Month Trend</h2>
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any) => [`${v.toLocaleString()} EGP`, "Spent"]}
                      contentStyle={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "13px" }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#areaGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No trend data yet" />
              )}
            </div>
          </div>

          {/* ── Transactions Table ───────────────────────── */}
          <div id="section-transactions" className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold">Transactions</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="bg-white/5 border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/30 transition w-48"
                />
              </div>
            </div>

            {filteredHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                      <th className="text-left py-3 px-2 font-medium">Transaction</th>
                      <th className="text-left py-3 px-2 font-medium hidden sm:table-cell">Category</th>
                      <th className="text-left py-3 px-2 font-medium hidden sm:table-cell">Date</th>
                      <th className="text-right py-3 px-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.slice(0, 20).map((e) => (
                      <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{CATEGORY_EMOJI[e.category] || "📦"}</span>
                            <div>
                              <p className="font-medium text-gray-200">{e.merchant || e.category}</p>
                              <p className="text-gray-600 text-xs sm:hidden">
                                {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 hidden sm:table-cell">
                          <span className="text-xs bg-white/5 px-2 py-0.5 rounded-md text-gray-400 capitalize">{e.category}</span>
                        </td>
                        <td className="py-3 px-2 text-gray-500 hidden sm:table-cell">
                          {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="font-semibold text-white">{e.amount.toLocaleString()}</span>
                          <span className="text-gray-500 text-xs ml-1">{e.currency}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message={searchQuery ? "No matching transactions" : "No transactions yet"} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Components ───────────────────────────────────────────── */

function BigStatCard({ label, value, suffix, trend, trendLabel, neutral, emoji }: {
  label: string;
  value: string;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  neutral?: boolean;
  emoji?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{label}</p>
      <div className="flex items-baseline gap-1">
        {emoji && <span className="text-2xl mr-1">{emoji}</span>}
        <span className="text-4xl lg:text-5xl font-bold tracking-tight text-white capitalize">{value}</span>
        {suffix && <span className="text-lg text-gray-500 font-normal">{suffix}</span>}
      </div>
      {trend !== undefined && !neutral && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${trend <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {trend <= 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
          <span>{Math.abs(trend).toFixed(0)}% {trendLabel}</span>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${active ? "bg-violet-500/10 text-violet-400" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
        }`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-600">
      <Minus size={24} className="mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}