import { useCallback, useEffect, useRef, useState } from "react";
import { Users as UsersIcon, MapPin, Phone, Radius, AtSign, UserX } from "lucide-react";

import api from "../../api";
import { Badge, Card, EmptyState, ErrorNote, Spinner, cx } from "../../components/ui";

const FILTERS = [
    { value: "all", label: "Everyone" },
    { value: "generator", label: "Generators" },
    { value: "collector", label: "Collection teams" },
    { value: "admin", label: "Admins" },
];

const ROLE_LABEL = { generator: "Generator", collector: "Collection team", admin: "Administrator" };
const ROLE_TONE = { generator: "brand", collector: "info", admin: "warn" };

export default function Users() {
    const [filter, setFilter] = useState("all");
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const load = useCallback(async (role) => {
        setLoading(true);
        try {
            const data = await api.getAdminUsers(role === "all" ? undefined : role);
            if (!alive.current) return;
            setUsers(data || []);
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
                    <UsersIcon size={24} className="text-brand-600" />
                    Community
                </h1>
                <p className="mt-1 text-sm text-ink-500">
                    Everyone registered on SafaiSetu, by role.
                </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter people by role">
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
                <Spinner label="Loading community members" />
            ) : users.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={UserX}
                        title="Nobody to show"
                        description={
                            filter === "all"
                                ? "No accounts have been created yet."
                                : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} are registered yet.`
                        }
                    />
                </Card>
            ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {users.map((person) => (
                        <li key={person.id}>
                            <Card className="h-full p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-ink-900">
                                            {person.name || person.username}
                                        </p>
                                        <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                                            <AtSign size={13} className="shrink-0 text-ink-400" />
                                            <span className="truncate">{person.username}</span>
                                        </p>
                                    </div>
                                    <Badge tone={ROLE_TONE[person.role] || "neutral"}>
                                        {ROLE_LABEL[person.role] || person.role}
                                    </Badge>
                                </div>

                                <dl className="mt-4 space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <dt className="sr-only">Location</dt>
                                        <MapPin size={15} className="shrink-0 text-ink-400" />
                                        <dd className="truncate text-ink-600">{person.location || "Not set"}</dd>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <dt className="sr-only">Phone number</dt>
                                        <Phone size={15} className="shrink-0 text-ink-400" />
                                        <dd className="truncate text-ink-600">{person.phone_number || "No phone number"}</dd>
                                    </div>
                                    {person.role === "collector" && (
                                        <div className="flex items-center gap-2">
                                            <dt className="sr-only">Service radius</dt>
                                            <Radius size={15} className="shrink-0 text-ink-400" />
                                            <dd className="text-ink-600">
                                                {person.service_radius_km != null
                                                    ? `${person.service_radius_km} km service radius`
                                                    : "No service radius set"}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
