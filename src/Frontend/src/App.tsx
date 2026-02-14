import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import MainLayout from "./components/layout/MainLayout";
import { SidebarProvider } from "./contexts/SidebarContext";
import { useTokenWatcher } from "./hooks/useTokenWatcher";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import StudioPage from "./pages/StudioPage";
import StudioCardsPage from "./pages/StudioCardsPage";
import StudioDashboardsPageNew from "./pages/StudioDashboardsPageNew";
import DashboardPreviewPage from "./pages/DashboardPreviewPage";
import SetupWizardPage from "./pages/SetupWizardPage";
import CompaniesPage from "./pages/CompaniesPage";
import ClientsPage from "./pages/ClientsPage";
import UserProfilePage from "./pages/UserProfilePage";
import { getDatabaseBootstrap, getSetupStatus } from "./lib/setupApi";

// A simple component to protect routes
const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const isAuthenticated = !!localStorage.getItem("accessToken");
  const [bootstrapReady, setBootstrapReady] = useState<"checking" | "ready" | "bootstrap">("checking");
  const [setupReady, setSetupReady] = useState<"checking" | "ready" | "setup">("checking");
  const navigate = useNavigate();
  const location = useLocation();

  // Watch for token expiration and auto-logout
  useTokenWatcher();

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setBootstrapReady("ready");
      setSetupReady("ready");
      return () => {
        active = false;
      };
    }
    getSetupStatus()
      .then((setupStatus) => {
        if (!active) return;
        if (setupStatus.isConfigured) {
          setSetupReady("ready");
          setBootstrapReady("ready");
          return;
        }
        getDatabaseBootstrap()
          .then((status) => {
            if (!active) return;
            const dbConfigured = Boolean(status.connectionStringMasked);
            const dbProvisioned = Boolean(status.provisionedAt);
            const dbReady = dbConfigured && dbProvisioned;
            setBootstrapReady(dbReady ? "ready" : "bootstrap");
            setSetupReady("setup");
          })
          .catch(() => {
            if (!active) return;
            setBootstrapReady("ready");
            setSetupReady("setup");
          });
      })
      .catch(() => {
        if (!active) return;
        getDatabaseBootstrap()
          .then((status) => {
            if (!active) return;
            const dbConfigured = Boolean(status.connectionStringMasked);
            const dbProvisioned = Boolean(status.provisionedAt);
            const dbReady = dbConfigured && dbProvisioned;
            setBootstrapReady(dbReady ? "ready" : "bootstrap");
            setSetupReady("setup");
          })
          .catch(() => {
            if (!active) return;
            setBootstrapReady("ready");
            setSetupReady("setup");
          });
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    // If setup is fully ready, ensure we don't stay on /setup unless really needed.
    // If not ready, redirect to /setup.
    
    if (bootstrapReady === "ready" && setupReady === "ready") {
        if (location.pathname === "/setup") {
            navigate("/dashboard", { replace: true });
        }
    } else if (bootstrapReady === "bootstrap" || setupReady === "setup") {
        if (location.pathname !== "/setup") {
            navigate("/setup", { replace: true });
        }
    }
  }, [bootstrapReady, setupReady, location.pathname, navigate, isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (bootstrapReady === "checking") {
    return null;
  }
  if (setupReady === "checking") {
    return null;
  }

  if (bootstrapReady === "bootstrap" && location.pathname !== "/setup") {
    return null;
  }
  if (setupReady === "setup" && location.pathname !== "/setup") {
    return null;
  }

  return <MainLayout>{children}</MainLayout>;
};

function App() {
  return (
    <Router>
      <SidebarProvider>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <SetupWizardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <StudioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio/cards"
          element={
            <ProtectedRoute>
              <StudioCardsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio/dashboards"
          element={
            <ProtectedRoute>
              <StudioDashboardsPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio/dashboards/preview/:id"
          element={
            <ProtectedRoute>
              <DashboardPreviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cards"
          element={
            <Navigate to="/studio/cards" replace />
          }
        />
        <Route
          path="/companies"
          element={
            <ProtectedRoute>
              <CompaniesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        {/* Redirect root to dashboard if authenticated, otherwise to login */}
        <Route
          path="/"
          element={
            localStorage.getItem("accessToken") ? (
              <Navigate to="/dashboard" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        </Routes>
      </SidebarProvider>
    </Router>
  );
}

export default App;
