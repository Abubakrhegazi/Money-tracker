"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, setAdminToken } from "@/lib/admin-api";
import Image from "next/image";
import { Shield, AlertTriangle, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await adminApi.login(username, password);
            setAdminToken(data.token);
            router.push("/admin");
        } catch (err: any) {
            setError(err.message || "Login failed");
        }
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
                        <Shield size={28} className="text-violet-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
                    <p className="text-gray-500 text-sm mt-1">Aura Finance Tracker</p>
                </div>

                <form onSubmit={handleLogin} className="bg-[#12121a] border border-white/5 rounded-2xl p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                            <AlertTriangle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition"
                            placeholder="admin" autoFocus required />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Password</label>
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition pr-10"
                                placeholder="••••••••" required />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
                <p className="text-center text-gray-700 text-xs mt-4">Protected area · All actions are logged</p>
            </div>
        </main>
    );
}
