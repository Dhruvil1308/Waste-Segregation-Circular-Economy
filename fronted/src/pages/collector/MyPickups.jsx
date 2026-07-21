import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MapPin, Navigation, QrCode, Truck, User } from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, CardHeader, CATEGORY_ICONS, cx, EmptyState, ErrorNote, Spinner, StatusPill, timeAgo,
} from "../../components/ui";

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** Backend timestamps are naive UTC; timeAgo() already normalises, this is for absolute dates. */
const formatMoment = (value) => {
    if (!value) return "";
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
};

function PickupCard({ item, children }) {
    return (
        <Card className={cx("overflow-hidden", item.escalated && "escalated-row")}>
            <CardHeader
                title={
                    <span className="flex items-center gap-2">
                        <span aria-hidden="true">{CATEGORY_ICONS[item.category] || CATEGORY_ICONS.mixed}</span>
                        {item.waste_type || item.category || "Waste"}
                    </span>
                }
                subtitle={`${num(item.quantity_kg).toFixed(1)} kg · ${item.category || "mixed"}`}
                action={
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusPill status={item.status} />
                        {item.escalated && <Badge tone="danger">Escalated</Badge>}
                    </div>
                }
            />

            <div className="flex gap-4 px-5 py-4">
                {item.image_url && (
                    <img
                        src={item.image_url}
                        alt={`Waste for pickup ${item.id}`}
                        className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-ink-200"
                        loading="lazy"
                    />
                )}
                <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-ink-600">
                        <dt className="sr-only">Generator</dt>
                        <User size={14} className="shrink-0 text-ink-400" />
                        <dd className="truncate">{item.generator_name || "Unknown household"}</dd>
                    </div>
                    <div className="flex items-center gap-2 text-ink-600">
                        <dt className="sr-only">Location</dt>
                        <MapPin size={14} className="shrink-0 text-ink-400" />
                        <dd className="truncate">{item.location || "No address given"}</dd>
                    </div>
                    {item.collected_at && (
                        <div className="flex items-center gap-2 text-brand-700">
                            <dt className="sr-only">Collected at</dt>
                            <CheckCircle2 size={14} className="shrink-0" />
                            <dd className="font-semibold">Collected {formatMoment(item.collected_at)}</dd>
                        </div>
                    )}
                </dl>
            </div>

            {children && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3">
                    <span className="text-xs text-ink-400">
                        {item.accepted_at ? `Accepted ${timeAgo(item.accepted_at)}` : timeAgo(item.created_at)}
                    </span>
                    <div className="flex flex-wrap gap-2">{children}</div>
                </div>
            )}
        </Card>
    );
}

function Section({ title, description, children }) {
    return (
        <section className="space-y-3">
            <div>
                <h2 className="font-bold text-ink-900">{title}</h2>
                {description && <p className="text-sm text-ink-500">{description}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">{children}</div>
        </section>
    );
}

export default function CollectorMyPickups() {
    const [pickups, setPickups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await api.getMyPickups();
            setPickups(Array.isArray(data) ? data : []);
            setLoadError(null);
        } catch (err) {
            setLoadError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!cancelled) await load();
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [load]);

    const startTravel = async (id) => {
        setActionError(null);
        setBusyId(id);
        try {
            await api.markEnRoute(id);
            await load();
        } catch (err) {
            setActionError(err);
        } finally {
            setBusyId(null);
        }
    };

    const accepted = pickups.filter((item) => item.status === "accepted");
    const enRoute = pickups.filter((item) => item.status === "en_route");
    const completed = pickups
        .filter((item) => item.status === "collected" || item.status === "processed")
        .sort((a, b) => String(b.collected_at || "").localeCompare(String(a.collected_at || "")));
    const other = pickups.filter(
        (item) => !["accepted", "en_route", "collected", "processed"].includes(item.status)
    );

    const scanLink = (
        <Link to="/app/scan">
            <Button variant="secondary">
                <QrCode size={16} />
                Scan QR to collect
            </Button>
        </Link>
    );

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-ink-900">My pickups</h1>
                <p className="mt-1 text-sm text-ink-500">
                    Everything you have accepted, grouped by where it is in the journey.
                </p>
            </header>

            {actionError && <ErrorNote error={actionError} onRetry={load} />}
            {loadError && <ErrorNote error={loadError} onRetry={load} />}

            {loading && !loadError ? (
                <Spinner label="Loading your pickups" />
            ) : pickups.length === 0 && !loadError ? (
                <Card>
                    <EmptyState
                        icon={Truck}
                        title="No pickups yet"
                        description="Accept a request from the nearby queue and it will show up here."
                        action={
                            <Link to="/app/queue">
                                <Button>Open the nearby queue</Button>
                            </Link>
                        }
                    />
                </Card>
            ) : (
                <div className="space-y-8">
                    {accepted.length > 0 && (
                        <Section title="Accepted" description="Waiting for you to set off.">
                            {accepted.map((item) => (
                                <PickupCard key={item.id} item={item}>
                                    <Button
                                        onClick={() => startTravel(item.id)}
                                        loading={busyId === item.id}
                                        disabled={busyId === item.id}
                                    >
                                        <Navigation size={16} />
                                        Start travel
                                    </Button>
                                    {scanLink}
                                </PickupCard>
                            ))}
                        </Section>
                    )}

                    {enRoute.length > 0 && (
                        <Section title="On the way" description="Scan the household's QR code at handover.">
                            {enRoute.map((item) => (
                                <PickupCard key={item.id} item={item}>
                                    {scanLink}
                                </PickupCard>
                            ))}
                        </Section>
                    )}

                    {other.length > 0 && (
                        <Section title="Other">
                            {other.map((item) => (
                                <PickupCard key={item.id} item={item} />
                            ))}
                        </Section>
                    )}

                    {completed.length > 0 && (
                        <Section title="Completed" description="Your collection history.">
                            {completed.map((item) => (
                                <PickupCard key={item.id} item={item} />
                            ))}
                        </Section>
                    )}
                </div>
            )}
        </div>
    );
}
