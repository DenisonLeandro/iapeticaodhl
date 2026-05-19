import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdminRoute from "@/components/auth/AdminRoute";
import { AppLayout } from "@/components/layout";
import Index from "./pages/Index.tsx";
import AuthPanel from "./components/auth/AuthPanel";
import Dashboard from "./pages/Dashboard.tsx";
import UsersPage from "./pages/settings/UsersPage.tsx";
import AISettingsPage from "./pages/settings/AISettingsPage.tsx";
import HelpPage from "./pages/HelpPage.tsx";

import CasesPage from "./pages/cases/CasesPage.tsx";
import CaseDetailPage from "./pages/cases/CaseDetailPage.tsx";

import ClientsPage from "./pages/clients/ClientsPage.tsx";
import ClientDetailPage from "./pages/clients/ClientDetailPage.tsx";
import Placeholder from "./pages/Placeholder.tsx";
import SettingsPage from "./pages/settings/SettingsPage.tsx";
import NewDocument from "./pages/ai/NewDocument.tsx";
import DocumentsPage from "./pages/ai/DocumentsPage.tsx";
import DocumentEditPage from "./pages/ai/DocumentEditPage.tsx";
import PublicationsPage from "./pages/publications/PublicationsPage.tsx";
import NotFound from "./pages/NotFound.tsx";


const queryClient = new QueryClient();

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<AuthPanel />} />
            <Route path="/register" element={<AuthPanel />} />

            {/* Protected routes with AppLayout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/ai/new" element={<NewDocument />} />
                <Route path="/ai/documents" element={<DocumentsPage />} />
                <Route path="/ai/documents/:id/edit" element={<DocumentEditPage />} />
                <Route path="/ai" element={<Navigate to="/ai/new" replace />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/new" element={<Navigate to="/clients?new=true" replace />} />
                <Route path="/clients/:id" element={<ClientDetailPage />} />
                <Route path="/cases" element={<CasesPage />} />
                
                <Route path="/cases/:id" element={<CaseDetailPage />} />
                <Route path="/publications" element={<PublicationsPage />} />
                <Route path="/cases/publications" element={<Navigate to="/publications" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/profile" element={<Navigate to="/settings?tab=profile" replace />} />
                <Route path="/settings/users" element={<Navigate to="/settings?tab=users" replace />} />
                <Route path="/settings/ai" element={<Navigate to="/settings?tab=ai" replace />} />
                <Route path="/settings/ai" element={<Navigate to="/settings?tab=ai" replace />} />
                <Route path="/settings/integrations" element={<Navigate to="/settings?tab=ai" replace />} />
                <Route path="/help" element={<HelpPage />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
