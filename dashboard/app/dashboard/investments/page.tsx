"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, removeToken } from "@/lib/api";
import Image from "next/image";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  LogOut, TrendingUp, TrendingDown, LayoutDashboard, Receipt,
  Target, Settings, ChevronDown, Trash2, Plus, X, Check,
  AlertTriangle, RefreshCw, TrendingUp as InvestIcon,
} from "lucide-react";

/* ── Asset type config ────────────────────────────────────── */
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

/* ── Helpers ──────────────────────────────────────────────── */
function fmt(n: number | null | undefined, currency = "EGP") {
  if (n == null) return "—";
  return `${n.toLocaleString()} ${currency}`;
}

/* ── Sub-components ───────────────────────────────────────── */
function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  return (
    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-5">
      <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl md:text-3xl font-bold tracking-tight ${
        positive === true ? "text-emerald-400" : positive === false ? "text-rose-400" : "text-white"
      }`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
        active ? "bg-violet-500/10 text-violet-400" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
      }`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mb-4">
        <InvestIcon size={36} className="text-violet-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-300 mb-1">No investments yet</h3>
      <p className="text-gray-600 text-sm max-w-xs">
        Tell the bot: <em>&ldquo;invested 10000 in Bitcoin&rdquo;</em> or add one below.
      </p>
    </div>
  );
}

/* ── Add Investment Modal ─────────────────────────────────── */
function AddInvestmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    asset_name: "",
    asset_type: "stocks",
    amount_invested: "",
    current_value: "",
    currency: "EGP",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.asset_name.trim()) { setError("Asset name is required"); return; }
    const amount = parseFloat(form.amount_invested);
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true);
    setError("");
    try {
      await api.createInvestment({
        asset_name: form.asset_name.trim(),
        asset_type: form.asset_type,
        amount_invested: amount,
        current_value: form.current_value ? parseFloat(form.current_value) : undefined,
        currency: form.currency,
        notes: form.notes || undefined,
        date: form.date,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || "Failed to save");
    }
    setSaving(false);
  };

  const inputClass = "bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition w-full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-semibold text-white">Add Investment</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Asset Name *</label>
            <input className={inputClass} placeholder="e.g. Tesla, Bitcoin, Gold" value={form.asset_name}
              onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Asset Type *</label>
            <select className={inputClass} value={form.asset_type}
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
              <input className={inputClass} type="number" placeholder="10000" value={form.amount_invested}
                onChange={e => setForm(f => ({ ...f, amount_invested: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Current Value</label>
              <input className={inputClass} type="number" placeholder="optional" value={form.current_value}
                onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Currency</label>
              <select className={inputClass} value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="EGP">EGP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input className={inputClass} type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes</label>
            <input className={inputClass} placeholder="optional" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {error && <p className="text-rose-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
              Save Investment
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-gray-300 text-sm transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */
export default function InvestmentsPage() {
  const router = useRouter();
  const [data, setData] = useState<{ summary: any; investments: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const loadData = () => {
    if (!getToken()) { router.push("/"); return; }
    setLoading(true);
    setError(null);
    api.getInvestments()
      .then(setData)
      .catch(e => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteInvestment(id);
      setData(prev => prev ? {
        ...prev,
        investments: prev.investments.filter(i => i.id !== id),
      } : prev);
      // refresh summary
      api.getInvestments().then(setData).catch(() => {});
    } catch { /* handled */ }
    setDeletingId(null);
  };

  const navItems = [
    { section: "dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard", href: "/dashboard" },
    { section: "investments", icon: <TrendingUp size={18} />, label: "Investments", href: "/dashboard/investments" },
    { section: "settings", icon: <Settings size={18} />, label: "Settings", href: "/dashboard/settings" },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
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

  const investments = data?.investments || [];
  const summary = data?.summary || {};
  const totalInvested: number = summary.total_invested || 0;
  const currentValue: number | null = summary.current_value ?? null;
  const totalGain: number | null = summary.total_gain ?? null;
  const gainPct: number | null = summary.gain_percentage ?? null;

  const pieData = Object.entries(summary.breakdown || {}).map(([name, value]) => ({
    name, value: value as number,
  }));

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
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={() => router.push("/dashboard")} />
            <NavItem icon={<Receipt size={18} />} label="Transactions" onClick={() => router.push("/dashboard")} />
            <NavItem icon={<Target size={18} />} label="Budgets" onClick={() => router.push("/dashboard")} />
            <NavItem icon={<TrendingUp size={18} />} label="Analytics" onClick={() => router.push("/dashboard")} />
            <NavItem icon={<InvestIcon size={18} />} label="Investments" active onClick={() => {}} />
          </nav>
          <div className="border-t border-white/5 pt-4">
            <NavItem icon={<Settings size={18} />} label="Settings" onClick={() => router.push("/dashboard/settings")} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {/* Header */}
          <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5 px-4 md:px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Investments</h2>
              <p className="text-xs text-gray-500">Portfolio overview</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
              >
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
              <StatCard label="Total Invested" value={fmt(totalInvested)} />
              <StatCard
                label="Current Value"
                value={currentValue != null ? fmt(currentValue) : "—"}
                sub={currentValue == null ? "No valuations yet" : undefined}
              />
              <StatCard
                label="Total Gain"
                value={totalGain != null ? `${totalGain >= 0 ? "+" : ""}${totalGain.toLocaleString()} EGP` : "—"}
                positive={totalGain != null ? totalGain >= 0 : null}
              />
              <StatCard
                label="Return %"
                value={gainPct != null ? `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%` : "—"}
                positive={gainPct != null ? gainPct >= 0 : null}
              />
            </div>

            {investments.length === 0 ? (
              <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl">
                <EmptyState />
              </div>
            ) : (
              <>
                {/* Donut Chart */}
                {pieData.length > 0 && (
                  <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
                    <h2 className="text-base font-semibold mb-4">Allocation by Type</h2>
                    <ResponsiveContainer width="100%" height={280}>
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
                            <span className="text-xs text-gray-400">
                              {ASSET_EMOJI[value] || "💼"} {ASSET_LABEL[value] || value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Investments Table */}
                <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
                  <h2 className="text-base font-semibold mb-4">Holdings</h2>

                  {/* Desktop */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                          <th className="text-left py-3 px-2 font-medium">Asset</th>
                          <th className="text-left py-3 px-2 font-medium">Type</th>
                          <th className="text-right py-3 px-2 font-medium">Invested</th>
                          <th className="text-right py-3 px-2 font-medium">Current Value</th>
                          <th className="text-right py-3 px-2 font-medium">Gain / Loss</th>
                          <th className="text-left py-3 px-2 font-medium">Date</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {investments.map((inv) => {
                          const gain = inv.current_value != null ? inv.current_value - inv.amount_invested : null;
                          const gainPctRow = gain != null && inv.amount_invested > 0 ? (gain / inv.amount_invested) * 100 : null;
                          return (
                            <tr key={inv.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition group">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{ASSET_EMOJI[inv.asset_type] || "💼"}</span>
                                  <div>
                                    <p className="font-medium text-gray-200">{inv.asset_name}</p>
                                    {inv.notes && <p className="text-gray-600 text-xs truncate max-w-[140px]">{inv.notes}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <span className="text-xs px-2 py-0.5 rounded-md"
                                  style={{ backgroundColor: `${ASSET_COLORS[inv.asset_type]}22`, color: ASSET_COLORS[inv.asset_type] }}>
                                  {ASSET_LABEL[inv.asset_type] || inv.asset_type}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right text-gray-300">
                                {inv.amount_invested.toLocaleString()} <span className="text-gray-600 text-xs">{inv.currency}</span>
                              </td>
                              <td className="py-3 px-2 text-right text-gray-300">
                                {inv.current_value != null ? (
                                  <>{inv.current_value.toLocaleString()} <span className="text-gray-600 text-xs">{inv.currency}</span></>
                                ) : <span className="text-gray-600">—</span>}
                              </td>
                              <td className="py-3 px-2 text-right font-medium">
                                {gain != null ? (
                                  <span className={gain >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                    {gain >= 0 ? "+" : ""}{gain.toLocaleString()}
                                    {gainPctRow != null && (
                                      <span className="text-xs ml-1 opacity-70">({gainPctRow >= 0 ? "+" : ""}{gainPctRow.toFixed(1)}%)</span>
                                    )}
                                  </span>
                                ) : <span className="text-gray-600">—</span>}
                              </td>
                              <td className="py-3 px-2 text-gray-500 text-xs">{inv.date}</td>
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

                  {/* Mobile */}
                  <div className="sm:hidden space-y-2">
                    {investments.map((inv) => {
                      const gain = inv.current_value != null ? inv.current_value - inv.amount_invested : null;
                      return (
                        <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                          <span className="text-2xl">{ASSET_EMOJI[inv.asset_type] || "💼"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-200 text-sm truncate">{inv.asset_name}</p>
                            <p className="text-gray-600 text-xs">{ASSET_LABEL[inv.asset_type]} · {inv.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white text-sm font-semibold">{inv.amount_invested.toLocaleString()}</p>
                            {gain != null && (
                              <p className={`text-xs ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {gain >= 0 ? "+" : ""}{gain.toLocaleString()}
                              </p>
                            )}
                          </div>
                          <button onClick={() => handleDelete(inv.id)} disabled={deletingId === inv.id}
                            className="text-gray-700 hover:text-rose-400 transition ml-1">
                            <Trash2 size={14} />
                          </button>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d14]/95 backdrop-blur-xl border-t border-white/5 flex justify-around py-2 px-1">
        {[
          { icon: <LayoutDashboard size={18} />, label: "Dashboard", href: "/dashboard" },
          { icon: <InvestIcon size={18} />, label: "Investments", href: "/dashboard/investments", active: true },
          { icon: <Settings size={18} />, label: "Settings", href: "/dashboard/settings" },
        ].map(n => (
          <button key={n.label} onClick={() => router.push(n.href)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] transition ${n.active ? "text-violet-400" : "text-gray-500"}`}>
            {n.icon}
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {showModal && (
        <AddInvestmentModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadData(); }}
        />
      )}
    </div>
  );
}
