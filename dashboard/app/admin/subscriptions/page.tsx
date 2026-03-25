"use client";
import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/admin-api";
import {
    Crown, Search, ChevronLeft, ChevronRight, X, Check,
    RefreshCw, Shield, Zap, User,
} from "lucide-react";

type Sub = {
    user_id: string;
    name: string | null;
    plan: string;
    effective_plan: string;
    is_trial: boolean;
    plan_expires_at: string | null;
    trial_ends_at: string | null;
};

const PLAN_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    free:  { label: "Free",  color: "text-gray-400",    bg: "bg-gray-500/10",   icon: <User size={11} /> },
    pro:   { label: "Pro",   color: "text-violet-400",  bg: "bg-violet-500/10", icon: <Zap size={11} /> },
    elite: { label: "Elite", color: "text-amber-400",   bg: "bg-amber-500/10",  icon: <Crown size={11} /> },
};

function PlanBadge({ plan, is_trial }: { plan: string; is_trial?: boolean }) {
    const m = PLAN_META[plan] ?? PLAN_META.free;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.bg} ${m.color}`}>
            {m.icon} {m.label}{is_trial ? " (trial)" : ""}
        </span>
    );
}

function fmt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type ModalState = { user: Sub; plan: string; days: number } | null;

export default function AdminSubscriptionsPage() {
    const [data, setData] = useState<{ subscriptions: Sub[]; total: number } | null>(null);
    const [page, setPage] = useState(1);
    const [perPage] = useState(25);
    const [search, setSearch] = useState("");
    const [planFilter, setPlanFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState>(null);
    const [saving, setSaving] = useState(false);
    const [cancellingTrial, setCancellingTrial] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        const params: Record<string, any> = { page, per_page: perPage };
        if (search.trim()) params.search = search.trim();
        if (planFilter !== "all") params.plan = planFilter;
        adminApi.getSubscriptions(params)
            .then(setData)
            .finally(() => setLoading(false));
    }, [page, perPage, search, planFilter]);

    useEffect(() => { load(); }, [load]);

    const showToast = (msg: string, ok: boolean) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const openModal = (user: Sub) =>
        setModal({ user, plan: user.effective_plan, days: 30 });

    const handleCancelTrial = async (user: Sub) => {
        if (!confirm(`Cancel trial for ${user.user_id}? They will revert to free immediately.`)) return;
        setCancellingTrial(user.user_id);
        try {
            await adminApi.cancelTrial(user.user_id);
            showToast(`Trial cancelled for ${user.user_id}`, true);
            load();
        } catch (err: any) {
            showToast(err.message || "Failed to cancel trial", false);
        } finally {
            setCancellingTrial(null);
        }
    };

    const handleSave = async () => {
        if (!modal) return;
        setSaving(true);
        try {
            await adminApi.setPlan(modal.user.user_id, modal.plan, modal.days);
            showToast(`Plan updated to ${modal.plan} for ${modal.user.user_id}`, true);
            setModal(null);
            load();
        } catch (err: any) {
            showToast(err.message || "Failed to update plan", false);
        } finally {
            setSaving(false);
        }
    };

    const totalPages = data ? Math.ceil(data.total / perPage) : 1;

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-xl
                    ${toast.ok ? "bg-emerald-500/90 text-white" : "bg-rose-500/90 text-white"}`}>
                    {toast.ok ? <Check size={14} /> : <X size={14} />} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Crown size={18} className="text-violet-400" /> Subscriptions
                    </h1>
                    <p className="text-sm text-gray-500">{data?.total ?? 0} users with plan records</p>
                </div>
                <button onClick={load} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-400 transition">
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <form onSubmit={e => { e.preventDefault(); setPage(1); load(); }} className="relative flex-1 max-w-xs">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search user ID…"
                        className="w-full bg-white/5 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/30"
                    />
                </form>
                <select
                    value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
                    className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-violet-500/30"
                >
                    <option value="all">All plans</option>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="elite">Elite</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : !data?.subscriptions.length ? (
                    <div className="p-16 text-center text-gray-600">
                        <Crown size={32} className="mx-auto mb-2 text-gray-700" />
                        <p>No subscription records found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                                    <th className="text-left py-3 px-4 font-medium">User ID</th>
                                    <th className="text-left py-3 px-4 font-medium">Name</th>
                                    <th className="text-left py-3 px-4 font-medium">Stored Plan</th>
                                    <th className="text-left py-3 px-4 font-medium">Effective</th>
                                    <th className="text-left py-3 px-4 font-medium">Expires</th>
                                    <th className="text-left py-3 px-4 font-medium">Trial Ends</th>
                                    <th className="py-3 px-4 font-medium" />
                                </tr>
                            </thead>
                            <tbody>
                                {data.subscriptions.map(u => (
                                    <tr key={u.user_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                                        <td className="py-3 px-4 font-mono text-xs text-violet-400">
                                            {u.user_id.length > 20
                                                ? u.user_id.slice(0, 8) + "…" + u.user_id.slice(-4)
                                                : u.user_id}
                                        </td>
                                        <td className="py-3 px-4 text-gray-300 text-xs">{u.name || <span className="text-gray-600">—</span>}</td>
                                        <td className="py-3 px-4"><PlanBadge plan={u.plan} /></td>
                                        <td className="py-3 px-4"><PlanBadge plan={u.effective_plan} is_trial={u.is_trial} /></td>
                                        <td className="py-3 px-4 text-gray-500 text-xs">{fmt(u.plan_expires_at)}</td>
                                        <td className="py-3 px-4 text-gray-500 text-xs">{fmt(u.trial_ends_at)}</td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {u.is_trial && (
                                                    <button
                                                        onClick={() => handleCancelTrial(u)}
                                                        disabled={cancellingTrial === u.user_id}
                                                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition font-medium disabled:opacity-50"
                                                    >
                                                        {cancellingTrial === u.user_id ? "…" : "Cancel trial"}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openModal(u)}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 transition font-medium"
                                                >
                                                    Change plan
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 text-sm text-gray-400 disabled:opacity-30">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-gray-500 px-3 py-2">Page {page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 text-sm text-gray-400 disabled:opacity-30">
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* Change Plan Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="font-bold text-lg">Change Plan</h2>
                                <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">{modal.user.user_id}</p>
                            </div>
                            <button onClick={() => setModal(null)} className="text-gray-600 hover:text-gray-300 transition">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Current plan */}
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span>Current:</span>
                            <PlanBadge plan={modal.user.effective_plan} is_trial={modal.user.is_trial} />
                        </div>

                        {/* Plan selector */}
                        <div>
                            <label className="text-xs text-gray-500 mb-2 block">New Plan</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(["free", "pro", "elite"] as const).map(p => {
                                    const m = PLAN_META[p];
                                    const active = modal.plan === p;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setModal(s => s ? { ...s, plan: p } : s)}
                                            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition
                                                ${active
                                                    ? `${m.bg} ${m.color} border-current/30`
                                                    : "bg-white/[0.03] border-white/5 text-gray-500 hover:bg-white/[0.06]"
                                                }`}
                                        >
                                            {m.icon}
                                            {m.label}
                                            {active && <Check size={10} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Days (hidden for free) */}
                        {modal.plan !== "free" && (
                            <div>
                                <label className="text-xs text-gray-500 mb-2 block">
                                    Duration (days)
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {[7, 30, 90, 365].map(d => (
                                        <button key={d}
                                            onClick={() => setModal(s => s ? { ...s, days: d } : s)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                                                ${modal.days === d
                                                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                                                    : "bg-white/5 border-white/5 text-gray-500 hover:bg-white/10"
                                                }`}>
                                            {d === 365 ? "1 year" : `${d}d`}
                                        </button>
                                    ))}
                                    <input
                                        type="number" min={1} max={3650}
                                        value={modal.days}
                                        onChange={e => setModal(s => s ? { ...s, days: Math.min(3650, Math.max(1, +e.target.value)) } : s)}
                                        className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/40"
                                        placeholder="Custom"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-600 mt-1.5">
                                    Expires: {new Date(Date.now() + modal.days * 86400000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                                </p>
                            </div>
                        )}

                        {/* Security note */}
                        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-2.5">
                            <Shield size={13} className="text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-amber-300/70 leading-relaxed">
                                Plan changes take effect immediately. The API enforces plan limits on every request — downgrading blocks feature access instantly.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button onClick={() => setModal(null)}
                                className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300 bg-white/5 hover:bg-white/10 transition">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || modal.plan === modal.user.effective_plan}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                {saving ? "Saving…" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
