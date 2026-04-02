import { Check, Star, Crown, Send, MessageSquare } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BlurFade } from "@/components/ui/blur-fade";

const BOT_URL = "https://t.me/walletTrackinggBot?start=subscribe";

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited categories",
  "AI spending analysis",
  "Daily & weekly digest notifications",
  "Investment tracking (stocks, crypto, gold, forex)",
  "Budget alerts",
];

const ELITE_FEATURES = [
  "Everything in Pro",
  "PDF report exports",
  "Multi-currency support (USD, EUR)",
  "Smart goal tracking",
  "Priority support",
  "Early access to new features",
];

const HOW_TO_STEPS = [
  {
    num: "01",
    text: (
      <>
        Open the bot and send{" "}
        <code className="bg-white/5 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono">
          /subscribe
        </code>
      </>
    ),
  },
  { num: "02", text: "Choose your plan — Pro or Elite" },
  {
    num: "03",
    text: (
      <>
        Send the InstaPay payment to{" "}
        <span className="text-white font-semibold">01148841234</span>
      </>
    ),
  },
  { num: "04", text: "Send a screenshot of your payment confirmation to the bot" },
  { num: "05", text: "We'll activate your subscription within 24 hours" },
];

export default function SubscribePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white px-4 py-20">
      <div className="max-w-5xl mx-auto flex flex-col gap-20">

        {/* ── Heading ── */}
        <BlurFade delay={0}>
          <div className="text-center flex flex-col gap-3">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Upgrade to Pro or Elite
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Pay once a month via InstaPay and we'll activate your plan within 24 hours.
            </p>
          </div>
        </BlurFade>

        {/* ── Plan Cards ── */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Pro */}
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

                {/* header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                      <Star className="w-5 h-5 text-violet-400" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      Most Popular
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Pro</h2>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-white">99</span>
                    <span className="text-gray-500">EGP / month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">7-day free trial included</p>
                </div>

                {/* features */}
                <ul className="space-y-3 flex-1 mb-8">
                  {PRO_FEATURES.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="block">
                  <ShimmerButton
                    className="w-full text-sm font-semibold py-3"
                    background="rgba(124, 58, 237, 1)"
                  >
                    <Send className="w-4 h-4 mr-2 inline" />
                    Subscribe via Telegram
                  </ShimmerButton>
                </a>
              </div>
            </MagicCard>
          </BlurFade>

          {/* Elite */}
          <BlurFade delay={0.2} inView>
            <div className="relative rounded-2xl bg-[#0f0f1a] border border-fuchsia-500/20 p-8 flex flex-col h-full">

              {/* header */}
              <div className="mb-6">
                <div className="w-11 h-11 rounded-xl bg-fuchsia-500/10 flex items-center justify-center mb-4">
                  <Crown className="w-5 h-5 text-fuchsia-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Elite</h2>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">199</span>
                  <span className="text-gray-500">EGP / month</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">For power users</p>
              </div>

              {/* features */}
              <ul className="space-y-3 flex-1 mb-8">
                {ELITE_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-fuchsia-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="block">
                <button className="w-full py-3 rounded-xl border border-fuchsia-500/30 text-sm font-semibold text-white hover:bg-fuchsia-500/5 transition flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  Subscribe via Telegram
                </button>
              </a>
            </div>
          </BlurFade>
        </div>

        {/* ── How to Subscribe ── */}
        <BlurFade delay={0.1} inView>
          <div className="rounded-2xl bg-[#0f0f1a] border border-white/5 p-8 md:p-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-violet-400" />
              </div>
              <h2 className="text-xl font-bold text-white">How to Subscribe</h2>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {HOW_TO_STEPS.map((step) => (
                <div key={step.num} className="flex flex-col gap-2">
                  <span className="text-4xl font-bold text-white/10 font-mono leading-none">
                    {step.num}
                  </span>
                  <p className="text-sm text-gray-300 leading-relaxed mt-1">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>

        {/* ── Already paid note ── */}
        <BlurFade delay={0.1} inView>
          <div className="rounded-2xl bg-violet-500/5 border border-violet-500/20 px-6 py-5 flex items-start gap-3">
            <Star className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-300">
              <span className="text-white font-semibold">Already paid?</span>{" "}
              Open the bot and send your screenshot if you haven&apos;t yet — we check submissions daily.
            </p>
          </div>
        </BlurFade>

      </div>
    </main>
  );
}
