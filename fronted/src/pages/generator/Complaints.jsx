import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, MessageSquareWarning, RefreshCw, Sparkles } from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, CardHeader, CATEGORY_ICONS, cx, EmptyState, ErrorNote,
    Field, Input, Select, Spinner, Textarea, timeAgo,
} from "../../components/ui";

const CATEGORIES = Object.keys(CATEGORY_ICONS);

/**
 * Ticket states, mirroring models.Ticket.status (open | acknowledged | resolved).
 * `acknowledged` must not fall through to neutral — grey reads as "closed" to a
 * user whose complaint is actively being worked. Anything unmapped stays neutral.
 */
const TICKET_TONES = {
    open: "warn",
    acknowledged: "info",
    resolved: "brand",
};

const prettyStatus = (status) =>
    String(status || "open").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default function Complaints() {
    // --- Form ---
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [listingId, setListingId] = useState("");
    const [preview, setPreview] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef(null);

    // --- Data ---
    const [tickets, setTickets] = useState([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [ticketsError, setTicketsError] = useState(null);
    const [requests, setRequests] = useState([]);
    const [requestsError, setRequestsError] = useState(null);

    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    // Blob URLs stay allocated until revoked; this cleanup is the only place that frees them.
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const loadTickets = useCallback(async () => {
        try {
            const rows = await api.getMyTickets();
            if (!aliveRef.current) return;
            setTickets(Array.isArray(rows) ? rows : []);
            setTicketsError(null);
        } catch (err) {
            if (aliveRef.current) setTicketsError(err);
        } finally {
            if (aliveRef.current) setTicketsLoading(false);
        }
    }, []);

    const loadRequests = useCallback(async () => {
        try {
            const rows = await api.getMyRequests();
            if (!aliveRef.current) return;
            setRequests(Array.isArray(rows) ? rows : []);
            setRequestsError(null);
        } catch (err) {
            // Linking a request is optional, so this is a notice, not a blocker.
            if (aliveRef.current) setRequestsError(err);
        }
    }, []);

    useEffect(() => { loadTickets(); loadRequests(); }, [loadTickets, loadRequests]);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setPreview(URL.createObjectURL(file));
        setImageUrl(null);
        setAnalyzeError(null);
        setAnalyzing(true);
        try {
            const result = await api.analyzeImage(file);
            if (!aliveRef.current) return;
            setImageUrl(result?.image_url || null);
            if (result?.category) setCategory(result.category);
        } catch (err) {
            if (aliveRef.current) setAnalyzeError(err);
        } finally {
            if (aliveRef.current) setAnalyzing(false);
        }
    };

    const clearPhoto = () => {
        setPreview(null);
        setImageUrl(null);
        setAnalyzeError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const resetForm = () => {
        setSubject("");
        setDescription("");
        setCategory("");
        setListingId("");
        clearPhoto();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitError(null);
        setSuccess(false);

        if (!subject.trim() || !description.trim()) {
            setSubmitError(new Error("Add a subject and a description so the team knows what went wrong."));
            return;
        }

        setSubmitting(true);
        try {
            await api.raiseTicket({
                subject: subject.trim(),
                description: description.trim(),
                listing_id: listingId ? Number(listingId) : null,
                category: category || null,
                // Server-hosted URL from the analysis, never the local blob preview.
                image_url: imageUrl,
            });
            if (!aliveRef.current) return;
            resetForm();
            setSuccess(true);
            await loadTickets();
        } catch (err) {
            if (aliveRef.current) setSubmitError(err);
        } finally {
            if (aliveRef.current) setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-ink-900">Complaints</h1>
                <p className="mt-1 text-sm text-ink-500">
                    Missed pickup, overflowing bin, anything else — tell the community team.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* --- Raise a complaint --- */}
                <Card className="h-fit">
                    <CardHeader title="Raise a complaint" subtitle="A photo helps us route it faster" />
                    <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
                        <Field label="Subject">
                            <Input
                                value={subject}
                                onChange={(e) => { setSubject(e.target.value); setSuccess(false); }}
                                placeholder="e.g. Bin not emptied for three days"
                                maxLength={140}
                                disabled={submitting}
                                required
                            />
                        </Field>

                        <Field label="What happened?">
                            <Textarea
                                value={description}
                                onChange={(e) => { setDescription(e.target.value); setSuccess(false); }}
                                placeholder="Describe the problem, where it is, and when you noticed it."
                                disabled={submitting}
                                required
                            />
                        </Field>

                        <Field label="Photo (optional)" hint="We scan it to tag the waste type automatically.">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFile}
                                disabled={analyzing || submitting}
                                className={cx(
                                    "w-full rounded-xl bg-white text-sm text-ink-600 ring-1 ring-inset ring-ink-300",
                                    "file:mr-4 file:cursor-pointer file:rounded-l-xl file:border-0 file:bg-brand-600",
                                    "file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700",
                                    "focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                                )}
                            />
                        </Field>

                        {preview && (
                            <div className="space-y-3">
                                <img
                                    src={preview}
                                    alt="The problem you are reporting"
                                    className="max-h-48 w-full rounded-xl object-cover ring-1 ring-ink-200"
                                />
                                {analyzing && <Spinner label="Reading your photo" />}
                                {!analyzing && imageUrl && (
                                    <p className="flex items-center gap-2 text-sm text-brand-700">
                                        <Sparkles size={16} />
                                        Photo attached{category ? ` · tagged as ${category}` : ""}.
                                    </p>
                                )}
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={clearPhoto}
                                    disabled={analyzing || submitting}
                                >
                                    <RefreshCw size={16} />
                                    Remove photo
                                </Button>
                            </div>
                        )}

                        {analyzeError && (
                            <ErrorNote error={analyzeError} />
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Waste category (optional)">
                                <Select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    disabled={submitting}
                                >
                                    <option value="">Not specific</option>
                                    {CATEGORIES.map((c) => (
                                        <option key={c} value={c}>
                                            {CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}
                                        </option>
                                    ))}
                                </Select>
                            </Field>

                            <Field label="Related request (optional)">
                                <Select
                                    value={listingId}
                                    onChange={(e) => setListingId(e.target.value)}
                                    disabled={submitting}
                                >
                                    <option value="">Not about a specific pickup</option>
                                    {requests.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            #{r.id} · {r.waste_type || r.category} · {r.location || "no address"}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        </div>

                        {requestsError && (
                            <ErrorNote error={requestsError} onRetry={loadRequests} />
                        )}

                        {submitError && <ErrorNote error={submitError} />}

                        {success && (
                            <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                                <CheckCircle2 size={16} />
                                Complaint raised. You will see it in the list below.
                            </p>
                        )}

                        <Button type="submit" className="w-full" loading={submitting} disabled={analyzing}>
                            Submit complaint
                        </Button>
                    </form>
                </Card>

                {/* --- History --- */}
                <Card className="h-fit">
                    <CardHeader
                        title="Your complaints"
                        subtitle={`${tickets.length} raised`}
                        action={
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setTicketsLoading(true); loadTickets(); }}
                                aria-label="Refresh complaints"
                            >
                                <RefreshCw size={16} />
                            </Button>
                        }
                    />

                    {ticketsError && (
                        <div className="px-5 pt-4">
                            <ErrorNote
                                error={ticketsError}
                                onRetry={() => { setTicketsLoading(true); loadTickets(); }}
                            />
                        </div>
                    )}

                    {ticketsLoading ? (
                        <Spinner label="Loading your complaints" />
                    ) : tickets.length === 0 ? (
                        <EmptyState
                            icon={MessageSquareWarning}
                            title="No complaints yet"
                            description="Anything you raise will be tracked here until it is resolved."
                        />
                    ) : (
                        <ul className="divide-y divide-ink-100">
                            {tickets.map((t) => (
                                <li
                                    key={t.id}
                                    className={cx("px-5 py-4", t.escalated && "escalated-row")}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className="font-semibold text-ink-900">{t.subject}</p>
                                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                                            {t.escalated && <Badge tone="danger">Escalated</Badge>}
                                            <Badge tone={TICKET_TONES[t.status] || "neutral"}>
                                                {prettyStatus(t.status)}
                                            </Badge>
                                        </div>
                                    </div>

                                    {t.description && (
                                        <p className="mt-1 text-sm text-ink-600">{t.description}</p>
                                    )}

                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                                        <span>{timeAgo(t.created_at)}</span>
                                        {t.category && (
                                            <span className="capitalize">
                                                · {CATEGORY_ICONS[t.category] || ""} {t.category}
                                            </span>
                                        )}
                                        {t.listing_id && <span>· request #{t.listing_id}</span>}
                                    </div>

                                    {t.resolution_note && (
                                        <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
                                            <span className="font-semibold">Resolution: </span>
                                            {t.resolution_note}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}
