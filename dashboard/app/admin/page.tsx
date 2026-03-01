"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import {
    Users, Receipt, TrendingUp, DollarSign, UserPlus, MessageSquare,
    ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

const PIE_COLORS = ["#8b5cf6", "#f97316", "#0ea5e9", "#f43f5e", "#10b981", "#eab308", "#64748b", "#ec4899", "#06b6d4", "#14b8a6"];

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        adminApi.getStats(days).then(setStats).finally(() => setLoading(false));
    }, [days]);

    if (loading || !stats) return (
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-[#12121a] border border-white/5 rounded-2xl p-4 animate-pulse">
                        <div className="h-3 w-16 bg-white/10 rounded mb-3" />
                        <div className="h-8 w-20 bg-white/10 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );

    const cards = [
        { label: "Total Users", value: stats.total_users, icon: Users, color: "text-violet-400" },
        { label: "Active (7d)", value: stats.active_7d, icon: UserPlus, color: "text-emerald-400" },
        { label: "Transactions", value: stats.total_transactions.toLocaleString(), icon: Receipt, color: "text-blue-400" },
        { label: "Volume", value: `${(stats.total_volume / 1000).toFixed(1)}K`, icon: DollarSign, color: "text-amber-400" },
        { label: "Today Txns", value: stats.transactions_today, icon: TrendingUp, color: "text-fuchsia-400" },
        { label: "New Today", value: stats.new_today, icon: UserPlus, color: "text-cyan-400" },
    ];

    const ratioData = [
        { name: "Expenses", value: stats.total_expense },
        { name: "Income", value: stats.total_income },
    ];

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl font-bold">Admin Dashboard</h1>
                    <p className="text-sm text-gray-500">Overview of all platform activity</p>
                </div>
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                    {[7, 30, 90].map(d => (
                        <button key={d} onClick={() => setDays(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${days === d ? "bg-violet-500/20 text-violet-400" : "text-gray-500 hover:text-gray-300"}`}>
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {cards.map(c => (
                    <div key={c.label} className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <c.icon size={14} className={c.color} />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{c.label}</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Charts Row 1: Activity + Volume */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Active Users" subtitle={`Last ${days} days`}>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={stats.daily}>
                            <defs>
                                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false}
                                tickFormatter={(v: string) => v.slice(5)} />
                            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Area type="monotone" dataKey="active_users" stroke="#8b5cf6" strokeWidth={2} fill="url(#g1)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Transaction Volume" subtitle="EGP">
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={stats.daily}>
                            <defs>
                                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false}
                                tickFormatter={(v: string) => v.slice(5)} />
                            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                            <Area type="monotone" dataKey="volume" stroke="#0ea5e9" strokeWidth={2} fill="url(#g2)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Charts Row 2: Categories + Expense/Income Ratio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Top Categories">
                    {stats.top_categories.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={stats.top_categories} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} width={90} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                                <Bar dataKey="total" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <Empty />}
                </ChartCard>

                <ChartCard title="Expense vs Income">
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie data={ratioData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} stroke="none">
                                <Cell fill="#f43f5e" />
                                <Cell fill="#10b981" />
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                            <Legend formatter={(value: string) => <span className="text-xs text-gray-400">{value}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Top Merchants */}
            {stats.top_merchants.length > 0 && (
                <ChartCard title="Top Merchants">
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={stats.top_merchants.slice(0, 8)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} width={120} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                            <Bar dataKey="total" fill="#f97316" radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
        </div>
    );
}

/* ── Helpers ──────────────────────────────── */
const tooltipStyle = { background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" };

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">{title}</h3>
                {subtitle && <span className="text-[10px] text-gray-600">{subtitle}</span>}
            </div>
            {children}
        </div>
    );
}

function Empty() {
    return <p className="text-gray-600 text-sm text-center py-10">No data yet</p>;
}
