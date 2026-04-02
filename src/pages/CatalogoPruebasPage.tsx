import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Prueba = {
  id: string | number;
  name: string;
  description?: string;
  categoria?: string;
};

export default function CatalogoPruebasPage() {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const COLORS = {
    primary: "#8C1D2C",
    primaryDark: "#6F1522",
    secondaryDark: "#3E5A72",
    light: "#F8FAFC",
    border: "#E5E7EB",
    textSoft: "#64748B",
    dark: "#1F2937",
  };

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.from("pruebas").select("*");

      if (error) {
        console.error("Error cargando catálogo:", error);
        return;
      }

      setPruebas((data as Prueba[]) || []);
    };

    fetch();
  }, []);

  const pruebasFiltradas = useMemo(() => {
    return pruebas.filter((p) =>
      p.name.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [pruebas, busqueda]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.light }}>
      {/* HERO */}
      <section
        className="py-20 text-white text-center"
        style={{
          background: `linear-gradient(to right, ${COLORS.primaryDark}, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-4xl font-bold sm:text-5xl">
            Catálogo de Pruebas
          </h1>

          <p className="mt-4 text-white/90 max-w-2xl mx-auto">
            Consulta las pruebas disponibles en nuestro laboratorio.
          </p>
        </div>
      </section>

      {/* BUSCADOR */}
      <section className="py-10">
        <div className="max-w-5xl mx-auto px-6">
          <input
            type="text"
            placeholder="Buscar examen..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border outline-none focus:ring-2"
            style={{ borderColor: COLORS.border }}
          />
        </div>
      </section>

      {/* LISTADO */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        {pruebasFiltradas.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pruebasFiltradas.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition"
                style={{ border: `1px solid ${COLORS.border}` }}
              >
                <h3 className="font-semibold" style={{ color: COLORS.dark }}>
                  {p.name}
                </h3>

                {p.description && (
                  <p
                    className="text-sm mt-2"
                    style={{ color: COLORS.textSoft }}
                  >
                    {p.description}
                  </p>
                )}

                <div className="mt-4">
                  <a
                    href="/cotizador"
                    className="text-sm font-semibold"
                    style={{ color: COLORS.primary }}
                  >
                    Solicitar cotización →
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 mt-10">
            No se encontraron pruebas.
          </p>
        )}
      </section>

      {/* CTA */}
      <section
        className="py-16 text-white text-center"
        style={{
          background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold">
            ¿Necesitas saber el valor de un examen?
          </h2>

          <p className="mt-4 text-white/90">
            Utiliza nuestro cotizador o contáctanos directamente para recibir información detallada.
          </p>

          <a
            href="/cotizador"
            className="inline-block mt-6 px-6 py-3 bg-white rounded-xl font-semibold"
            style={{ color: COLORS.primary }}
          >
            Ir al cotizador
          </a>
        </div>
      </section>
    </div>
  );
}