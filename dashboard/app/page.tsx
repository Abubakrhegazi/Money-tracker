"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/api";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const devLogin = async () => {
    setLoading(true);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/test-token`);
    const data = await res.json();
    setToken(data.token);
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <Image src="/aura-logo.png" alt="Aura" width={64} height={64} className="mx-auto mb-4 rounded-xl" />
        <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent mb-2">
          Aura
        </h1>
        <p className="text-gray-400">Your personal finance tracker</p>
      </div>
      <div className="bg-[#12121a] border border-white/5 rounded-2xl p-8 flex flex-col items-center gap-4 w-80">
        <p className="text-gray-300 text-sm">Development Mode</p>
        <button
          onClick={devLogin}
          disabled={loading}
          className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold py-3 px-6 rounded-xl transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Enter Dashboard"}
        </button>
        <p className="text-gray-600 text-xs">Telegram login will be enabled on production</p>
      </div>
    </main>
  );
}