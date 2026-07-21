import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Recycle, MapPin, Eye, EyeOff, CheckCircle2, AlertTriangle,
    Loader2, LogIn, UserPlus,
} from "lucide-react";

import api from "../api";
import { Button, Card, Field, Input, Select, ErrorNote, cx } from "../components/ui";

/**
 * Login + registration.
 *
 * Both screens end in the same place: a token in localStorage, the profile in
 * hand, and `onAuthed(user)` fired so the app shell can take over. The shared
 * `finishAuth` helper below is the single path there, so the two forms can
 * never drift apart on what "signed in" means.
 */

const ROLE_OPTIONS = [
    { value: "generator", label: "Waste Generator" },
    { value: "collector", label: "Collection Team (SHG)" },
    { value: "admin", label: "Community Admin" },
];

/**
 * Persists the session and hands the profile back to the caller.
 * Returns the user so callers can branch on role if they need to.
 */
async function finishAuth(token, onAuthed) {
    localStorage.setItem("token", token);
    try {
        const user = await api.getMe();
        localStorage.setItem("user_role", user.role ?? "");
        localStorage.setItem("user_name", user.name ?? "");
        onAuthed?.(user);
        return user;
    } catch (err) {
        // A token we cannot resolve to a profile is worse than no token at all:
        // it leaves the shell rendering for a user we know nothing about.
        api.logout();
        throw err;
    }
}

// --- Shared chrome -----------------------------------------------------------

function AuthShell({ title, subtitle, wide, children, footer }) {
    return (
        <div className="min-h-screen bg-gradient-to-b from-brand-50 via-ink-50 to-ink-50 px-4 py-10 sm:py-16">
            <div className={cx("mx-auto w-full", wide ? "max-w-2xl" : "max-w-md")}>
                <Link
                    to="/"
                    className="mb-8 flex items-center justify-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
                >
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm">
                        <Recycle size={22} />
                    </span>
                    <span className="text-2xl font-bold tracking-tight text-ink-900">SafaiSetu</span>
                </Link>

                <Card className="animate-fade-up p-6 sm:p-8">
                    <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h1>
                    {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
                    <div className="mt-6">{children}</div>
                </Card>

                <p className="mt-6 text-center text-sm text-ink-500">{footer}</p>
            </div>
        </div>
    );
}

/** Password box with a real show/hide toggle. Always controlled. */
function PasswordInput({ value, onChange, ...props }) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <Input
                type={visible ? "text" : "password"}
                value={value}
                onChange={onChange}
                className="pr-11"
                {...props}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-ink-400 transition hover:text-ink-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
        </div>
    );
}

// --- Login -------------------------------------------------------------------

export function LoginPage({ onAuthed }) {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const { access_token: token } = await api.login(username.trim(), password);
            if (!token) throw new Error("The server did not return a session token.");
            await finishAuth(token, onAuthed);
            navigate("/app", { replace: true });
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthShell
            title="Welcome back"
            subtitle="Sign in to manage pickups in your community."
            footer={
                <>
                    New to SafaiSetu?{" "}
                    <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                        Create an account
                    </Link>
                </>
            }
        >
            <form onSubmit={submit} className="space-y-4" noValidate>
                {error && <ErrorNote error={error} />}

                <Field label="Username">
                    <Input
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        placeholder="your.username"
                        required
                    />
                </Field>

                <Field label="Password">
                    <PasswordInput
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        required
                    />
                </Field>

                <Button type="submit" size="lg" loading={busy} className="w-full">
                    {!busy && <LogIn size={17} />}
                    {busy ? "Signing in" : "Sign in"}
                </Button>
            </form>
        </AuthShell>
    );
}

// --- Register ----------------------------------------------------------------

const EMPTY_FORM = {
    name: "",
    username: "",
    password: "",
    role: "generator",
    location: "",
    phone_number: "",
    service_radius_km: 5,
};

export function RegisterPage({ onAuthed }) {
    const navigate = useNavigate();
    const [form, setForm] = useState(EMPTY_FORM);
    const [coords, setCoords] = useState(null);       // { latitude, longitude, accuracy }
    const [geoState, setGeoState] = useState("idle"); // idle | locating | ready | blocked
    const [geoMessage, setGeoMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // getCurrentPosition has no abort handle, so guard the callbacks instead.
    const alive = useRef(true);
    useEffect(() => () => { alive.current = false; }, []);

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const locate = () => {
        setGeoMessage("");
        if (!navigator.geolocation) {
            setGeoState("blocked");
            setGeoMessage("This browser cannot share a location.");
            return;
        }
        setGeoState("locating");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (!alive.current) return;
                setCoords({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                });
                setGeoState("ready");
            },
            (err) => {
                if (!alive.current) return;
                setCoords(null);
                setGeoState("blocked");
                setGeoMessage(
                    err.code === err.PERMISSION_DENIED
                        ? "Location permission was denied."
                        : err.code === err.TIMEOUT
                            ? "Finding your location took too long."
                            : "Your location is unavailable right now."
                );
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const radius = Number(form.service_radius_km);
            const payload = {
                name: form.name.trim(),
                username: form.username.trim(),
                password: form.password,
                role: form.role,
                location: form.location.trim(),
                phone_number: form.phone_number.trim() || null,
                latitude: coords?.latitude ?? null,
                longitude: coords?.longitude ?? null,
                // Only collectors have a service radius; send a sane value regardless.
                service_radius_km:
                    form.role === "collector" && Number.isFinite(radius) && radius > 0 ? radius : 5,
            };

            // /signup already returns a session token; fall back to an explicit
            // login only if a future backend stops doing that.
            const res = await api.signup(payload);
            const token = res?.access_token
                ?? (await api.login(payload.username, payload.password))?.access_token;
            if (!token) throw new Error("The account was created but no session token came back. Try signing in.");

            await finishAuth(token, onAuthed);
            navigate("/app", { replace: true });
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthShell
            wide
            title="Create your account"
            subtitle="Join your community's waste-collection network."
            footer={
                <>
                    Already registered?{" "}
                    <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                        Sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={submit} className="space-y-5" noValidate>
                {error && <ErrorNote error={error} />}

                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Full name">
                        <Input
                            name="name"
                            value={form.name}
                            onChange={set("name")}
                            autoComplete="name"
                            placeholder="Asha Patel"
                            required
                        />
                    </Field>

                    <Field label="Username">
                        <Input
                            name="username"
                            value={form.username}
                            onChange={set("username")}
                            autoComplete="username"
                            placeholder="asha.patel"
                            required
                        />
                    </Field>

                    <Field label="Password" hint="At least 8 characters.">
                        <PasswordInput
                            name="password"
                            value={form.password}
                            onChange={set("password")}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            required
                        />
                    </Field>

                    <Field label="I am a">
                        <Select name="role" value={form.role} onChange={set("role")}>
                            {ROLE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Phone number">
                        <Input
                            name="phone_number"
                            type="tel"
                            value={form.phone_number}
                            onChange={set("phone_number")}
                            autoComplete="tel"
                            inputMode="tel"
                            placeholder="+91 98765 43210"
                        />
                    </Field>

                    {form.role === "collector" && (
                        <Field label="Service radius" hint="How far you will travel for a pickup.">
                            <div className="relative">
                                <Input
                                    name="service_radius_km"
                                    type="number"
                                    min="1"
                                    max="50"
                                    step="0.5"
                                    value={form.service_radius_km}
                                    onChange={set("service_radius_km")}
                                    className="pr-12"
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm font-medium text-ink-400">
                                    km
                                </span>
                            </div>
                        </Field>
                    )}
                </div>

                <Field label="Address" hint="Street, area and city — collectors see this on the pickup card.">
                    <Input
                        name="location"
                        value={form.location}
                        onChange={set("location")}
                        autoComplete="street-address"
                        placeholder="12 Gandhi Marg, Navrangpura, Ahmedabad"
                        required
                    />
                </Field>

                {/* --- GPS capture ------------------------------------------------ */}
                <div className="rounded-xl bg-ink-50 p-4 ring-1 ring-inset ring-ink-200">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink-800">Pin point location</p>
                            <p className="mt-0.5 text-sm text-ink-500">
                                Coordinates let us match you with the closest collection team.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={locate}
                            disabled={geoState === "locating"}
                        >
                            {geoState === "locating"
                                ? <Loader2 size={16} className="animate-spin" />
                                : <MapPin size={16} />}
                            {geoState === "locating"
                                ? "Locating"
                                : geoState === "ready" ? "Update location" : "Use my location"}
                        </Button>
                    </div>

                    {geoState === "ready" && coords && (
                        <div
                            className="mt-3 flex items-start gap-2.5 rounded-lg bg-brand-50 px-3 py-2.5 ring-1 ring-inset ring-brand-200"
                            role="status"
                        >
                            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand-600" />
                            <div className="min-w-0 text-sm">
                                <p className="font-semibold text-brand-800">Location captured</p>
                                <p className="mt-0.5 tabular-nums text-brand-700">
                                    {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                                    {Number.isFinite(coords.accuracy) && (
                                        <span className="text-brand-600"> · ±{Math.round(coords.accuracy)} m</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {geoState === "blocked" && (
                        <div
                            className="mt-3 flex items-start gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-inset ring-amber-200"
                            role="status"
                        >
                            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
                            <div className="min-w-0 text-sm text-amber-800">
                                <p className="font-semibold">{geoMessage}</p>
                                <p className="mt-0.5">
                                    You can still sign up — we will use your address instead. Nearby matching
                                    will be less precise until you add a location from your profile.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <Button type="submit" size="lg" loading={busy} className="w-full">
                    {!busy && <UserPlus size={17} />}
                    {busy ? "Creating account" : "Create account"}
                </Button>
            </form>
        </AuthShell>
    );
}
