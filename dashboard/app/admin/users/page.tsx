"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import Link from "next/link";
import { Search, Download, ChevronLeft, ChevronRight, Users as UsersIcon } from "lucide-react";

export default function AdminUsersPage() {
    const [data, setData] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [perPage, setPerPage] = useState(25);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        const params: any = { page, per_page: perPage };
        if (search.trim()) params.search = search.trim();
        adminApi.getUsers(params).then(setData).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [page, perPage]);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(); };

    const handleExport = async () => {
        const blob = await adminApi.exportUsers();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click();
    };

    const totalPages = data ? Math.ceil(data.total / perPage) : 1;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl font-bold">Users</h1>
                    <p className="text-sm text-gray-500">{data?.total || 0} total users</p>
                </div>
                <div className="flex gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search user ID..." className="bg-white/5 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/30 w-44" />
                    </form>
                    <button onClick={handleExport} className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-400 transition">
                        <Download size={14} /> CSV
                    </button>
                    <select value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}
                        className="bg-white/5 border border-white/5 rounded-lg px-2 py-2 text-sm text-gray-400 focus:outline-none">
                        <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                    </select>
                </div>
            </div>

            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}
                    </div>
                ) : data?.users.length === 0 ? (
                    <div className="p-16 text-center text-gray-600">
                        <UsersIcon size={32} className="mx-auto mb-2 text-gray-700" />
                        <p>No users found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                                    <th className="text-left py-3 px-4 font-medium">User ID</th>
                                    <th className="text-left py-3 px-4 font-medium">Platform</th>
                                    <th className="text-right py-3 px-4 font-medium">Transactions</th>
                                    <th className="text-right py-3 px-4 font-medium">Spent</th>
                                    <th className="text-right py-3 px-4 font-medium">Income</th>
                                    <th className="text-left py-3 px-4 font-medium">Joined</th>
                                    <th className="text-left py-3 px-4 font-medium">Last Active</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.users.map((u: any) => (
                                    <tr key={u.user_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                                        <td className="py-3 px-4">
                                            <Link href={`/admin/users/${encodeURIComponent(u.user_id)}`} className="text-violet-400 hover:text-violet-300 font-mono text-xs">
                                                {u.user_id.length > 20 ? u.user_id.slice(0, 8) + "..." + u.user_id.slice(-4) : u.user_id}
                                            </Link>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-1">
                                                {u.platforms.map((p: string) => (
                                                    <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded ${p === "telegram" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-300">{u.total_transactions}</td>
                                        <td className="py-3 px-4 text-right text-gray-300">{u.total_spent.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-right text-emerald-400">{u.total_income.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-gray-500 text-xs">{u.joined ? new Date(u.joined).toLocaleDateString() : "—"}</td>
                                        <td className="py-3 px-4 text-gray-500 text-xs">{u.last_active ? new Date(u.last_active).toLocaleDateString() : "—"}</td>
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
        </div>
    );
}
