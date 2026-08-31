import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  Toaster as Sonner,
} from "@/components/ui/sonner";

import {
  Toaster,
} from "@/components/ui/toaster";

import {
  TooltipProvider,
} from "@/components/ui/tooltip";

import {
  AuthProvider,
  useAuth,
} from "@/contexts/AuthContext";

import {
  DataProvider,
} from "@/contexts/DataContext";

/* ============================================================
   PÁGINAS
============================================================ */

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

import HomePage from "@/pages/Home";
import QuienesSomosPage from "@/pages/QuienesSomosPage";
import ServiciosPage from "@/pages/ServiciosPage";
import ContactanosPage from "@/pages/ContactanosPage";
import DomicilioPage from "@/pages/DomicilioPage";
import CatalogoPruebasPage from "@/pages/CatalogoPruebasPage";

import HistorialPage from "@/pages/HistorialPage";
import CotizadorPage from "@/pages/CotizadorPage";

import Usuarios from "@/pages/Usuarios";
import DoctorsPage from "@/pages/DoctorsPage";
import OrdersByDoctorPage from "@/pages/OrdersByDoctorPage";
import ExamGroupsPage from "@/pages/ExamGroupsPage";

/*
 * IMPORTANTE:
 * Página pública que recibe el token del QR.
 */
import ValidarResultadosPage from "@/pages/ValidarResultadosPage";

import NotFound from "@/pages/NotFound";

/* ============================================================
   QUERY CLIENT
============================================================ */

const queryClient =
  new QueryClient();

/* ============================================================
   RUTAS ADMINISTRATIVAS
============================================================ */

function AdminRoutes() {
  const {
    isAuthenticated,
  } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AdminLayout>
      <Routes>
        <Route
          path="/"
          element={
            <DashboardPage />
          }
        />

        <Route
          path="/inventory"
          element={
            <InventoryPage />
          }
        />

        <Route
          path="/tests"
          element={
            <TestsPage />
          }
        />

        <Route
          path="/patients"
          element={
            <PatientsPage />
          }
        />

        <Route
          path="/orders"
          element={
            <OrdersPage />
          }
        />

        <Route
          path="/results"
          element={
            <ResultsPage />
          }
        />

        <Route
          path="/settings"
          element={
            <SettingsPage />
          }
        />

        <Route
          path="/usuarios"
          element={
            <Usuarios />
          }
        />

        <Route
          path="/doctores"
          element={
            <DoctorsPage />
          }
        />

        <Route
          path="/orders-by-doctor"
          element={
            <OrdersByDoctorPage />
          }
        />

        <Route
          path="/exam-groups"
          element={
            <ExamGroupsPage />
          }
        />
      </Routes>
    </AdminLayout>
  );
}

/* ============================================================
   APP
============================================================ */

const App = () => {
  return (
    <QueryClientProvider
      client={
        queryClient
      }
    >
      <TooltipProvider>
        <AuthProvider>
          <DataProvider>
            <Toaster />

            <Sonner />

            <BrowserRouter>
              <Routes>

                {/* =============================================
                    VALIDACIÓN PÚBLICA DE RESULTADOS
                ============================================== */}

                <Route
                  path="/validar-resultados/:token"
                  element={
                    <ValidarResultadosPage />
                  }
                />

                {/* =============================================
                    PORTAL PACIENTE
                ============================================== */}

                <Route
                  path="/portal"
                  element={
                    <PatientPortalPage />
                  }
                />

                {/* =============================================
                    ADMINISTRACIÓN
                ============================================== */}

                <Route
                  path="/admin/*"
                  element={
                    <AdminRoutes />
                  }
                />

                {/* =============================================
                    WEB PÚBLICA
                ============================================== */}

                <Route
                  path="/"
                  element={
                    <HomePage />
                  }
                />

                <Route
                  path="/quienes-somos"
                  element={
                    <QuienesSomosPage />
                  }
                />

                <Route
                  path="/servicios"
                  element={
                    <ServiciosPage />
                  }
                />

                <Route
                  path="/contactanos"
                  element={
                    <ContactanosPage />
                  }
                />

                <Route
                  path="/domicilio"
                  element={
                    <DomicilioPage />
                  }
                />

                <Route
                  path="/catalogopruebas"
                  element={
                    <CatalogoPruebasPage />
                  }
                />

                <Route
                  path="/historial"
                  element={
                    <HistorialPage />
                  }
                />

                <Route
                  path="/cotizador"
                  element={
                    <CotizadorPage />
                  }
                />

                {/* =============================================
                    404
                ============================================== */}

                <Route
                  path="*"
                  element={
                    <NotFound />
                  }
                />

              </Routes>
            </BrowserRouter>
          </DataProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;