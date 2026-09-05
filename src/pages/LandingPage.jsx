import { Link } from "react-router";
import Logo from "../components/Logo";
import SiteFooter from "../components/SiteFooter";
import {
  Lock,
  Mic,
  Image as ImageIcon,
  Phone,
  Video,
  MessageCircle,
  BellOff,
  ArrowRight,
  Check,
  ShieldCheck,
  EyeOff,
  Play,
  Send,
  CheckCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Lock,
    title: "Private by default",
    desc: "Your messages stay between you and the people you're talking to. Nothing sold, nothing mined.",
  },
  {
    icon: Mic,
    title: "Voice notes",
    desc: "Say it faster than you can type. Record and send in a single tap.",
  },
  {
    icon: ImageIcon,
    title: "Photos & video",
    desc: "Share moments in full quality, or send them as view-once when they're just for now.",
  },
  {
    icon: Phone,
    title: "Voice & video calls",
    desc: "Crisp one-to-one calls, right inside the conversation.",
  },
  {
    icon: MessageCircle,
    title: "Groups & channels",
    desc: "Keep friends, family, or a whole team in one place without the chaos.",
  },
  {
    icon: BellOff,
    title: "No noise",
    desc: "No ads, no algorithm, no endless pings. Just the people you chose to talk to.",
  },
];

const ASSURANCES = [
  { icon: ShieldCheck, title: "You're in control", desc: "Delete messages and your data whenever you want." },
  { icon: EyeOff, title: "No tracking", desc: "We don't follow you around the web or build a profile." },
  { icon: BellOff, title: "No ads, ever", desc: "Havn is a quiet space, never funded by advertising." },
];

const STEPS = [
  { n: "01", title: "Create your account", desc: "Sign up in seconds with just an email address." },
  { n: "02", title: "Find your people", desc: "Add the friends, family, and groups you actually talk to." },
  { n: "03", title: "Start talking", desc: "Send your first message, voice note, photo, or call." },
];

const WAVE = [9, 15, 22, 13, 26, 18, 11, 24, 19, 10, 16, 23, 12, 18, 9];

function ChatMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div aria-hidden className="absolute -right-3 -top-3 h-full w-full rounded-[28px] bg-[#C2410C]" />
      <div className="relative rounded-[24px] border border-[#2A2420] bg-[#141311] p-4">
        <div className="flex items-center gap-3 border-b border-[#2A2420] pb-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#3C3630] font-display font-semibold text-[#DED7CD]">
            M
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[#FAF7F2]">Maya Okafor</p>
            <p className="flex items-center gap-1.5 text-xs text-[#8A7E70]">
              <span className="size-1.5 rounded-full bg-[#3F9142]" />
              online
            </p>
          </div>
          <Phone aria-hidden className="size-[18px] text-[#8A7E70]" />
          <Video aria-hidden className="size-[18px] text-[#8A7E70]" />
        </div>

        <div className="flex flex-col gap-2.5 py-4">
          <div className="max-w-[78%] self-start rounded-2xl rounded-tl-sm bg-[#272320] px-4 py-2.5 text-sm text-[#DED7CD]">
            Are we still on for tonight?
          </div>

          <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-[#C2410C] px-4 py-2.5 text-sm text-white">
            Just leaving now — see you in 10.
            <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-white/70">
              9:24
              <CheckCheck aria-hidden className="size-3.5" />
            </span>
          </div>

          <div className="flex max-w-[78%] items-center gap-3 self-start rounded-2xl rounded-tl-sm bg-[#272320] px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#C2410C] text-white">
              <Play aria-hidden className="size-4 translate-x-[1px]" />
            </span>
            <span className="flex h-6 items-center gap-[3px]">
              {WAVE.map((h, i) => (
                <span key={i} className="w-[3px] rounded-full bg-[#8A7E70]" style={{ height: `${h}px` }} />
              ))}
            </span>
            <span className="text-xs text-[#8A7E70]">0:14</span>
          </div>

          <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-[#C2410C] px-4 py-2.5 text-sm text-white">
            Perfect
            <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-white/70">
              9:24
              <CheckCheck aria-hidden className="size-3.5" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-[#2A2420] bg-[#1C1815] py-2 pl-4 pr-2">
          <span className="flex-1 text-sm text-[#8A7E70]">Message</span>
          <span className="grid size-8 place-items-center rounded-full bg-[#C2410C] text-white">
            <Send aria-hidden className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="w-full min-h-[100dvh] bg-[#FAF7F2] text-[#141311]">
      <header className="sticky top-0 z-20 border-b border-[#E7DFD4] bg-[#FAF7F2]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo size={30} />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-[#57534E] hover:text-[#141311] transition-colors">
              Features
            </a>
            <a href="#privacy" className="text-sm font-medium text-[#57534E] hover:text-[#141311] transition-colors">
              Privacy
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="px-3 py-2 text-sm font-medium text-[#141311] hover:text-[#C2410C] transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-xl bg-[#C2410C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#A8380E] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E0D7CB] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6B5F52]">
            <span className="size-1.5 rounded-full bg-[#C2410C]" />
            Private messaging
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            A <span className="text-[#C2410C]">calmer</span> place to talk.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#57534E]">
            Havn keeps your conversations with friends, family, and colleagues in one quiet, private place.
            Messages, voice notes, photos, and calls — without the noise.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-[#C2410C] px-6 py-3.5 font-medium text-white hover:bg-[#A8380E] transition-colors"
            >
              Get started
              <ArrowRight aria-hidden className="size-[18px]" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E0D7CB] px-6 py-3.5 font-medium text-[#141311] hover:bg-[#F0EAE1] transition-colors"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#6B5F52]">
            {["No ads", "No tracking", "Free to use"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-4 text-[#C2410C]" />
                {t}
              </span>
            ))}
          </div>
        </div>

        <ChatMock />
      </section>

      <section id="features" className="border-y border-[#E7DFD4] bg-[#F3EDE4]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C2410C]">
              Everything you need
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Built for real conversations.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#57534E]">
              The essentials, done well — and nothing you didn't ask for.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#E0D7CB] bg-[#E0D7CB] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[#FAF7F2] p-8">
                <span className="grid size-11 place-items-center rounded-xl bg-[#C2410C]/10 text-[#C2410C]">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#57534E]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="bg-[#141311] text-[#FAF7F2]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#E8975E]">Privacy</span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Your conversations stay yours.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#A89F92]">
              No trackers. No advertising. No selling your data to the highest bidder. Havn is a quiet corner
              of the internet that works for you — not for advertisers.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {ASSURANCES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border-t border-[#2A2420] pt-6">
                <Icon aria-hidden className="size-6 text-[#E8975E]" />
                <h3 className="mt-4 font-display text-lg font-semibold text-[#FAF7F2]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A89F92]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C2410C]">Getting started</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Talking in three steps.
          </h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#E0D7CB] bg-[#E0D7CB] sm:grid-cols-3">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="bg-[#FAF7F2] p-8">
              <span className="font-display text-3xl font-bold text-[#C2410C]">{n}</span>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#57534E]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#C2410C] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center lg:py-20">
          <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to find your Havn?
          </h2>
          <p className="max-w-md text-lg text-white/85">Join a calmer way to stay in touch with the people who matter.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-medium text-[#C2410C] hover:bg-[#FFF7ED] transition-colors"
            >
              Get started
              <ArrowRight aria-hidden className="size-[18px]" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3.5 font-medium text-white hover:bg-white/10 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export default LandingPage;
