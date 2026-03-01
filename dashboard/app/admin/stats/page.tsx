"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { adminApi as aApi } from "@/lib/admin-api";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

const tooltipStyle = { background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" };

export default function AdminStatsPage() {
    const [stats, setStats] = useState<any>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        adminApi.getStats(days).then(setStats).finally(() => setLoading(false));
    }, [days]);

    if (loading || !stats) return (
        <div className="p-6 space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-72 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
    );

    const ratioData = [{ name: "Expenses", value: stats.total_expense }, { name: "Income", value: stats.total_income }];

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold">Analytics</h1>
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                    {[7, 30, 90].map(d => (
                        <button key={d} onClick={() => setDays(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${days === d ? "bg-violet-500/20 text-violet-400" : "text-gray-500 hover:text-gray-300"}`}>
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Daily Active Users */}
                <Card title="Daily Active Users">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={stats.daily}>
                            <defs><linearGradient id="au" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.slice(5)} />
                            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Area type="monotone" dataKey="active_users" stroke="#8b5cf6" strokeWidth={2} fill="url(#au)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>

                {/* Transaction Count */}
                <Card title="Daily Transactions">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={stats.daily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.slice(5)} />
                            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="transactions" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* Volume */}
                <Card title="Daily Volume (EGP)">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={stats.daily}>
                            <defs><linearGradient id="vl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.3} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.slice(5)} />
                            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                            <Area type="monotone" dataKey="volume" stroke="#f97316" strokeWidth={2} fill="url(#vl)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>

                {/* Expense vs Income */}
                <Card title="Expense vs Income">
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie data={ratioData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55} stroke="none">
                                <Cell fill="#f43f5e" /><Cell fill="#10b981" />
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                            <Legend formatter={(v: string) => <span className="text-xs text-gray-400">{v}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>

                {/* Top Categories */}
                <Card title="Top Categories">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={stats.top_categories} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} width={90} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                            <Bar dataKey="total" fill="#a855f7" radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* Top Merchants */}
                <Card title="Top Merchants">
                    {stats.top_merchants.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={stats.top_merchants.slice(0, 8)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} width={120} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v.toLocaleString()} EGP`} />
                                <Bar dataKey="total" fill="#f97316" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-gray-600 text-sm text-center py-16">No merchant data</p>}
                </Card>
            </div>
        </div>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 md:p-5">
            <h3 className="text-sm font-semibold mb-4">{title}</h3>
            {children}
        </div>
    );
}
