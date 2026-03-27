import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import QuienesSomosPage from "@/pages/QuienesSomosPage";
import ServiciosPage from "@/pages/ServiciosPage";
import ContactanosPage from "@/pages/ContactanosPage";
import DomicilioPage from "@/pages/DomicilioPage";
import CatalogoPruebasPage from "@/pages/CatalogoPruebasPage";

export default function HomePage() {
  const [stats, setStats] = useState({
    pacientes: 0,
    ordenes: 0,
    laboratorio: null as any,
  });
  const [modal, setModal] = useState<null | string>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { count: pacientes } = await supabase
        .from("pacientes")
        .select("*", { count: "exact", head: true });

      const { count: ordenes } = await supabase
        .from("ordenes")
        .select("*", { count: "exact", head: true });

      const { data: laboratorio } = await supabase
        .from("configuracion_laboratorio")
        .select("*")
        .limit(1)
        .single();

      setStats({
        pacientes: pacientes || 0,
        ordenes: ordenes || 0,
        laboratorio: laboratorio || {},
      });
    };
    fetchData();
  }, []);

  const lab = stats.laboratorio || {};

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* HEADER INFO */}
      <header className="py-2 bg-[#68A883] text-white text-sm">
        <div className="container mx-auto px-5 flex flex-col md:flex-row justify-end items-center gap-4">
          <div className="flex items-center gap-2">
            <span>📞</span>
            <span>+593 04-2594010</span>
          </div>
          <a href="mailto:consultas@interlabsa.com" className="flex items-center gap-2 hover:underline">
            ✉️ consultas@interlabsa.com
          </a>
        </div>
      </header>

      {/* NAVBAR */}
      <nav className="bg-white shadow sticky top-0 z-50">
        <div className="container mx-auto px-5 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            {/* Reemplazamos next/image por img normal */}
            <img
              src="/resources/img/assets/logo_interlab.png"
              alt="Interlab"
              className="h-12 w-auto"
            />
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="/" className="hover:text-[#68A883]">Inicio</a>
            <button onClick={() => setModal("quienes")}>Quiénes Somos</button>
            <button onClick={() => setModal("servicios")}>Servicios</button>
            <button onClick={() => setModal("contacto")}>Contáctanos</button>
          </div>

          <button className="md:hidden">☰</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative h-[500px] md:h-[600px] overflow-hidden">
        <img
          src="/files/banners/sl25de1.png"  
          alt="Banner Interlab"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-center px-6">
          <div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              {lab.name || "Laboratorio Clínico Interlab"}
            </h1>
            <p className="max-w-xl mx-auto text-lg">
              Resultados confiables con tecnología de vanguardia
            </p>
          </div>
        </div>
      </section>

      {/* ACCESOS RÁPIDOS */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-5">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow hover:shadow-xl transition p-6 text-center">
              <div className="text-[#68A883] text-5xl mb-4">📋</div>
              <h5 className="font-semibold text-lg mb-2">Consulta tus Resultados</h5>
              <a
                href="/portal"
                className="inline-block mt-4 px-8 py-2.5 bg-[#68A883] text-white rounded-full font-medium hover:bg-[#5a9c72]"
              >
                Consultar
              </a>
            </div>
            
            {/* Card 3 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow hover:shadow-xl transition p-6 text-center">
              <div className="text-[#68A883] text-5xl mb-4">📖</div>
              <h5 className="font-semibold text-lg mb-2">Historial Clínico</h5>
              <a
                href="/historial"
                target="_blank"
                className="inline-block mt-4 px-8 py-2.5 bg-[#68A883] text-white rounded-full font-medium hover:bg-[#5a9c72]"
              >
                Acceder
              </a>
            </div>

            {/* Card 4 */}
            <div className="bg-white border border-gray-200 rounded-xl shadow hover:shadow-xl transition p-6 text-center">
              <div className="text-[#68A883] text-5xl mb-4">💲</div>
              <h5 className="font-semibold text-lg mb-2">Cotiza tus Exámenes</h5>
              <a
                href="/cotizador"
                target="_blank"
                className="inline-block mt-4 px-8 py-2.5 bg-[#68A883] text-white rounded-full font-medium hover:bg-[#5a9c72]"
              >
                Cotizar
              </a>
            </div>
            
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-5">
          <h2 className="text-3xl font-bold text-center mb-12">Servicios</h2>
          <div className="grid md:grid-cols-2 gap-8">
            
            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow hover:shadow-2xl transition">
              <div className="text-[#68A883] text-6xl mb-6">🏠</div>
              <h4 className="font-semibold text-xl mb-3">Servicio a Domicilio</h4>
              <p className="text-gray-600">
                Realiza tus exámenes desde la comodidad de tu hogar o trabajo.
              </p>
              <button onClick={() => setModal("domicilio")}>
                Ver más →
              </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow hover:shadow-2xl transition">
              <div className="text-[#68A883] text-6xl mb-6">📋</div>
              <h4 className="font-semibold text-xl mb-3">Catálogo de Pruebas</h4>
              <p className="text-gray-600">
                Amplio catálogo de exámenes clínicos con la más alta tecnología.
              </p>
              <button onClick={() => setModal("catalogo")}>
                Ver más →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ESTADÍSTICAS */}
      <section className="py-16 bg-[#68A883] text-white">
        <div className="container mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          <div>
            <div className="w-28 h-28 mx-auto bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-4xl font-bold mb-4">
              {stats.pacientes.toLocaleString()}
            </div>
            <p className="font-medium">Pacientes Atendidos</p>
          </div>
          <div>
            <div className="w-28 h-28 mx-auto bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-4xl font-bold mb-4">
              {stats.ordenes.toLocaleString()}
            </div>
            <p className="font-medium">Pruebas Realizadas</p>
          </div>
          <div>
            <div className="w-28 h-28 mx-auto bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-4xl font-bold mb-4">
              29
            </div>
            <p className="font-medium">Años de Experiencia</p>
          </div>
          <div>
            <div className="w-28 h-28 mx-auto bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-4xl font-bold mb-4">
              24/7
            </div>
            <p className="font-medium">Atención Continua</p>
          </div>
        </div>
      </section>

      {/* NUESTRO LABORATORIO */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-5 max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">Nuestro Laboratorio</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Ofrecemos servicios de laboratorio clínico con altos estándares de calidad y tecnología de última generación.
          </p>

          {lab && (
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div>
                  <h4 className="font-semibold text-xl mb-2">Un laboratorio Completo</h4>
                  <p className="text-gray-600">Desde pruebas rutinarias hasta estudios especializados.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-xl mb-2">Garantía de Calidad</h4>
                  <p className="text-gray-600">Resultados garantizados mediante sistemas automatizados y controles internacionales.</p>
                </div>                
              </div>

              <div className="bg-gray-100 p-8 rounded-2xl">
                <h4 className="font-semibold mb-6">Información de Contacto</h4>
                <p><strong>Dirección:</strong> {lab.address}</p>
                <p><strong>Horario:</strong> {lab.schedule}</p>
                <p><strong>Teléfono:</strong> {lab.phone}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#2f2f2f] text-white py-12">
        <div className="container mx-auto px-5">
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <h5 className="font-bold mb-4 flex items-center gap-2">
                CERTIFICACIONES
              </h5>
              <p className="text-sm text-gray-400">SAE-LCL-17-001 • ISO 9001 • Licencia Ambiental</p>
            </div>
            <div>
              <h5 className="font-bold mb-4">UBÍCANOS</h5>
              <p className="text-sm text-gray-400">
                Calle Emma E. Ortiz Bermeo y Justino Cornejo<br />
                Mz. 14 Solar 2, Guayaquil
              </p>
              <p className="mt-4 text-sm">📞 04-2594010</p>
            </div>
            <div>
              <h5 className="font-bold mb-4">SÍGUENOS</h5>
              <div className="flex gap-4 text-2xl">
                <a href="https://www.instagram.com/interlabec" target="_blank">📷</a>
                <a href="https://www.facebook.com/InterlabEcuador" target="_blank">📘</a>
              </div>
            </div>
          </div>

          <hr className="my-10 border-gray-700" />

          <div className="text-center text-sm text-gray-400">
            © {new Date().getFullYear()} {lab.name || "Interlab S.A."} — Todos los derechos reservados
          </div>
        </div>
      </footer>

      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative">

            <button
                onClick={() => setModal(null)}
                className="absolute top-4 right-4 text-2xl"
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