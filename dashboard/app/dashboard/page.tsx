"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, removeToken } from "@/lib/api";
import Image from "next/image";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  LogOut, TrendingUp, TrendingDown, Receipt, Wallet, Target,
  Check, X, LayoutDashboard, Search, ChevronDown,
  ArrowUpRight, ArrowDownRight, Minus, Settings, Trash2,
  Menu, XCircle, AlertTriangle, RefreshCw,
} from "lucide-react";

/* ── Color System ─────────────────────────────────────────── */
const CATEGORY_COLORS: Record<string, string> = {
  food: "#f97316", transport: "#0ea5e9", shopping: "#a855f7",
  bills: "#f43f5e", entertainment: "#eab308", health: "#10b981",
  education: "#6366f1", other: "#64748b",
  salary: "#22c55e", freelance: "#06b6d4", gift: "#ec4899",
  refund: "#8b5cf6", investment: "#14b8a6", other_income: "#f59e0b",
};

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍔", transport: "🚗", shopping: "🛍️",
  bills: "📄", entertainment: "🎬", health: "💊",
  education: "📚", other: "📦",
  salary: "💵", freelance: "💻", gift: "🎁",
  refund: "🔄", investment: "📈", other_income: "💰",
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

/* ── Skeleton Components ──────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-20 bg-white/10 rounded mb-4" />
      <div className="h-10 w-32 bg-white/10 rounded mb-2" />
      <div className="h-3 w-24 bg-white/5 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-6 animate-pulse">
      <div className="h-5 w-32 bg-white/10 rounded mb-6" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 border-b border-white/[0.03]">
          <div className="w-10 h-10 bg-white/5 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 bg-white/10 rounded" />
            <div className="h-2 w-20 bg-white/5 rounded" />
          </div>
          <div className="h-4 w-16 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-6 animate-pulse">
      <div className="h-5 w-40 bg-white/10 rounded mb-6" />
      <div className="h-64 bg-white/5 rounded-xl" />
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────── */
function EmptyState({ title, message, icon }: { title: string; message: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-300 mb-1">{title}</h3>
      <p className="text-gray-600 text-sm max-w-xs">{message}</p>
    </div>
  );
}

/* ── Error State ──────────────────────────────────────────── */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} className="text-rose-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl transition font-medium text-sm"
        >
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBudgetCat, setEditingBudgetCat] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [budgetMenuOpen, setBudgetMenuOpen] = useState<string | null>(null);
  const [confirmDeleteBudget, setConfirmDeleteBudget] = useState<string | null>(null);

  const loadData = () => {
    if (!getToken()) { router.push("/"); return; }
    setLoading(true);
    setError(null);
    Promise.all([api.getSummary(), api.getHistory(), api.getMonthlyTrend(), api.getBudget()])
      .then(([s, h, t, b]) => {
        setSummary(s); setHistory(h); setTrend(t); setBudgets(b || {});
      })
      .catch((err) => {
        setError(err.message || "Failed to load dashboard data");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const logout = () => { removeToken(); router.push("/"); };

  const saveBudget = async (category: string) => {
    const amount = parseFloat(budgetInput.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) return;
    await api.setBudget(category, amount);
    setBudgets(prev => ({ ...prev, [category]: amount }));
    setEditingBudgetCat(null);
    setBudgetMenuOpen(null);
  };

  const handleDeleteBudget = async (category: string) => {
    try {
      await api.deleteBudget(category);
      setBudgets(prev => {
        const next = { ...prev };
        delete next[category];
        return next;
      });
    } catch { /* handled by API layer */ }
    setConfirmDeleteBudget(null);
    setBudgetMenuOpen(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await api.deleteExpense(id);
      setHistory(prev => prev.filter(e => e.id !== id));
      // Refresh summary since totals changed
      const s = await api.getSummary();
      setSummary(s);
    } catch { /* Error handled by API layer */ }
    setDeletingId(null);
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

  if (error) return <ErrorState message={error} onRetry={loadData} />;

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Skeleton sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#0d0d14] p-6">
        <div className="mb-10">
          <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      </aside>
      <main className="flex-1 p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonChart />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonTable />
      </main>
    </div>
  );

  const spent = summary?.total || 0;
  const income = summary?.income_total || 0;
  const lastMonth = summary?.last_month_total || 0;
  const daysElapsed = summary?.days_in_month || 1;
  const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0;
  const change = pctChange(spent, lastMonth);
  const net = income - spent;

  const pieData = Object.entries(summary?.breakdown || {}).map(([name, value]) => ({
    name, value: value as number,
  }));

  const scrollTo = (id: string, section: string) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
    if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navItems = [
    { id: "top", section: "dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { id: "section-transactions", section: "transactions", icon: <Receipt size={18} />, label: "Transactions" },
    { id: "section-budget", section: "budgets", icon: <Target size={18} />, label: "Budgets" },
    { id: "section-analytics", section: "analytics", icon: <TrendingUp size={18} />, label: "Analytics" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white">
      <div className="flex flex-1 flex-col md:flex-row">      {/* ── Sidebar (desktop) ─────────────────────────── */}
        <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#0d0d14] p-6 sticky top-0 h-screen">
          <div className="mb-10 flex items-center gap-2">
            <Image src="/aura-logo.png" alt="Aura" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Aura
              </h1>
              <p className="text-[10px] text-gray-600 tracking-wider uppercase">Finance Tracker</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {navItems.map(n => (
              <NavItem key={n.section} icon={n.icon} label={n.label}
                active={activeSection === n.section}
                onClick={() => scrollTo(n.id, n.section)} />
            ))}
          </nav>

          <div className="border-t border-white/5 pt-4">
            <NavItem icon={<Settings size={18} />} label="Settings"
              active={activeSection === "settings"} onClick={() => router.push("/dashboard/settings")} />
          </div>
        </aside>

        {/* ── Mobile bottom nav ─────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d14]/95 backdrop-blur-xl border-t border-white/5 flex justify-around py-2 px-1">
          {navItems.map(n => (
            <button key={n.section}
              onClick={() => scrollTo(n.id, n.section)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] transition ${activeSection === n.section ? "text-violet-400" : "text-gray-500"
                }`}>
              {n.icon}
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Main Content ────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5 px-4 md:px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Image src="/aura-logo.png" alt="Aura" width={28} height={28} className="rounded-lg md:hidden" />
              <div>
                <h2 className="text-lg font-semibold text-white">Dashboard</h2>
                <p className="text-xs text-gray-500">{summary?.month}</p>
              </div>
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

          <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* ── Stat Cards ──────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <BigStatCard
                label="Total Spent" value={`${spent.toLocaleString()}`}
                suffix=" EGP" trend={change} trendLabel="vs last month"
              />
              <BigStatCard
                label="Income" value={`${income.toLocaleString()}`}
                suffix=" EGP" neutral isIncome
              />
              <BigStatCard
                label="Net Balance"
                value={`${Math.abs(net).toLocaleString()}`}
                suffix=" EGP"
                prefix={net >= 0 ? "+" : "-"}
                isPositive={net >= 0}
                neutral
              />
              <BigStatCard
                label="Daily Average"
                value={`${Math.round(dailyAvg).toLocaleString()}`}
                suffix=" EGP" neutral
              />
            </div>

            {/* ── Budget Section ──────────────────────────── */}
            <div id="section-budget" className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-5">
                <Target size={18} className="text-violet-400" /> Category Budgets
              </h2>

              {pieData.length > 0 ? (
                <div className="space-y-4">
                  {pieData.sort((a, b) => b.value - a.value).map(({ name, value }) => {
                    const catBudget = budgets[name];
                    const catPct = catBudget ? Math.min((value / catBudget) * 100, 100) : 0;
                    const colors = catBudget ? budgetColor(catPct) : { bar: "from-gray-600 to-gray-700", text: "text-gray-500" };
                    return (
                      <div key={name}>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="text-gray-300 flex items-center gap-2">
                            <span>{CATEGORY_EMOJI[name] || "📦"}</span>
                            <span className="capitalize">{name}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            {editingBudgetCat === name ? (
                              <div className="flex items-center gap-1">
                                <input type="text" value={budgetInput}
                                  onChange={e => setBudgetInput(e.target.value)}
                                  placeholder="5000" autoFocus
                                  onKeyDown={e => e.key === "Enter" && saveBudget(name)}
                                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs w-20 text-white focus:outline-none focus:border-violet-500/50" />
                                <button onClick={() => saveBudget(name)} className="text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
                                <button onClick={() => setEditingBudgetCat(null)} className="text-gray-500 hover:text-gray-400"><X size={14} /></button>
                              </div>
                            ) : confirmDeleteBudget === name ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400">Remove budget?</span>
                                <button onClick={() => handleDeleteBudget(name)} className="text-rose-400 hover:text-rose-300 font-medium">Yes</button>
                                <button onClick={() => setConfirmDeleteBudget(null)} className="text-gray-500 hover:text-gray-400">No</button>
                              </div>
                            ) : (
                              <>
                                <span className="text-gray-500 text-xs">
                                  {value.toLocaleString()}{catBudget ? ` / ${catBudget.toLocaleString()}` : ""} EGP
                                </span>
                                <div className="relative">
                                  <button onClick={() => setBudgetMenuOpen(budgetMenuOpen === name ? null : name)}
                                    className="text-gray-600 hover:text-gray-400 transition" title="Budget options">
                                    <Settings size={12} />
                                  </button>
                                  {budgetMenuOpen === name && (
                                    <div className="absolute right-0 top-full mt-1 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl py-1 w-36 z-20">
                                      <button
                                        onClick={() => { setEditingBudgetCat(name); setBudgetInput(catBudget?.toString() || ""); setBudgetMenuOpen(null); }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition"
                                      >
                                        <Settings size={12} /> {catBudget ? "Edit amount" : "Set budget"}
                                      </button>
                                      {catBudget && (
                                        <button
                                          onClick={() => { setConfirmDeleteBudget(name); setBudgetMenuOpen(null); }}
                                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-400 hover:bg-white/5 transition"
                                        >
                                          <Trash2 size={12} /> Delete budget
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${catBudget ? `bg-gradient-to-r ${colors.bar}` : ""}`}
                            style={{
                              width: catBudget ? `${catPct}%` : `100%`,
                              backgroundColor: catBudget ? undefined : CATEGORY_COLORS[name] || "#64748b",
                              opacity: catBudget ? 1 : 0.4,
                            }}
                          />
                        </div>
                        {catBudget && (
                          <p className={`text-[10px] text-right mt-0.5 ${colors.text}`}>
                            {catPct.toFixed(0)}% used · {Math.max(0, catBudget - value).toLocaleString()} left
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No spending yet"
                  message="Send a message to the bot to track your first expense!"
                  icon={<Target size={32} className="text-violet-400" />}
                />
              )}
            </div>

            {/* ── Charts ──────────────────────────────────── */}
            <div id="section-analytics" className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Pie Chart */}
              <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
                <h2 className="text-base font-semibold mb-4">Spending by Category</h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name"
                        cx="50%" cy="45%" outerRadius={85} innerRadius={50} stroke="none">
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#64748b"} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: any) => `${v.toLocaleString()} EGP`}
                        contentStyle={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "13px" }}
                        itemStyle={{ color: "#e2e8f0" }}
                      />
                      <Legend verticalAlign="bottom"
                        formatter={(value: string) => (
                          <span className="text-xs text-gray-400 capitalize">
                            {CATEGORY_EMOJI[value] || ""} {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No data" message="Start tracking to see your breakdown"
                    icon={<Wallet size={32} className="text-violet-400" />} />
                )}
              </div>

              {/* Area Chart */}
              <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
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
                      <Area type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} fill="url(#areaGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No trend data" message="Track for a few months to see trends"
                    icon={<TrendingUp size={32} className="text-violet-400" />} />
                )}
              </div>
            </div>

            {/* ── Transactions Table ───────────────────────── */}
            <div id="section-transactions" className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h2 className="text-base font-semibold">Transactions</h2>
                <div className="relative w-full sm:w-auto">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="bg-white/5 border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/30 transition w-full sm:w-48"
                  />
                </div>
              </div>

              {filteredHistory.length > 0 ? (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                          <th className="text-left py-3 px-2 font-medium">Transaction</th>
                          <th className="text-left py-3 px-2 font-medium">Category</th>
                          <th className="text-left py-3 px-2 font-medium">Date</th>
                          <th className="text-right py-3 px-2 font-medium">Amount</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.slice(0, 30).map((e) => {
                          const isIncome = e.entry_type === "income";
                          return (
                            <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition group">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{CATEGORY_EMOJI[e.category] || "📦"}</span>
                                  <div>
                                    <p className="font-medium text-gray-200">{e.merchant || e.category}</p>
                                    <p className="text-gray-600 text-xs">{isIncome ? "📥 Income" : "📤 Expense"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <span className="text-xs bg-white/5 px-2 py-0.5 rounded-md text-gray-400 capitalize">{e.category}</span>
                              </td>
                              <td className="py-3 px-2 text-gray-500">
                                {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <span className={`font-semibold ${isIncome ? "text-emerald-400" : "text-white"}`}>
                                  {isIncome ? "+" : "-"}{e.amount.toLocaleString()}
                                </span>
                                <span className="text-gray-500 text-xs ml-1">{e.currency}</span>
                              </td>
                              <td className="py-3 px-2">
                                <button
                                  onClick={() => handleDelete(e.id)}
                                  disabled={deletingId === e.id}
                                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-rose-400 transition disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deletingId === e.id ? (
                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card layout */}
                  <div className="sm:hidden space-y-2">
                    {filteredHistory.slice(0, 20).map((e) => {
                      const isIncome = e.entry_type === "income";
                      return (
                        <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                          <span className="text-2xl">{CATEGORY_EMOJI[e.category] || "📦"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-200 text-sm truncate">{e.merchant || e.category}</p>
                            <p className="text-gray-600 text-xs">
                              {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              {isIncome && <span className="text-emerald-500 ml-1">income</span>}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold text-sm ${isIncome ? "text-emerald-400" : "text-white"}`}>
                              {isIncome ? "+" : "-"}{e.amount.toLocaleString()}
                            </p>
                            <p className="text-gray-600 text-[10px]">{e.currency}</p>
                          </div>
                          <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id}
                            className="text-gray-700 hover:text-rose-400 transition ml-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <EmptyState
                  title={searchQuery ? "No matches" : "No transactions yet"}
                  message={searchQuery ? "Try a different search term" : "Send a message to the bot to start tracking!"}
                  icon={<Receipt size={32} className="text-violet-400" />}
                />
              )}
            </div>
          </div>
        </main>
        </div>
        {/* Footer */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '1.5rem 2rem',
          textAlign: 'center',
          color: '#6b6b80',
          fontSize: '0.8rem',
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}>
          <span>© 2026 Aura</span>
          <span>·</span>
          <a href="/privacy" style={{ color: '#6b6b80', textDecoration: 'none' }}
            onMouseOver={e => (e.currentTarget.style.color = '#7c6af7')}
            onMouseOut={e => (e.currentTarget.style.color = '#6b6b80')}>Privacy Policy</a>
          <span>·</span>
          <a href="/terms" style={{ color: '#6b6b80', textDecoration: 'none' }}
            onMouseOver={e => (e.currentTarget.style.color = '#7c6af7')}
            onMouseOut={e => (e.currentTarget.style.color = '#6b6b80')}>Terms of Service</a>
        </footer>
      </div>
      );
}

      /* ── Components ───────────────────────────────────────────── */

      function BigStatCard({label, value, suffix, prefix, trend, trendLabel, neutral, emoji, isIncome, isPositive}: {
        label: string;
      value: string;
      suffix?: string;
      prefix?: string;
      trend?: number;
      trendLabel?: string;
      neutral?: boolean;
      emoji?: string;
      isIncome?: boolean;
      isPositive?: boolean;
}) {
  return (
      <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-5">
        <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-2 md:mb-3">{label}</p>
        <div className="flex items-baseline gap-1 flex-wrap">
          {prefix && <span className={`text-xl md:text-2xl font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>{prefix}</span>}
          {emoji && <span className="text-xl md:text-2xl mr-1">{emoji}</span>}
          <span className={`text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight capitalize ${isIncome ? "text-emerald-400" : isPositive !== undefined ? (isPositive ? "text-emerald-400" : "text-rose-400") : "text-white"
            }`}>{value}</span>
          {suffix && <span className="text-sm md:text-lg text-gray-500 font-normal">{suffix}</span>}
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

      function NavItem({icon, label, active, onClick}: {icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
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