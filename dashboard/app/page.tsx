"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Mic,
  BarChart3,
  Tag,
  Send,
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
} from "lucide-react";
import { setToken } from "@/lib/api";
import { Particles } from "@/components/ui/particles";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { NumberTicker } from "@/components/ui/number-ticker";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const features = [
  {
    icon: <Mic className="w-6 h-6 text-violet-400" />,
    title: "Voice & Text Logging",
    description:
      "Send a voice note or text message and Aura instantly logs your expense — no forms, no friction.",
  },
  {
    icon: <Tag className="w-6 h-6 text-fuchsia-400" />,
    title: "AI Categorization",
    description:
      "Every transaction is automatically sorted into the right category using AI, so your data is always clean and organized.",
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-violet-400" />,
    title: "Spending Analytics",
    description:
      "Beautiful charts and breakdowns show you exactly where your money goes — daily, weekly, or monthly.",
  },
  {
    icon: (
      <div className="flex items-center gap-1">
        <Send className="w-5 h-5 text-fuchsia-400" />
        <WhatsAppIcon className="w-5 h-5 text-green-400" />
      </div>
    ),
    title: "Telegram & WhatsApp",
    description:
      "No app to download. Aura lives inside Telegram and WhatsApp — the apps you already use every day.",
  },
  {
    icon: <Zap className="w-6 h-6 text-violet-400" />,
    title: "Instant Insights",
    description:
      "Get real-time spending summaries with a single command. Know your budget status at any moment.",
  },
  {
    icon: <Shield className="w-6 h-6 text-fuchsia-400" />,
    title: "Private by Default",
    description:
      "Your financial data is yours. Stored securely and never shared with third parties.",
  },
];

const steps = [
  {
    num: "01",
    title: "Send a message",
    desc: 'Text or voice note your expense on Telegram or WhatsApp. Something like "Coffee 18 EGP" is all it takes.',
  },
  {
    num: "02",
    title: "Aura processes it",
    desc: "The AI reads your message, extracts the amount, category, and details — instantly.",
  },
  {
    num: "03",
    title: "View your dashboard",
    desc: "Open the web dashboard anytime to see charts, trends, and a full history of your spending.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const devLogin = async () => {
    setLoading(true);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/test-token`
    );
    const data = await res.json();
    setToken(data.token);
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <Particles
          className="absolute inset-0"
          quantity={120}
          color="#7c3aed"
          size={0.5}
          staticity={30}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-4xl mx-auto">
          <BlurFade delay={0.1}>
            <AnimatedGradientText>
              <span className="text-white/80 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Your personal finance tracker
              </span>
            </AnimatedGradientText>
          </BlurFade>

          <BlurFade delay={0.2}>
            <div className="flex flex-col items-center gap-3">
              <Image
                src="/aura-logo.png"
                alt="Aura"
                width={72}
                height={72}
                className="rounded-2xl"
              />
              <h1 className="text-7xl md:text-9xl font-bold bg-gradient-to-b from-white via-violet-200 to-fuchsia-400 bg-clip-text text-transparent leading-none tracking-tight">
                Aura
              </h1>
            </div>
          </BlurFade>

          <BlurFade delay={0.3}>
            <p className="text-lg md:text-xl text-gray-400 max-w-xl leading-relaxed">
              Track spending with a voice note. No apps, no spreadsheets.
              <br className="hidden md:block" />
              Just message Aura on WhatsApp or Telegram and let it do the rest.
            </p>
          </BlurFade>

          <BlurFade delay={0.4}>
            <div className="flex flex-col sm:flex-row gap-3 items-center mt-2">
              {process.env.NODE_ENV === "development" ? (
                <ShimmerButton
                  onClick={devLogin}
                  disabled={loading}
                  className="text-base font-semibold px-8 py-3 disabled:opacity-50"
                  background="rgba(124, 58, 237, 1)"
                >
                  {loading ? "Entering..." : "Enter Dashboard"}
                </ShimmerButton>
              ) : (
                <>
                  <a
                    href="https://wa.me/message/YOUR_WHATSAPP_BOT"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ShimmerButton
                      className="text-base font-semibold px-8 py-3"
                      background="rgba(22, 163, 74, 1)"
                    >
                      <WhatsAppIcon className="w-4 h-4 mr-2 inline" />
                      Start on WhatsApp
                    </ShimmerButton>
                  </a>
                  <a
                    href="https://t.me/walletTrackinggBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm group border border-white/10 rounded-full px-5 py-2.5 hover:border-white/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Use Telegram instead
                  </a>
                </>
              )}
              <a
                href="#features"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm group"
              >
                Learn more
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </BlurFade>
        </div>

        {/* scroll fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none" />
      </section>

      {/* ── Stats ── */}
      <section className="py-20 px-4 border-y border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 md:gap-8 text-center">
          {[
            { value: 1000, suffix: "+", label: "Transactions logged" },
            { value: 10, suffix: "+", label: "Active users" },
            { value: 99, suffix: "%", label: "Uptime" },
          ].map((stat, i) => (
            <BlurFade key={i} delay={0.1 * i} inView>
              <div className="flex flex-col items-center gap-1">
                <p className="text-4xl font-bold text-white">
                  <NumberTicker value={stat.value} delay={0.2 * i} />
                  <span className="text-violet-400">{stat.suffix}</span>
                </p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <BlurFade inView>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Everything you need
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Aura is a complete finance tracking system that lives where you already are.
              </p>
            </div>
          </BlurFade>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <BlurFade key={i} delay={0.08 * i} inView>
                <MagicCard className="h-full rounded-2xl">
                  <div className="relative p-6 flex flex-col gap-4 bg-[#0f0f1a] rounded-2xl h-full">
                    <BorderBeam
                      size={80}
                      duration={8}
                      delay={i * 1.5}
                      colorFrom="#7c3aed"
                      colorTo="#a855f7"
                      borderWidth={1}
                    />
                    <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1.5">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-4 bg-[#0d0d18]">
        <div className="max-w-4xl mx-auto">
          <BlurFade inView>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Dead simple.
              </h2>
              <p className="text-gray-400">
                Three steps is all it takes to start tracking.
              </p>
            </div>
          </BlurFade>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <BlurFade key={i} delay={0.15 * i} inView>
                <div className="flex flex-col gap-3">
                  <span className="text-5xl font-bold text-white/10 font-mono">
                    {step.num}
                  </span>
                  <h3 className="font-semibold text-white text-lg">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-32 px-4 overflow-hidden">
        <Particles
          className="absolute inset-0"
          quantity={60}
          color="#a855f7"
          size={0.4}
          staticity={50}
        />
        <div className="relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center gap-8">
          <BlurFade inView>
            <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-b from-white to-violet-300 bg-clip-text text-transparent">
              Start tracking today.
            </h2>
            <p className="text-gray-400 mt-4 text-lg">
              No signup needed. Just open WhatsApp or Telegram and say hello to Aura.
            </p>
          </BlurFade>

          <BlurFade inView delay={0.2}>
            {process.env.NODE_ENV === "development" ? (
              <ShimmerButton
                onClick={devLogin}
                disabled={loading}
                className="text-lg font-semibold px-10 py-4 disabled:opacity-50"
                background="rgba(124, 58, 237, 1)"
              >
                {loading ? "Entering..." : "Open Dashboard"}
              </ShimmerButton>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                <a
                  href="https://wa.me/message/YOUR_WHATSAPP_BOT"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ShimmerButton
                    className="text-lg font-semibold px-10 py-4"
                    background="rgba(22, 163, 74, 1)"
                  >
                    <WhatsAppIcon className="w-5 h-5 mr-2 inline" />
                    Open Aura on WhatsApp
                  </ShimmerButton>
                </a>
                <a
                  href="https://t.me/walletTrackinggBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm group border border-white/10 rounded-full px-6 py-3 hover:border-white/20"
                >
                  <Send className="w-4 h-4" />
                  Use Telegram
                </a>
              </div>
            )}
          </BlurFade>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-4 border-t border-white/5 text-center">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Image
              src="/aura-logo.png"
              alt="Aura"
              width={22}
              height={22}
              className="rounded-md opacity-70"
            />
            <span>Aura — Your personal finance tracker</span>
          </div>
          <div className="flex gap-6">
            <a
              href="https://wa.me/message/YOUR_WHATSAPP_BOT"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition"
            >
              WhatsApp
            </a>
            <a
              href="https://t.me/walletTrackinggBot"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition"
            >
              Telegram
            </a>
            <a href="/privacy" className="hover:text-gray-400 transition">
              Privacy
            </a>
            <a href="/terms" className="hover:text-gray-400 transition">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
