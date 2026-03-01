"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { adminApi, getAdminToken, clearAdminToken } from "@/lib/admin-api";
import Link from "next/link";
import {
    LayoutDashboard, Users, Receipt, BarChart3, Shield, Settings,
    ClipboardList, Activity, LogOut, Menu, X, ChevronRight,
} from "lucide-react";

const NAV = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/users", icon: Users, label: "Users" },
    { href: "/admin/transactions", icon: Receipt, label: "Transactions" },
    { href: "/admin/stats", icon: BarChart3, label: "Analytics" },
    { href: "/admin/audit", icon: ClipboardList, label: "Audit Log" },
    { href: "/admin/health", icon: Activity, label: "Health" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [admin, setAdmin] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [mobileNav, setMobileNav] = useState(false);

    // Skip auth guard for login page
    const isLoginPage = pathname === "/admin/login";

    useEffect(() => {
        if (isLoginPage) { setLoading(false); return; }
        const token = getAdminToken();
        if (!token) { router.push("/admin/login"); return; }
        adminApi.me()
            .then(d => { setAdmin(d.username); setLoading(false); })
            .catch(() => { clearAdminToken(); router.push("/admin/login"); });
    }, [pathname]);

    // Session timeout — auto logout after 30 min inactivity
    useEffect(() => {
        if (isLoginPage || !admin) return;
        let timer: NodeJS.Timeout;
        const reset = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                clearAdminToken();
                router.push("/admin/login");
            }, 30 * 60 * 1000);
        };
        window.addEventListener("mousemove", reset);
        window.addEventListener("keydown", reset);
        reset();
        return () => {
            clearTimeout(timer);
            window.removeEventListener("mousemove", reset);
            window.removeEventListener("keydown", reset);
        };
    }, [admin, isLoginPage]);

    if (isLoginPage) return <>{children}</>;
    if (loading) return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const handleLogout = async () => {
        await adminApi.logout().catch(() => { });
        clearAdminToken();
        router.push("/admin/login");
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex">
            {/* Sidebar */}
            <aside className="hidden lg:flex flex-col w-60 border-r border-white/5 bg-[#0d0d14] sticky top-0 h-screen">
                <div className="p-5 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Shield size={20} className="text-violet-400" />
                        <span className="font-bold text-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                            Admin
                        </span>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-0.5">Aura Finance Tracker</p>
                </div>
                <nav className="flex-1 p-3 space-y-0.5">
                    {NAV.map(n => {
                        const active = pathname === n.href || (n.href !== "/admin" && pathname.startsWith(n.href));
                        return (
                            <Link key={n.href} href={n.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${active ? "bg-violet-500/10 text-violet-400" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                    }`}>
                                <n.icon size={18} />
                                <span>{n.label}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-3 border-t border-white/5 space-y-1">
                    <div className="px-3 py-2 text-xs text-gray-600">Signed in as <span className="text-gray-400">{admin}</span></div>
                    <button onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-rose-400 hover:bg-white/5 w-full transition">
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#0d0d14]/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Shield size={18} className="text-violet-400" />
                        <span className="font-bold text-sm text-violet-400">Admin</span>
                    </div>
                    <button onClick={() => setMobileNav(!mobileNav)} className="text-gray-400">
                        {mobileNav ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
                {mobileNav && (
                    <nav className="bg-[#0d0d14] border-t border-white/5 p-3 space-y-1">
                        {NAV.map(n => (
                            <Link key={n.href} href={n.href} onClick={() => setMobileNav(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${pathname === n.href ? "bg-violet-500/10 text-violet-400" : "text-gray-500"
                                    }`}>
                                <n.icon size={18} /> {n.label}
                            </Link>
                        ))}
                        <button onClick={handleLogout}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-rose-400 w-full">
                            <LogOut size={18} /> Sign Out
                        </button>
                    </nav>
                )}
            </div>

            {/* Main */}
            <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
                {children}
            </main>
        </div>
    );
}
