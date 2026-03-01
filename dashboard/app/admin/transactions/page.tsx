"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { Search, Download, ChevronLeft, ChevronRight, Receipt } from "lucide-react";

const CATS = ["", "food", "transport", "shopping", "bills", "entertainment", "health", "other"];
const TYPES = ["", "expense", "income"];

export default function AdminTransactionsPage() {
    const [data, setData] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [entryType, setEntryType] = useState("");
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        const params: any = { page, per_page: perPage };
        if (search.trim()) params.search = search.trim();
        if (category) params.category = category;
        if (entryType) params.entry_type = entryType;
        adminApi.getTransactions(params).then(setData).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [page, perPage, category, entryType]);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(); };

    const handleExport = async () => {
        const blob = await adminApi.exportTransactions();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "transactions.csv"; a.click();
    };

    const totalPages = data ? Math.ceil(data.total / perPage) : 1;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl font-bold">Transactions</h1>
                    <p className="text-sm text-gray-500">{data?.total || 0} total</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Merchant..." className="bg-white/5 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/30 w-36" />
                    </form>
                    <select value={entryType} onChange={e => { setEntryType(e.target.value); setPage(1); }}
                        className="bg-white/5 border border-white/5 rounded-lg px-2 py-2 text-sm text-gray-400 focus:outline-none">
                        <option value="">All types</option><option value="expense">Expense</option><option value="income">Income</option>
                    </select>
                    <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
                        className="bg-white/5 border border-white/5 rounded-lg px-2 py-2 text-sm text-gray-400 focus:outline-none">
                        <option value="">All categories</option>
                        {CATS.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handleExport} className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-400 transition">
                        <Download size={14} /> CSV
                    </button>
                </div>
            </div>

            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}
                    </div>
                ) : data?.transactions.length === 0 ? (
                    <div className="p-16 text-center text-gray-600">
                        <Receipt size={32} className="mx-auto mb-2 text-gray-700" />
                        <p>No transactions found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                                    <th className="text-left py-3 px-4 font-medium">Date</th>
                                    <th className="text-left py-3 px-4 font-medium">User</th>
                                    <th className="text-left py-3 px-4 font-medium">Type</th>
                                    <th className="text-left py-3 px-4 font-medium">Category</th>
                                    <th className="text-left py-3 px-4 font-medium">Merchant</th>
                                    <th className="text-right py-3 px-4 font-medium">Amount</th>
                                    <th className="text-left py-3 px-4 font-medium">Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.transactions.map((t: any) => (
                                    <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
                                        <td className="py-3 px-4 font-mono text-xs text-gray-400">{t.user_id.slice(0, 10)}...</td>
                                        <td className="py-3 px-4">
                                            <span className={`text-xs ${t.entry_type === "income" ? "text-emerald-400" : "text-gray-400"}`}>{t.entry_type}</span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-400 text-xs capitalize">{t.category}</td>
                                        <td className="py-3 px-4 text-gray-500 text-xs">{t.merchant || "—"}</td>
                                        <td className="py-3 px-4 text-right font-medium">
                                            <span className={t.entry_type === "income" ? "text-emerald-400" : "text-white"}>
                                                {t.amount.toLocaleString()} {t.currency}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-600 text-xs max-w-[200px] truncate">{t.transcript || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 text-sm text-gray-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
                    <span className="text-sm text-gray-500 px-3 py-2">Page {page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 text-sm text-gray-400 disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
            )}
        </div>
    );
}
