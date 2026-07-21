import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, Crosshair, Info, RefreshCw, Sparkles } from "lucide-react";

import api from "../../api";
import {
    Badge, Button, Card, CardHeader, CATEGORY_ICONS, cx, ErrorNote, Field,
    Input, Select, Spinner,
} from "../../components/ui";

const CATEGORIES = Object.keys(CATEGORY_ICONS);

export default function NewRequest() {
    const navigate = useNavigate();

    // Step 1 — the photo
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);

    // Step 2 — what the AI made of it, plus the user's corrections
    const [analysis, setAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState(null);
    const [category, setCategory] = useState("");
    const [quantity, setQuantity] = useState("");

    // Step 3 — where and who
    const [location, setLocation] = useState("");
    const [coords, setCoords] = useState({ latitude: null, longitude: null });
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState(null);
    const [phone, setPhone] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    // Blob URLs stay allocated until revoked. This cleanup runs on every swap and
    // on unmount, so it is the single place that frees them.
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setPreview(URL.createObjectURL(file));
        setAnalysis(null);
        setAnalyzeError(null);
        setSubmitError(null);
        setAnalyzing(true);

        try {
            const result = await api.analyzeImage(file);
            setAnalysis(result);
            setCategory(result?.category || "mixed");
            setQuantity(
                result?.estimated_quantity_kg === undefined || result?.estimated_quantity_kg === null
                    ? ""
                    : String(result.estimated_quantity_kg)
            );
        } catch (err) {
            setAnalyzeError(err);
        } finally {
            setAnalyzing(false);
        }
    };

    const useMyLocation = () => {
        setLocationError(null);
        if (!navigator.geolocation) {
            setLocationError(new Error("This browser cannot share your location. Please type the address instead."));
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCoords({ latitude, longitude });
                // Never clobber an address the user already typed; coordinates are a fallback label.
                setLocation((current) => current.trim() || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                setLocating(false);
            },
            (err) => {
                setLocationError(new Error(err.message || "Could not read your location. Please type the address instead."));
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const resetPhoto = () => {
        setPreview(null);
        setAnalysis(null);
        setAnalyzeError(null);
        setCategory("");
        setQuantity("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const quantityNumber = Number(quantity);
    const quantityValid = quantity !== "" && Number.isFinite(quantityNumber) && quantityNumber > 0;
    const canSubmit = Boolean(analysis) && quantityValid && location.trim().length > 0 && !submitting;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitError(null);

        if (!analysis) {
            setSubmitError(new Error("Add a photo of the waste first — the analysis fills in the details."));
            return;
        }
        if (!quantityValid) {
            setSubmitError(new Error("Enter a quantity greater than zero."));
            return;
        }
        if (!location.trim()) {
            setSubmitError(new Error("Add a pickup location so the collector can find you."));
            return;
        }

        setSubmitting(true);
        try {
            await api.createRequest({
                waste_type: analysis.waste_type,
                category,
                quantity_kg: quantityNumber,
                location: location.trim(),
                // The server-hosted URL from the analysis. The blob: preview only
                // resolves in this tab, so it must never be persisted.
                image_url: analysis.image_url || null,
                latitude: coords.latitude,
                longitude: coords.longitude,
                phone_number: phone.trim() || null,
            });
            navigate("/app/requests");
        } catch (err) {
            setSubmitError(err);
            setSubmitting(false);
        }
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <header>
                <h1 className="text-2xl font-bold text-ink-900">Request a pickup</h1>
                <p className="mt-1 text-sm text-ink-500">
                    Photograph the waste — we identify it, you confirm, a collector comes.
                </p>
            </header>

            {/* --- Step 1: the photo --- */}
            <Card>
                <CardHeader title="1. Photo of the waste" subtitle="Use your camera or pick an existing photo" />
                <div className="space-y-4 px-5 py-4">
                    <Field label="Waste photo" hint="A clear, close photo gives the best identification.">
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
                                alt="The waste you are about to report"
                                className="max-h-64 w-full rounded-xl object-cover ring-1 ring-ink-200"
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={resetPhoto}
                                disabled={analyzing || submitting}
                            >
                                <RefreshCw size={16} />
                                Choose a different photo
                            </Button>
                        </div>
                    )}

                    {!preview && (
                        <p className="flex items-center gap-2 text-sm text-ink-400">
                            <Camera size={16} />
                            No photo yet.
                        </p>
                    )}
                </div>
            </Card>

            {/* --- Step 2: the analysis --- */}
            {(analyzing || analysis || analyzeError) && (
                <Card>
                    <CardHeader
                        title="2. What we found"
                        subtitle="Correct anything that looks wrong"
                        action={<Badge tone="brand"><Sparkles size={12} /> AI</Badge>}
                    />
                    <div className="space-y-4 px-5 py-4">
                        {analyzing && <Spinner label="Analysing your photo" />}

                        {analyzeError && !analyzing && (
                            <ErrorNote
                                error={analyzeError}
                                onRetry={() => fileInputRef.current?.click()}
                            />
                        )}

                        {analysis && !analyzing && (
                            <>
                                <div className="rounded-xl bg-brand-50 px-4 py-4 ring-1 ring-inset ring-brand-200">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl" aria-hidden="true">
                                            {CATEGORY_ICONS[analysis.category] || CATEGORY_ICONS.mixed}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-bold capitalize text-ink-900">
                                                    {analysis.waste_type || analysis.category}
                                                </p>
                                                <Badge tone={analysis.recyclable ? "brand" : "warn"}>
                                                    {analysis.recyclable ? "Recyclable" : "Not recyclable"}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm capitalize text-ink-600">
                                                {analysis.category} · about {analysis.estimated_quantity_kg} kg
                                            </p>
                                            {analysis.description && (
                                                <p className="mt-2 text-sm text-ink-600">{analysis.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    {analysis.handling_note && (
                                        <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-ink-700">
                                            <Info size={16} className="mt-0.5 shrink-0 text-brand-700" />
                                            <span>{analysis.handling_note}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <Field label="Category" hint="Change it if we guessed wrong.">
                                        <Select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            disabled={submitting}
                                        >
                                            {CATEGORIES.map((c) => (
                                                <option key={c} value={c}>
                                                    {CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>

                                    <Field
                                        label="Quantity (kg)"
                                        error={quantity !== "" && !quantityValid ? "Enter a number greater than zero." : undefined}
                                    >
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            inputMode="decimal"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            disabled={submitting}
                                            placeholder="0.0"
                                        />
                                    </Field>
                                </div>
                            </>
                        )}
                    </div>
                </Card>
            )}

            {/* --- Step 3: where to come --- */}
            <Card>
                <CardHeader title="3. Pickup details" subtitle="Where the collector should come" />
                <div className="space-y-4 px-5 py-4">
                    <Field label="Pickup location" hint="A landmark or door number helps the team find you.">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g. Flat 3B, Gulmohar Society, near the water tank"
                                disabled={submitting}
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={useMyLocation}
                                loading={locating}
                                disabled={submitting}
                                className="shrink-0"
                            >
                                <Crosshair size={16} />
                                Use my location
                            </Button>
                        </div>
                    </Field>

                    {coords.latitude !== null && (
                        <p className="flex items-center gap-2 text-sm text-brand-700">
                            <Check size={16} />
                            Pinned at {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                        </p>
                    )}

                    {locationError && <ErrorNote error={locationError} />}

                    <Field label="Phone number (optional)" hint="Only used if the collector cannot find the spot.">
                        <Input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. 98765 43210"
                            disabled={submitting}
                        />
                    </Field>
                </div>
            </Card>

            {submitError && <ErrorNote error={submitError} />}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate("/app")}
                    disabled={submitting}
                >
                    Cancel
                </Button>
                <Button type="submit" size="lg" loading={submitting} disabled={!canSubmit}>
                    Submit request
                </Button>
            </div>
        </form>
    );
}
