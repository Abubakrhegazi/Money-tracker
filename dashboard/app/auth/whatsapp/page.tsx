"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/api";

function WhatsAppAuthInner() {
    const router = useRouter();
    const params = useSearchParams();
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        const token = params.get("token");
        if (!token) {
            setErr("Missing token in URL");
            return;
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

        fetch(`${API_URL}/auth/whatsapp?token=${token}`)
            .then(async (r) => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
                return data;
            })
            .then((data) => {
                setToken(data.token);
                router.replace("/dashboard");
            })
            .catch((e) => setErr(String(e.message || e)));
    }, [params, router]);

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-300 p-6 text-center">
            {err ? (
                <div>
                    <div className="text-red-400 font-semibold mb-2">Login failed</div>
                    <div className="text-sm text-gray-400 break-all">{err}</div>
                </div>
            ) : (
                "🔐 Logging you in…"
            )}
        </main>
    );
}

export default function WhatsAppAuthPage() {
    return (
        <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-300">Loading…</main>}>
            <WhatsAppAuthInner />
        </Suspense>
    );
}