"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { Activity, CheckCircle, XCircle, Clock } from "lucide-react";

export default function AdminHealthPage() {
    const [maintenance, setMaintenance] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminApi.getMaintenance()
            .then(d => setMaintenance(d.maintenance))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
    );

    const services = [
        { name: "FastAPI Backend", status: "operational", detail: "Serving admin + user API" },
        { name: "WhatsApp Bot", status: maintenance ? "maintenance" : "operational", detail: maintenance ? "Maintenance mode ON" : "Processing messages" },
        { name: "Telegram Bot", status: "operational", detail: "Running via python-telegram-bot" },
        { name: "PostgreSQL", status: "operational", detail: "Connected via SQLAlchemy" },
        { name: "Groq AI", status: "operational", detail: "LLM + Whisper transcription" },
    ];

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-bold">System Health</h1>
                <p className="text-sm text-gray-500">Service status overview</p>
            </div>

            <div className="space-y-3">
                {services.map(s => (
                    <div key={s.name} className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.status === "operational" ? "bg-emerald-500/10" : s.status === "maintenance" ? "bg-amber-500/10" : "bg-rose-500/10"
                            }`}>
                            {s.status === "operational" ? <CheckCircle size={20} className="text-emerald-400" /> :
                                s.status === "maintenance" ? <Clock size={20} className="text-amber-400" /> :
                                    <XCircle size={20} className="text-rose-400" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-white">{s.name}</p>
                            <p className="text-xs text-gray-500">{s.detail}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg ${s.status === "operational" ? "bg-emerald-500/10 text-emerald-400" :
                                s.status === "maintenance" ? "bg-amber-500/10 text-amber-400" :
                                    "bg-rose-500/10 text-rose-400"
                            }`}>{s.status}</span>
                    </div>
                ))}
            </div>

            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-3">Maintenance Mode</h3>
                <p className="text-xs text-gray-500 mb-4">When enabled, the bot replies "Service temporarily unavailable" to all messages.</p>
                <button onClick={async () => {
                    const r = await adminApi.toggleMaintenance();
                    setMaintenance(r.maintenance);
                }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${maintenance ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-white/5 text-gray-400 hover:bg-white/10"
                        }`}>
                    {maintenance ? "🔧 Disable Maintenance" : "Enable Maintenance Mode"}
                </button>
            </div>
        </div>
    );
}
