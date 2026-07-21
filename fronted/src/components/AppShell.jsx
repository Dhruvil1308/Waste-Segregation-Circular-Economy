import { useEffect, useState, useCallback, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
    Bell, LogOut, Menu, X, Recycle, LayoutDashboard, PlusCircle, ListChecks,
    MessageSquareWarning, Truck, QrCode, ShieldAlert, Users, Inbox,
} from "lucide-react";

import api from "../api";
import { Badge, Button, Card, cx, timeAgo } from "./ui";

/** How often the bell asks the server for news. Polling keeps this robust across restarts. */
const POLL_MS = 5000;

const NAV_BY_ROLE = {
    generator: [
        { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/new", label: "New pickup", icon: PlusCircle },
        { to: "/app/requests", label: "My requests", icon: ListChecks },
        { to: "/app/complaints", label: "Complaints", icon: MessageSquareWarning },
    ],
    collector: [
        { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/queue", label: "Nearby queue", icon: Inbox },
        { to: "/app/pickups", label: "My pickups", icon: Truck },
        { to: "/app/scan", label: "Scan QR", icon: QrCode },
        { to: "/app/complaints", label: "Complaints", icon: MessageSquareWarning },
    ],
    admin: [
        { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
        { to: "/app/alerts", label: "Alerts", icon: ShieldAlert },
        { to: "/app/requests", label: "All requests", icon: ListChecks },
        { to: "/app/complaints", label: "Complaints", icon: MessageSquareWarning },
        { to: "/app/users", label: "Community", icon: Users },
    ],
};

const ROLE_LABEL = { generator: "Waste Generator", collector: "Collection Team", admin: "Administrator" };

function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const panelRef = useRef(null);

    const refresh = useCallback(async () => {
        try {
            const { unread } = await api.getUnreadCount();
            setUnread(unread);
        } catch {
            /* transient network blips must not break the shell */
        }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, POLL_MS);
        return () => clearInterval(id);
    }, [refresh]);

    // Close when clicking outside the panel.
    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [open]);

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (next) {
            try {
                setItems(await api.getNotifications());
                await api.markNotificationsRead();
                setUnread(0);
            } catch {
                /* leave the panel empty rather than crashing the header */
            }
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                onClick={toggle}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                className="relative rounded-xl p-2 text-ink-600 transition hover:bg-ink-100"
            >
                <Bell size={20} />
                {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <Card className="absolute right-0 z-50 mt-2 w-80 animate-fade-up overflow-hidden sm:w-96">
                    <div className="border-b border-ink-100 px-4 py-3 font-bold text-ink-900">Notifications</div>
                    <div className="max-h-96 overflow-y-auto">
                        {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-400">Nothing yet.</p>}
                        {items.map((n) => (
                            <div key={n.id} className={cx("border-b border-ink-50 px-4 py-3 last:border-0",
                                n.type === "escalation" && "bg-red-50/60")}>
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-semibold text-ink-800">{n.title}</p>
                                    <span className="shrink-0 text-xs text-ink-400">{timeAgo(n.created_at)}</span>
                                </div>
                                {n.message && <p className="mt-0.5 text-sm text-ink-500">{n.message}</p>}
                                {n.type === "escalation" && <Badge tone="danger" className="mt-2">Escalated</Badge>}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

export default function AppShell({ user, onLogout, children }) {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const nav = NAV_BY_ROLE[user?.role] || [];

    const logout = () => {
        api.logout();
        onLogout?.();
        navigate("/login");
    };

    const links = (
        <nav className="space-y-1">
            {nav.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                        cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                            isActive ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-100")
                    }
                >
                    <Icon size={18} />
                    {label}
                </NavLink>
            ))}
        </nav>
    );

    return (
        <div className="min-h-screen bg-ink-50">
            <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
                    <button className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
                        onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
                        {menuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
                            <Recycle size={18} />
                        </span>
                        <div className="leading-tight">
                            <p className="font-bold text-ink-900">SafaiSetu</p>
                            <p className="hidden text-xs text-ink-500 sm:block">{ROLE_LABEL[user?.role] || ""}</p>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <NotificationBell />
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold text-ink-800">{user?.name}</p>
                            <p className="text-xs text-ink-500">{user?.location}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
                            <LogOut size={16} />
                        </Button>
                    </div>
                </div>
            </header>

            <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
                <aside className="hidden w-56 shrink-0 lg:block">{links}</aside>

                {menuOpen && (
                    <div className="fixed inset-0 z-30 bg-ink-900/30 lg:hidden" onClick={() => setMenuOpen(false)}>
                        <div className="h-full w-64 bg-white p-4 pt-20" onClick={(e) => e.stopPropagation()}>{links}</div>
                    </div>
                )}

                <main className="min-w-0 flex-1">{children}</main>
            </div>
        </div>
    );
}
