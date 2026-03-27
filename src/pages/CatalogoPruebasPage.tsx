import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CatalogoPruebasPage() {
  const [pruebas, setPruebas] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("pruebas").select("*");
      setPruebas(data || []);
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">

      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Catálogo de Pruebas</h1>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pruebas.map((p) => (
          <div
            key={p.id}
            className="bg-white p-6 rounded-2xl shadow hover:shadow-xl transition"
          >
            <h3 className="font-semibold text-lg">{p.name}</h3>
            <p className="text-gray-600 text-sm mt-2">{p.description}</p>

            <div className="mt-4 flex justify-between items-center">
              <span className="text-[#68A883] font-bold">${p.price}</span>
              <button className="text-sm bg-[#68A883] text-white px-3 py-1 rounded">
                Agregar
              </button>
            </div>
          </div>
        ))}
      </section>

    </div>
  );
}