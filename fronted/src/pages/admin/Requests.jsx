import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, MapPin, Inbox } from "lucide-react";

import api from "../../api";
import {
    Badge, Card, EmptyState, ErrorNote, Spinner, StatusPill,
    cx, timeAgo, STATUS_LABELS, CATEGORY_ICONS,
} from "../../components/ui";

const FILTERS = [
    { value: "all", label: "All" },
    { value: "requested", label: STATUS_LABELS.requested },
    { value: "accepted", label: STATUS_LABELS.accepted },
    { value: "en_route", label: STATUS_LABELS.en_route },
    { value: "collected", label: STATUS_LABELS.collected },
    { value: "processed", label: STATUS_LABELS.processed },
];

export default function Requests() {
    const [filter, setFilter] = useState("all");
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const load = useCallback(async (status) => {
        setLoading(true);
        try {
            const data = await api.getAdminRequests(status === "all" ? undefined : status);
            if (!alive.current) return;
            setRequests(data || []);
            setError(null);
        } catch (err) {
            if (alive.current) setError(err);
        } finally {
            if (alive.current) setLoading(false);
        }
    }, []);

    useEffect(() => { load(filter); }, [load, filter]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-900">
                    <ListChecks size={24} className="text-brand-600" />
                    All requests
                </h1>
                <p className="mt-1 text-sm text-ink-500">Every pickup raised in the community, newest first.</p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter requests by status">
                {FILTERS.map(({ value, label }) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        aria-pressed={filter === value}
                        className={cx(
                            "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                            filter === value
                                ? "bg-brand-600 text-white"
                                : "bg-white text-ink-600 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {error && <ErrorNote error={error} onRetry={() => load(filter)} />}

            {loading ? (
                <Spinner label="Loading requests" />
            ) : requests.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={Inbox}
                        title="No requests here"
                        description={
                            filter === "all"
                                ? "Nobody has raised a pickup yet."
                                : `No request is currently "${STATUS_LABELS[filter] || filter}".`
                        }
                    />
                </Card>
            ) : (
                <>
                    {/* Mobile: one card per request */}
                    <ul className="space-y-3 md:hidden">
                        {requests.map((item) => (
                            <li key={item.id}>
                                <Card className={cx("p-4", item.escalated && "escalated-row")}>
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl" aria-hidden="true">
                                            {CATEGORY_ICONS[item.category] || CATEGORY_ICONS.mixed}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-ink-900">
                                                    {item.generator_name || `Generator #${item.user_id}`}
                                                </p>
                                                {item.escalated && <Badge tone="danger">Escalated</Badge>}
                                            </div>
                                            <p className="mt-0.5 text-sm capitalize text-ink-600">
                                                {item.category || "uncategorised"} · {item.waste_type}
                                                {item.quantity_kg ? ` · ${item.quantity_kg} kg` : ""}
                                            </p>
                                            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                                                <MapPin size={14} className="shrink-0 text-ink-400" />
                                                <span className="truncate">{item.location}</span>
                                            </p>
                                            <div className="mt-2 flex items-center justify-between gap-2">
                                                <StatusPill status={item.status} />
                                                <span className="text-xs text-ink-400">{timeAgo(item.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </li>
                        ))}
                    </ul>

                    {/* Desktop: a table that scrolls inside its own box, never the page */}
                    <Card className="hidden overflow-hidden md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
                                    <tr>
                                        <th scope="col" className="px-5 py-3 font-semibold">Generator</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Category</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Quantity</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Location</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Raised</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ink-100">
                                    {requests.map((item) => (
                                        <tr key={item.id} className={cx(item.escalated && "escalated-row")}>
                                            {/* A ring is a box-shadow and collapsed table rows drop it,
                                                so escalation also gets a border the row cannot lose. */}
                                            <td className={cx("px-5 py-3", item.escalated && "border-l-4 border-l-red-500")}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-ink-900">
                                                        {item.generator_name || `Generator #${item.user_id}`}
                                                    </span>
                                                    {item.escalated && <Badge tone="danger">Escalated</Badge>}
                                                </div>
                                                <span className="text-xs text-ink-400">#{item.id}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="mr-1.5" aria-hidden="true">
                                                    {CATEGORY_ICONS[item.category] || CATEGORY_ICONS.mixed}
                                                </span>
                                                <span className="capitalize text-ink-700">
                                                    {item.category || item.waste_type}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink-700">
                                                {item.quantity_kg != null ? `${item.quantity_kg} kg` : "—"}
                                            </td>
                                            <td className="max-w-[16rem] truncate px-5 py-3 text-ink-600" title={item.location}>
                                                {item.location}
                                            </td>
                                            <td className="px-5 py-3">
                                                <StatusPill status={item.status} />
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3 text-ink-500">
                                                {timeAgo(item.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}
