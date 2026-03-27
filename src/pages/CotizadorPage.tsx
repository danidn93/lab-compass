import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Prueba = {
  id: string | number;
  name: string;
  price: number | string;
};

type Paciente = {
  cedula: string;
  nombres: string;
  email: string;
};

const WHATSAPP_NUMBER = "593999999999"; // <-- reemplaza por tu número real

export default function CotizadorPage() {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [carrito, setCarrito] = useState<Prueba[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoMuestra, setTipoMuestra] = useState<"VENTANILLA" | "DOMICILIO">("VENTANILLA");
  const [paciente, setPaciente] = useState<Paciente>({
    cedula: "",
    nombres: "",
    email: "",
  });

  useEffect(() => {
    const fetchPruebas = async () => {
      const { data, error } = await supabase.from("pruebas").select("*");

      if (error) {
        console.error("Error al cargar pruebas:", error);
        return;
      }

      setPruebas((data as Prueba[]) || []);
    };

    fetchPruebas();
  }, []);

  const pruebasFiltradas = useMemo(() => {
    return pruebas.filter((p) =>
      String(p.name || "")
        .toLowerCase()
        .includes(busqueda.toLowerCase())
    );
  }, [pruebas, busqueda]);

  const agregar = (prueba: Prueba) => {
    setCarrito((prev) => [...prev, prueba]);
  };

  const quitar = (index: number) => {
    setCarrito((prev) => prev.filter((_, i) => i !== index));
  };

  const total = carrito.reduce((acc, item) => acc + Number(item.price || 0), 0);

  const handlePacienteChange = (field: keyof Paciente, value: string) => {
    setPaciente((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const datosPacienteCompletos =
    paciente.cedula.trim() !== "" &&
    paciente.nombres.trim() !== "" &&
    paciente.email.trim() !== "";

  const continuarASiguientePaso = () => {
    if (!datosPacienteCompletos) {
      alert("Por favor completa cédula, nombres y email.");
      return;
    }

    setPaso(2);
  };

  const enviarCotizacion = () => {
    if (carrito.length === 0) {
      alert("Debes agregar al menos una prueba.");
      return;
    }

    const detallePruebas = carrito
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} - $${Number(item.price).toFixed(2)}`
      )
      .join("\n");

    const mensaje = `Hola, solicito una cotización de exámenes.

Tipo de toma de muestra: ${tipoMuestra}

Datos del paciente:
- Cédula: ${paciente.cedula}
- Nombres: ${paciente.nombres}
- Email: ${paciente.email}

Pruebas solicitadas:
${detallePruebas}

Total: $${total.toFixed(2)}`;

    if (tipoMuestra === "DOMICILIO") {
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
      return;
    }

    alert("Cotización generada correctamente para atención en ventanilla.");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">Cotizador de Exámenes</h1>

        {/* TOTAL */}
        <div className="flex justify-center mb-6">
          <div className="text-center">
            <p className="text-5xl font-bold text-[#68A883]">${total.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">
              * Nos reservamos el derecho de modificar precios sin previo aviso
              <br />
              * Aplican restricciones.
            </p>
          </div>
        </div>

        {/* INDICADOR DE PASOS */}
        <div className="flex justify-center gap-4 mb-8">
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              paso === 1 ? "bg-[#68A883] text-white" : "bg-white text-gray-600 border"
            }`}
          >
            1. Datos del paciente
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              paso === 2 ? "bg-[#68A883] text-white" : "bg-white text-gray-600 border"
            }`}
          >
            2. Selección de pruebas
          </div>
        </div>

        {/* PASO 1 */}
        {paso === 1 && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6 md:p-8">
            <h2 className="text-xl font-semibold mb-6 text-center">
              Información del paciente
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cédula <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={paciente.cedula}
                  onChange={(e) => handlePacienteChange("cedula", e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#68A883]"
                  placeholder="Ingresa la cédula"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombres <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={paciente.nombres}
                  onChange={(e) => handlePacienteChange("nombres", e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#68A883]"
                  placeholder="Ingresa los nombres completos"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={paciente.email}
                  onChange={(e) => handlePacienteChange("email", e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#68A883]"
                  placeholder="Ingresa el correo electrónico"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">
                  Toma de muestras <span className="text-red-500">*</span>
                </label>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="muestras"
                      checked={tipoMuestra === "VENTANILLA"}
                      onChange={() => setTipoMuestra("VENTANILLA")}
                    />
                    <span>VENTANILLA</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="muestras"
                      checked={tipoMuestra === "DOMICILIO"}
                      onChange={() => setTipoMuestra("DOMICILIO")}
                    />
                    <span>DOMICILIO</span>
                  </label>
                </div>
              </div>

              <button
                onClick={continuarASiguientePaso}
                className="w-full bg-[#68A883] text-white py-3 rounded-xl font-medium hover:opacity-90"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {paso === 2 && (
          <>
            {/* BUSCADOR */}
            <div className="flex justify-center mb-8">
              <input
                type="text"
                placeholder="Buscar examen..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full max-w-md bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#68A883]"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* LISTA DE PRUEBAS */}
              <div className="space-y-4 max-h-[650px] overflow-y-auto pr-1">
                {pruebasFiltradas.length > 0 ? (
                  pruebasFiltradas.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white p-4 rounded-2xl shadow flex justify-between items-center"
                    >
                      <div>
                        <h3 className="font-semibold">{p.name}</h3>
                        <p className="text-sm text-gray-500">
                          ${Number(p.price).toFixed(2)}
                        </p>
                      </div>

                      <button
                        onClick={() => agregar(p)}
                        className="bg-[#68A883] text-white px-3 py-2 rounded-xl text-sm hover:opacity-90"
                      >
                        Agregar
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="bg-white p-4 rounded-2xl shadow text-gray-500">
                    No se encontraron exámenes.
                  </div>
                )}
              </div>

              {/* RESUMEN */}
              <div className="bg-white p-6 rounded-2xl shadow h-fit sticky top-6">
                <h2 className="font-semibold text-lg mb-4">Resumen de cotización</h2>

                <div className="mb-4 text-sm text-gray-700 space-y-1">
                  <p>
                    <span className="font-medium">Paciente:</span> {paciente.nombres}
                  </p>
                  <p>
                    <span className="font-medium">Cédula:</span> {paciente.cedula}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span> {paciente.email}
                  </p>
                  <p>
                    <span className="font-medium">Atención:</span> {tipoMuestra}
                  </p>
                </div>

                <hr className="my-4" />

                {carrito.length > 0 ? (
                  <div className="space-y-3">
                    {carrito.map((item, i) => (
                      <div
                        key={`${item.id}-${i}`}
                        className="flex items-center justify-between gap-3 border-b pb-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            ${Number(item.price).toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => quitar(i)}
                          className="text-sm text-red-500 hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}

                    <div className="flex justify-between font-bold text-lg pt-2">
                      <span>Total:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <button
                        onClick={() => setPaso(1)}
                        className="border border-gray-300 py-3 rounded-xl font-medium hover:bg-gray-50"
                      >
                        Volver
                      </button>

                      <button
                        onClick={enviarCotizacion}
                        className="bg-[#68A883] text-white py-3 rounded-xl font-medium hover:opacity-90"
                      >
                        {tipoMuestra === "DOMICILIO"
                          ? "Enviar WhatsApp"
                          : "Generar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      Aún no has agregado exámenes.
                    </p>

                    <button
                      onClick={() => setPaso(1)}
                      className="w-full border border-gray-300 py-3 rounded-xl font-medium hover:bg-gray-50"
                    >
                      Volver
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}