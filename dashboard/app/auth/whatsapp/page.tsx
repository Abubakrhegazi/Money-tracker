"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/api";

export default function WhatsAppAuth() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/whatsapp?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.token) {
          setToken(data.token);
          router.push("/dashboard");
        }
      });
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white text-xl">🔐 Logging you in...</p>
    </main>
  );
}