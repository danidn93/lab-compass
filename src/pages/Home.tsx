import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import QuienesSomosPage from "@/pages/QuienesSomosPage";
import ServiciosPage from "@/pages/ServiciosPage";
import ContactanosPage from "@/pages/ContactanosPage";
import DomicilioPage from "@/pages/DomicilioPage";
import CatalogoPruebasPage from "@/pages/CatalogoPruebasPage";

type LaboratorioConfig = {
  id?: string;
  logo?: string | null;
  name?: string | null;
  owner?: string | null;
  address?: string | null;
  ruc?: string | null;
  health_registry?: string | null;
  phone?: string | null;
  schedule?: string | null;
  updated_at?: string | null;
  legal_name?: string | null;
  email?: string | null;
  firma?: string | null;
  sello?: string | null;
};

const COLORS = {
  primary: "#8C1D2C",
  primaryDark: "#6F1522",
  primarySoft: "#F7E9EC",
  secondary: "#5E7C96",
  secondaryDark: "#3E5A72",
  secondarySoft: "#EAF2F7",
  dark: "#1F2937",
  darker: "#111827",
  light: "#F8FAFC",
  border: "#E5E7EB",
  white: "#FFFFFF",
  textSoft: "#64748B",
};

export default function HomePage() {
  const [stats, setStats] = useState({
    pacientes: 0,
    ordenes: 0,
    laboratorio: {} as LaboratorioConfig,
  });

  const [modal, setModal] = useState<null | string>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ count: pacientes }, { count: ordenes }, { data: laboratorio }] =
          await Promise.all([
            supabase.from("pacientes").select("*", { count: "exact", head: true }),
            supabase.from("ordenes").select("*", { count: "exact", head: true }),
            supabase
              .from("configuracion_laboratorio")
              .select("*")
              .limit(1)
              .maybeSingle(),
          ]);

        setStats({
          pacientes: pacientes || 0,
          ordenes: ordenes || 0,
          laboratorio: (laboratorio as LaboratorioConfig) || {},
        });
      } catch (error) {
        console.error("Error cargando datos del home:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const lab = stats.laboratorio || {};

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: COLORS.light, color: COLORS.dark }}
    >      

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur" style={{ borderColor: COLORS.border }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-4">
            {lab.logo ? (
              <img
                src={lab.logo}
                alt={lab.name || "Logo laboratorio"}
                className="h-14 w-14 rounded-xl object-contain shadow-sm"
                style={{ border: `1px solid ${COLORS.border}` }}
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: COLORS.primarySoft }}
              >
                🧪
              </div>
            )}

            <div className="hidden sm:block">
              <h1 className="text-lg font-bold leading-tight" style={{ color: COLORS.dark }}>
                {lab.name || 'Laboratorio de Análisis Clínico "Central"'}
              </h1>
              <p className="text-sm" style={{ color: COLORS.textSoft }}>
                Resultados confiables y atención profesional
              </p>
            </div>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a
              href="/"
              className="text-sm font-semibold"
              style={{ color: COLORS.primary }}
            >
              Inicio
            </a>

            <button
              onClick={() => setModal("quienes")}
              className="text-sm font-medium transition"
              style={{ color: COLORS.dark }}
              onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.dark)}
            >
              Quiénes somos
            </button>

            <button
              onClick={() => setModal("servicios")}
              className="text-sm font-medium transition"
              style={{ color: COLORS.dark }}
              onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.dark)}
            >
              Servicios
            </button>

            <button
              onClick={() => setModal("contacto")}
              className="text-sm font-medium transition"
              style={{ color: COLORS.dark }}
              onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.primary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.dark)}
            >
              Contáctanos
            </button>
          </div>

          <button
            className="rounded-lg border px-3 py-2 text-sm md:hidden"
            style={{ borderColor: COLORS.border }}
          >
            ☰
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(to right, ${COLORS.primaryDark}, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,white,transparent_35%),radial-gradient(circle_at_bottom_left,white,transparent_25%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center text-white">
            <span className="mb-4 inline-flex w-fit rounded-full bg-white/15 px-4 py-1 text-sm font-medium backdrop-blur">
              Laboratorio clínico • Atención profesional
            </span>

            <h2 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              {lab.name || 'Laboratorio de Análisis Clínico "Central"'}
            </h2>

            <p className="mt-5 max-w-xl text-base sm:text-lg text-white/90">
              Resultados precisos, servicio confiable y atención humana para el cuidado de tu salud.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/portal"
                className="rounded-xl px-6 py-3 font-semibold shadow-lg transition hover:scale-[1.02]"
                style={{
                  backgroundColor: COLORS.white,
                  color: COLORS.primary,
                }}
              >
                Consultar resultados
              </a>

              <a
                href="/cotizador"
                className="rounded-xl border px-6 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
                style={{ borderColor: "rgba(255,255,255,0.4)", backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                Cotizar exámenes
              </a>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div
              className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
              style={{ border: "1px solid rgba(0,0,0,0.05)" }}
            >
              <div className="mb-6 flex items-center gap-4">
                {lab.logo ? (
                  <img
                    src={lab.logo}
                    alt={lab.name || "Logo"}
                    className="h-20 w-20 rounded-2xl object-contain"
                    style={{ border: `1px solid ${COLORS.border}` }}
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl"
                    style={{ backgroundColor: COLORS.primarySoft }}
                  >
                    🧪
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                    {lab.name || 'Laboratorio de Análisis Clínico "Central"'}
                  </h3>
                  {lab.owner && (
                    <p className="mt-1 text-sm" style={{ color: COLORS.textSoft }}>
                      {lab.owner}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl p-4" style={{ backgroundColor: COLORS.primarySoft }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.primary }}>
                    Dirección
                  </p>
                  <p className="mt-2 text-sm" style={{ color: COLORS.dark }}>
                    {lab.address || "No registrada"}
                  </p>
                </div>

                <div className="rounded-2xl p-4" style={{ backgroundColor: COLORS.secondarySoft }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.secondaryDark }}>
                    Teléfono
                  </p>
                  <p className="mt-2 text-sm" style={{ color: COLORS.dark }}>
                    {lab.phone || "No registrado"}
                  </p>
                </div>

                <div className="rounded-2xl p-4" style={{ backgroundColor: COLORS.primarySoft }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.primary }}>
                    RUC
                  </p>
                  <p className="mt-2 text-sm" style={{ color: COLORS.dark }}>
                    {lab.ruc || "No registrado"}
                  </p>
                </div>

                <div className="rounded-2xl p-4" style={{ backgroundColor: COLORS.secondarySoft }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.secondaryDark }}>
                    Registro sanitario
                  </p>
                  <p className="mt-2 text-sm" style={{ color: COLORS.dark }}>
                    {lab.health_registry || "No registrado"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACCESOS RÁPIDOS */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h3 className="text-3xl font-bold" style={{ color: COLORS.dark }}>
              Accesos rápidos
            </h3>
            <p className="mt-3" style={{ color: COLORS.textSoft }}>
              Consulta tus servicios más importantes de forma rápida y sencilla.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div
              className="group rounded-3xl bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              style={{ border: `1px solid ${COLORS.border}` }}
            >
              <div
                className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                style={{ backgroundColor: COLORS.primarySoft }}
              >
                📄
              </div>
              <h4 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Consulta tus resultados
              </h4>
              <p className="mt-3" style={{ color: COLORS.textSoft }}>
                Accede de forma segura a los resultados de tus exámenes clínicos.
              </p>
              <a
                href="/portal"
                className="mt-6 inline-block rounded-xl px-6 py-3 font-semibold text-white transition"
                style={{ backgroundColor: COLORS.primary }}
              >
                Consultar ahora
              </a>
            </div>

            <div
              className="group rounded-3xl bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              style={{ border: `1px solid ${COLORS.border}` }}
            >
              <div
                className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                style={{ backgroundColor: COLORS.secondarySoft }}
              >
                🧾
              </div>
              <h4 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Cotiza tus exámenes
              </h4>
              <p className="mt-3" style={{ color: COLORS.textSoft }}>
                Revisa valores referenciales de tus pruebas de laboratorio de manera rápida.
              </p>
              <a
                href="/cotizador"
                className="mt-6 inline-block rounded-xl px-6 py-3 font-semibold text-white transition"
                style={{ backgroundColor: COLORS.secondaryDark }}
              >
                Cotizar
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h3 className="text-3xl font-bold" style={{ color: COLORS.dark }}>
              Nuestros servicios
            </h3>
            <p className="mt-3" style={{ color: COLORS.textSoft }}>
              Atención clínica con calidad, confianza y comodidad para nuestros pacientes.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div
              className="rounded-3xl p-8 transition hover:shadow-lg"
              style={{
                border: `1px solid ${COLORS.border}`,
                backgroundColor: COLORS.light,
              }}
            >
              <div className="mb-5 text-5xl">🏠</div>
              <h4 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Servicio a domicilio
              </h4>
              <p className="mt-3" style={{ color: COLORS.textSoft }}>
                Toma de muestras en casa o en tu lugar de trabajo, con comodidad y seguridad.
              </p>
              <button
                onClick={() => setModal("domicilio")}
                className="mt-6 font-semibold"
                style={{ color: COLORS.primary }}
              >
                Ver más →
              </button>
            </div>

            <div
              className="rounded-3xl p-8 transition hover:shadow-lg"
              style={{
                border: `1px solid ${COLORS.border}`,
                backgroundColor: COLORS.light,
              }}
            >
              <div className="mb-5 text-5xl">🧪</div>
              <h4 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Catálogo de pruebas
              </h4>
              <p className="mt-3" style={{ color: COLORS.textSoft }}>
                Conoce nuestro catálogo de exámenes clínicos disponibles.
              </p>
              <button
                onClick={() => setModal("catalogo")}
                className="mt-6 font-semibold"
                style={{ color: COLORS.secondaryDark }}
              >
                Ver más →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ESTADÍSTICAS */}
      <section className="py-16 text-white" style={{ backgroundColor: COLORS.dark }}>
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-4xl font-extrabold" style={{ color: "#D9AAB1" }}>
              {loading ? "..." : stats.pacientes.toLocaleString()}
            </div>
            <p className="mt-3 text-sm text-slate-300">Pacientes registrados</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-4xl font-extrabold" style={{ color: "#B7D0E3" }}>
              {loading ? "..." : stats.ordenes.toLocaleString()}
            </div>
            <p className="mt-3 text-sm text-slate-300">Órdenes procesadas</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-4xl font-extrabold text-white">29</div>
            <p className="mt-3 text-sm text-slate-300">Años de experiencia</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-4xl font-extrabold text-white">Calidad</div>
            <p className="mt-3 text-sm text-slate-300">Compromiso en cada resultado</p>
          </div>
        </div>
      </section>

      {/* INFORMACIÓN DEL LABORATORIO */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h3 className="text-3xl font-bold" style={{ color: COLORS.dark }}>
              Información del laboratorio
            </h3>
            <p className="mt-3" style={{ color: COLORS.textSoft }}>
              Datos institucionales y de contacto para una mejor atención.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div
              className="rounded-3xl bg-white p-8 shadow-sm lg:col-span-2"
              style={{ border: `1px solid ${COLORS.border}` }}
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textSoft }}>
                    Nombre
                  </p>
                  <p className="mt-2 text-base font-medium" style={{ color: COLORS.dark }}>
                    {lab.name || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textSoft }}>
                    Responsable
                  </p>
                  <p className="mt-2 text-base" style={{ color: COLORS.dark }}>
                    {lab.owner || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textSoft }}>
                    Dirección
                  </p>
                  <p className="mt-2 text-base" style={{ color: COLORS.dark }}>
                    {lab.address || "No registrada"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textSoft }}>
                    Teléfono
                  </p>
                  <p className="mt-2 text-base" style={{ color: COLORS.dark }}>
                    {lab.phone || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textSoft }}>
                    Correo electrónico
                  </p>
                  <p className="mt-2 text-base" style={{ color: COLORS.dark }}>
                    {lab.email || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textSoft }}>
                    Horario
                  </p>
                  <p className="mt-2 text-base" style={{ color: COLORS.dark }}>
                    {lab.schedule || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textSoft }}>
                    RUC
                  </p>
                  <p className="mt-2 text-base" style={{ color: COLORS.dark }}>
                    {lab.ruc || "No registrado"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textSoft }}>
                    Registro sanitario
                  </p>
                  <p className="mt-2 text-base" style={{ color: COLORS.dark }}>
                    {lab.health_registry || "No registrado"}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-3xl p-8 text-white shadow-xl"
              style={{
                background: `linear-gradient(to bottom right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
              }}
            >
              <h4 className="text-xl font-bold">Tu salud, nuestra prioridad</h4>
              <p className="mt-4 text-sm leading-6 text-white/90">
                Brindamos atención confiable y resultados oportunos para apoyar el cuidado de tu salud
                y la de tu familia.
              </p>

              <div className="mt-8 space-y-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  ✅ Atención profesional
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  ✅ Resultados confiables
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  ✅ Servicio ágil y seguro
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "🧪",
                title: "Resultados confiables",
                text: "Procesos de análisis orientados a entregar resultados oportunos y seguros.",
                bg: COLORS.primarySoft,
              },
              {
                icon: "👨‍⚕️",
                title: "Atención profesional",
                text: "Personal capacitado para brindar una experiencia clara, humana y eficiente.",
                bg: COLORS.secondarySoft,
              },
              {
                icon: "⚡",
                title: "Servicio ágil",
                text: "Accede a cotizaciones, resultados y atención de forma rápida y sencilla.",
                bg: COLORS.primarySoft,
              },
              {
                icon: "🏠",
                title: "Toma de muestras a domicilio",
                text: "Comodidad y seguridad para pacientes que prefieren atención en casa o trabajo.",
                bg: COLORS.secondarySoft,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl p-6"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: item.bg,
                }}
              >
                <div className="mb-4 text-4xl">{item.icon}</div>
                <h3 className="text-lg font-bold" style={{ color: COLORS.dark }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-sm" style={{ color: COLORS.textSoft }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POR QUÉ ELEGIRNOS */}
      <section style={{ backgroundColor: COLORS.light }} className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-[0.2em]"
                style={{ color: COLORS.primary }}
              >
                ¿Por qué elegirnos?
              </p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: COLORS.dark }}>
                Comprometidos con la calidad en cada resultado
              </h2>
              <p className="mt-5 leading-7" style={{ color: COLORS.textSoft }}>
                En {lab.name || "nuestro laboratorio"} trabajamos con un enfoque profesional y humano,
                brindando servicios de análisis clínico orientados a la confianza, precisión y atención oportuna.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  "Procesos organizados y atención responsable al paciente.",
                  "Amplio catálogo de pruebas clínicas disponibles.",
                  "Facilidad para consultar resultados y cotizar exámenes.",
                  "Atención presencial y servicio a domicilio.",
                ].map((text) => (
                  <div key={text} className="flex gap-3">
                    <span className="text-xl" style={{ color: COLORS.primary }}>✔</span>
                    <p style={{ color: COLORS.dark }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-3xl bg-white p-8 shadow-sm"
              style={{ border: `1px solid ${COLORS.border}` }}
            >
              <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Datos institucionales
              </h3>
              <div className="mt-6 space-y-4 text-sm" style={{ color: COLORS.dark }}>
                <div>
                  <p className="font-semibold" style={{ color: COLORS.textSoft }}>
                    Responsable
                  </p>
                  <p>{lab.owner || "No registrado"}</p>
                </div>
                <div>
                  <p className="font-semibold" style={{ color: COLORS.textSoft }}>
                    RUC
                  </p>
                  <p>{lab.ruc || "No registrado"}</p>
                </div>
                <div>
                  <p className="font-semibold" style={{ color: COLORS.textSoft }}>
                    Registro sanitario
                  </p>
                  <p>{lab.health_registry || "No registrado"}</p>
                </div>
                <div>
                  <p className="font-semibold" style={{ color: COLORS.textSoft }}>
                    Horario
                  </p>
                  <p>{lab.schedule || "No registrado"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESO */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.secondaryDark }}
            >
              Nuestro proceso
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: COLORS.dark }}>
              ¿Cómo funciona?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl" style={{ color: COLORS.textSoft }}>
              Hemos simplificado el proceso para que nuestros pacientes accedan con facilidad a nuestros servicios.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                title: "Consulta o cotiza",
                text: "Revisa nuestro catálogo de pruebas o solicita una cotización.",
              },
              {
                n: "02",
                title: "Acude o solicita domicilio",
                text: "Visítanos en nuestras instalaciones o agenda la toma de muestra a domicilio.",
              },
              {
                n: "03",
                title: "Procesamos tu muestra",
                text: "Realizamos el análisis correspondiente con cuidado y responsabilidad.",
              },
              {
                n: "04",
                title: "Consulta resultados",
                text: "Accede en línea a tus resultados de manera práctica y segura.",
              },
            ].map((step, index) => (
              <div
                key={step.n}
                className="rounded-3xl p-6"
                style={{
                  backgroundColor: index % 2 === 0 ? COLORS.primarySoft : COLORS.secondarySoft,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div
                  className="mb-4 text-3xl font-bold"
                  style={{ color: index % 2 === 0 ? COLORS.primary : COLORS.secondaryDark }}
                >
                  {step.n}
                </div>
                <h3 className="text-lg font-bold" style={{ color: COLORS.dark }}>
                  {step.title}
                </h3>
                <p className="mt-2 text-sm" style={{ color: COLORS.textSoft }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ÁREAS */}
      <section style={{ backgroundColor: COLORS.light }} className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold" style={{ color: COLORS.dark }}>
              Áreas de análisis
            </h2>
            <p className="mt-3" style={{ color: COLORS.textSoft }}>
              Algunas de las pruebas y servicios que nuestros pacientes consultan con mayor frecuencia.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              "Hematología",
              "Química clínica",
              "Parasitología",
              "Uroanálisis",
              "Serología",
              "Perfiles y chequeos",
            ].map((item, index) => (
              <div
                key={item}
                className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                style={{ border: `1px solid ${COLORS.border}` }}
              >
                <div
                  className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                  style={{
                    backgroundColor: index % 2 === 0 ? COLORS.primarySoft : COLORS.secondarySoft,
                  }}
                >
                  🧫
                </div>
                <h3 className="text-lg font-bold" style={{ color: COLORS.dark }}>
                  {item}
                </h3>
                <p className="mt-2 text-sm" style={{ color: COLORS.textSoft }}>
                  Consulta disponibilidad, valores referenciales y detalles de esta área.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section
        className="py-20 text-white"
        style={{
          background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Tu salud merece atención confiable
          </h2>
          <p className="mt-4 text-white/90">
            Consulta resultados, cotiza tus exámenes o contáctanos para recibir atención personalizada.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="/portal"
              className="rounded-xl px-6 py-3 font-semibold"
              style={{ backgroundColor: COLORS.white, color: COLORS.primary }}
            >
              Ver resultados
            </a>

            <a
              href="/cotizador"
              className="rounded-xl border px-6 py-3 font-semibold text-white"
              style={{
                borderColor: "rgba(255,255,255,0.4)",
                backgroundColor: "rgba(255,255,255,0.1)",
              }}
            >
              Cotizar exámenes
            </a>

            <button
              onClick={() => setModal("contacto")}
              className="rounded-xl border bg-transparent px-6 py-3 font-semibold text-white"
              style={{ borderColor: "rgba(255,255,255,0.4)" }}
            >
              Contáctanos
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 text-white" style={{ backgroundColor: COLORS.darker }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <h5
                className="mb-4 text-sm font-bold uppercase tracking-wide"
                style={{ color: "#D9AAB1" }}
              >
                Laboratorio
              </h5>
              <p className="text-sm text-slate-400">
                {lab.name || 'Laboratorio de Análisis Clínico "Central"'}
              </p>
              {lab.owner && <p className="mt-2 text-sm text-slate-400">{lab.owner}</p>}
            </div>

            <div>
              <h5
                className="mb-4 text-sm font-bold uppercase tracking-wide"
                style={{ color: "#B7D0E3" }}
              >
                Contacto
              </h5>
              <div className="space-y-2 text-sm text-slate-400">
                <p>{lab.address || "Dirección no registrada"}</p>
                <p>{lab.phone || "Teléfono no registrado"}</p>
                <p>{lab.email || "Correo no registrado"}</p>
              </div>
            </div>

            <div>
              <h5
                className="mb-4 text-sm font-bold uppercase tracking-wide"
                style={{ color: "#D9AAB1" }}
              >
                Datos legales
              </h5>
              <div className="space-y-2 text-sm text-slate-400">
                <p>RUC: {lab.ruc || "No registrado"}</p>
                <p>Registro sanitario: {lab.health_registry || "No registrado"}</p>
                <p>{lab.schedule || "Horario no registrado"}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 text-center text-sm text-slate-500">
            © {new Date().getFullYear()} {lab.name || "Laboratorio Central"} — Todos los derechos reservados
          </div>
        </div>
      </footer>

      {/* MODALES */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <button
              onClick={() => setModal(null)}
              className="absolute right-4 top-4 z-10 rounded-full px-3 py-1 text-xl transition"
              style={{
                backgroundColor: "#F1F5F9",
                color: COLORS.dark,
              }}
            >
              ✕
            </button>

            {modal === "quienes" && <QuienesSomosPage />}
            {modal === "servicios" && <ServiciosPage />}
            {modal === "contacto" && <ContactanosPage />}
            {modal === "domicilio" && <DomicilioPage />}
            {modal === "catalogo" && <CatalogoPruebasPage />}
          </div>
        </div>
      )}
    </div>
  );
}