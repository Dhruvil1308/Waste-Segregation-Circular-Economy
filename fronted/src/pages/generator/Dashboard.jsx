import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Coins, Leaf, MapPin, PackageOpen, PlusCircle, Recycle } from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, CardHeader, CATEGORY_ICONS, cx, EmptyState, ErrorNote,
    Spinner, StatTile, StatusPill, timeAgo,
} from "../../components/ui";

/** A collector accepting should show up without a manual refresh. */
const POLL_MS = 5000;

/** Anything not yet collected is still the generator's business. */
const isActive = (r) => r.status !== "collected" && r.status !== "processed";

/** Trims trailing zeros so "12.0" reads as "12" but "12.4" keeps its detail. */
const fmt = (value, digits = 1) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "0";
    return String(Number(n.toFixed(digits)));
};

export default function Dashboard({ user }) {
    const navigate = useNavigate();
    const [name, setName] = useState(user?.name || localStorage.getItem("user_name") || "");
    const [stats, setStats] = useState(null);
    const [statsError, setStatsError] = useState(null);
    const [requests, setRequests] = useState([]);
    const [listError, setListError] = useState(null);
    const [loading, setLoading] = useState(true);

    // Guards every setState after an await so a fast unmount can't warn or leak.
    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    useEffect(() => {
        if (user?.name) { setName(user.name); return; }
        let alive = true;
        (async () => {
            try {
                const me = await api.getMe();
                if (alive && me?.name) setName(me.name);
            } catch {
                // The greeting is cosmetic; a missing name must not block the dashboard.
            }
        })();
        return () => { alive = false; };
    }, [user?.name]);

    const loadStats = useCallback(async () => {
        try {
            const [impact, wallet] = await Promise.all([api.getMyImpact(), api.getWallet()]);
            if (!aliveRef.current) return;
            setStats({ ...impact, balance: wallet?.balance ?? 0 });
            setStatsError(null);
        } catch (err) {
            if (aliveRef.current) setStatsError(err);
        }
    }, []);

    /** `silent` keeps the poll from flashing the spinner over a list already on screen. */
    const loadRequests = useCallback(async (silent = false) => {
        try {
            const rows = await api.getMyRequests();
            if (!aliveRef.current) return;
            setRequests(Array.isArray(rows) ? rows : []);
            setListError(null);
        } catch (err) {
            if (aliveRef.current) setListError(err);
        } finally {
            if (aliveRef.current && !silent) setLoading(false);
        }
    }, []);

    useEffect(() => { loadStats(); }, [loadStats]);

    useEffect(() => {
        loadRequests();
        const id = setInterval(() => loadRequests(true), POLL_MS);
        return () => clearInterval(id);
    }, [loadRequests]);

    const active = requests.filter(isActive);

    const retry = () => {
        setLoading(true);
        loadStats();
        loadRequests();
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ink-900">
                        Hello{name ? `, ${name}` : ""} 👋
                    </h1>
                    <p className="mt-1 text-sm text-ink-500">
                        Here is what your waste is doing for the neighbourhood.
                    </p>
                </div>
                <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate("/app/new")}>
                    <PlusCircle size={18} />
                    Request a pickup
                </Button>
            </header>

            {statsError && <ErrorNote error={statsError} onRetry={loadStats} />}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatTile
                    label="Total waste given"
                    value={fmt(stats?.total_waste_kg)}
                    unit="kg"
                    icon={Recycle}
                    tone="brand"
                />
                <StatTile
                    label="CO₂ saved"
                    value={fmt(stats?.total_co2_saved)}
                    unit="kg"
                    icon={Leaf}
                    tone="info"
                />
                <StatTile
                    label="Green credits"
                    value={fmt(stats?.balance, 0)}
                    icon={Coins}
                    tone="warn"
                />
            </div>

            <Card>
                <CardHeader
                    title="Active pickups"
                    subtitle="Updates live as collectors respond"
                    action={
                        <Link
                            to="/app/requests"
                            className="rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                        >
                            View all
                        </Link>
                    }
                />

                {listError && (
                    <div className="px-5 pt-4">
                        <ErrorNote error={listError} onRetry={() => loadRequests()} />
                    </div>
                )}

                {loading ? (
                    <Spinner label="Loading your pickups" />
                ) : active.length === 0 ? (
                    <EmptyState
                        icon={PackageOpen}
                        title="No pickups in progress"
                        description="Snap a photo of your waste and a nearby collection team will pick it up."
                        action={
                            <Link
                                to="/app/new"
                                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                            >
                                <PlusCircle size={16} />
                                Request a pickup
                            </Link>
                        }
                    />
                ) : (
                    <ul className="divide-y divide-ink-100">
                        {active.map((r) => (
                            <li
                                key={r.id}
                                className={cx(
                                    "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
                                    r.escalated && "escalated-row"
                                )}
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className="text-2xl" aria-hidden="true">
                                        {CATEGORY_ICONS[r.category] || CATEGORY_ICONS.mixed}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold capitalize text-ink-900">
                                            {r.waste_type || r.category}
                                            <span className="ml-2 font-normal text-ink-500">
                                                {fmt(r.quantity_kg)} kg
                                            </span>
                                        </p>
                                        <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                                            <MapPin size={14} className="shrink-0" />
                                            <span className="truncate">{r.location || "No address given"}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                                    {r.escalated && <Badge tone="danger">Escalated</Badge>}
                                    <StatusPill status={r.status} />
                                    <span className="text-xs text-ink-400">{timeAgo(r.created_at)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {!loading && listError && requests.length === 0 && (
                <div className="flex justify-center">
                    <Button variant="secondary" onClick={retry}>Try again</Button>
                </div>
            )}
        </div>
    );
}
