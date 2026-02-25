"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/api";

function TelegramAuthInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const t = params.get("t");
    if (!t) {
      router.replace("/");
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    fetch(`${API_URL}/auth/telegram-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Invalid/expired link");
        return r.json();
      })
      .then((data) => {
        setToken(data.token);
        router.replace("/dashboard");
      })
      .catch(() => router.replace("/"));
  }, [params, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-300">
      Logging you in…
    </main>
  );
}

export default function TelegramAuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-300">
          Loading…
        </main>
      }
    >
      <TelegramAuthInner />
    </Suspense>
  );
}