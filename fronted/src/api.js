// Override with VITE_API_URL in fronted/.env if the backend runs on a different port.
export const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const getHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Unwraps a response, surfacing the backend's `detail` message.
 * Silent failures were a real source of dead-end UI, so errors always carry text.
 */
const handle = async (res, fallback) => {
    if (res.ok) return res.status === 204 ? null : res.json();
    let detail = fallback;
    try {
        const body = await res.json();
        if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
        /* response had no JSON body; keep the fallback message */
    }
    const error = new Error(detail);
    error.status = res.status;
    throw error;
};

const get = (path, fallback) => fetch(`${BASE_URL}${path}`, { headers: getHeaders() }).then((r) => handle(r, fallback));

const send = (method) => (path, body, fallback) =>
    fetch(`${BASE_URL}${path}`, {
        method,
        headers: getHeaders(),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).then((r) => handle(r, fallback));

const post = send("POST");
const patch = send("PATCH");

export const api = {
    // --- Auth ---
    login: async (username, password) => {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData,
        });
        return handle(res, "Incorrect username or password");
    },

    signup: (userData) => post("/signup", userData, "Could not create the account"),

    logout: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_name");
    },

    // --- Profile ---
    getMe: () => get("/users/me", "Could not load your profile"),

    // --- AI analysis + requests (generator) ---
    analyzeImage: async (file) => {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${BASE_URL}/waste/analyze`, {
            method: "POST",
            headers: getAuthHeaders(), // no Content-Type: the browser sets the multipart boundary
            body: form,
        });
        return handle(res, "Could not analyze the image");
    },

    createRequest: (payload) => post("/waste/create", payload, "Could not create the request"),
    getMyRequests: () => get("/waste/my", "Could not load your requests"),
    confirmPickup: (id) => post(`/waste/confirm-pickup/${id}`, undefined, "Could not confirm the pickup"),
    getQr: (id) => get(`/waste/qr/${id}`, "Could not load the QR code"),

    // --- Collector ---
    getNearbyRequests: () => get("/waste/available", "Could not load nearby requests"),
    getMyPickups: () => get("/waste/pickups", "Could not load your pickups"),
    acceptRequest: (id, pickupTime) =>
        post(`/waste/accept/${id}`, { pickup_time: pickupTime ?? null }, "Could not accept the request"),
    markEnRoute: (id) => post(`/waste/en-route/${id}`, undefined, "Could not mark en route"),
    collectByQr: (qrToken) => post("/waste/collect", { qr_token: qrToken }, "Could not verify that QR code"),

    // --- Public tracking (no auth) ---
    track: async (qrToken) => handle(await fetch(`${BASE_URL}/waste/track/${qrToken}`), "Tracking code not found"),

    // --- Notifications ---
    getNotifications: (unreadOnly = false) =>
        get(`/notifications/?unread_only=${unreadOnly}`, "Could not load notifications"),
    getUnreadCount: () => get("/notifications/count", "Could not load notifications"),
    markNotificationsRead: (ids) => post("/notifications/read", { notification_ids: ids ?? null }, "Could not update notifications"),

    // --- Tickets ---
    raiseTicket: (payload) => post("/tickets/", payload, "Could not raise the complaint"),
    getMyTickets: () => get("/tickets/my", "Could not load your complaints"),
    getAllTickets: (statusFilter) =>
        get(`/tickets/${statusFilter ? `?status_filter=${statusFilter}` : ""}`, "Could not load complaints"),
    updateTicket: (id, payload) => patch(`/tickets/${id}`, payload, "Could not update the complaint"),

    // --- Admin ---
    getAdminOverview: () => get("/admin/overview", "Could not load the overview"),
    getAlerts: () => get("/admin/alerts", "Could not load alerts"),
    getAdminUsers: (role) => get(`/admin/users${role ? `?role=${role}` : ""}`, "Could not load users"),
    getAdminRequests: (statusFilter) =>
        get(`/admin/requests${statusFilter ? `?status_filter=${statusFilter}` : ""}`, "Could not load requests"),
    assignCollector: (listingId, collectorId) =>
        post(`/admin/assign/${listingId}/${collectorId}`, undefined, "Could not assign that collector"),
    recheckEscalations: () => post("/admin/recheck-escalations", undefined, "Could not recheck escalations"),

    // --- Impact / wallet ---
    // These deliberately reject rather than resolving to zeros: silently rendering
    // "0 kg" during an outage looks like real data and hides the failure.
    getMyImpact: () => get("/impact/my", "Could not load your impact"),
    getImpactSummary: () => get("/impact/summary", "Could not load impact"),
    getPartnerStats: () => get("/impact/partner-stats", "Could not load your stats"),
    getWallet: () => get("/wallet/balance", "Could not load your wallet"),

    // --- Chatbot ---
    startChat: (intent, role) => post("/chatbot/start", { intent, user_role: role }, "Could not start the chat"),
    sendChat: (sessionId, text) =>
        post("/chatbot/answer", { session_id: sessionId, text_input: text }, "Could not send that message"),
};

export default api;
