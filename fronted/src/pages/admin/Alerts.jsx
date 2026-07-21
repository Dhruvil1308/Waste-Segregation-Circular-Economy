import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert, MapPin, Clock, UserCheck, CheckCircle2, Truck } from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, EmptyState, ErrorNote, Modal, Spinner,
    cx, timeAgo, CATEGORY_ICONS,
} from "../../components/ui";

/**
 * The escalation screen. Everything here is a generator the community has failed
 * to answer at least three times, so the styling is deliberately loud.
 */
export default function Alerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Assignment modal
    const [target, setTarget] = useState(null);
    const [collectors, setCollectors] = useState([]);
    const [collectorsLoading, setCollectorsLoading] = useState(false);
    const [collectorsError, setCollectorsError] = useState(null);
    const [assigningId, setAssigningId] = useState(null);
    const [assignError, setAssignError] = useState(null);

    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getAlerts();
            if (!alive.current) return;
            setAlerts(data || []);
            setError(null);
        } catch (err) {
            if (alive.current) setError(err);
        } finally {
            if (alive.current) setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openAssign = async (request) => {
        setTarget(request);
        setAssignError(null);
        setCollectorsError(null);
        setCollectorsLoading(true);
        try {
            const data = await api.getAdminUsers("collector");
            if (!alive.current) return;
            setCollectors(data || []);
        } catch (err) {
            if (alive.current) setCollectorsError(err);
        } finally {
            if (alive.current) setCollectorsLoading(false);
        }
    };

    const closeAssign = () => {
        setTarget(null);
        setAssignError(null);
        setAssigningId(null);
    };

    const assign = async (collectorId) => {
        if (!target) return;
        setAssigningId(collectorId);
        setAssignError(null);
        try {
            await api.assignCollector(target.id, collectorId);
            if (!alive.current) return;
            closeAssign();
            await load();
        } catch (err) {
            if (alive.current) setAssignError(err);
        } finally {
            if (alive.current) setAssigningId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-900">
                    <ShieldAlert size={24} className="text-red-600" />
                    Escalation alerts
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-ink-600">
                    These pickups belong to generators who raised{" "}
                    <strong className="font-semibold text-ink-800">three or more requests that no collector answered</strong>.
                    They are escalated to you so somebody is accountable for them. Assign a collection team to clear an
                    escalation.
                </p>
            </div>

            {error && <ErrorNote error={error} onRetry={load} />}

            {loading ? (
                <Spinner label="Loading escalations" />
            ) : alerts.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={CheckCircle2}
                        title="No escalations right now"
                        description="Every generator has had their requests picked up or accepted."
                    />
                </Card>
            ) : (
                <ul className="space-y-4">
                    {alerts.map((item) => (
                        <li key={item.id}>
                            <Card className="escalated-row animate-alert p-5">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                                    <span className="text-3xl" aria-hidden="true">
                                        {CATEGORY_ICONS[item.category] || CATEGORY_ICONS.mixed}
                                    </span>

                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-bold text-ink-900">
                                                {item.generator_name || `Generator #${item.user_id}`}
                                            </p>
                                            <Badge tone="danger">Escalated</Badge>
                                            <Badge tone="neutral">Request #{item.id}</Badge>
                                        </div>

                                        <p className="text-sm font-medium capitalize text-ink-700">
                                            {item.category || "uncategorised"} · {item.waste_type}
                                            {item.quantity_kg ? ` · ${item.quantity_kg} kg` : ""}
                                        </p>

                                        <p className="flex items-center gap-1.5 text-sm text-ink-600">
                                            <MapPin size={14} className="shrink-0 text-ink-400" />
                                            <span className="truncate">{item.location}</span>
                                        </p>

                                        <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                                            <Clock size={14} className="shrink-0" />
                                            Waiting {timeAgo(item.created_at)}
                                        </p>
                                    </div>

                                    <div className="shrink-0">
                                        <Button onClick={() => openAssign(item)} className="w-full md:w-auto">
                                            <UserCheck size={16} />
                                            Assign collector
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            <Modal
                open={Boolean(target)}
                onClose={closeAssign}
                title={target ? `Assign request #${target.id}` : "Assign collector"}
                footer={<Button variant="secondary" onClick={closeAssign}>Cancel</Button>}
            >
                {target && (
                    <p className="mb-4 text-sm text-ink-600">
                        {target.generator_name || "This generator"} has been waiting {timeAgo(target.created_at)} at{" "}
                        <span className="font-medium text-ink-800">{target.location}</span>.
                    </p>
                )}

                {assignError && (
                    <div className="mb-4">
                        <ErrorNote error={assignError} />
                    </div>
                )}

                {collectorsError && (
                    <ErrorNote error={collectorsError} onRetry={() => target && openAssign(target)} />
                )}

                {collectorsLoading ? (
                    <Spinner label="Loading collection teams" />
                ) : !collectorsError && collectors.length === 0 ? (
                    <EmptyState
                        icon={Truck}
                        title="No collection teams yet"
                        description="Register a collector before assigning this request."
                    />
                ) : (
                    <ul className="max-h-80 space-y-2 overflow-y-auto">
                        {collectors.map((collector) => (
                            <li key={collector.id}>
                                <div className={cx(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-ink-200",
                                    assigningId === collector.id && "bg-ink-50"
                                )}>
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                                        <Truck size={16} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-ink-900">
                                            {collector.name || collector.username}
                                        </p>
                                        <p className="truncate text-xs text-ink-500">
                                            {collector.location}
                                            {collector.service_radius_km != null && ` · ${collector.service_radius_km} km radius`}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => assign(collector.id)}
                                        loading={assigningId === collector.id}
                                        disabled={assigningId != null && assigningId !== collector.id}
                                    >
                                        Assign
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Modal>
        </div>
    );
}
