import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function HistorialPage() {
  const [cedula, setCedula] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);

  const buscar = async () => {
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("*")
      .eq("cedula", cedula)
      .single();

    if (!paciente) return alert("Paciente no encontrado");

    const { data } = await supabase
      .from("ordenes")
      .select("*")
      .eq("patient_id", paciente.id);

    setResultados(data || []);
  };

  return (
    <div className="min-h-screen p-10 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Historial Clínico</h1>

      <div className="flex gap-4 mb-6">
        <input
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          placeholder="Ingresa tu cédula"
          className="border p-2 rounded w-64"
        />
        <button
          onClick={buscar}
          className="bg-[#68A883] text-white px-4 py-2 rounded"
        >
          Buscar
        </button>
      </div>

      {resultados.map((r) => (
        <div key={r.id} className="bg-white p-4 rounded shadow mb-3">
          <p><strong>Código:</strong> {r.code}</p>
          <p><strong>Fecha:</strong> {r.date}</p>
          <p><strong>Estado:</strong> {r.status}</p>
        </div>
      ))}
    </div>
  );
}