import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ExternalLink, MapPin, PackageOpen, PlusCircle, QrCode } from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, CardHeader, CATEGORY_ICONS, cx, EmptyState, ErrorNote,
    Field, Modal, Select, Spinner, StatusPill, STATUS_LABELS, timeAgo,
} from "../../components/ui";

const STATUSES = Object.keys(STATUS_LABELS);

/** The generator can still confirm by hand while the pickup is in flight. */
const canConfirm = (status) => status === "accepted" || status === "en_route";

const fmt = (value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? String(Number(n.toFixed(1))) : "0";
};

export default function MyRequests() {
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("all");

    // Row-level action state, kept apart from the list load so a failed confirm
    // never blanks the table.
    const [actionError, setActionError] = useState(null);
    const [confirmingId, setConfirmingId] = useState(null);

    // QR modal
    const [qrFor, setQrFor] = useState(null);
    const [qr, setQr] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState(null);

    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    const load = useCallback(async () => {
        try {
            const rows = await api.getMyRequests();
            if (!aliveRef.current) return;
            setRequests(Array.isArray(rows) ? rows : []);
            setError(null);
        } catch (err) {
            if (aliveRef.current) setError(err);
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openQr = async (request) => {
        setQrFor(request);
        setQr(null);
        setQrError(null);
        setQrLoading(true);
        try {
            const data = await api.getQr(request.id);
            if (!aliveRef.current) return;
            setQr(data);
        } catch (err) {
            if (aliveRef.current) setQrError(err);
        } finally {
            if (aliveRef.current) setQrLoading(false);
        }
    };

    const closeQr = () => {
        setQrFor(null);
        setQr(null);
        setQrError(null);
        // A collector may have scanned while the modal was open.
        load();
    };

    const confirm = async (request) => {
        setActionError(null);
        setConfirmingId(request.id);
        try {
            await api.confirmPickup(request.id);
            await load();
        } catch (err) {
            if (aliveRef.current) setActionError(err);
        } finally {
            if (aliveRef.current) setConfirmingId(null);
        }
    };

    // Newest first. `created_at` is a naive UTC string, so plain string compare
    // would break across formats — parse it.
    const sorted = [...requests].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    const visible = filter === "all" ? sorted : sorted.filter((r) => r.status === filter);

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ink-900">My requests</h1>
                    <p className="mt-1 text-sm text-ink-500">Every pickup you have raised, newest first.</p>
                </div>
                <Button onClick={() => navigate("/app/new")} className="w-full sm:w-auto">
                    <PlusCircle size={18} />
                    Request a pickup
                </Button>
            </header>

            {actionError && <ErrorNote error={actionError} />}

            <Card>
                <CardHeader
                    title={`${visible.length} request${visible.length === 1 ? "" : "s"}`}
                    subtitle="Show the QR at handover, or confirm by hand if scanning fails"
                    action={
                        <div className="w-44">
                            <Field label="Status">
                                <Select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    aria-label="Filter requests by status"
                                >
                                    <option value="all">All statuses</option>
                                    {STATUSES.map((s) => (
                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                    ))}
                                </Select>
                            </Field>
                        </div>
                    }
                />

                {error && (
                    <div className="px-5 pt-4">
                        <ErrorNote error={error} onRetry={() => { setLoading(true); load(); }} />
                    </div>
                )}

                {loading ? (
                    <Spinner label="Loading your requests" />
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={PackageOpen}
                        title={filter === "all" ? "No requests yet" : "Nothing with that status"}
                        description={
                            filter === "all"
                                ? "Your pickup requests will appear here once you raise one."
                                : "Try a different status filter to see your other requests."
                        }
                        action={
                            filter === "all" ? (
                                <Button onClick={() => navigate("/app/new")}>
                                    <PlusCircle size={16} />
                                    Request a pickup
                                </Button>
                            ) : (
                                <Button variant="secondary" onClick={() => setFilter("all")}>
                                    Show all
                                </Button>
                            )
                        }
                    />
                ) : (
                    <ul className="divide-y divide-ink-100">
                        {visible.map((r) => (
                            <li
                                key={r.id}
                                className={cx(
                                    "flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between",
                                    r.escalated && "escalated-row"
                                )}
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className="text-2xl" aria-hidden="true">
                                        {CATEGORY_ICONS[r.category] || CATEGORY_ICONS.mixed}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold capitalize text-ink-900">
                                                {r.waste_type || r.category}
                                            </p>
                                            <span className="text-sm text-ink-500">{fmt(r.quantity_kg)} kg</span>
                                            {r.escalated && <Badge tone="danger">Escalated</Badge>}
                                        </div>
                                        <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                                            <MapPin size={14} className="shrink-0" />
                                            <span className="truncate">{r.location || "No address given"}</span>
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <StatusPill status={r.status} />
                                            <span className="text-xs text-ink-400">{timeAgo(r.created_at)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                                    <Button variant="secondary" size="sm" onClick={() => openQr(r)}>
                                        <QrCode size={16} />
                                        Show QR
                                    </Button>
                                    {canConfirm(r.status) && (
                                        <Button
                                            size="sm"
                                            loading={confirmingId === r.id}
                                            disabled={confirmingId !== null && confirmingId !== r.id}
                                            onClick={() => confirm(r)}
                                        >
                                            <CheckCircle2 size={16} />
                                            Confirm pickup
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Modal
                open={qrFor !== null}
                onClose={closeQr}
                title={qrFor ? `Handover code · request #${qrFor.id}` : "Handover code"}
                footer={<Button variant="secondary" onClick={closeQr}>Close</Button>}
            >
                <div className="space-y-4">
                    <p className="text-sm text-ink-600">
                        Show this code to the collection team at handover. They scan it to record
                        that the waste has changed hands — no paperwork, no disputes.
                    </p>

                    {qrLoading && <Spinner label="Generating your code" />}

                    {qrError && !qrLoading && (
                        <ErrorNote error={qrError} onRetry={() => qrFor && openQr(qrFor)} />
                    )}

                    {qr && !qrLoading && (
                        <>
                            <div
                                className="mx-auto grid w-full max-w-56 place-items-center rounded-xl bg-white p-4 ring-1 ring-ink-200 [&_svg]:h-auto [&_svg]:w-full"
                                /* The backend returns a self-contained SVG string for this listing. */
                                dangerouslySetInnerHTML={{ __html: qr.svg }}
                            />

                            <div>
                                <p className="mb-1 text-sm font-semibold text-ink-700">Tracking code</p>
                                <p className="select-all break-all rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm text-ink-800 ring-1 ring-inset ring-ink-200">
                                    {qr.qr_token}
                                </p>
                                <p className="mt-1 text-xs text-ink-400">
                                    Read it out if the camera will not focus.
                                </p>
                            </div>

                            <Link
                                to={`/track/${qr.qr_token}`}
                                className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-brand-700 hover:underline"
                            >
                                <ExternalLink size={16} />
                                Track this pickup
                            </Link>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
}
