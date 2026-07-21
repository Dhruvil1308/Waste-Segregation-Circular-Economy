import { useCallback, useEffect, useRef, useState } from "react";
import { Inbox, MapPin, Truck, User } from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, CardHeader, CATEGORY_ICONS, cx, EmptyState, ErrorNote, Spinner, timeAgo,
} from "../../components/ui";

const POLL_MS = 5000;

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const distanceLabel = (km) =>
    km === null || km === undefined || !Number.isFinite(Number(km))
        ? "distance unknown"
        : `${Number(km).toFixed(1)} km away`;

/**
 * The API already returns nearest-first; this only pushes requests with no distance
 * to the bottom while leaving the server's ordering untouched.
 */
const withUnknownDistanceLast = (list) =>
    [...list].sort((a, b) => {
        const aKnown = Number.isFinite(Number(a?.distance_km));
        const bKnown = Number.isFinite(Number(b?.distance_km));
        if (aKnown === bKnown) return 0;
        return aKnown ? -1 : 1;
    });

export default function CollectorQueue() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [acceptError, setAcceptError] = useState(null);
    const [acceptingId, setAcceptingId] = useState(null);

    /** Ids removed optimistically, so the 5s poll cannot resurrect a row mid-accept. */
    const pendingRemovals = useRef(new Set());

    const load = useCallback(async () => {
        try {
            const data = await api.getNearbyRequests();
            const list = Array.isArray(data) ? data : [];
            setItems(withUnknownDistanceLast(list.filter((item) => !pendingRemovals.current.has(item.id))));
            setLoadError(null);
        } catch (err) {
            setLoadError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const tick = () => {
            if (!cancelled) load();
        };
        tick();
        const id = setInterval(tick, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [load]);

    const accept = async (item) => {
        setAcceptError(null);
        setAcceptingId(item.id);
        // Optimistic: the row disappears immediately so two taps cannot double-accept.
        pendingRemovals.current.add(item.id);
        setItems((current) => current.filter((row) => row.id !== item.id));

        try {
            await api.acceptRequest(item.id, null);
        } catch (err) {
            // Someone else got there first (a 400) or the network failed — put the row back.
            pendingRemovals.current.delete(item.id);
            setAcceptError(err);
        } finally {
            setAcceptingId(null);
            await load();
        }
    };

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-ink-900">Nearby queue</h1>
                <p className="mt-1 text-sm text-ink-500">
                    Households waiting for a collection, nearest first. Updates automatically.
                </p>
            </header>

            {acceptError && <ErrorNote error={acceptError} onRetry={load} />}
            {loadError && <ErrorNote error={loadError} onRetry={load} />}

            {loading && !loadError ? (
                <Spinner label="Loading the queue" />
            ) : items.length === 0 && !loadError ? (
                <Card>
                    <EmptyState
                        icon={Inbox}
                        title="The queue is clear"
                        description="No unaccepted requests near you right now. New ones appear here on their own."
                    />
                </Card>
            ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                    {items.map((item) => (
                        <li key={item.id}>
                            <Card className={cx("h-full overflow-hidden", item.escalated && "escalated-row")}>
                                <CardHeader
                                    title={
                                        <span className="flex items-center gap-2">
                                            <span aria-hidden="true">
                                                {CATEGORY_ICONS[item.category] || CATEGORY_ICONS.mixed}
                                            </span>
                                            {item.waste_type || item.category || "Waste"}
                                        </span>
                                    }
                                    subtitle={`${num(item.quantity_kg).toFixed(1)} kg · ${item.category || "mixed"}`}
                                    action={item.escalated ? <Badge tone="danger">Escalated</Badge> : null}
                                />

                                <div className="flex gap-4 px-5 py-4">
                                    {item.image_url && (
                                        <img
                                            src={item.image_url}
                                            alt={`Waste for request ${item.id}`}
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
                                        <div className="flex items-center gap-2 text-ink-600">
                                            <dt className="sr-only">Distance</dt>
                                            <Truck size={14} className="shrink-0 text-ink-400" />
                                            <dd
                                                className={cx(
                                                    "font-semibold",
                                                    Number.isFinite(Number(item.distance_km))
                                                        ? "text-ink-800"
                                                        : "text-ink-400"
                                                )}
                                            >
                                                {distanceLabel(item.distance_km)}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>

                                <div className="flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-3">
                                    <span className="text-xs text-ink-400">
                                        Requested {timeAgo(item.created_at) || "recently"}
                                    </span>
                                    <Button
                                        onClick={() => accept(item)}
                                        loading={acceptingId === item.id}
                                        disabled={acceptingId === item.id}
                                    >
                                        Accept pickup
                                    </Button>
                                </div>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
