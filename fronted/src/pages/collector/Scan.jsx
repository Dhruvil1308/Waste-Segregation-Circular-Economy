import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CameraOff, CheckCircle2, Keyboard, QrCode, Truck } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

import api from "../../api";
import { Button, Card, CardHeader, ErrorNote, Field, Input, Spinner } from "../../components/ui";

const READER_ID = "qr-reader";

/**
 * QR payloads have shipped as both a bare token and a full tracking URL.
 * Only URLs are rewritten, so a token containing slashes is never mangled.
 */
const normaliseToken = (text) => {
    const value = String(text || "").trim();
    if (!/^https?:\/\//i.test(value)) return value;
    const segments = value.split("?")[0].split("#")[0].split("/").filter(Boolean);
    return segments[segments.length - 1] || value;
};

export default function CollectorScan() {
    const [cameraOn, setCameraOn] = useState(false);
    const [starting, setStarting] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [manualCode, setManualCode] = useState("");
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const scannerRef = useRef(null);
    /** The camera fires the success callback on every frame; this makes collection idempotent. */
    const handledRef = useRef(false);

    const stopCamera = useCallback(async () => {
        const instance = scannerRef.current;
        scannerRef.current = null;
        setCameraOn(false);
        if (!instance) return;
        try {
            await instance.stop();
        } catch {
            /* already stopped, or the track was released when the tab was hidden */
        }
        try {
            instance.clear();
        } catch {
            /* the reader node may already be gone */
        }
    }, []);

    // Release the camera when the collector navigates away.
    useEffect(() => stopCamera, [stopCamera]);

    const submitToken = useCallback(
        async (rawToken) => {
            const token = normaliseToken(rawToken);
            if (!token) {
                setError(new Error("Enter the code printed under the household's QR."));
                return;
            }
            setVerifying(true);
            setError(null);
            try {
                const response = await api.collectByQr(token);
                setResult(response);
                setManualCode("");
                await stopCamera();
            } catch (err) {
                setError(err);
                handledRef.current = false; // allow another scan attempt
            } finally {
                setVerifying(false);
            }
        },
        [stopCamera]
    );

    const startCamera = async () => {
        setError(null);
        setResult(null);
        setStarting(true);
        handledRef.current = false;
        try {
            const instance = new Html5Qrcode(READER_ID);
            scannerRef.current = instance;
            await instance.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    if (handledRef.current) return;
                    handledRef.current = true;
                    submitToken(decodedText);
                },
                () => {
                    /* per-frame "no QR found" noise — not an error worth showing */
                }
            );
            setCameraOn(true);
        } catch (err) {
            scannerRef.current = null;
            setCameraOn(false);
            setError(
                new Error(
                    err?.message
                        ? `Could not start the camera: ${err.message}. Use the code box below instead.`
                        : "Could not start the camera. Use the code box below instead."
                )
            );
        } finally {
            setStarting(false);
        }
    };

    const scanAnother = () => {
        setResult(null);
        setError(null);
        setManualCode("");
        handledRef.current = false;
    };

    const onManualSubmit = (event) => {
        event.preventDefault();
        submitToken(manualCode);
    };

    const points = result?.rewards?.points_earned ?? 0;

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-ink-900">Scan to collect</h1>
                <p className="mt-1 text-sm text-ink-500">
                    Ask the household to show their pickup QR, or type the code by hand.
                </p>
            </header>

            {result ? (
                <Card className="animate-fade-up overflow-hidden">
                    <div className="flex flex-col items-center gap-4 bg-brand-50 px-6 py-10 text-center">
                        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-white">
                            <CheckCircle2 size={34} />
                        </span>
                        <div>
                            <p className="text-2xl font-bold text-brand-800">Collection confirmed</p>
                            <p className="mt-1 text-sm text-brand-700">
                                {result.waste_type || result.category
                                    ? `${result.waste_type || result.category} logged successfully.`
                                    : "This pickup is now marked as collected."}
                            </p>
                        </div>
                        <p className="text-5xl font-bold tabular-nums text-brand-700">
                            +{points}
                            <span className="ml-2 text-lg font-semibold text-brand-600">points</span>
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button size="lg" onClick={scanAnother}>
                                <QrCode size={18} />
                                Scan another
                            </Button>
                            <Link to="/app/pickups">
                                <Button size="lg" variant="secondary">
                                    <Truck size={18} />
                                    My pickups
                                </Button>
                            </Link>
                        </div>
                    </div>
                </Card>
            ) : (
                <>
                    {error && <ErrorNote error={error} />}

                    <Card>
                        <CardHeader
                            title="Camera"
                            subtitle="The camera only turns on when you ask it to."
                            action={
                                cameraOn ? (
                                    <Button variant="secondary" size="sm" onClick={stopCamera}>
                                        <CameraOff size={16} />
                                        Stop
                                    </Button>
                                ) : null
                            }
                        />
                        <div className="px-5 py-4">
                            {/* Kept mounted: html5-qrcode needs this node to exist before start(). */}
                            <div
                                id={READER_ID}
                                className={cameraOn ? "overflow-hidden rounded-xl bg-ink-900" : "hidden"}
                            />

                            {!cameraOn && !starting && (
                                <div className="flex flex-col items-center gap-3 py-6 text-center">
                                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">
                                        <Camera size={24} />
                                    </span>
                                    <p className="text-sm text-ink-500">
                                        Point the camera at the household&apos;s QR code to complete the pickup.
                                    </p>
                                    <Button size="lg" onClick={startCamera}>
                                        <Camera size={18} />
                                        Start camera
                                    </Button>
                                </div>
                            )}

                            {starting && <Spinner label="Opening the camera" />}

                            {cameraOn &&
                                (verifying ? (
                                    <Spinner label="Confirming the collection" />
                                ) : (
                                    <p className="mt-3 text-center text-sm text-ink-500">
                                        Hold steady — the code is read automatically.
                                    </p>
                                ))}
                        </div>
                    </Card>

                    <Card>
                        <CardHeader
                            title="Or enter the code"
                            subtitle="Works on a laptop, or when camera access is blocked."
                        />
                        <form className="space-y-4 px-5 py-4" onSubmit={onManualSubmit}>
                            <Field label="Pickup code" hint="The short code shown beneath the household's QR.">
                                <Input
                                    value={manualCode}
                                    onChange={(event) => setManualCode(event.target.value)}
                                    placeholder="e.g. 7f3a9c21-…"
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                            </Field>
                            <Button type="submit" loading={verifying} disabled={verifying || !manualCode.trim()}>
                                <Keyboard size={16} />
                                Verify code
                            </Button>
                        </form>
                    </Card>
                </>
            )}
        </div>
    );
}
