import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquareWarning, CheckCircle2, Eye, Inbox, Clock } from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, EmptyState, ErrorNote, Field, Modal, Spinner, Textarea,
    cx, timeAgo, CATEGORY_ICONS,
} from "../../components/ui";

const FILTERS = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "acknowledged", label: "Acknowledged" },
    { value: "resolved", label: "Resolved" },
];

const STATUS_TONE = { open: "warn", acknowledged: "info", resolved: "brand" };
const STATUS_LABEL = { open: "Open", acknowledged: "Acknowledged", resolved: "Resolved" };

export default function Complaints() {
    const [filter, setFilter] = useState("all");
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [busyId, setBusyId] = useState(null);
    const [actionError, setActionError] = useState(null);

    // Resolve modal
    const [resolving, setResolving] = useState(null);
    const [note, setNote] = useState("");
    const [noteError, setNoteError] = useState("");
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState(null);

    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const load = useCallback(async (status) => {
        setLoading(true);
        try {
            const data = await api.getAllTickets(status === "all" ? undefined : status);
            if (!alive.current) return;
            setTickets(data || []);
            setError(null);
        } catch (err) {
            if (alive.current) setError(err);
        } finally {
            if (alive.current) setLoading(false);
        }
    }, []);

    useEffect(() => { load(filter); }, [load, filter]);

    const acknowledge = async (ticket) => {
        setBusyId(ticket.id);
        setActionError(null);
        try {
            await api.updateTicket(ticket.id, { status: "acknowledged" });
            if (!alive.current) return;
            await load(filter);
        } catch (err) {
            if (alive.current) setActionError(err);
        } finally {
            if (alive.current) setBusyId(null);
        }
    };

    const openResolve = (ticket) => {
        setResolving(ticket);
        setNote(ticket.resolution_note || "");
        setNoteError("");
        setModalError(null);
    };

    const closeResolve = () => {
        setResolving(null);
        setNote("");
        setNoteError("");
        setModalError(null);
    };

    const submitResolve = async () => {
        if (!resolving) return;
        if (!note.trim()) {
            setNoteError("Tell the generator what was done — this note is sent to them.");
            return;
        }
        setSaving(true);
        setModalError(null);
        try {
            await api.updateTicket(resolving.id, { status: "resolved", resolution_note: note.trim() });
            if (!alive.current) return;
            closeResolve();
            await load(filter);
        } catch (err) {
            if (alive.current) setModalError(err);
        } finally {
            if (alive.current) setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-900">
                    <MessageSquareWarning size={24} className="text-brand-600" />
                    Complaints
                </h1>
                <p className="mt-1 text-sm text-ink-500">
                    Every complaint raised by generators. Escalated ones sort to the top.
                </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter complaints by status">
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
            {actionError && <ErrorNote error={actionError} />}

            {loading ? (
                <Spinner label="Loading complaints" />
            ) : tickets.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={Inbox}
                        title="No complaints here"
                        description={
                            filter === "all"
                                ? "Nobody has raised a complaint yet."
                                : `No complaint is currently ${filter}.`
                        }
                    />
                </Card>
            ) : (
                <ul className="space-y-4">
                    {tickets.map((ticket) => (
                        <li key={ticket.id}>
                            <Card className={cx("p-5", ticket.escalated && "escalated-row animate-alert")}>
                                <div className="flex flex-col gap-4 sm:flex-row">
                                    {ticket.image_url && (
                                        <a
                                            href={ticket.image_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="shrink-0"
                                            aria-label={`Open the photo attached to "${ticket.subject}" in a new tab`}
                                        >
                                            <img
                                                src={ticket.image_url}
                                                alt={`Attached to complaint: ${ticket.subject}`}
                                                className="h-24 w-24 rounded-xl object-cover ring-1 ring-ink-200"
                                            />
                                        </a>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-bold text-ink-900">{ticket.subject}</h2>
                                            <Badge tone={STATUS_TONE[ticket.status] || "neutral"}>
                                                {STATUS_LABEL[ticket.status] || ticket.status}
                                            </Badge>
                                            {ticket.escalated && <Badge tone="danger">Escalated</Badge>}
                                            {ticket.category && (
                                                <Badge tone="neutral">
                                                    <span aria-hidden="true">
                                                        {CATEGORY_ICONS[ticket.category] || CATEGORY_ICONS.mixed}
                                                    </span>
                                                    <span className="capitalize">{ticket.category}</span>
                                                </Badge>
                                            )}
                                        </div>

                                        <p className="mt-1 text-sm text-ink-500">
                                            Raised by{" "}
                                            <span className="font-semibold text-ink-700">
                                                {ticket.generator_name || `Generator #${ticket.generator_id}`}
                                            </span>
                                            {ticket.listing_id ? ` · request #${ticket.listing_id}` : ""}
                                        </p>

                                        {ticket.description && (
                                            <p className="mt-2 whitespace-pre-line text-sm text-ink-700">
                                                {ticket.description}
                                            </p>
                                        )}

                                        {ticket.resolution_note && (
                                            <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
                                                <span className="font-semibold">Resolution: </span>
                                                {ticket.resolution_note}
                                            </p>
                                        )}

                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                            <span className="flex items-center gap-1.5 text-xs text-ink-400">
                                                <Clock size={13} />
                                                Raised {timeAgo(ticket.created_at)}
                                                {ticket.resolved_at && ` · resolved ${timeAgo(ticket.resolved_at)}`}
                                            </span>

                                            <div className="flex flex-wrap gap-2">
                                                {ticket.status === "open" && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => acknowledge(ticket)}
                                                        loading={busyId === ticket.id}
                                                    >
                                                        {busyId !== ticket.id && <Eye size={16} />}
                                                        Acknowledge
                                                    </Button>
                                                )}
                                                {ticket.status !== "resolved" && (
                                                    <Button size="sm" onClick={() => openResolve(ticket)}>
                                                        <CheckCircle2 size={16} />
                                                        Resolve
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            <Modal
                open={Boolean(resolving)}
                onClose={closeResolve}
                title={resolving ? `Resolve: ${resolving.subject}` : "Resolve complaint"}
                footer={
                    <>
                        <Button variant="secondary" onClick={closeResolve} disabled={saving}>Cancel</Button>
                        <Button onClick={submitResolve} loading={saving}>Mark resolved</Button>
                    </>
                }
            >
                {modalError && (
                    <div className="mb-4">
                        <ErrorNote error={modalError} />
                    </div>
                )}

                <Field
                    label="Resolution note"
                    hint="Sent to the generator as a notification."
                    error={noteError}
                >
                    <Textarea
                        value={note}
                        onChange={(e) => {
                            setNote(e.target.value);
                            if (noteError) setNoteError("");
                        }}
                        placeholder="e.g. The missed pickup was collected on Tuesday and the team was briefed."
                    />
                </Field>
            </Modal>
        </div>
    );
}
