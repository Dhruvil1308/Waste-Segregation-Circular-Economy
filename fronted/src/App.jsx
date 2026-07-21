import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import api from "./api";
import AppShell from "./components/AppShell";
import { Spinner, EmptyState } from "./components/ui";

import LandingPage from "./pages/Landing";
import { LoginPage, RegisterPage } from "./pages/Auth";
import TrackPage from "./pages/Track";

import GeneratorDashboard from "./pages/generator/Dashboard";
import NewRequest from "./pages/generator/NewRequest";
import MyRequests from "./pages/generator/MyRequests";
import GeneratorComplaints from "./pages/generator/Complaints";

import CollectorDashboard from "./pages/collector/Dashboard";
import CollectorQueue from "./pages/collector/Queue";
import MyPickups from "./pages/collector/MyPickups";
import ScanPage from "./pages/collector/Scan";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminAlerts from "./pages/admin/Alerts";
import AdminRequests from "./pages/admin/Requests";
import AdminUsers from "./pages/admin/Users";
import AdminComplaints from "./pages/admin/Complaints";

/**
 * Several nav paths are shared across roles (/app/requests, /app/complaints),
 * so each route resolves its component from the current role rather than
 * duplicating the whole route table three times.
 */
const ROUTES_BY_ROLE = {
    generator: {
        "": GeneratorDashboard,
        new: NewRequest,
        requests: MyRequests,
        complaints: GeneratorComplaints,
    },
    collector: {
        "": CollectorDashboard,
        queue: CollectorQueue,
        pickups: MyPickups,
        scan: ScanPage,
        complaints: AdminComplaints, // collectors work the same complaint queue as admins
    },
    admin: {
        "": AdminDashboard,
        alerts: AdminAlerts,
        requests: AdminRequests,
        users: AdminUsers,
        complaints: AdminComplaints,
    },
};

function RoleRoute({ user, segment }) {
    const Component = ROUTES_BY_ROLE[user?.role]?.[segment];
    if (!Component) {
        return (
            <EmptyState
                title="Not available for your role"
                description={`This page does not exist for a ${user?.role || "signed out"} account.`}
            />
        );
    }
    return <Component user={user} />;
}

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    const loadUser = useCallback(async () => {
        if (!localStorage.getItem("token")) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            setUser(await api.getMe());
        } catch {
            // Token expired or invalid - drop it rather than looping on 401s.
            api.logout();
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const isAppRoute = location.pathname.startsWith("/app");

    if (loading && isAppRoute) return <Spinner label="Loading your workspace" />;

    const requireAuth = (element) => (user ? element : <Navigate to="/login" replace />);

    return (
        <Routes>
            {/* Public */}
            <Route path="/" element={user ? <Navigate to="/app" replace /> : <LandingPage />} />
            <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage onAuthed={setUser} />} />
            <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterPage onAuthed={setUser} />} />
            <Route path="/track/:token" element={<TrackPage />} />

            {/* Authenticated workspace */}
            <Route
                path="/app/*"
                element={requireAuth(
                    <AppShell user={user} onLogout={() => setUser(null)}>
                        <Routes>
                            <Route index element={<RoleRoute user={user} segment="" />} />
                            <Route path="new" element={<RoleRoute user={user} segment="new" />} />
                            <Route path="requests" element={<RoleRoute user={user} segment="requests" />} />
                            <Route path="complaints" element={<RoleRoute user={user} segment="complaints" />} />
                            <Route path="queue" element={<RoleRoute user={user} segment="queue" />} />
                            <Route path="pickups" element={<RoleRoute user={user} segment="pickups" />} />
                            <Route path="scan" element={<RoleRoute user={user} segment="scan" />} />
                            <Route path="alerts" element={<RoleRoute user={user} segment="alerts" />} />
                            <Route path="users" element={<RoleRoute user={user} segment="users" />} />
                            <Route path="*" element={<EmptyState title="Page not found" />} />
                        </Routes>
                    </AppShell>
                )}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
