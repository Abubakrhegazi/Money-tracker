"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import Image from "next/image";
import {
    ArrowLeft, Clock, Calendar, Globe,
    Check, Loader2, Sun, Moon, User, DollarSign,
} from "lucide-react";

const TIME_OPTIONS = [
    { label: "8:00 PM", value: "20:00" },
    { label: "9:00 PM", value: "21:00" },
    { label: "10:00 PM", value: "22:00" },
    { label: "11:00 PM", value: "23:00" },
    { label: "8:00 AM", value: "08:00" },
    { label: "9:00 AM", value: "09:00" },
    { label: "12:00 PM", value: "12:00" },
];

const DAY_OPTIONS = [
    { label: "Sunday", value: 0 },
    { label: "Monday", value: 1 },
    { label: "Friday", value: 5 },
    { label: "Saturday", value: 6 },
];

const TIMEZONE_OPTIONS = [
    "Africa/Cairo",
    "Asia/Riyadh",
    "Asia/Dubai",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
];

const CURRENCY_OPTIONS = [
    { value: "EGP", label: "EGP", flag: "🇪🇬", name: "Egyptian Pound" },
    { value: "USD", label: "USD", flag: "🇺🇸", name: "US Dollar" },
    { value: "EUR", label: "EUR", flag: "🇪🇺", name: "Euro" },
    { value: "GBP", label: "GBP", flag: "🇬🇧", name: "British Pound" },
    { value: "SAR", label: "SAR", flag: "🇸🇦", name: "Saudi Riyal" },
    { value: "AED", label: "AED", flag: "🇦🇪", name: "UAE Dirham" },
];

interface NotifSettings {
    daily_enabled: boolean;
    daily_time: string;
    weekly_enabled: boolean;
    weekly_day: number;
    timezone: string;
}

interface UserProfile {
    name: string | null;
    main_currency: string;
}

export default function SettingsPage() {
    const router = useRouter();
    const [notif, setNotif] = useState<NotifSettings | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const [nameEditing, setNameEditing] = useState(false);

    useEffect(() => {
        if (!getToken()) { router.push("/"); return; }
        Promise.all([
            api.getNotificationSettings(),
            api.getUserSettings(),
        ])
            .then(([n, p]) => {
                setNotif(n);
                setProfile(p);
                setNameInput(p.name || "");
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const showSaved = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const updateNotif = async (key: keyof NotifSettings, value: any) => {
        if (!notif) return;
        const prev = { ...notif };
        setNotif({ ...notif, [key]: value });
        setSaving(true);
        setSaved(false);
        try {
            await api.updateNotificationSettings({ [key]: value });
            showSaved();
        } catch {
            setNotif(prev);
        }
        setSaving(false);
    };

    const updateProfile = async (key: keyof UserProfile, value: string) => {
        if (!profile) return;
        const prev = { ...profile };
        setProfile({ ...profile, [key]: value });
        setSaving(true);
        setSaved(false);
        try {
            await api.updateUserSettings({ [key]: value });
            showSaved();
        } catch {
            setProfile(prev);
        }
        setSaving(false);
    };

    const saveName = async () => {
        const trimmed = nameInput.trim();
        if (trimmed === (profile?.name || "")) { setNameEditing(false); return; }
        await updateProfile("name", trimmed);
        setNameEditing(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <Loader2 className="animate-spin text-violet-400" size={32} />
            </div>
        );
    }

    if (!notif || !profile) return null;

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5 px-4 md:px-6 py-4">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-gray-400 hover:text-white transition p-1"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <Image src="/aura-logo.png" alt="Aura" width={28} height={28} className="rounded-lg" />
                    <div>
                        <h1 className="text-lg font-semibold">Settings</h1>
                        <p className="text-xs text-gray-500">Profile & notifications</p>
                    </div>
                    {saving && <Loader2 size={16} className="animate-spin text-violet-400 ml-auto" />}
                    {saved && <Check size={16} className="text-emerald-400 ml-auto" />}
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
                {/* ── Profile Section ──────────────────────────── */}
                <div>
                    <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-1">Profile</h2>

                    {/* Name Card */}
                    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5 md:p-6 mb-3">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                <User size={20} className="text-sky-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold">Name</h3>
                                <p className="text-xs text-gray-500">Displayed in your dashboard greeting</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => { setNameInput(e.target.value); setNameEditing(true); }}
                                onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                                placeholder="Enter your name"
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition"
                            />
                            {nameEditing && (
                                <button
                                    onClick={saveName}
                                    className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                                >
                                    Save
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Currency Card */}
                    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <DollarSign size={20} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Main Currency</h3>
                                <p className="text-xs text-gray-500">Used as the default currency for tracking</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {CURRENCY_OPTIONS.map((c) => (
                                <button
                                    key={c.value}
                                    onClick={() => updateProfile("main_currency", c.value)}
                                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs transition ${profile.main_currency === c.value
                                        ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                                        : "bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10"
                                        }`}
                                >
                                    <span className="text-lg">{c.flag}</span>
                                    <span className="font-medium">{c.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Notifications Section ────────────────────── */}
                <div>
                    <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-1">Notifications</h2>

                    {/* Daily Summary Card */}
                    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5 md:p-6 mb-3">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                    <Sun size={20} className="text-violet-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Daily Summary</h3>
                                    <p className="text-xs text-gray-500">Receive a spending recap every day</p>
                                </div>
                            </div>
                            <ToggleSwitch
                                checked={notif.daily_enabled}
                                onChange={(v) => updateNotif("daily_enabled", v)}
                            />
                        </div>

                        {notif.daily_enabled && (
                            <div className="space-y-4 pl-[52px]">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                                        <Clock size={12} className="inline mr-1" /> Send at
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {TIME_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => updateNotif("daily_time", opt.value)}
                                                className={`text-xs py-2 px-2 rounded-lg border transition ${notif.daily_time === opt.value
                                                    ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                                                    : "bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10"
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Weekly Summary Card */}
                    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5 md:p-6 mb-3">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                                    <Moon size={20} className="text-fuchsia-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Weekly Summary</h3>
                                    <p className="text-xs text-gray-500">Get a weekly spending overview</p>
                                </div>
                            </div>
                            <ToggleSwitch
                                checked={notif.weekly_enabled}
                                onChange={(v) => updateNotif("weekly_enabled", v)}
                            />
                        </div>

                        {notif.weekly_enabled && (
                            <div className="space-y-4 pl-[52px]">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                                        <Calendar size={12} className="inline mr-1" /> Send on
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {DAY_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => updateNotif("weekly_day", opt.value)}
                                                className={`text-xs py-2 px-4 rounded-lg border transition ${notif.weekly_day === opt.value
                                                    ? "bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300"
                                                    : "bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10"
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Timezone Card */}
                    <div className="bg-gradient-to-br from-[#12121a] to-[#16162a] border border-white/5 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Globe size={20} className="text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Timezone</h3>
                                <p className="text-xs text-gray-500">Used for scheduling notification times</p>
                            </div>
                        </div>
                        <select
                            value={notif.timezone}
                            onChange={(e) => updateNotif("timezone", e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                        >
                            {TIMEZONE_OPTIONS.map((tz) => (
                                <option key={tz} value={tz} className="bg-[#12121a] text-white">
                                    {tz.replace(/_/g, " ")}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Info footer */}
                <div className="text-center text-gray-600 text-xs py-4">
                    Summaries are sent via Telegram at your preferred time.
                    <br />
                    Notifications are auto-disabled after 3 consecutive delivery failures.
                </div>
            </main>
        </div>
    );
}

/* ── Toggle Switch Component ─────────────────────────────────────────── */

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${checked ? "bg-violet-500" : "bg-white/10"
                }`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-0"
                    }`}
            />
        </button>
    );
}
