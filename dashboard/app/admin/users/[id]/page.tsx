"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/admin-api";
import {
    ArrowLeft, Trash2, DollarSign, TrendingUp,
} from "lucide-react";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const CAT_COLORS: Record<string, string> = {
    food: "#f97316", transport: "#0ea5e9", shopping: "#a855f7", bills: "#f43f5e",
    entertainment: "#eab308", health: "#10b981", other: "#64748b",
    salary: "#22c55e", freelance: "#06b6d4", gift: "#ec4899",
};
const tooltipStyle = { background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" };

export default function UserDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        adminApi.getUser(id).then(setUser).finally(() => setLoading(false));
    }, [id]);

    const handleDelete = async () => {
        if (!confirm(`Delete all data for user ${id}? This cannot be undone.`)) return;
        setDeleting(true);
        await adminApi.deleteUser(id);
        router.push("/admin/users");
    };

    if (loading) return (
        <div className="p-6">
            <div className="h-10 w-48 bg-white/10 rounded animate-pulse mb-6" />
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />)}
            </div>
        </div>
    );

    if (!user) return (
        <div className="p-6 text-center text-gray-500">
            <p>User not found</p>
            <button onClick={() => router.push("/admin/users")} className="mt-2 text-violet-400">← Back</button>
        </div>
    );

    const pieData = Object.entries(user.breakdown || {}).map(([name, value]) => ({ name, value: value as number }));

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <button onClick={() => router.push("/admin/users")} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm">
                    <ArrowLeft size={16} /> Back
                </button>
                <button onClick={handleDelete} disabled={deleting}
                    className="flex items-center gap-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-3 py-2 rounded-xl text-sm transition disabled:opacity-50">
                    <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete User"}
                </button>
            </div>

            {/* User Header */}
            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-6">
                <h2 className="text-lg font-bold font-mono">{user.user_id}</h2>
                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>Joined: {user.joined ? new Date(user.joined).toLocaleDateString() : "—"}</span>
                    <span>Last active: {user.last_active ? new Date(user.last_active).toLocaleDateString() : "—"}</span>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <StatBox label="Transactions" value={user.total_transactions} />
                <StatBox label="Total Spent" value={`${user.total_spent.toLocaleString()} EGP`} color="text-rose-400" />
                <StatBox label="Total Income" value={`${user.total_income.toLocaleString()} EGP`} color="text-emerald-400" />
            </div>

            {/* Category Breakdown */}
            {pieData.length > 0 && (
                <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold mb-4">Spending by Category</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} stroke="none">
                                {pieData.map(e => <Cell key={e.name} fill={CAT_COLORS[e.name] || "#64748b"} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                            <Legend formatter={(value: string) => <span className="text-xs text-gray-400 capitalize">{value}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Transactions */}
            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-4">Transaction History</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                                <th className="text-left py-2 px-3 font-medium">Date</th>
                                <th className="text-left py-2 px-3 font-medium">Type</th>
                                <th className="text-left py-2 px-3 font-medium">Category</th>
                                <th className="text-left py-2 px-3 font-medium">Merchant</th>
                                <th className="text-right py-2 px-3 font-medium">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {user.transactions.slice(0, 50).map((t: any) => (
                                <tr key={t.id} className="border-b border-white/[0.03]">
                                    <td className="py-2 px-3 text-gray-500 text-xs">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
                                    <td className="py-2 px-3">
                                        <span className={`text-xs ${t.entry_type === "income" ? "text-emerald-400" : "text-gray-400"}`}>
                                            {t.entry_type === "income" ? "📥" : "📤"} {t.entry_type}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-gray-400 text-xs capitalize">{t.category}</td>
                                    <td className="py-2 px-3 text-gray-500 text-xs">{t.merchant || "—"}</td>
                                    <td className="py-2 px-3 text-right font-medium">
                                        <span className={t.entry_type === "income" ? "text-emerald-400" : "text-white"}>
                                            {t.amount.toLocaleString()} {t.currency}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value, color = "text-white" }: { label: string; value: any; color?: string }) {
    return (
        <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
    );
}
