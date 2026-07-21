import { Loader2, Inbox, AlertTriangle, X } from "lucide-react";

/** Joins class names, dropping falsy values. */
export const cx = (...parts) => parts.filter(Boolean).join(" ");

// --- Status vocabulary, mirroring backend/models.py ---
export const STATUS_LABELS = {
    requested: "Awaiting collector",
    accepted: "Accepted",
    en_route: "On the way",
    collected: "Collected",
    processed: "Processed",
};

export const CATEGORY_ICONS = {
    plastic: "🧴", organic: "🥬", paper: "📄", metal: "🔩",
    glass: "🍾", ewaste: "🔌", hazardous: "☣️", mixed: "🗑️",
};

export function Badge({ children, tone = "neutral", className }) {
    const tones = {
        neutral: "bg-ink-100 text-ink-700 ring-ink-200",
        brand: "bg-brand-50 text-brand-700 ring-brand-200",
        warn: "bg-amber-50 text-amber-700 ring-amber-200",
        danger: "bg-red-50 text-red-700 ring-red-200",
        info: "bg-blue-50 text-blue-700 ring-blue-200",
    };
    return (
        <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
            tones[tone], className)}>
            {children}
        </span>
    );
}

export function StatusPill({ status }) {
    return (
        <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
            `status-${status}`)}>
            {STATUS_LABELS[status] || status}
        </span>
    );
}

export function Button({ variant = "primary", size = "md", className, disabled, loading, children, ...props }) {
    const variants = {
        primary: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600",
        secondary: "bg-white text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50 focus-visible:outline-ink-400",
        danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
        ghost: "text-ink-600 hover:bg-ink-100 focus-visible:outline-ink-400",
    };
    const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };

    return (
        <button
            disabled={disabled || loading}
            className={cx(
                "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                variants[variant], sizes[size], className
            )}
            {...props}
        >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {children}
        </button>
    );
}

export function Card({ className, children, ...props }) {
    return (
        <div className={cx("rounded-2xl bg-white ring-1 ring-ink-200/70 shadow-sm", className)} {...props}>
            {children}
        </div>
    );
}

export function CardHeader({ title, subtitle, action }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
            <div>
                <h2 className="font-bold text-ink-900">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

export function StatTile({ label, value, unit, icon: Icon, tone = "brand" }) {
    const tones = {
        brand: "bg-brand-50 text-brand-700",
        info: "bg-blue-50 text-blue-700",
        warn: "bg-amber-50 text-amber-700",
        danger: "bg-red-50 text-red-700",
    };
    return (
        <Card className="p-5">
            <div className="flex items-center gap-3">
                {Icon && (
                    <span className={cx("grid h-10 w-10 place-items-center rounded-xl", tones[tone])}>
                        <Icon size={20} />
                    </span>
                )}
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-500">{label}</p>
                    <p className="text-2xl font-bold tabular-nums text-ink-900">
                        {value}
                        {unit && <span className="ml-1 text-sm font-semibold text-ink-400">{unit}</span>}
                    </p>
                </div>
            </div>
        </Card>
    );
}

export function Field({ label, hint, error, children }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</span>
            {children}
            {hint && !error && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
            {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
        </label>
    );
}

const inputBase =
    "w-full rounded-xl bg-white px-4 py-2.5 text-sm ring-1 ring-inset ring-ink-300 " +
    "placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none";

export const Input = ({ className, ...props }) => <input className={cx(inputBase, className)} {...props} />;
export const Textarea = ({ className, ...props }) => <textarea className={cx(inputBase, "min-h-24", className)} {...props} />;
export const Select = ({ className, children, ...props }) => (
    <select className={cx(inputBase, className)} {...props}>{children}</select>
);

export function Spinner({ label = "Loading" }) {
    return (
        <div className="flex items-center justify-center gap-2 py-12 text-ink-500" role="status">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-medium">{label}…</span>
        </div>
    );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
    return (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">
                <Icon size={24} />
            </span>
            <div>
                <p className="font-semibold text-ink-800">{title}</p>
                {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
            </div>
            {action}
        </div>
    );
}

/** Inline error banner. Failures are always shown, never swallowed into the console. */
export function ErrorNote({ error, onRetry }) {
    if (!error) return null;
    return (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-inset ring-red-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <div className="flex-1 text-sm text-red-800">{error.message || String(error)}</div>
            {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>}
        </div>
    );
}

export function Modal({ open, onClose, title, children, footer }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4" onClick={onClose}>
            <Card
                className="w-full max-w-lg animate-fade-up overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                    <h2 className="font-bold text-ink-900">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-ink-400 hover:bg-ink-100">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-5 py-4">{children}</div>
                {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
            </Card>
        </div>
    );
}

/** Relative time, e.g. "4m ago". Backend timestamps are naive UTC. */
export function timeAgo(value) {
    if (!value) return "";
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (Number.isNaN(seconds)) return "";
    if (seconds < 60) return "just now";
    const units = [["d", 86400], ["h", 3600], ["m", 60]];
    for (const [suffix, size] of units) {
        if (seconds >= size) return `${Math.floor(seconds / size)}${suffix} ago`;
    }
    return "just now";
}
