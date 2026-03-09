"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, removeToken } from "@/lib/api";
import Image from "next/image";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, YAxis,
} from "recharts";
import {
  LogOut, TrendingUp, Receipt, Target, Settings, ChevronDown,
  Trash2, Plus, X, Check, AlertTriangle, RefreshCw,
} from "lucide-react";

/* ── Asset type config ─────────────────────────────────────── */
const ASSET_COLORS: Record<string, string> = {
  stocks: "#6366f1",
  crypto: "#f97316",
  gold: "#eab308",
  real_estate: "#10b981",
  other: "#64748b",
};
const ASSET_EMOJI: Record<string, string> = {
  stocks: "📈", crypto: "₿", gold: "🥇", real_estate: "🏠", other: "💼",
};
const ASSET_LABEL: Record<string, string> = {
  stocks: "Stocks", crypto: "Crypto", gold: "Gold", real_estate: "Real Estate", other: "Other",
};

/* ── Helpers ───────────────────────────────────────────────── */
function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Sparkline ─────────────────────────────────────────────── */
function Sparkline({ data, color }: { data: { price: number }[]; color: string }) {
  if (!data || data.length < 2) return <span className="text-gray-700 text-xs">—</span>;
  return (
    <ResponsiveContainer width={72} height={28}>
      <LineChart data={data}>
        <YAxis domain={["auto", "auto"]} hide />
        <Line type="monotone" dataKey="price" stroke={color} dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Sub-components ────────────────────────────────────────── */
function StatCard({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean | null;
}) {
  return (
    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-5">
      <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl md:text-3xl font-bold tracking-tight ${positive === true ? "text-emerald-400" : positive === false ? "text-rose-400" : "text-white"
        }`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${active ? "bg-violet-500/10 text-violet-400" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
        }`}>
      {icon}<span>{label}</span>
    </button>
  );
}

/* ── Add Investment Modal ──────────────────────────────────── */
function AddInvestmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    asset_name: "", asset_type: "stocks",
    amount_invested: "", current_value: "",
    currency: "EGP", notes: "",
    date: new Date().toISOString().slice(0, 10),
    grams: "", ticker_symbol: "", coin_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.asset_name.trim()) { setError("Asset name is required"); return; }
    const amount = parseFloat(form.amount_invested);
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true); setError("");
    try {
      await api.createInvestment({
        asset_name: form.asset_name.trim(),
        asset_type: form.asset_type,
        amount_invested: amount,
        current_value: form.current_value ? parseFloat(form.current_value) : undefined,
        currency: form.currency,
        notes: form.notes || undefined,
        date: form.date,
        grams: form.grams ? parseFloat(form.grams) : undefined,
        ticker_symbol: form.ticker_symbol || undefined,
        coin_id: form.coin_id || undefined,
      });
      onSaved();
    } catch (e: any) { setError(e.message || "Failed to save"); }
    setSaving(false);
  };

  const inp = "bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition w-full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-semibold text-white">Add Investment</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Asset Name *</label>
            <input className={inp} placeholder="e.g. Tesla, Bitcoin, Gold" value={form.asset_name}
              onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Asset Type *</label>
            <select className={inp} style={{ colorScheme: 'dark' }} value={form.asset_type}
              onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}>
              <option value="stocks">📈 Stocks</option>
              <option value="crypto">₿ Crypto</option>
              <option value="gold">🥇 Gold</option>
              <option value="real_estate">🏠 Real Estate</option>
              <option value="other">💼 Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount Invested *</label>
              <input className={inp} type="number" placeholder="10000" value={form.amount_invested}
                onChange={e => setForm(f => ({ ...f, amount_invested: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Current Value</label>
              <input className={inp} type="number" placeholder="optional" value={form.current_value}
                onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} />
            </div>
          </div>
          {/* Type-specific fields */}
          {form.asset_type === "gold" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Grams</label>
              <input className={inp} type="number" placeholder="e.g. 10" value={form.grams}
                onChange={e => setForm(f => ({ ...f, grams: e.target.value }))} />
            </div>
          )}
          {form.asset_type === "stocks" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ticker Symbol</label>
              <input className={inp} placeholder="e.g. TSLA, AAPL" value={form.ticker_symbol}
                onChange={e => setForm(f => ({ ...f, ticker_symbol: e.target.value.toUpperCase() }))} />
            </div>
          )}
          {form.asset_type === "crypto" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Coin ID</label>
              <input className={inp} placeholder="e.g. bitcoin, ethereum" value={form.coin_id}
                onChange={e => setForm(f => ({ ...f, coin_id: e.target.value.toLowerCase() }))} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Currency</label>
              <select className={inp} style={{ colorScheme: 'dark' }} value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="EGP">EGP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input className={inp} type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes</label>
            <input className={inp} placeholder="optional" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
              Save Investment
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-gray-300 text-sm transition">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function InvestmentsPage() {
  const router = useRouter();
  const [data, setData] = useState<{ summary: any; investments: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const loadData = useCallback(() => {
    if (!getToken()) { router.push("/"); return; }
    setLoading(true); setError(null);
    api.getInvestments()
      .then(d => { setData(d); setLastRefresh(new Date()); })
      .catch(e => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh prices on page load
  useEffect(() => {
    if (!getToken()) return;
    (api as any).refreshInvestments()
      .then(() => api.getInvestments())
      .then((d: any) => { setData(d); setLastRefresh(new Date()); })
      .catch(() => { /* silently fail */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePriceRefresh = async () => {
    setRefreshing(true);
    try {
      await (api as any).refreshInvestments();
      await api.getInvestments().then(d => { setData(d); setLastRefresh(new Date()); });
    } catch {
      // silently fail — prices unavailable
    }
    setRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteInvestment(id);
      api.getInvestments().then(setData).catch(() => { });
    } catch { /* handled */ }
    setDeletingId(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <AlertTriangle size={40} className="text-rose-400 mx-auto mb-3" />
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={loadData} className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl transition text-sm font-medium">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    </div>
  );

  const investments: any[] = data?.investments || [];
  const summary = data?.summary || {};
  const totalInvested: number = summary.total_invested || 0;
  const currentValue: number | null = summary.current_value ?? null;
  const totalGain: number | null = summary.total_gain ?? null;
  const gainPct: number | null = summary.gain_percentage ?? null;

  const pieData = Object.entries(summary.breakdown || {}).map(([name, value]) => ({
    name, value: value as number,
  }));

  // Most recent last_price_update across all investments
  const latestUpdate = investments.reduce((acc: string | null, i) => {
    if (!i.last_price_update) return acc;
    if (!acc) return i.last_price_update;
    return i.last_price_update > acc ? i.last_price_update : acc;
  }, null);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white">
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#0d0d14] p-6 sticky top-0 h-screen">
          <div className="mb-10 flex items-center gap-2">
            <Image src="/aura-logo.png" alt="Aura" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Aura</h1>
              <p className="text-[10px] text-gray-600 tracking-wider uppercase">Finance Tracker</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1 flex-1">
            <NavItem icon={<TrendingUp size={18} />} label="Dashboard" onClick={() => router.push("/dashboard")} />
            <NavItem icon={<Receipt size={18} />} label="Transactions" onClick={() => router.push("/dashboard")} />
            <NavItem icon={<Target size={18} />} label="Budgets" onClick={() => router.push("/dashboard")} />
            <NavItem icon={<TrendingUp size={18} />} label="Analytics" onClick={() => router.push("/dashboard")} />
            <NavItem icon={<TrendingUp size={18} />} label="Investments" active />
          </nav>
          <div className="border-t border-white/5 pt-4">
            <NavItem icon={<Settings size={18} />} label="Settings" onClick={() => router.push("/dashboard/settings")} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {/* Header */}
          <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5 px-4 md:px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Investments</h2>
              {latestUpdate && (
                <p className="text-xs text-gray-600">
                  Last updated: {timeAgo(latestUpdate)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePriceRefresh} disabled={refreshing}
                title="Refresh live prices"
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 hover:text-white px-3 py-1.5 rounded-xl text-xs transition">
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing…" : "Refresh prices"}
              </button>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                <Plus size={14} /> Add
              </button>
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-full pl-1 pr-3 py-1 transition">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold">A</div>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl py-2 w-44">
                    <button onClick={() => { removeToken(); router.push("/"); }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition">
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard label="Total Invested" value={totalInvested > 0 ? `${totalInvested.toLocaleString()} EGP` : "—"} />
              <StatCard label="Current Value"
                value={currentValue != null ? `${currentValue.toLocaleString()} EGP` : "—"}
                sub={currentValue == null ? "No live prices yet" : undefined} />
              <StatCard label="Total Gain"
                value={totalGain != null ? `${totalGain >= 0 ? "+" : ""}${totalGain.toLocaleString()} EGP` : "—"}
                positive={totalGain != null ? totalGain >= 0 : null} />
              <StatCard label="Return %"
                value={gainPct != null ? `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%` : "—"}
                positive={gainPct != null ? gainPct >= 0 : null} />
            </div>

            {investments.length === 0 ? (
              <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-16 text-center">
                <p className="text-4xl mb-3">📊</p>
                <h3 className="text-gray-300 font-semibold mb-1">No investments yet</h3>
                <p className="text-gray-600 text-sm">Tell the bot: <em>&ldquo;invested 10000 in Bitcoin&rdquo;</em> or add one with the button above.</p>
              </div>
            ) : (
              <>
                {/* Donut Chart */}
                {pieData.length > 0 && (
                  <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
                    <h2 className="text-base font-semibold mb-4">Allocation by Type</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name"
                          cx="50%" cy="45%" outerRadius={90} innerRadius={55} stroke="none">
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={ASSET_COLORS[entry.name] ?? "#64748b"} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any) => `${v.toLocaleString()} EGP`}
                          contentStyle={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "13px" }}
                          itemStyle={{ color: "#e2e8f0" }}
                        />
                        <Legend verticalAlign="bottom"
                          formatter={(value: string) => (
                            <span className="text-xs text-gray-400">{ASSET_EMOJI[value] || "💼"} {ASSET_LABEL[value] || value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Holdings Table */}
                <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
                  <h2 className="text-base font-semibold mb-4">Holdings</h2>

                  {/* Desktop */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                          <th className="text-left py-3 px-2 font-medium">Asset</th>
                          <th className="text-left py-3 px-2 font-medium">Type</th>
                          <th className="text-right py-3 px-2 font-medium">Invested</th>
                          <th className="text-right py-3 px-2 font-medium">Current Value</th>
                          <th className="text-right py-3 px-2 font-medium">Gain / Loss</th>
                          <th className="text-center py-3 px-2 font-medium">7d Trend</th>
                          <th className="text-left py-3 px-2 font-medium">Updated</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {investments.map((inv) => {
                          const gain = inv.current_value != null ? inv.current_value - inv.amount_invested : null;
                          const gainPctRow = gain != null && inv.amount_invested > 0 ? (gain / inv.amount_invested) * 100 : null;
                          const color = ASSET_COLORS[inv.asset_type] ?? "#64748b";
                          const hasPrice = inv.current_value != null;
                          return (
                            <tr key={inv.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition group">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{ASSET_EMOJI[inv.asset_type] || "💼"}</span>
                                  <div>
                                    <p className="font-medium text-gray-200">{inv.asset_name}</p>
                                    <p className="text-gray-600 text-xs">
                                      {inv.ticker_symbol && <span className="mr-1">{inv.ticker_symbol}</span>}
                                      {inv.grams && <span>{inv.grams}g</span>}
                                      {inv.notes && !inv.ticker_symbol && !inv.grams && <span className="truncate max-w-[120px] inline-block">{inv.notes}</span>}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <span className="text-xs px-2 py-0.5 rounded-md"
                                  style={{ backgroundColor: `${color}22`, color }}>
                                  {ASSET_LABEL[inv.asset_type] || inv.asset_type}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right text-gray-300">
                                {inv.amount_invested.toLocaleString()}
                                <span className="text-gray-600 text-xs ml-1">{inv.currency}</span>
                              </td>
                              <td className="py-3 px-2 text-right">
                                {hasPrice ? (
                                  <span className="text-gray-200">
                                    {inv.current_value.toLocaleString()}
                                    <span className="text-gray-600 text-xs ml-1">{inv.currency}</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-600 text-xs">Price unavailable</span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right font-medium">
                                {gain != null ? (
                                  <div className={gain >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                    <span>{gain >= 0 ? "+" : ""}{gain.toLocaleString()}</span>
                                    {gainPctRow != null && (
                                      <span className="text-xs opacity-70 ml-1">({gainPctRow >= 0 ? "+" : ""}{gainPctRow.toFixed(1)}%)</span>
                                    )}
                                  </div>
                                ) : <span className="text-gray-600 text-xs">—</span>}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex justify-center">
                                  <Sparkline data={inv.price_history || []} color={color} />
                                </div>
                              </td>
                              <td className="py-3 px-2 text-gray-600 text-xs">
                                {inv.last_price_update ? timeAgo(inv.last_price_update) : "—"}
                              </td>
                              <td className="py-3 px-2">
                                <button onClick={() => handleDelete(inv.id)} disabled={deletingId === inv.id}
                                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-rose-400 transition disabled:opacity-30">
                                  {deletingId === inv.id
                                    ? <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                                    : <Trash2 size={14} />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden space-y-2">
                    {investments.map((inv) => {
                      const gain = inv.current_value != null ? inv.current_value - inv.amount_invested : null;
                      const gainPctRow = gain != null && inv.amount_invested > 0 ? (gain / inv.amount_invested) * 100 : null;
                      const color = ASSET_COLORS[inv.asset_type] ?? "#64748b";
                      return (
                        <div key={inv.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl mt-0.5">{ASSET_EMOJI[inv.asset_type] || "💼"}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-200 text-sm">{inv.asset_name}</p>
                                  <p className="text-gray-600 text-xs">{ASSET_LABEL[inv.asset_type]} · {inv.date}</p>
                                </div>
                                <button onClick={() => handleDelete(inv.id)} disabled={deletingId === inv.id}
                                  className="text-gray-700 hover:text-rose-400 transition ml-2 mt-0.5">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="flex gap-4 mt-2">
                                <div>
                                  <p className="text-[10px] text-gray-600 uppercase">Invested</p>
                                  <p className="text-sm font-medium text-white">
                                    {inv.amount_invested.toLocaleString()}
                                    <span className="text-gray-600 text-xs ml-1">{inv.currency}</span>
                                  </p>
                                </div>
                                {inv.current_value != null && (
                                  <div>
                                    <p className="text-[10px] text-gray-600 uppercase">Value</p>
                                    <p className="text-sm font-medium text-white">
                                      {inv.current_value.toLocaleString()}
                                      <span className="text-gray-600 text-xs ml-1">{inv.currency}</span>
                                    </p>
                                  </div>
                                )}
                                {gain != null && (
                                  <div>
                                    <p className="text-[10px] text-gray-600 uppercase">Gain</p>
                                    <p className={`text-sm font-medium ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {gain >= 0 ? "+" : ""}{gain.toLocaleString()}
                                      {gainPctRow != null && <span className="text-xs ml-1">({gainPctRow >= 0 ? "+" : ""}{gainPctRow.toFixed(1)}%)</span>}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {(inv.price_history || []).length >= 2 && (
                                <div className="mt-2">
                                  <Sparkline data={inv.price_history} color={color} />
                                </div>
                              )}
                              {inv.last_price_update && (
                                <p className="text-[10px] text-gray-700 mt-1">Updated {timeAgo(inv.last_price_update)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d14]/95 backdrop-blur-xl border-t border-white/5 flex justify-around py-2 px-1">
        {[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Investments", href: "/dashboard/investments", active: true },
          { label: "Settings", href: "/dashboard/settings" },
        ].map(n => (
          <button key={n.label} onClick={() => router.push(n.href)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] transition ${n.active ? "text-violet-400" : "text-gray-500"}`}>
            <TrendingUp size={18} /><span>{n.label}</span>
          </button>
        ))}
      </nav>

      {showModal && (
        <AddInvestmentModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); loadData(); }} />
      )}
    </div>
  );
}
