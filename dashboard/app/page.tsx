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
  LineChart,
  Check,
  Crown,
  Star,
  Sparkles,
} from "lucide-react";
import { setToken } from "@/lib/api";
import { Particles } from "@/components/ui/particles";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { NumberTicker } from "@/components/ui/number-ticker";

// WAVE 2: WhatsApp — WhatsAppIcon component removed for MVP.

const features = [
  {
    icon: <Mic className="w-6 h-6 text-violet-400" />,
    title: "Voice & Text Logging",
    description:
      "Send a voice note or text message and Aura instantly logs your expense — no forms, no friction.",
  },
  {
    icon: <LineChart className="w-6 h-6 text-violet-400" />,
    title: "Investment Portfolio",
    description:
      "Track stocks, crypto, gold, and forex in one place. Live prices, gain/loss, and portfolio value — always up to date.",
  },
  // WAVE 2: WhatsApp — "Telegram & WhatsApp" feature card removed for MVP.
  {
    icon: <Send className="w-5 h-5 text-fuchsia-400" />,
    title: "Telegram",
    description:
      "No app to download. Aura lives inside Telegram — the app you already use every day.",
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-violet-400" />,
    title: "Spending Analytics",
    description:
      "Beautiful charts and breakdowns show you exactly where your money goes — daily, weekly, or monthly.",
  },
  {
    icon: <Tag className="w-6 h-6 text-fuchsia-400" />,
    title: "AI Categorization",
    description:
      "Every transaction is automatically sorted into the right category using AI, so your data is always clean and organized.",
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
    desc: 'Text or voice note your expense on Telegram. Something like "Coffee 18 EGP" is all it takes.',
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
              Just message Aura on Telegram and let it do the rest.
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
                  {/* WAVE 2: WhatsApp CTA button removed for MVP. */}
                  <a
                    href="https://t.me/walletTrackinggBot"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ShimmerButton
                      className="text-base font-semibold px-8 py-3"
                      background="rgba(0, 136, 204, 1)"
                    >
                      <Send className="w-4 h-4 mr-2 inline" />
                      Start on Telegram
                    </ShimmerButton>
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

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <BlurFade inView>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Simple pricing
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Start free, upgrade when you need more. Try Pro free for 7 days.
              </p>
            </div>
          </BlurFade>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <BlurFade delay={0} inView>
              <div className="relative rounded-2xl bg-[#0f0f1a] border border-white/5 p-8 flex flex-col h-full">
                <div className="mb-6">
                  <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                    <Zap className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Free</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">0</span>
                    <span className="text-gray-500">EGP / month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Get started with the basics
                  </p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {[
                    "Manual expense & income logging",
                    "Voice messages (Whisper AI)",
                    "Basic monthly summary",
                    "Up to 3 categories",
                    "Telegram access",
                    "Web dashboard access",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <a
                  href="https://t.me/walletTrackinggBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <button className="w-full py-3 rounded-xl border border-white/10 text-sm font-semibold text-white hover:bg-white/5 transition">
                    Get Started
                  </button>
                </a>
              </div>
            </BlurFade>

            {/* Pro — highlighted */}
            <BlurFade delay={0.1} inView>
              <MagicCard className="h-full rounded-2xl">
                <div className="relative p-8 bg-[#0f0f1a] rounded-2xl flex flex-col h-full">
                  <BorderBeam
                    size={120}
                    duration={8}
                    colorFrom="#7c3aed"
                    colorTo="#d946ef"
                    borderWidth={1.5}
                  />

                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <Star className="w-5 h-5 text-violet-400" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        Most Popular
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white">Pro</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">99</span>
                      <span className="text-gray-500">EGP / month</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      7-day free trial included
                    </p>
                  </div>

                  <ul className="space-y-3 flex-1 mb-8">
                    {[
                      "Everything in Free",
                      "Unlimited categories",
                      "AI spending analysis",
                      "Daily & weekly digest notifications",
                      "Investment tracking (stocks, crypto, gold, forex)",
                      "Budget alerts",
                      // WAVE 2: "WhatsApp channel access" removed for MVP.
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="https://t.me/walletTrackinggBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <ShimmerButton
                      className="w-full text-sm font-semibold py-3"
                      background="rgba(124, 58, 237, 1)"
                    >
                      Start Free Trial
                    </ShimmerButton>
                  </a>
                </div>
              </MagicCard>
            </BlurFade>

            {/* Elite */}
            <BlurFade delay={0.2} inView>
              <div className="relative rounded-2xl bg-[#0f0f1a] border border-white/5 p-8 flex flex-col h-full">
                <div className="mb-6">
                  <div className="w-11 h-11 rounded-xl bg-fuchsia-500/10 flex items-center justify-center mb-4">
                    <Crown className="w-5 h-5 text-fuchsia-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Elite</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">199</span>
                    <span className="text-gray-500">EGP / month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    For power users
                  </p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {[
                    "Everything in Pro",
                    "PDF report exports",
                    "Multi-currency support (USD, EUR)",
                    "Smart goal tracking",
                    "Priority support",
                    "Early access to new features",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-fuchsia-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <a
                  href="https://t.me/walletTrackinggBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <button className="w-full py-3 rounded-xl border border-fuchsia-500/20 text-sm font-semibold text-white hover:bg-fuchsia-500/5 transition">
                    Get Elite
                  </button>
                </a>
              </div>
            </BlurFade>
          </div>

          <BlurFade delay={0.3} inView>
            <p className="text-center text-sm text-gray-600 mt-8">
              Annual billing: 2 months free. All prices in EGP.
            </p>
          </BlurFade>
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
              No signup needed. Just open Telegram and say hello to Aura.
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
                {/* WAVE 2: WhatsApp CTA button removed for MVP. */}
                <a
                  href="https://t.me/walletTrackinggBot"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ShimmerButton
                    className="text-lg font-semibold px-10 py-4"
                    background="rgba(0, 136, 204, 1)"
                  >
                    <Send className="w-5 h-5 mr-2 inline" />
                    Open Aura on Telegram
                  </ShimmerButton>
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
            {/* WAVE 2: WhatsApp footer link removed for MVP. */}
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
