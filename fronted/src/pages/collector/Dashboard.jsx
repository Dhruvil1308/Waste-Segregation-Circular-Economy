import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowRight, Gauge, IndianRupee, Inbox, MapPin, Package, QrCode, Recycle, ShieldAlert,
} from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, CardHeader, CATEGORY_ICONS, cx, EmptyState, ErrorNote, Spinner, StatTile, timeAgo,
} from "../../components/ui";

/** The queue moves fast; five seconds keeps the preview honest without hammering the API. */
const POLL_MS = 5000;
const PREVIEW_COUNT = 5;

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** Alerts endpoints have shipped as both a bare array and a wrapper object. Accept either. */
const asList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.alerts)) return data.alerts;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
    return [];
};

const distanceLabel = (km) =>
    km === null || km === undefined || !Number.isFinite(Number(km))
        ? "distance unknown"
        : `${Number(km).toFixed(1)} km away`;

/** Requests without a distance sort last, but the API's own order is otherwise preserved. */
const withUnknownDistanceLast = (list) =>
    [...list].sort((a, b) => {
        const aKnown = Number.isFinite(Number(a?.distance_km));
        const bKnown = Number.isFinite(Number(b?.distance_km));
        if (aKnown === bKnown) return 0;
        return aKnown ? -1 : 1;
    });

const alertText = (alert) =>
    alert?.message ||
    alert?.title ||
    alert?.description ||
    [alert?.waste_type, alert?.location].filter(Boolean).join(" · ") ||
    `Request #${alert?.id ?? "?"} needs attention`;

export default function CollectorDashboard() {
    const [stats, setStats] = useState(null);
    const [statsError, setStatsError] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const [nearby, setNearby] = useState([]);
    const [feedError, setFeedError] = useState(null);
    const [feedLoading, setFeedLoading] = useState(true);

    const [alerts, setAlerts] = useState([]);
    const [alertsError, setAlertsError] = useState(null);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            setStats(await api.getPartnerStats());
            setStatsError(null);
        } catch (err) {
            setStatsError(err);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    const loadFeed = useCallback(async () => {
        try {
            const data = await api.getNearbyRequests();
            setNearby(Array.isArray(data) ? data : []);
            setFeedError(null);
        } catch (err) {
            setFeedError(err);
        } finally {
            setFeedLoading(false);
        }
    }, []);

    const loadAlerts = useCallback(async () => {
        try {
            setAlerts(asList(await api.getAlerts()));
            setAlertsError(null);
        } catch (err) {
            // The alert feed is admin-scoped on some deployments. A 401/403 means "this board
            // isn't yours", which is not a failure — anything else is a real problem and is shown.
            if (err?.status === 401 || err?.status === 403) {
                setAlerts([]);
                setAlertsError(null);
            } else {
                setAlertsError(err);
            }
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            if (cancelled) return;
            await loadFeed();
            if (cancelled) return;
            await loadAlerts();
        };
        tick();
        const id = setInterval(tick, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [loadFeed, loadAlerts]);

    const preview = withUnknownDistanceLast(nearby).slice(0, PREVIEW_COUNT);

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-ink-900">Collection dashboard</h1>
                    <p className="mt-1 text-sm text-ink-500">
                        Live view of what is waiting to be picked up around you.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link to="/app/queue">
                        <Button variant="secondary">
                            <Inbox size={16} />
                            Nearby queue
                        </Button>
                    </Link>
                    <Link to="/app/scan">
                        <Button>
                            <QrCode size={16} />
                            Scan QR
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Escalated requests have been ignored for too long — they get the loudest surface. */}
            {alerts.length > 0 && (
                <div
                    className="animate-alert rounded-2xl bg-red-50 p-5 ring-2 ring-red-300"
                    role="alert"
                >
                    <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700">
                            <ShieldAlert size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-bold text-red-900">
                                    {alerts.length} escalated {alerts.length === 1 ? "request" : "requests"}
                                </h2>
                                <Badge tone="danger">Escalated</Badge>
                            </div>
                            <p className="mt-0.5 text-sm text-red-800">
                                These households have been waiting through three or more unanswered requests.
                            </p>
                            <ul className="mt-3 space-y-1.5">
                                {alerts.slice(0, 4).map((alert, index) => (
                                    <li
                                        key={alert?.id ?? index}
                                        className="rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-red-900"
                                    >
                                        {alertText(alert)}
                                    </li>
                                ))}
                            </ul>
                            {alerts.length > 4 && (
                                <p className="mt-2 text-sm text-red-800">+ {alerts.length - 4} more waiting.</p>
                            )}
                            <Link to="/app/queue" className="mt-3 inline-block">
                                <Button variant="danger" size="sm">
                                    Open the queue
                                    <ArrowRight size={16} />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {alertsError && <ErrorNote error={alertsError} onRetry={loadAlerts} />}

            <section>
                <h2 className="sr-only">Your numbers</h2>
                {statsLoading ? (
                    <Spinner label="Loading your stats" />
                ) : statsError ? (
                    <ErrorNote error={statsError} onRetry={loadStats} />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatTile
                            label="Available batches"
                            value={num(stats?.available_batches)}
                            icon={Package}
                            tone="info"
                        />
                        <StatTile
                            label="Processed"
                            value={num(stats?.processed_kg).toFixed(1)}
                            unit="kg"
                            icon={Recycle}
                            tone="brand"
                        />
                        <StatTile
                            label="Capacity"
                            value={num(stats?.capacity_kg).toFixed(1)}
                            unit="kg"
                            icon={Gauge}
                            tone="warn"
                        />
                        <StatTile
                            label="Earnings"
                            value={`₹${num(stats?.earnings).toLocaleString("en-IN")}`}
                            icon={IndianRupee}
                            tone="brand"
                        />
                    </div>
                )}
            </section>

            <Card>
                <CardHeader
                    title="New nearby requests"
                    subtitle="Refreshes every few seconds"
                    action={
                        <Link to="/app/queue">
                            <Button variant="ghost" size="sm">
                                See all
                                <ArrowRight size={16} />
                            </Button>
                        </Link>
                    }
                />

                {feedError && (
                    <div className="px-5 pt-4">
                        <ErrorNote error={feedError} onRetry={loadFeed} />
                    </div>
                )}

                {feedLoading && !feedError ? (
                    <Spinner label="Looking for nearby waste" />
                ) : preview.length === 0 && !feedError ? (
                    <EmptyState
                        icon={Inbox}
                        title="Nothing waiting right now"
                        description="New requests from households near you will appear here automatically."
                    />
                ) : (
                    <ul className="divide-y divide-ink-100">
                        {preview.map((item) => (
                            <li
                                key={item.id}
                                className={cx(
                                    "flex items-start gap-3 px-5 py-4",
                                    item.escalated && "escalated-row"
                                )}
                            >
                                <span className="text-2xl" aria-hidden="true">
                                    {CATEGORY_ICONS[item.category] || CATEGORY_ICONS.mixed}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-ink-900">
                                            {item.waste_type || item.category || "Waste"}
                                        </p>
                                        <Badge tone="neutral">{num(item.quantity_kg).toFixed(1)} kg</Badge>
                                        {item.escalated && <Badge tone="danger">Escalated</Badge>}
                                    </div>
                                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
                                        <span className="inline-flex items-center gap-1">
                                            <MapPin size={14} />
                                            {distanceLabel(item.distance_km)}
                                        </span>
                                        {item.location && <span className="truncate">· {item.location}</span>}
                                    </p>
                                </div>
                                <span className="shrink-0 text-xs text-ink-400">{timeAgo(item.created_at)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
