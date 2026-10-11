// App.tsx: the root component that sets up routing, auth context, and layout.
//
// NEW CONCEPT: React Router — lets the URL determine what page to show.
// Routes map URL patterns to components. ProtectedRoute blocks unauthenticated
// users from accessing pages that require a login.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TicketListPage from "./pages/TicketListPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gray-100">
      {user && <Navbar />}
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/tickets" element={
            <ProtectedRoute><AppLayout><TicketListPage /></AppLayout></ProtectedRoute>
          } />
          <Route path="/tickets/:ticketId" element={
            <ProtectedRoute><AppLayout><TicketDetailPage /></AppLayout></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
