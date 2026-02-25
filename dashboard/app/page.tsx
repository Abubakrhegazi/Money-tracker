"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const devLogin = async () => {
    setLoading(true);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/test-token`);    const data = await res.json();
    setToken(data.token);
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">💰 MoneyBot</h1>
        <p className="text-gray-400">Track your spending with voice notes</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4 w-80">
        <p className="text-gray-300 text-sm">Development Mode</p>
        <button
          onClick={devLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "🚀 Enter Dashboard"}
        </button>
        <p className="text-gray-600 text-xs">Telegram login will be enabled on production</p>
      </div>
    </main>
  );
}