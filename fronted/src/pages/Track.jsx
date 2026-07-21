import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    Recycle, Check, SearchX, FileText, UserCheck, Truck, PackageCheck,
    MapPin, Scale, User, Home,
} from "lucide-react";

import api from "../api";
import {
    Card, CardHeader, Badge, StatusPill, Spinner, EmptyState, ErrorNote,
    cx, timeAgo, STATUS_LABELS, CATEGORY_ICONS,
} from "../components/ui";

/** How often the public tracker re-asks the server, so a handover shows up without a reload. */
const POLL_MS = 10000;

/**
 * The full journey a pickup takes. The backend sends only the steps that have
 * already happened, so everything after the current status is drawn greyed-out —
 * a parcel tracker is only reassuring if you can see what comes next.
 */
const LIFECYCLE = [
    { key: "requested", icon: FileText, label: "Request created", description: "Waiting for a collection team to accept." },
    { key: "accepted", icon: UserCheck, label: "Collector assigned", description: "A collection team takes on the pickup." },
    { key: "en_route", icon: Truck, label: "On the way", description: "The collector is heading to the pickup point." },
    { key: "collected", icon: PackageCheck, label: "Collected", description: "Waste handed over and the QR code verified." },
    { key: "processed", icon: Recycle, label: "Processed", description: "Sorted and sent for recycling or composting." },
];

/** Backend timestamps are naive UTC; without the Z the browser reads them as local time. */
const toDate = (value) => {
    if (!value) return null;
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatStamp = (value) => {
    const date = toDate(value);
    if (!date) return "";
    return date.toLocaleString(undefined, {
        day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
};

/** Best-effort icon for a server-authored step name; falls back to a plain tick. */
const iconForStep = (name = "") => {
    const text = name.toLowerCase();
    const match = LIFECYCLE.find(({ key, label }) =>
        text.includes(key.replace("_", " ")) || text.includes(label.toLowerCase().split(" ")[0]));
    return match ? match.icon : Check;
};

function TimelineStep({ icon: Icon, title, description, meta, done, isLast }) {
    return (
        <li className="relative pb-8 pl-14 last:pb-0">
            {!isLast && (
                <span
                    aria-hidden="true"
                    className={cx("absolute left-[19px] top-10 bottom-0 w-0.5",
                        done ? "bg-brand-300" : "bg-ink-200")}
                />
            )}
            <span
                aria-hidden="true"
                className={cx("absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-full ring-4 ring-white",
                    done ? "bg-brand-600 text-white shadow-sm" : "bg-ink-100 text-ink-400")}
            >
                <Icon size={18} />
            </span>

            <div className={cx("min-w-0", !done && "opacity-70")}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className={cx("font-bold", done ? "text-ink-900" : "text-ink-500")}>{title}</p>
                    {meta
                        ? <span className="text-xs font-medium text-ink-400">{meta}</span>
                        : !done && <Badge tone="neutral">Upcoming</Badge>}
                </div>
                {description && (
                    <p className={cx("mt-1 text-sm", done ? "text-ink-600" : "text-ink-400")}>{description}</p>
                )}
            </div>
        </li>
    );
}

function SummaryRow({ icon: Icon, label, value }) {
    if (value === null || value === undefined || value === "") return null;
    return (
        <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500">
                <Icon size={16} />
            </span>
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
                <p className="break-words font-semibold text-ink-800">{value}</p>
            </div>
        </div>
    );
}

export default function TrackPage() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async ({ signal } = {}) => {
        try {
            const result = await api.track(token);
            if (signal?.aborted) return;
            setData(result);
            setError(null);
            setNotFound(false);
        } catch (err) {
            if (signal?.aborted) return;
            if (err.status === 404) {
                setNotFound(true);
                setData(null);
                setError(null);
            } else {
                // Never swallowed: a stale timeline with no explanation is worse than an error.
                setError(err);
            }
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        const controller = { aborted: false };
        setLoading(true);
        setData(null);
        setError(null);
        setNotFound(false);

        const run = async () => { await load({ signal: controller }); };
        run();

        const id = setInterval(run, POLL_MS);
        return () => {
            controller.aborted = true;
            clearInterval(id);
        };
    }, [load]);

    const steps = Array.isArray(data?.journey_steps) ? data.journey_steps : [];
    const stageIndex = LIFECYCLE.findIndex((s) => s.key === data?.status);
    const upcoming = stageIndex >= 0 ? LIFECYCLE.slice(stageIndex + 1) : [];

    // If the server sent no steps yet, fall back to the stages the timestamps prove happened.
    const doneSteps = steps.length > 0
        ? steps.map((step, i) => ({
            key: `step-${i}`,
            icon: iconForStep(step.step_name),
            title: step.step_name,
            description: step.description,
            timestamp: step.timestamp,
        }))
        : (stageIndex >= 0 ? LIFECYCLE.slice(0, stageIndex + 1) : []).map((stage) => ({
            key: stage.key,
            icon: stage.icon,
            title: stage.label,
            description: stage.description,
            timestamp: { requested: data?.created_at, accepted: data?.accepted_at, collected: data?.collected_at }[stage.key],
        }));

    const totalSteps = doneSteps.length + upcoming.length;

    return (
        <div className="min-h-screen bg-ink-50">
            <header className="border-b border-ink-200 bg-white">
                <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
                    <Link to="/" className="flex items-center gap-2 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
                            <Recycle size={18} />
                        </span>
                        <div className="leading-tight">
                            <p className="font-bold text-ink-900">SafaiSetu</p>
                            <p className="text-xs text-ink-500">Track a pickup</p>
                        </div>
                    </Link>

                    <Link
                        to="/"
                        className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-100"
                    >
                        <Home size={16} />
                        <span className="hidden sm:inline">Home</span>
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 py-6">
                {loading && !data && !notFound && <Spinner label="Looking up this pickup" />}

                {notFound && (
                    <Card>
                        <EmptyState
                            icon={SearchX}
                            title="We could not find that tracking code"
                            description="The code may be mistyped or expired. Check the QR code on your pickup and try again."
                            action={
                                <Link
                                    to="/"
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                                >
                                    Go to SafaiSetu
                                </Link>
                            }
                        />
                    </Card>
                )}

                {error && !notFound && (
                    <div className="mb-4">
                        <ErrorNote error={error} onRetry={() => load()} />
                    </div>
                )}

                {data && (
                    <div className="space-y-5 animate-fade-up">
                        <Card className={cx("overflow-hidden", data.escalated && "escalated-row")}>
                            <div className="flex flex-wrap items-start gap-4 border-b border-ink-100 px-5 py-4">
                                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-2xl">
                                    {CATEGORY_ICONS[data.category] || CATEGORY_ICONS.mixed}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h1 className="truncate text-lg font-bold text-ink-900">
                                        {data.waste_type || data.category || "Waste pickup"}
                                    </h1>
                                    <p className="mt-0.5 text-sm text-ink-500">
                                        Pickup #{data.id}
                                        {data.created_at && <> · raised {timeAgo(data.created_at)}</>}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {data.escalated && <Badge tone="danger">Escalated</Badge>}
                                    <StatusPill status={data.status} />
                                </div>
                            </div>

                            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                                <SummaryRow
                                    icon={Scale}
                                    label="Quantity"
                                    value={data.quantity_kg != null ? `${data.quantity_kg} kg` : null}
                                />
                                <SummaryRow icon={MapPin} label="Location" value={data.location} />
                                <SummaryRow icon={User} label="Generator" value={data.generator_name} />
                                <SummaryRow
                                    icon={Truck}
                                    label="Collector"
                                    value={data.collector_name || (data.status === "requested" ? "Not assigned yet" : null)}
                                />
                            </div>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Journey"
                                subtitle={STATUS_LABELS[data.status] || data.status}
                            />
                            <div className="px-5 py-6">
                                {totalSteps === 0 ? (
                                    <EmptyState
                                        title="No journey yet"
                                        description="This pickup has not started moving. Check back in a moment."
                                    />
                                ) : (
                                    <ol className="relative">
                                        {doneSteps.map((step, i) => (
                                            <TimelineStep
                                                key={step.key}
                                                icon={step.icon}
                                                title={step.title}
                                                description={step.description}
                                                meta={formatStamp(step.timestamp)}
                                                done
                                                isLast={i === totalSteps - 1}
                                            />
                                        ))}
                                        {upcoming.map((stage, i) => (
                                            <TimelineStep
                                                key={stage.key}
                                                icon={stage.icon}
                                                title={stage.label}
                                                description={stage.description}
                                                done={false}
                                                isLast={doneSteps.length + i === totalSteps - 1}
                                            />
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </Card>

                        <p className="text-center text-xs text-ink-400">
                            This page refreshes on its own every 10 seconds.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
