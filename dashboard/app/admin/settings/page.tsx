"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { Key, Monitor, Shield, Eye, EyeOff, Trash2, CheckCircle } from "lucide-react";

export default function AdminSettingsPage() {
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [pwMsg, setPwMsg] = useState("");
    const [pwError, setPwError] = useState("");
    const [sessions, setSessions] = useState<any[]>([]);
    const [envConfig, setEnvConfig] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([adminApi.getSessions(), adminApi.getEnvConfig()])
            .then(([s, e]) => { setSessions(s); setEnvConfig(e); })
            .finally(() => setLoading(false));
    }, []);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwMsg(""); setPwError("");
        try {
            const r = await adminApi.changePassword(currentPw, newPw);
            setPwMsg(`Password hash generated. Update ADMIN_PASSWORD_HASH in Railway:\n${r.new_hash}`);
            setCurrentPw(""); setNewPw("");
        } catch (err: any) {
            setPwError(err.message);
        }
    };

    const handleRevoke = async (id: number) => {
        await adminApi.revokeSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
    };

    if (loading) return (
        <div className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
    );

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <h1 className="text-xl font-bold">Settings</h1>

            {/* Change Password */}
            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Key size={16} className="text-violet-400" /> Change Password</h3>
                <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Current Password</label>
                        <input type={showPw ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50" required />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">New Password</label>
                        <div className="relative">
                            <input type={showPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 pr-10" required minLength={8} />
                            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
                        Update Password
                    </button>
                    {pwMsg && <div className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 whitespace-pre-wrap">{pwMsg}</div>}
                    {pwError && <div className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{pwError}</div>}
                </form>
            </div>

            {/* Active Sessions */}
            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Monitor size={16} className="text-violet-400" /> Active Sessions</h3>
                {sessions.length === 0 ? (
                    <p className="text-gray-600 text-sm">No active sessions</p>
                ) : (
                    <div className="space-y-2">
                        {sessions.map(s => (
                            <div key={s.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.03] rounded-xl px-4 py-3">
                                <div>
                                    <p className="text-sm text-gray-300">{s.admin} — <span className="text-gray-600 font-mono text-xs">{s.ip || "unknown IP"}</span></p>
                                    <p className="text-xs text-gray-600">Last active: {s.last_active ? new Date(s.last_active).toLocaleString() : "—"}</p>
                                </div>
                                <button onClick={() => handleRevoke(s.id)} className="text-gray-600 hover:text-rose-400 transition" title="Revoke">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Environment Config */}
            <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Shield size={16} className="text-violet-400" /> Environment Config</h3>
                <div className="space-y-1">
                    {envConfig.map((e: any) => (
                        <div key={e.key} className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                            <span className="text-xs font-mono text-gray-400">{e.key}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 font-mono">{e.value}</span>
                                {e.set ? <CheckCircle size={12} className="text-emerald-500" /> : <span className="text-[10px] text-rose-400">missing</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
