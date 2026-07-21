import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Recycle, Camera, ScanLine, Truck, QrCode, ArrowRight, Search, ShieldCheck,
    Users, Leaf, IndianRupee, MapPin, BellRing, BarChart3, CheckCircle2, Package,
} from "lucide-react";

import api from "../api";
import {
    Badge, Button, Card, EmptyState, ErrorNote, Input, Spinner, StatTile, cx, CATEGORY_ICONS,
} from "../components/ui";

/* --------------------------------------------------------------------------
   Static content. Kept out of the component so the JSX below stays readable.
   -------------------------------------------------------------------------- */

const ROLES = [
    {
        icon: Camera,
        title: "Waste Generator",
        blurb: "Households, shops and hostels with waste to hand over.",
        points: [
            "Snap one photo — AI names the waste and estimates the weight",
            "Watch your pickup move from requested to collected, live",
            "Show a QR code at the door so handover is never disputed",
        ],
    },
    {
        icon: Truck,
        title: "Collection Team",
        blurb: "Self-help group collectors working a neighbourhood route.",
        points: [
            "See nearby requests sorted by distance, accept in one tap",
            "Mark yourself en route so the household knows to be ready",
            "Scan the generator's QR to close the job — no paperwork",
        ],
    },
    {
        icon: ShieldCheck,
        title: "Community Admin",
        blurb: "The ward or society office keeping the loop honest.",
        points: [
            "Escalated requests surface in red before anyone complains",
            "Assign a collector by hand when a request has been sitting",
            "Track tonnage, CO₂ saved and SHG income in one overview",
        ],
    },
];

const STEPS = [
    { icon: Camera, title: "Snap a photo", text: "Point your phone at the pile. That is the whole form." },
    { icon: ScanLine, title: "AI sorts it", text: "Category, weight and handling notes are filled in for you." },
    { icon: Truck, title: "A team accepts", text: "The nearest SHG collector claims it and heads over." },
    { icon: QrCode, title: "QR verified", text: "Scanned at the doorstep, so the record matches reality." },
];

const CATEGORY_ORDER = ["plastic", "organic", "paper", "metal", "glass", "ewaste", "hazardous", "mixed"];

/** Compact, locale-aware number, e.g. 12,480 or 1.2L — big numbers must stay glanceable. */
const fmt = (n) => {
    const value = Number(n) || 0;
    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toLocaleString("en-IN", { maximumFractionDigits: 1 });
};

/* -------------------------------------------------------------------------- */

/** Tracking-code box. Public, so a neighbour can follow a pickup without an account. */
function TrackForm({ compact = false }) {
    const navigate = useNavigate();
    const [code, setCode] = useState("");
    const [error, setError] = useState(null);

    const submit = (e) => {
        e.preventDefault();
        const token = code.trim();
        if (!token) {
            setError(new Error("Enter the tracking code printed under your QR."));
            return;
        }
        setError(null);
        navigate(`/track/${encodeURIComponent(token)}`);
    };

    return (
        <div className={cx(compact ? "w-full max-w-xs" : "w-full max-w-md")}>
            <form onSubmit={submit} className="flex items-center gap-2">
                <label htmlFor={compact ? "track-code-header" : "track-code-hero"} className="sr-only">
                    Tracking code
                </label>
                <div className="relative flex-1">
                    <Search
                        size={16}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                    <Input
                        id={compact ? "track-code-header" : "track-code-hero"}
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder="Tracking code"
                        autoComplete="off"
                        className="pl-9"
                    />
                </div>
                <Button type="submit" size={compact ? "sm" : "md"} variant={compact ? "secondary" : "primary"}>
                    Track
                    {!compact && <ArrowRight size={16} />}
                </Button>
            </form>
            {error && (
                <div className="mt-2">
                    <ErrorNote error={error} />
                </div>
            )}
        </div>
    );
}

/** Live impact band. The numbers are the argument, so a failure is shown, never hidden. */
function ImpactBand() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const summary = await api.getImpactSummary();
                if (!cancelled) setData(summary);
            } catch (err) {
                if (!cancelled) setError(err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const isEmpty =
        data &&
        !Number(data.total_waste_kg) &&
        !Number(data.total_co2_saved) &&
        !Number(data.total_income_generated);

    return (
        <section className="border-y border-ink-200 bg-white py-16 sm:py-20" aria-labelledby="impact-heading">
            <div className="mx-auto max-w-7xl px-4">
                <div className="mx-auto max-w-2xl text-center">
                    <Badge tone="brand">
                        <BarChart3 size={12} aria-hidden="true" />
                        Community impact
                    </Badge>
                    <h2 id="impact-heading" className="mt-4 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                        Every pickup adds up
                    </h2>
                    <p className="mt-3 text-ink-500">
                        Totals across every household and collection team on SafaiSetu, updated as pickups are verified.
                    </p>
                </div>

                <div className="mt-10">
                    {loading && <Spinner label="Loading community impact" />}

                    {!loading && error && (
                        <div className="mx-auto max-w-xl">
                            <ErrorNote error={error} onRetry={() => setReloadKey((k) => k + 1)} />
                        </div>
                    )}

                    {!loading && !error && isEmpty && (
                        <Card>
                            <EmptyState
                                icon={Package}
                                title="No pickups recorded yet"
                                description="Be the first household in your ward to raise a request — the totals start here."
                                action={
                                    <Button size="sm" onClick={() => navigate("/register")}>
                                        Get started
                                    </Button>
                                }
                            />
                        </Card>
                    )}

                    {!loading && !error && data && !isEmpty && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <StatTile
                                label="Waste diverted"
                                value={fmt(data.total_waste_kg)}
                                unit="kg"
                                icon={Recycle}
                                tone="brand"
                            />
                            <StatTile
                                label="CO₂ saved"
                                value={fmt(data.total_co2_saved)}
                                unit="kg"
                                icon={Leaf}
                                tone="info"
                            />
                            <StatTile
                                label="Income to collectors"
                                value={`₹${fmt(data.total_income_generated)}`}
                                icon={IndianRupee}
                                tone="warn"
                            />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */

export default function LandingPage() {
    const navigate = useNavigate();

    /** In-page jump that respects the smooth-scroll set on <html>. */
    const jumpTo = (id) => document.getElementById(id)?.scrollIntoView();

    return (
        <div className="min-h-screen bg-ink-50">
            {/* ---------------- Header ---------------- */}
            <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/85 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
                    <Link to="/" className="flex items-center gap-2" aria-label="SafaiSetu home">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
                            <Recycle size={18} aria-hidden="true" />
                        </span>
                        <span className="text-lg font-bold tracking-tight text-ink-900">SafaiSetu</span>
                    </Link>

                    <nav className="ml-6 hidden items-center gap-6 lg:flex" aria-label="Sections">
                        <a href="#roles" className="text-sm font-semibold text-ink-600 transition hover:text-brand-700">
                            Who it&apos;s for
                        </a>
                        <a href="#how" className="text-sm font-semibold text-ink-600 transition hover:text-brand-700">
                            How it works
                        </a>
                        <a href="#impact-heading" className="text-sm font-semibold text-ink-600 transition hover:text-brand-700">
                            Impact
                        </a>
                    </nav>

                    <div className="ml-auto flex items-center gap-2">
                        <div className="hidden md:block">
                            <TrackForm compact />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                            Login
                        </Button>
                        <Button size="sm" onClick={() => navigate("/register")}>
                            Register
                        </Button>
                    </div>
                </div>
            </header>

            <main>
                {/* ---------------- Hero ---------------- */}
                <section className="relative overflow-hidden">
                    {/* Soft brand wash behind the fold */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 via-ink-50 to-ink-50"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
                    />

                    {/* Sized to one screen: 100svh minus the sticky header, so the whole
                        hero lands in the browser's default view without scrolling.
                        svh (not vh) keeps it correct on mobile when the URL bar collapses. */}
                    <div className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-7xl items-center px-4 py-10 lg:py-12">
                        <div className="grid w-full items-center gap-10 lg:grid-cols-12 lg:gap-12">
                            <div className="animate-fade-up lg:col-span-7">
                                <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink-900 sm:text-5xl lg:text-[3.25rem] xl:text-6xl">
                                    A bridge between your doorstep and the{" "}
                                    <span className="text-brand-600">team that collects</span>
                                </h1>

                                <p className="mt-4 max-w-xl leading-relaxed text-ink-600 lg:text-lg">
                                    SafaiSetu connects households with local self-help group collection teams. Photograph
                                    your waste, let AI sort and weigh it, and track the pickup end to end — verified by a
                                    QR scan at handover.
                                </p>

                                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                    <Button
                                        size="lg"
                                        className="w-full sm:w-auto"
                                        onClick={() => navigate("/register")}
                                    >
                                        Request a pickup
                                        <ArrowRight size={18} aria-hidden="true" />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        className="w-full sm:w-auto"
                                        onClick={() => jumpTo("how")}
                                    >
                                        See how it works
                                    </Button>
                                </div>

                                {/* The header carries the tracking field on md+, so this only
                                    appears on small screens where that field is hidden. */}
                                <div className="mt-6 rounded-2xl bg-white/70 p-4 ring-1 ring-ink-200/70 sm:max-w-md md:hidden">
                                    <p className="mb-2 text-sm font-semibold text-ink-700">
                                        Already have a tracking code?
                                    </p>
                                    <TrackForm />
                                </div>
                            </div>

                            {/* Illustrative journey card. Hidden below lg: stacked under the
                                copy it pushes the hero past one screen on a phone. */}
                            <div className="hidden animate-fade-up lg:col-span-5 lg:block" style={{ animationDelay: "120ms" }}>
                                <Card className="overflow-hidden rounded-3xl shadow-lg">
                                    <div className="flex items-center justify-between border-b border-ink-100 bg-brand-600 px-5 py-4 text-white">
                                        <div className="flex items-center gap-2">
                                            <QrCode size={18} aria-hidden="true" />
                                            <span className="font-bold">Pickup #2417</span>
                                        </div>
                                        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                                            On the way
                                        </span>
                                    </div>

                                    <div className="space-y-4 px-5 py-5">
                                        <div className="flex items-center gap-3">
                                            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-xl">
                                                {CATEGORY_ICONS.plastic}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-ink-900">Mixed plastic bottles</p>
                                                <p className="text-sm text-ink-500">4.2 kg · recyclable</p>
                                            </div>
                                        </div>

                                        <ol className="space-y-3">
                                            {[
                                                ["Request raised", "Sector 7, Block C"],
                                                ["Sorted by AI", "Plastic · 4.2 kg"],
                                                ["Team accepted", "Nirmal SHG · 1.4 km away"],
                                            ].map(([title, detail]) => (
                                                <li key={title} className="flex items-start gap-3">
                                                    <CheckCircle2
                                                        size={18}
                                                        aria-hidden="true"
                                                        className="mt-0.5 shrink-0 text-brand-600"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-semibold text-ink-800">{title}</p>
                                                        <p className="text-sm text-ink-500">{detail}</p>
                                                    </div>
                                                </li>
                                            ))}
                                            <li className="flex items-start gap-3 opacity-60">
                                                <span
                                                    aria-hidden="true"
                                                    className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-ink-300"
                                                />
                                                <div>
                                                    <p className="text-sm font-semibold text-ink-800">QR scanned at handover</p>
                                                    <p className="text-sm text-ink-500">Pending</p>
                                                </div>
                                            </li>
                                        </ol>

                                        <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                                            {CATEGORY_ORDER.slice(0, 6).map((c) => (
                                                <span
                                                    key={c}
                                                    className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium capitalize text-ink-600"
                                                >
                                                    <span aria-hidden="true">{CATEGORY_ICONS[c]}</span>
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------------- Three roles ---------------- */}
                <section id="roles" className="scroll-mt-20 py-20 sm:py-24" aria-labelledby="roles-heading">
                    <div className="mx-auto max-w-7xl px-4">
                        <div className="mx-auto max-w-2xl text-center">
                            <Badge tone="brand">
                                <Users size={12} aria-hidden="true" />
                                Three roles, one loop
                            </Badge>
                            <h2
                                id="roles-heading"
                                className="mt-4 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl"
                            >
                                Built for everyone in the chain
                            </h2>
                            <p className="mt-3 text-ink-500">
                                Households raise it, collection teams clear it, and the community office keeps an eye on
                                anything that stalls.
                            </p>
                        </div>

                        <div className="mt-12 grid gap-6 md:grid-cols-3">
                            {ROLES.map(({ icon: Icon, title, blurb, points }, i) => (
                                <Card
                                    key={title}
                                    className="animate-fade-up flex flex-col rounded-3xl p-6 transition hover:shadow-md"
                                    style={{ animationDelay: `${i * 90}ms` }}
                                >
                                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                                        <Icon size={22} aria-hidden="true" />
                                    </span>
                                    <h3 className="mt-5 text-lg font-bold text-ink-900">{title}</h3>
                                    <p className="mt-1 text-sm text-ink-500">{blurb}</p>
                                    <ul className="mt-5 space-y-3">
                                        {points.map((p) => (
                                            <li key={p} className="flex items-start gap-2.5">
                                                <CheckCircle2
                                                    size={16}
                                                    aria-hidden="true"
                                                    className="mt-0.5 shrink-0 text-brand-600"
                                                />
                                                <span className="text-sm leading-relaxed text-ink-600">{p}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ---------------- How it works ---------------- */}
                <section
                    id="how"
                    className="scroll-mt-20 border-y border-ink-200 bg-white py-20 sm:py-24"
                    aria-labelledby="how-heading"
                >
                    <div className="mx-auto max-w-7xl px-4">
                        <div className="mx-auto max-w-2xl text-center">
                            <Badge tone="brand">Four steps</Badge>
                            <h2 id="how-heading" className="mt-4 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                                From photo to verified pickup
                            </h2>
                            <p className="mt-3 text-ink-500">
                                No forms to fill, no phone calls to chase. The whole handover fits in four taps.
                            </p>
                        </div>

                        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {STEPS.map(({ icon: Icon, title, text }, i) => (
                                <li
                                    key={title}
                                    className="animate-fade-up relative rounded-3xl bg-ink-50 p-6 ring-1 ring-ink-200/70"
                                    style={{ animationDelay: `${i * 90}ms` }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white">
                                            <Icon size={20} aria-hidden="true" />
                                        </span>
                                        <span className="text-sm font-bold tabular-nums text-ink-400">
                                            Step {i + 1}
                                        </span>
                                    </div>
                                    <h3 className="mt-4 font-bold text-ink-900">{title}</h3>
                                    <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{text}</p>

                                    {i < STEPS.length - 1 && (
                                        <ArrowRight
                                            size={18}
                                            aria-hidden="true"
                                            className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-ink-300 lg:block"
                                        />
                                    )}
                                </li>
                            ))}
                        </ol>

                        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-ink-500">
                            <span className="inline-flex items-center gap-2">
                                <MapPin size={16} aria-hidden="true" className="text-brand-600" />
                                Nearest team first
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <BellRing size={16} aria-hidden="true" className="text-brand-600" />
                                Live status alerts
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <ShieldCheck size={16} aria-hidden="true" className="text-brand-600" />
                                Nothing goes unanswered
                            </span>
                        </div>
                    </div>
                </section>

                {/* ---------------- Impact ---------------- */}
                <ImpactBand />

                {/* ---------------- Closing CTA ---------------- */}
                <section className="py-20 sm:py-24">
                    <div className="mx-auto max-w-5xl px-4">
                        <div className="animate-fade-up overflow-hidden rounded-3xl bg-brand-700 px-6 py-12 text-center shadow-lg sm:px-12 sm:py-16">
                            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                                Your ward&apos;s next pickup starts with a photo
                            </h2>
                            <p className="mx-auto mt-4 max-w-xl text-brand-50">
                                Join as a household, a collection team or a community admin. Setup takes under a minute.
                            </p>
                            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    className="w-full sm:w-auto"
                                    onClick={() => navigate("/register")}
                                >
                                    Create an account
                                    <ArrowRight size={18} aria-hidden="true" />
                                </Button>
                                <Button
                                    size="lg"
                                    className="w-full bg-brand-800 hover:bg-brand-900 focus-visible:outline-white sm:w-auto"
                                    onClick={() => navigate("/login")}
                                >
                                    I already have one
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* ---------------- Footer ---------------- */}
            <footer className="border-t border-ink-200 bg-white">
                <div className="mx-auto max-w-7xl px-4 py-12">
                    <div className="grid gap-10 md:grid-cols-4">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-2">
                                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
                                    <Recycle size={18} aria-hidden="true" />
                                </span>
                                <span className="text-lg font-bold tracking-tight text-ink-900">SafaiSetu</span>
                            </div>
                            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
                                A community waste-management bridge — connecting households with self-help group
                                collection teams, and making every pickup verifiable.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-ink-900">Product</h3>
                            <ul className="mt-4 space-y-2.5 text-sm">
                                <li>
                                    <a href="#roles" className="text-ink-500 transition hover:text-brand-700">
                                        Who it&apos;s for
                                    </a>
                                </li>
                                <li>
                                    <a href="#how" className="text-ink-500 transition hover:text-brand-700">
                                        How it works
                                    </a>
                                </li>
                                <li>
                                    <a href="#impact-heading" className="text-ink-500 transition hover:text-brand-700">
                                        Community impact
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-ink-900">Get started</h3>
                            <ul className="mt-4 space-y-2.5 text-sm">
                                <li>
                                    <Link to="/register" className="text-ink-500 transition hover:text-brand-700">
                                        Create an account
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/login" className="text-ink-500 transition hover:text-brand-700">
                                        Login
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-6 sm:flex-row">
                        <p className="text-sm text-ink-400">
                            © {new Date().getFullYear()} SafaiSetu. Built for cleaner wards.
                        </p>
                        <p className="inline-flex items-center gap-2 text-sm text-ink-400">
                            <Leaf size={14} aria-hidden="true" className="text-brand-600" />
                            Waste is only waste when it is wasted.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
