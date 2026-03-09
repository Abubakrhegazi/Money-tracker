"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, removeToken } from "@/lib/api";
import Image from "next/image";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, YAxis, XAxis, AreaChart, Area,
} from "recharts";
import {
  LogOut, TrendingUp, Receipt, Target, Settings, ChevronDown,
  Trash2, Plus, X, Check, AlertTriangle, RefreshCw, BarChart2, List,
  Coins, DollarSign, Building2, Briefcase, Pencil,
} from "lucide-react";

/* ── Asset type config ─────────────────────────────────────── */
const ASSET_COLORS: Record<string, string> = {
  stocks: "#6366f1",
  crypto: "#f97316",
  gold: "#eab308",
  real_estate: "#10b981",
  currency: "#06b6d4",
  other: "#64748b",
};
function AssetIcon({ type, size = 14 }: { type: string; size?: number }) {
  const color = ASSET_COLORS[type] ?? "#64748b";
  const icon: Record<string, React.ReactNode> = {
    stocks: <TrendingUp size={size} />,
    crypto: <Coins size={size} />,
    gold: <Coins size={size} />,
    real_estate: <Building2 size={size} />,
    currency: <DollarSign size={size} />,
    other: <Briefcase size={size} />,
  };
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${color}22`, color }}>
      {icon[type] ?? <Briefcase size={size} />}
    </div>
  );
}
const ASSET_LABEL: Record<string, string> = {
  stocks: "Stocks", crypto: "Crypto", gold: "Gold", real_estate: "Real Estate", currency: "Currency", other: "Other",
};

const ASSET_TYPES = [
  { value: "stocks", label: "Stocks", emoji: "📈" },
  { value: "crypto", label: "Crypto", emoji: "₿" },
  { value: "gold", label: "Gold", emoji: "🥇" },
  { value: "real_estate", label: "Real Estate", emoji: "🏠" },
  { value: "currency", label: "Currency", emoji: "💱" },
  { value: "other", label: "Other", emoji: "💼" },
];

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

const KARATS = [
  { value: "24", label: "24k — Pure Gold", emoji: "✨" },
  { value: "21", label: "21k — 87.5% Pure", emoji: "🥇" },
  { value: "18", label: "18k — 75% Pure", emoji: "🥈" },
  { value: "14", label: "14k — 58.3% Pure", emoji: "🥉" },
];

const CURRENCIES = [
  { value: "EGP", label: "EGP — Egyptian Pound", emoji: "🇪🇬" },
  { value: "USD", label: "USD — US Dollar", emoji: "🇺🇸" },
  { value: "EUR", label: "EUR — Euro", emoji: "🇪🇺" },
  { value: "GBP", label: "GBP — British Pound", emoji: "🇬🇧" },
  { value: "SAR", label: "SAR — Saudi Riyal", emoji: "🇸🇦" },
  { value: "AED", label: "AED — UAE Dirham", emoji: "🇦🇪" },
];

/* ── Reusable custom dropdown ──────────────────────────────── */
function CustomDropdown({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; emoji: string }[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(a => a.value === value) || options[0];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 transition">
        <span>{selected.emoji} {selected.label}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {options.map(a => (
            <button key={a.value} type="button"
              onClick={() => { onChange(a.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-white/5 ${a.value === value ? "text-violet-400 bg-violet-500/10" : "text-gray-200"}`}>
              <span>{a.emoji}</span><span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Toggle Switch ─────────────────────────────────────────── */
function Toggle({ checked, onCheckedChange, label }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; label: string;
}) {
  return (
    <button type="button" onClick={() => onCheckedChange(!checked)}
      className="flex items-center gap-2.5 select-none group">
      <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${checked ? "bg-violet-600" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-4" : ""}`} />
      </div>
      <span className="text-xs text-gray-400 group-hover:text-gray-300 transition">{label}</span>
    </button>
  );
}

/* ── Add Investment Modal ──────────────────────────────────── */
function AddInvestmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    asset_name: "", asset_type: "stocks", currency: "EGP", notes: "",
    date: new Date().toISOString().slice(0, 10),
    ticker_symbol: "", is_egyptian: false, shares: "", buy_price_per_share: "",
    grams: "", karat: "21", amount_paid_gold: "",
    coin_id: "", amount_invested: "",
    forex_pair: "", buy_rate: "",
    manual_amount: "",
  });
  const [tickerInfo, setTickerInfo] = useState<{ valid: boolean; symbol: string; price_egp: number } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isStocks = form.asset_type === "stocks";
  const isGold = form.asset_type === "gold";
  const isCrypto = form.asset_type === "crypto";
  const isCurrency = form.asset_type === "currency";

  const effectiveTicker = isStocks && form.ticker_symbol
    ? (form.is_egyptian && !form.ticker_symbol.includes(".") ? form.ticker_symbol + ".CA" : form.ticker_symbol)
    : "";

  const sharesNum = parseFloat(form.shares);
  const buyPriceNum = parseFloat(form.buy_price_per_share) || tickerInfo?.price_egp || 0;
  const stockCost = !isNaN(sharesNum) && sharesNum > 0 && buyPriceNum > 0 ? sharesNum * buyPriceNum : null;

  const unitsHeld = (() => {
    if (!isCurrency) return null;
    const amt = parseFloat(form.amount_invested);
    const rate = parseFloat(form.buy_rate);
    if (!isNaN(amt) && !isNaN(rate) && rate > 0) return (amt / rate).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return null;
  })();

  const verifyTicker = async () => {
    if (!effectiveTicker) return;
    setVerifying(true); setTickerInfo(null);
    try {
      const result = await api.checkTicker(effectiveTicker);
      setTickerInfo(result);
      if (result.valid && !form.asset_name) setForm(f => ({ ...f, asset_name: result.symbol }));
    } catch {
      setTickerInfo({ valid: false, symbol: effectiveTicker, price_egp: 0 });
    }
    setVerifying(false);
  };

  const save = async () => {
    if (!form.asset_name.trim()) { setError("Asset name is required"); return; }
    let amount_invested = 0;
    let price_per_unit: number | undefined;
    let grams: number | undefined;
    let karat: number | undefined;

    if (isStocks) {
      if (tickerInfo?.valid) {
        const s = parseFloat(form.shares);
        if (isNaN(s) || s <= 0) { setError("Enter number of shares"); return; }
        const bp = parseFloat(form.buy_price_per_share) || tickerInfo.price_egp;
        amount_invested = s * bp;
        price_per_unit = bp;
      } else {
        amount_invested = parseFloat(form.manual_amount);
        if (isNaN(amount_invested) || amount_invested <= 0) { setError("Enter the amount invested (or verify your ticker to use shares)"); return; }
      }
    } else if (isGold) {
      grams = form.grams ? parseFloat(form.grams) : undefined;
      if (!grams || grams <= 0) { setError("Enter number of grams"); return; }
      karat = form.karat ? parseInt(form.karat) : undefined;
      amount_invested = form.amount_paid_gold ? parseFloat(form.amount_paid_gold) : 0;
    } else if (isCurrency) {
      if (!form.forex_pair.trim()) { setError("Enter the currency you hold (e.g. USD)"); return; }
      amount_invested = parseFloat(form.amount_invested);
      if (isNaN(amount_invested) || amount_invested <= 0) { setError("Enter the amount you spent"); return; }
      const rate = parseFloat(form.buy_rate);
      price_per_unit = (!isNaN(rate) && rate > 0) ? rate : undefined; // if blank, backend fetches current rate
    } else {
      amount_invested = parseFloat(form.amount_invested);
      if (isNaN(amount_invested) || amount_invested <= 0) { setError("Enter a valid amount"); return; }
    }

    setSaving(true); setError("");
    try {
      await api.createInvestment({
        asset_name: form.asset_name.trim(),
        asset_type: form.asset_type,
        amount_invested,
        currency: form.currency,
        notes: form.notes || undefined,
        date: form.date,
        grams,
        karat,
        ticker_symbol: isStocks ? (effectiveTicker || undefined) : undefined,
        coin_id: isCrypto ? (form.coin_id || undefined) : undefined,
        forex_pair: isCurrency ? (form.forex_pair.toUpperCase() || undefined) : undefined,
        price_per_unit,
      });
      onSaved();
    } catch (e: any) { setError(e.message || "Failed to save"); }
    setSaving(false);
  };

  const inp = "w-full bg-white/[0.04] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/30 transition";
  const lbl = "text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-[#0f0f18] border border-white/8 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[440px] shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0f0f18]/95 backdrop-blur-md border-b border-white/5 px-5 py-4 flex justify-between items-center rounded-t-2xl">
          <div>
            <p className="text-sm font-semibold text-white">Add Investment</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Track a new asset in your portfolio</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-600 hover:text-gray-300 transition">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Asset Type Grid */}
          <div>
            <p className={lbl}>Asset Type</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ASSET_TYPES.map(a => (
                <button key={a.value} type="button"
                  onClick={() => { setForm(f => ({ ...f, asset_type: a.value })); setTickerInfo(null); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-medium transition ${
                    form.asset_type === a.value
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                      : "border-white/5 bg-white/[0.02] text-gray-600 hover:border-white/10 hover:text-gray-400"
                  }`}>
                  <span className="text-xl leading-none">{a.emoji}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── STOCKS ──────────────────────────────────── */}
          {isStocks && (
            <div className="space-y-3">
              <div>
                <p className={lbl}>Ticker Symbol</p>
                <div className="flex gap-2">
                  <input className={`${inp} flex-1`} placeholder="e.g. TSLA, NVDA, COMI"
                    value={form.ticker_symbol}
                    onChange={e => { setForm(f => ({ ...f, ticker_symbol: e.target.value.toUpperCase() })); setTickerInfo(null); }} />
                  <button type="button" onClick={verifyTicker}
                    disabled={!form.ticker_symbol || verifying}
                    className="px-3.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 text-xs text-gray-300 disabled:opacity-30 transition flex items-center gap-1.5 shrink-0">
                    {verifying
                      ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                      : <Check size={11} />}
                    {verifying ? "Checking…" : "Verify"}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <Toggle
                    checked={form.is_egyptian}
                    onCheckedChange={v => { setForm(f => ({ ...f, is_egyptian: v })); setTickerInfo(null); }}
                    label="Egyptian stock (EGX) — appends .CA" />
                  {effectiveTicker && effectiveTicker !== form.ticker_symbol && (
                    <span className="text-[10px] text-gray-600 font-mono">{effectiveTicker}</span>
                  )}
                </div>
              </div>

              {tickerInfo && (
                tickerInfo.valid ? (
                  <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <Check size={11} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-emerald-300">{tickerInfo.symbol} — found</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Current price: <span className="text-gray-300">{tickerInfo.price_egp.toLocaleString(undefined, { maximumFractionDigits: 2 })} EGP / share</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-500/15 rounded-xl px-3 py-2.5">
                    <AlertTriangle size={12} className="text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-400">Ticker not found — check the symbol and try again{form.is_egyptian ? ". Make sure the stock is listed on EGX." : ""}</p>
                  </div>
                )
              )}

              {tickerInfo?.valid ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className={lbl}>Number of Shares *</p>
                      <input className={inp} type="number" placeholder="e.g. 10"
                        value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} />
                    </div>
                    <div>
                      <p className={lbl}>Buy Price / Share</p>
                      <input className={inp} type="number"
                        placeholder={tickerInfo.price_egp.toFixed(2)}
                        value={form.buy_price_per_share}
                        onChange={e => setForm(f => ({ ...f, buy_price_per_share: e.target.value }))} />
                      <p className="text-[10px] text-gray-700 mt-1">Blank = use current price</p>
                    </div>
                  </div>
                  {stockCost != null && (
                    <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl px-3 py-2.5">
                      <p className="text-xs font-medium text-violet-300">
                        {form.shares} shares × {(parseFloat(form.buy_price_per_share) || tickerInfo.price_egp).toLocaleString(undefined, { maximumFractionDigits: 2 })} EGP
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Total cost ≈ {stockCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className={lbl}>Amount Invested *</p>
                  <input className={inp} type="number" placeholder="e.g. 10,000 EGP"
                    value={form.manual_amount} onChange={e => setForm(f => ({ ...f, manual_amount: e.target.value }))} />
                  {!tickerInfo && <p className="text-[10px] text-gray-700 mt-1">Verify ticker above to enter shares count instead</p>}
                </div>
              )}
            </div>
          )}

          {/* ── GOLD ────────────────────────────────────── */}
          {isGold && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={lbl}>Grams *</p>
                  <input className={inp} type="number" placeholder="e.g. 10"
                    value={form.grams} onChange={e => setForm(f => ({ ...f, grams: e.target.value }))} />
                </div>
                <div>
                  <p className={lbl}>Karat</p>
                  <CustomDropdown value={form.karat} onChange={v => setForm(f => ({ ...f, karat: v }))} options={KARATS} />
                </div>
              </div>
              <div>
                <p className={lbl}>Amount You Paid <span className="text-gray-700 normal-case font-normal">(optional)</span></p>
                <input className={inp} type="number" placeholder="Leave blank — computed from live gold price"
                  value={form.amount_paid_gold} onChange={e => setForm(f => ({ ...f, amount_paid_gold: e.target.value }))} />
              </div>
              {form.grams && (
                <div className="flex items-center gap-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-3 py-2.5">
                  <span className="text-base">🥇</span>
                  <p className="text-[11px] text-gray-400">
                    {form.grams}g of {form.karat}k gold — current value tracked from live market price
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── CRYPTO ──────────────────────────────────── */}
          {isCrypto && (
            <div className="space-y-3">
              <div>
                <p className={lbl}>Coin</p>
                <input className={inp} placeholder="e.g. bitcoin, ethereum, solana"
                  value={form.coin_id} onChange={e => setForm(f => ({ ...f, coin_id: e.target.value.toLowerCase() }))} />
                <p className="text-[10px] text-gray-700 mt-1">Use the CoinGecko ID (lowercase)</p>
              </div>
              <div>
                <p className={lbl}>Amount Invested *</p>
                <input className={inp} type="number" placeholder="e.g. 5,000 EGP"
                  value={form.amount_invested} onChange={e => setForm(f => ({ ...f, amount_invested: e.target.value }))} />
              </div>
            </div>
          )}

          {/* ── CURRENCY ────────────────────────────────── */}
          {isCurrency && (
            <div className="space-y-3">
              <div>
                <p className={lbl}>Currency You Hold *</p>
                <input className={inp} placeholder="e.g. USD, EUR, GBP, SAR"
                  value={form.forex_pair} onChange={e => setForm(f => ({ ...f, forex_pair: e.target.value.toUpperCase() }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={lbl}>Amount Spent * <span className="text-gray-700 normal-case font-normal">({form.currency})</span></p>
                  <input className={inp} type="number" placeholder="e.g. 10,000"
                    value={form.amount_invested} onChange={e => setForm(f => ({ ...f, amount_invested: e.target.value }))} />
                </div>
                <div>
                  <p className={lbl}>Rate Bought At <span className="text-gray-700 normal-case font-normal">(optional)</span></p>
                  <input className={inp} type="number"
                    placeholder="Blank = current rate"
                    value={form.buy_rate} onChange={e => setForm(f => ({ ...f, buy_rate: e.target.value }))} />
                </div>
              </div>
              {unitsHeld && (
                <div className="flex items-center gap-2.5 bg-cyan-500/5 border border-cyan-500/15 rounded-xl px-3 py-2.5">
                  <span className="text-base">💱</span>
                  <div>
                    <p className="text-xs font-medium text-cyan-300">You hold ≈ {unitsHeld} {form.forex_pair || "units"}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Live rate tracked automatically</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── REAL ESTATE / OTHER ─────────────────────── */}
          {(form.asset_type === "real_estate" || form.asset_type === "other") && (
            <div>
              <p className={lbl}>Amount Invested *</p>
              <input className={inp} type="number" placeholder="e.g. 1,500,000 EGP"
                value={form.amount_invested} onChange={e => setForm(f => ({ ...f, amount_invested: e.target.value }))} />
            </div>
          )}

          {/* ── COMMON FIELDS ───────────────────────────── */}
          <div className="border-t border-white/5 pt-4 space-y-3">
            <div>
              <p className={lbl}>Name *</p>
              <input className={inp}
                placeholder={isStocks ? "e.g. CIB, Tesla" : isGold ? "e.g. 21k Bracelet" : isCrypto ? "e.g. Bitcoin" : isCurrency ? "e.g. USD Savings" : "Asset name"}
                value={form.asset_name} onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={lbl}>Currency</p>
                <CustomDropdown value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={CURRENCIES} />
              </div>
              <div>
                <p className={lbl}>Date</p>
                <input className={inp} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <p className={lbl}>Notes</p>
              <input className={inp} placeholder="optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-500/15 rounded-lg px-3 py-2.5">
              <AlertTriangle size={12} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
              Save Investment
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/5 text-sm transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Market Overview ───────────────────────────────────────── */
function MarketOverview({ investments }: { investments: any[] }) {
  const items = (() => {
    const seen = new Set<string>();
    return investments.filter(inv => {
      const key = inv.ticker_symbol || inv.coin_id || inv.forex_pair || (inv.asset_type === "gold" ? `gold-${inv.karat || 24}` : null);
      if (!key || seen.has(key) || inv.current_price == null) return false;
      seen.add(key);
      return true;
    });
  })();

  if (items.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
      <h2 className="text-base font-semibold mb-4">Market Prices</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollbarWidth: "thin" }}>
        {items.map(inv => {
          const color = ASSET_COLORS[inv.asset_type] ?? "#64748b";
          const history: { price: number }[] = inv.price_history || [];
          const first = history[0]?.price;
          const last = history[history.length - 1]?.price;
          const change = first && last && first > 0 ? ((last - first) / first) * 100 : null;
          const label = inv.ticker_symbol || inv.coin_id || inv.forex_pair
            || (inv.asset_type === "gold" ? `${inv.karat || 24}k Gold` : inv.asset_name);
          const sublabel = inv.asset_type === "gold"
            ? "per gram · EGP"
            : inv.asset_type === "currency"
            ? `1 ${(inv.forex_pair || "").split("/")[0]} in EGP`
            : inv.asset_type === "crypto"
            ? "price · EGP"
            : "per share · EGP";
          return (
            <div key={inv.id} className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-3 min-w-[160px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <AssetIcon type={inv.asset_type} size={13} />
                <span className="text-xs font-semibold text-white truncate">{label}</span>
              </div>
              <p className="text-lg font-bold text-white tabular-nums leading-none">
                {inv.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5 mb-2">{sublabel}</p>
              <div className="flex items-center justify-between">
                {change != null ? (
                  <span className={`text-[10px] font-medium ${change > 0 ? "text-emerald-400" : change < 0 ? "text-rose-400" : "text-gray-400"}`}>
                    {change > 0 ? "+" : ""}{change.toFixed(2)}% 7d
                  </span>
                ) : <span className="text-[10px] text-gray-700">—</span>}
                <Sparkline data={history} color={color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Edit Investment Modal ──────────────────────────────────── */
function EditInvestmentModal({ inv, onClose, onSaved }: {
  inv: any; onClose: () => void; onSaved: () => void;
}) {
  const [notes, setNotes] = useState<string>(inv.notes || "");
  const [currentValue, setCurrentValue] = useState<string>(
    inv.current_value != null ? String(inv.current_value) : ""
  );
  const [amountInvested, setAmountInvested] = useState<string>(
    inv.amount_invested > 0 ? String(inv.amount_invested) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isManual = ["real_estate", "other"].includes(inv.asset_type);

  const save = async () => {
    const body: { notes?: string; current_value?: number; amount_invested?: number } = {};
    if (notes !== (inv.notes || "")) body.notes = notes || undefined;
    const cv = parseFloat(currentValue);
    if (currentValue !== "" && !isNaN(cv) && cv >= 0) body.current_value = cv;
    const ai = parseFloat(amountInvested);
    if (amountInvested !== "" && !isNaN(ai) && ai > 0) body.amount_invested = ai;
    if (Object.keys(body).length === 0) { onClose(); return; }
    setSaving(true); setError("");
    try {
      await api.updateInvestment(inv.id, body);
      onSaved();
    } catch (e: any) { setError(e.message || "Failed to save"); }
    setSaving(false);
  };

  const inp = "w-full bg-white/[0.04] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/30 transition";
  const lbl = "text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-[#0f0f18] border border-white/8 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl">
        <div className="sticky top-0 bg-[#0f0f18]/95 backdrop-blur-md border-b border-white/5 px-5 py-4 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-2">
            <AssetIcon type={inv.asset_type} size={14} />
            <div>
              <p className="text-sm font-semibold text-white">{inv.asset_name}</p>
              <p className="text-[10px] text-gray-600">{ASSET_LABEL[inv.asset_type]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-600 hover:text-gray-300 transition">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {(isManual || inv.current_value != null) && (
            <div>
              <label className={lbl}>Current Value ({inv.currency})</label>
              <input className={inp} type="number" min="0" value={currentValue}
                onChange={e => setCurrentValue(e.target.value)}
                placeholder={inv.current_value != null ? String(inv.current_value) : "Enter current value"} />
            </div>
          )}
          <div>
            <label className={lbl}>Amount Invested ({inv.currency})</label>
            <input className={inp} type="number" min="0" value={amountInvested}
              onChange={e => setAmountInvested(e.target.value)}
              placeholder={inv.amount_invested > 0 ? String(inv.amount_invested) : "Enter amount paid"} />
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea className={`${inp} resize-none`} rows={2} value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-gray-400 text-sm hover:bg-white/5 transition">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition flex items-center justify-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Investment Chart Card ─────────────────────────────────── */
function InvestmentChartCard({ inv, onDelete, deleting, onEdit }: {
  inv: any; onDelete: (id: string) => void; deleting: boolean; onEdit: (inv: any) => void;
}) {
  const color = ASSET_COLORS[inv.asset_type] ?? "#64748b";
  const history: { price: number; recorded_at?: string }[] = inv.price_history || [];
  const gain = inv.current_value != null && inv.amount_invested > 0
    ? inv.current_value - inv.amount_invested : null;
  const gainPct = gain != null && inv.amount_invested > 0
    ? (gain / inv.amount_invested) * 100 : null;

  const chartData = history.map((h) => ({
    price: h.price,
    label: h.recorded_at
      ? new Date(h.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "",
  }));

  const gradId = `cg-${inv.id}`;
  const subLabel = inv.ticker_symbol || inv.forex_pair
    || (inv.grams ? `${inv.karat || 24}k · ${inv.grams}g` : ASSET_LABEL[inv.asset_type]);

  return (
    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <AssetIcon type={inv.asset_type} size={14} />
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{inv.asset_name}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{subLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {gainPct != null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${gainPct > 0 ? "bg-emerald-500/10 text-emerald-400" : gainPct < 0 ? "bg-rose-500/10 text-rose-400" : "bg-white/5 text-gray-400"}`}>
              {gainPct > 0 ? "+" : ""}{gainPct.toFixed(1)}%
            </span>
          )}
          <button onClick={() => onEdit(inv)} className="text-gray-700 hover:text-violet-400 transition p-0.5">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(inv.id)} disabled={deleting}
            className="text-gray-700 hover:text-rose-400 transition disabled:opacity-30 p-0.5">
            {deleting
              ? <div className="w-3.5 h-3.5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
              : <Trash2 size={12} />}
          </button>
        </div>
      </div>

      {/* Value & gain */}
      <div>
        <p className="text-xl font-bold text-white tabular-nums">
          {inv.current_value != null
            ? inv.current_value.toLocaleString()
            : inv.amount_invested > 0 ? inv.amount_invested.toLocaleString() : "—"}
          <span className="text-xs text-gray-600 font-normal ml-1">{inv.currency}</span>
        </p>
        {gain != null && (
          <p className={`text-xs mt-0.5 tabular-nums ${gain > 0 ? "text-emerald-400" : gain < 0 ? "text-rose-400" : "text-gray-400"}`}>
            {gain > 0 ? "+" : ""}{gain.toLocaleString()} {inv.currency}
          </p>
        )}
      </div>

      {/* Chart */}
      {chartData.length >= 2 ? (
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={["auto", "auto"]} hide />
            <Tooltip
              contentStyle={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", fontSize: "11px" }}
              itemStyle={{ color: "#e2e8f0" }}
              formatter={(v: any) => [`${Number(v).toLocaleString()} EGP`, "Price"]}
              labelStyle={{ color: "#9ca3af", fontSize: "10px" }}
            />
            <Area type="monotone" dataKey="price" stroke={color} fill={`url(#${gradId})`} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[110px] flex items-center justify-center rounded-xl bg-white/[0.02]">
          <p className="text-gray-700 text-xs">Not enough data yet — refresh to populate</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-1 border-t border-white/[0.04] text-[10px] text-gray-600">
        <span>{inv.amount_invested > 0 ? `Cost: ${inv.amount_invested.toLocaleString()} ${inv.currency}` : "No cost basis"}</span>
        <span>{inv.last_price_update ? timeAgo(inv.last_price_update) : "—"}</span>
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
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [editingInv, setEditingInv] = useState<any | null>(null);

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
                value={totalGain != null ? `${totalGain > 0 ? "+" : ""}${totalGain.toLocaleString()} EGP` : "—"}
                positive={totalGain != null ? (totalGain > 0 ? true : totalGain < 0 ? false : null) : null} />
              <StatCard label="Return %"
                value={gainPct != null ? `${gainPct > 0 ? "+" : ""}${gainPct.toFixed(1)}%` : "—"}
                positive={gainPct != null ? (gainPct > 0 ? true : gainPct < 0 ? false : null) : null} />
            </div>

            {/* Market Overview — always shown if any live prices exist */}
            <MarketOverview investments={investments} />

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
                            <span className="text-xs text-gray-400">{ASSET_LABEL[value] || value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Holdings Table / Chart */}
                <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold">Holdings</h2>
                    {/* View toggle */}
                    <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
                      <button
                        onClick={() => setViewMode("table")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewMode === "table" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                        <List size={13} /> Table
                      </button>
                      <button
                        onClick={() => setViewMode("chart")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewMode === "chart" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                        <BarChart2 size={13} /> Charts
                      </button>
                    </div>
                  </div>

                  {/* Chart Grid */}
                  {viewMode === "chart" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {investments.map((inv) => (
                        <InvestmentChartCard
                          key={inv.id}
                          inv={inv}
                          onDelete={handleDelete}
                          deleting={deletingId === inv.id}
                          onEdit={setEditingInv}
                        />
                      ))}
                    </div>
                  )}

                  {/* Table view (desktop + mobile) */}
                  {viewMode === "table" && <>
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
                          <th className="w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {investments.map((inv) => {
                          const gain = inv.current_value != null && inv.amount_invested > 0 ? inv.current_value - inv.amount_invested : null;
                          const gainPctRow = gain != null && inv.amount_invested > 0 ? (gain / inv.amount_invested) * 100 : null;
                          const color = ASSET_COLORS[inv.asset_type] ?? "#64748b";
                          const hasPrice = inv.current_value != null;
                          return (
                            <tr key={inv.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition group">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <AssetIcon type={inv.asset_type} size={14} />
                                  <div>
                                    <p className="font-medium text-gray-200">{inv.asset_name}</p>
                                    <p className="text-gray-600 text-xs">
                                      {inv.ticker_symbol && <span className="mr-1">{inv.ticker_symbol}</span>}
                                      {inv.grams && <span>{inv.karat ? `${inv.karat}k · ` : ""}{inv.grams}g</span>}
                                      {inv.forex_pair && <span className="mr-1">{inv.forex_pair}</span>}
                                      {inv.notes && !inv.ticker_symbol && !inv.grams && !inv.forex_pair && <span className="truncate max-w-[120px] inline-block">{inv.notes}</span>}
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
                                {inv.amount_invested > 0 ? inv.amount_invested.toLocaleString() : <span className="text-gray-600 text-xs">—</span>}
                                {inv.amount_invested > 0 && <span className="text-gray-600 text-xs ml-1">{inv.currency}</span>}
                              </td>
                              <td className="py-3 px-2 text-right">
                                {hasPrice ? (
                                  <span className="text-gray-200">
                                    {inv.current_value.toLocaleString()}
                                    <span className="text-gray-600 text-xs ml-1">{inv.currency}</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right font-medium">
                                {gain != null ? (
                                  <div className={gain > 0 ? "text-emerald-400" : gain < 0 ? "text-rose-400" : "text-gray-400"}>
                                    <span>{gain > 0 ? "+" : ""}{gain.toLocaleString()}</span>
                                    {gainPctRow != null && (
                                      <span className="text-xs opacity-70 ml-1">({gainPctRow > 0 ? "+" : ""}{gainPctRow.toFixed(1)}%)</span>
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
                                <div className="flex items-center gap-2 justify-end">
                                  <button onClick={() => setEditingInv(inv)}
                                    className="text-gray-600 hover:text-violet-400 transition">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => handleDelete(inv.id)} disabled={deletingId === inv.id}
                                    className="text-gray-600 hover:text-rose-400 transition disabled:opacity-30">
                                    {deletingId === inv.id
                                      ? <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                                      : <Trash2 size={13} />}
                                  </button>
                                </div>
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
                      const gain = inv.current_value != null && inv.amount_invested > 0 ? inv.current_value - inv.amount_invested : null;
                      const gainPctRow = gain != null && inv.amount_invested > 0 ? (gain / inv.amount_invested) * 100 : null;
                      const color = ASSET_COLORS[inv.asset_type] ?? "#64748b";
                      return (
                        <div key={inv.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                          <div className="flex items-start gap-3">
                            <AssetIcon type={inv.asset_type} size={14} />
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-200 text-sm">{inv.asset_name}</p>
                                  <p className="text-gray-600 text-xs">{ASSET_LABEL[inv.asset_type]}{inv.forex_pair ? ` · ${inv.forex_pair}` : inv.ticker_symbol ? ` · ${inv.ticker_symbol}` : inv.grams ? ` · ${inv.karat ? `${inv.karat}k · ` : ""}${inv.grams}g` : ""} · {inv.date}</p>
                                </div>
                                <div className="flex items-center gap-1.5 ml-2 mt-0.5">
                                  <button onClick={() => setEditingInv(inv)} className="text-gray-700 hover:text-violet-400 transition">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => handleDelete(inv.id)} disabled={deletingId === inv.id}
                                    className="text-gray-700 hover:text-rose-400 transition">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex gap-4 mt-2">
                                <div>
                                  <p className="text-[10px] text-gray-600 uppercase">Invested</p>
                                  <p className="text-sm font-medium text-white">
                                    {inv.amount_invested > 0 ? inv.amount_invested.toLocaleString() : <span className="text-gray-600 text-xs">—</span>}
                                    {inv.amount_invested > 0 && <span className="text-gray-600 text-xs ml-1">{inv.currency}</span>}
                                  </p>
                                </div>
                                {inv.current_value != null ? (
                                  <div>
                                    <p className="text-[10px] text-gray-600 uppercase">Value</p>
                                    <p className="text-sm font-medium text-white">
                                      {inv.current_value.toLocaleString()}
                                      <span className="text-gray-600 text-xs ml-1">{inv.currency}</span>
                                    </p>
                                  </div>
                                ) : null}
                                {gain != null && (
                                  <div>
                                    <p className="text-[10px] text-gray-600 uppercase">Gain</p>
                                    <p className={`text-sm font-medium ${gain > 0 ? "text-emerald-400" : gain < 0 ? "text-rose-400" : "text-gray-400"}`}>
                                      {gain > 0 ? "+" : ""}{gain.toLocaleString()}
                                      {gainPctRow != null && <span className="text-xs ml-1">({gainPctRow > 0 ? "+" : ""}{gainPctRow.toFixed(1)}%)</span>}
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
                  </>}
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
        <AddInvestmentModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); handlePriceRefresh(); }} />
      )}
      {editingInv && (
        <EditInvestmentModal
          inv={editingInv}
          onClose={() => setEditingInv(null)}
          onSaved={() => { setEditingInv(null); loadData(); }}
        />
      )}
    </div>
  );
}
