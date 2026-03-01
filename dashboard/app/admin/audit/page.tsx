"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";

export default function AdminAuditPage() {
    const [data, setData] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        adminApi.getAuditLog(page).then(setData).finally(() => setLoading(false));
    }, [page]);

    const totalPages = data ? Math.ceil(data.total / 50) : 1;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-bold">Audit Log</h1>
                <p className="text-sm text-gray-500">All admin actions are logged here (read-only)</p>
            </div>

            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(10)].map((_, i) => <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />)}
                    </div>
                ) : !data?.logs.length ? (
                    <div className="p-16 text-center text-gray-600">
                        <ClipboardList size={32} className="mx-auto mb-2 text-gray-700" />
                        <p>No audit entries yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                                    <th className="text-left py-3 px-4 font-medium">Timestamp</th>
                                    <th className="text-left py-3 px-4 font-medium">Admin</th>
                                    <th className="text-left py-3 px-4 font-medium">Action</th>
                                    <th className="text-left py-3 px-4 font-medium">Target</th>
                                    <th className="text-left py-3 px-4 font-medium">IP</th>
                                    <th className="text-left py-3 px-4 font-medium">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.logs.map((l: any) => (
                                    <tr key={l.id} className="border-b border-white/[0.03]">
                                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{l.timestamp ? new Date(l.timestamp).toLocaleString() : "—"}</td>
                                        <td className="py-3 px-4 text-gray-300 text-xs">{l.admin}</td>
                                        <td className="py-3 px-4">
                                            <span className={`text-xs px-2 py-0.5 rounded-md ${l.action.includes("fail") || l.action.includes("limited") ? "bg-rose-500/10 text-rose-400"
                                                    : l.action.includes("success") || l.action.includes("login") ? "bg-emerald-500/10 text-emerald-400"
                                                        : l.action.includes("delete") ? "bg-orange-500/10 text-orange-400"
                                                            : "bg-white/5 text-gray-400"
                                                }`}>{l.action}</span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-500 text-xs">
                                            {l.target_type ? `${l.target_type}: ${l.target_id || "—"}` : "—"}
                                        </td>
                                        <td className="py-3 px-4 text-gray-600 text-xs font-mono">{l.ip || "—"}</td>
                                        <td className="py-3 px-4 text-gray-600 text-xs max-w-[200px] truncate">{l.details || "—"}</td>
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
