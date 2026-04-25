import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import LoginPage from "@/pages/LoginPage";
import AdminLayout from "@/components/AdminLayout";
import DashboardPage from "@/pages/DashboardPage";
import InventoryPage from "@/pages/InventoryPage";
import TestsPage from "@/pages/TestsPage";
import PatientsPage from "@/pages/PatientsPage";
import OrdersPage from "@/pages/OrdersPage";
import ResultsPage from "@/pages/ResultsPage";
import SettingsPage from "@/pages/SettingsPage";
import PatientPortalPage from "@/pages/PatientPortalPage";
import NotFound from "./pages/NotFound.tsx";
import HomePage from "@/pages/Home";
import QuienesSomosPage from "@/pages/QuienesSomosPage";
import ServiciosPage from "@/pages/ServiciosPage";
import ContactanosPage from "@/pages/ContactanosPage";
import DomicilioPage from "@/pages/DomicilioPage";
import CatalogoPruebasPage from "@/pages/CatalogoPruebasPage";
import HistorialPage from "./pages/HistorialPage.tsx";
import CotizadorPage from "./pages/CotizadorPage.tsx";
import Usuarios from "./pages/Usuarios.tsx";
import DoctorsPage from "./pages/DoctorsPage.tsx";
import OrdersByDoctorPage from "./pages/OrdersByDoctorPage.tsx";
import ExamGroupsPage from "./pages/ExamGroupsPage.tsx";

const queryClient = new QueryClient();

function AdminRoutes() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/tests" element={<TestsPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/doctores" element={<DoctorsPage />} />
        <Route path="/orders-by-doctor" element={<OrdersByDoctorPage />} />
        <Route path="/exam-groups" element={<ExamGroupsPage />} />
      </Routes>
    </AdminLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <DataProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/portal" element={<PatientPortalPage />} />
              <Route path="/admin/*" element={<AdminRoutes />} />
              <Route path="/" element={<HomePage />} />
              <Route path="*" element={<NotFound />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/quienes-somos" element={<QuienesSomosPage />} />
              <Route path="/servicios" element={<ServiciosPage />} />
              <Route path="/contactanos" element={<ContactanosPage />} />
              <Route path="/domicilio" element={<DomicilioPage />} />
              <Route path="/catalogopruebas" element={<CatalogoPruebasPage />} />
              <Route path="/historial" element={<HistorialPage />} />
              <Route path="/cotizador" element={<CotizadorPage />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

function HomeRedirect() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-4">
      <div className="w-20 h-20 rounded-2xl gradient-clinical flex items-center justify-center">
        <svg className="w-10 h-10 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </div>
      <h1 className="text-3xl font-display font-bold text-foreground">BioAnalítica</h1>
      <p className="text-muted-foreground text-center max-w-md">Sistema de Gestión de Laboratorio Clínico</p>
      <div className="flex gap-4 mt-4">
        <a href="/admin" className="inline-flex items-center justify-center rounded-lg px-6 py-3 font-medium gradient-clinical text-primary-foreground transition-opacity hover:opacity-90">
          Panel Administrativo
        </a>
        <a href="/portal" className="inline-flex items-center justify-center rounded-lg px-6 py-3 font-medium border border-border bg-card hover:bg-muted transition-colors">
          Consultar Resultados
        </a>
      </div>
    </div>
  );
}

export default App;
