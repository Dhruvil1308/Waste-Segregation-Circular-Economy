import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    Users, Truck, ListChecks, Inbox, Scale, ShieldAlert,
    MessageSquareWarning, RefreshCw, ArrowRight, CheckCircle2,
} from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, CardHeader, EmptyState, ErrorNote, Spinner, StatTile,
    cx, timeAgo, CATEGORY_ICONS,
} from "../../components/ui";

/** The overview is a live picture of the community, so it refreshes on its own. */
const POLL_MS = 10000;

export default function Dashboard() {
    const [overview, setOverview] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [rechecking, setRechecking] = useState(false);
    const [recheckError, setRecheckError] = useState(null);
    const [recheckNote, setRecheckNote] = useState("");

    // Guards against writing state after the page has gone away.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const load = useCallback(async (silent) => {
        if (!silent) setLoading(true);
        try {
            const [nextOverview, nextAlerts] = await Promise.all([
                api.getAdminOverview(),
                api.getAlerts(),
            ]);
            if (!alive.current) return;
            setOverview(nextOverview);
            setAlerts(nextAlerts || []);
            setError(null);
        } catch (err) {
            // A failing poll is still a failure the admin needs to see.
            if (alive.current) setError(err);
        } finally {
            if (alive.current && !silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(false);
        const id = setInterval(() => load(true), POLL_MS);
        return () => clearInterval(id);
    }, [load]);

    const recheck = async () => {
        setRechecking(true);
        setRecheckError(null);
        setRecheckNote("");
        try {
            const result = await api.recheckEscalations();
            if (!alive.current) return;
            setRecheckNote(
                `Checked ${result?.checked ?? 0} generator(s) · ${result?.escalated_generators?.length ?? 0} still escalated.`
            );
            await load(true);
        } catch (err) {
            if (alive.current) setRecheckError(err);
        } finally {
            if (alive.current) setRechecking(false);
        }
    };

    if (loading) return <Spinner label="Loading the community overview" />;

    const topAlerts = alerts.slice(0, 5);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-ink-900">Community overview</h1>
                    <p className="mt-1 text-sm text-ink-500">
                        Refreshes every {POLL_MS / 1000} seconds.
                    </p>
                </div>
                <Button variant="secondary" onClick={recheck} loading={rechecking}>
                    {!rechecking && <RefreshCw size={16} />}
                    Recheck escalations
                </Button>
            </div>

            {error && <ErrorNote error={error} onRetry={() => load(false)} />}
            {recheckError && <ErrorNote error={recheckError} onRetry={recheck} />}

            {recheckNote && (
                <div className="flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-inset ring-brand-200">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-600" />
                    <p className="text-sm text-brand-800">{recheckNote}</p>
                </div>
            )}

            {overview && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile label="Generators" value={overview.total_generators ?? 0} icon={Users} tone="brand" />
                    <StatTile label="Collection teams" value={overview.total_collectors ?? 0} icon={Truck} tone="info" />
                    <StatTile label="Total requests" value={overview.total_requests ?? 0} icon={ListChecks} tone="brand" />
                    <StatTile label="Open requests" value={overview.open_requests ?? 0} icon={Inbox} tone="info" />
                    <StatTile label="Escalated requests" value={overview.escalated_requests ?? 0} icon={ShieldAlert} tone="danger" />
                    <StatTile label="Open complaints" value={overview.open_tickets ?? 0} icon={MessageSquareWarning} tone="warn" />
                    <StatTile label="Escalated complaints" value={overview.escalated_tickets ?? 0} icon={ShieldAlert} tone="danger" />
                    <StatTile label="Waste collected" value={overview.collected_kg ?? 0} unit="kg" icon={Scale} tone="brand" />
                </div>
            )}

            <Card className={cx(alerts.length > 0 && "escalated-row")}>
                <CardHeader
                    title="Escalation alerts"
                    subtitle="Requests from generators nobody has answered yet."
                    action={
                        <Link
                            to="/app/alerts"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                            View all
                            <ArrowRight size={16} />
                        </Link>
                    }
                />

                {alerts.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="Nothing is escalated"
                        description="Every generator has had their requests answered."
                    />
                ) : (
                    <ul className="divide-y divide-red-200/70">
                        {topAlerts.map((item) => (
                            <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                                <span className="text-2xl" aria-hidden="true">
                                    {CATEGORY_ICONS[item.category] || CATEGORY_ICONS.mixed}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold text-ink-900">
                                        {item.generator_name || `Request #${item.id}`}
                                    </p>
                                    <p className="truncate text-sm text-ink-600">
                                        {item.waste_type}
                                        {item.quantity_kg ? ` · ${item.quantity_kg} kg` : ""} · {item.location}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-xs font-medium text-ink-500">
                                        waiting {timeAgo(item.created_at)}
                                    </span>
                                    <Badge tone="danger">Escalated</Badge>
                                </div>
                            </li>
                        ))}
                        {alerts.length > topAlerts.length && (
                            <li className="px-5 py-3 text-sm font-semibold text-red-700">
                                <Link to="/app/alerts" className="hover:underline">
                                    +{alerts.length - topAlerts.length} more waiting for a collector
                                </Link>
                            </li>
                        )}
                    </ul>
                )}
            </Card>
        </div>
    );
}
