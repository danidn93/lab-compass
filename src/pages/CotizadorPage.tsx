import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

type Prueba = {
  id: string | number;
  name: string;
  price: number | string;
};

type TipoIdentificacion = "CEDULA" | "PASAPORTE";

type Paciente = {
  tipoIdentificacion: TipoIdentificacion;
  identificacion: string;
  nombres: string;
  email: string;
  telefono: string;
  direccion: string;
};

type ErroresFormulario = {
  identificacion?: string;
  nombres?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
};

type ClienteFacturacion = {
  id: string;
  tipo_identificacion: "CEDULA" | "RUC" | "PASAPORTE" | "CONSUMIDOR_FINAL";
  identificacion: string;
  nombres: string;
  direccion: string;
  telefono: string;
  email: string | null;
};

const WHATSAPP_NUMBER = "593985044520";

const COLORS = {
  primary: "#8C1D2C",
  primaryDark: "#6F1522",
  primarySoft: "#F7E9EC",
  secondary: "#5E7C96",
  secondaryDark: "#3E5A72",
  secondarySoft: "#EAF2F7",
  dark: "#1F2937",
  light: "#F8FAFC",
  border: "#E5E7EB",
  textSoft: "#64748B",
  white: "#FFFFFF",
  success: "#047857",
  danger: "#B91C1C",
};

export default function CotizadorPage() {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [carrito, setCarrito] = useState<Prueba[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoMuestra, setTipoMuestra] = useState<"VENTANILLA" | "DOMICILIO">(
    "VENTANILLA"
  );
  const [paciente, setPaciente] = useState<Paciente>({
    tipoIdentificacion: "CEDULA",
    identificacion: "",
    nombres: "",
    email: "",
    telefono: "",
    direccion: "",
  });
  const [errores, setErrores] = useState<ErroresFormulario>({});
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteAutocompletado, setClienteAutocompletado] = useState(false);

  useEffect(() => {
    const fetchPruebas = async () => {
      const { data, error } = await supabase.from("pruebas").select("*");

      if (error) {
        console.error("Error al cargar pruebas:", error);
        toast.error("No se pudieron cargar las pruebas.");
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

  const normalizarIdentificacion = (
    tipo: TipoIdentificacion,
    valor: string
  ) => {
    if (tipo === "CEDULA") {
      return valor.replace(/\D/g, "");
    }

    return valor.trim().toUpperCase();
  };

  const handlePacienteChange = (field: keyof Paciente, value: string) => {
    setPaciente((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field === "identificacion") {
      setErrores((prev) => ({ ...prev, identificacion: undefined }));
      setClienteAutocompletado(false);
    }

    if (field === "nombres") {
      setErrores((prev) => ({ ...prev, nombres: undefined }));
    }

    if (field === "email") {
      setErrores((prev) => ({ ...prev, email: undefined }));
    }

    if (field === "telefono") {
      setErrores((prev) => ({ ...prev, telefono: undefined }));
    }

    if (field === "direccion") {
      setErrores((prev) => ({ ...prev, direccion: undefined }));
    }
  };

  const validarCedulaEcuatoriana = (cedula: string) => {
    const cleaned = cedula.replace(/\D/g, "");

    if (!/^\d{10}$/.test(cleaned)) return false;

    const provincia = Number(cleaned.substring(0, 2));
    if (provincia < 1 || provincia > 24) return false;

    const tercerDigito = Number(cleaned[2]);
    if (tercerDigito >= 6) return false;

    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;

    for (let i = 0; i < 9; i++) {
      let valor = Number(cleaned[i]) * coeficientes[i];
      if (valor >= 10) valor -= 9;
      suma += valor;
    }

    const decenaSuperior = Math.ceil(suma / 10) * 10;
    let digitoVerificador = decenaSuperior - suma;
    if (digitoVerificador === 10) digitoVerificador = 0;

    return digitoVerificador === Number(cleaned[9]);
  };

  const validarPasaporte = (pasaporte: string) => {
    const value = pasaporte.trim();
    return /^[A-Za-z0-9-]{5,20}$/.test(value);
  };

  const validarEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const validarTelefono = (telefono: string) => {
    const limpio = telefono.replace(/[^\d+]/g, "");
    return limpio.length >= 7;
  };

  const validarIdentificacion = () => {
    if (paciente.tipoIdentificacion === "CEDULA") {
      return validarCedulaEcuatoriana(paciente.identificacion);
    }

    return validarPasaporte(paciente.identificacion);
  };

  const buscarClienteFacturacion = async () => {
    const identificacionNormalizada = normalizarIdentificacion(
      paciente.tipoIdentificacion,
      paciente.identificacion
    );

    if (!identificacionNormalizada) return;

    if (
      paciente.tipoIdentificacion === "CEDULA" &&
      !validarCedulaEcuatoriana(identificacionNormalizada)
    ) {
      return;
    }

    if (
      paciente.tipoIdentificacion === "PASAPORTE" &&
      !validarPasaporte(identificacionNormalizada)
    ) {
      return;
    }

    try {
      setBuscandoCliente(true);

      const { data, error } = await supabase
        .from("clientes_facturacion")
        .select("*")
        .eq("tipo_identificacion", paciente.tipoIdentificacion)
        .eq("identificacion", identificacionNormalizada)
        .maybeSingle();

      if (error) {
        console.error("Error consultando cliente de facturación:", error);
        return;
      }

      if (data) {
        const cliente = data as ClienteFacturacion;

        setPaciente((prev) => ({
          ...prev,
          identificacion: identificacionNormalizada,
          nombres: cliente.nombres || prev.nombres,
          email: cliente.email || prev.email,
          telefono: cliente.telefono || prev.telefono,
          direccion: cliente.direccion || prev.direccion,
        }));

        setClienteAutocompletado(true);

        setErrores((prev) => ({
          ...prev,
          identificacion: undefined,
          nombres: undefined,
          email: undefined,
          telefono: undefined,
          direccion: undefined,
        }));

        toast.success("Se encontraron datos guardados para esta identificación.");
      } else {
        setClienteAutocompletado(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBuscandoCliente(false);
    }
  };

  const continuarASiguientePaso = async () => {
    const nuevosErrores: ErroresFormulario = {};

    if (paciente.identificacion.trim() === "") {
      nuevosErrores.identificacion =
        paciente.tipoIdentificacion === "CEDULA"
          ? "Ingresa la cédula ecuatoriana."
          : "Ingresa el pasaporte.";
    } else if (!validarIdentificacion()) {
      nuevosErrores.identificacion =
        paciente.tipoIdentificacion === "CEDULA"
          ? "La cédula ecuatoriana no es válida."
          : "El pasaporte no es válido. Debe contener entre 5 y 20 caracteres alfanuméricos.";
    }

    if (paciente.nombres.trim() === "") {
      nuevosErrores.nombres = "Ingresa los nombres completos.";
    }

    if (paciente.email.trim() === "") {
      nuevosErrores.email = "Ingresa el correo electrónico.";
    } else if (!validarEmail(paciente.email)) {
      nuevosErrores.email = "El correo electrónico no es válido.";
    }

    if (paciente.telefono.trim() === "") {
      nuevosErrores.telefono = "Ingresa el teléfono.";
    } else if (!validarTelefono(paciente.telefono)) {
      nuevosErrores.telefono = "El teléfono no es válido.";
    }

    if (tipoMuestra === "DOMICILIO" && paciente.direccion.trim() === "") {
      nuevosErrores.direccion =
        "Ingresa la dirección para la toma de muestra a domicilio.";
    }

    setErrores(nuevosErrores);

    if (Object.keys(nuevosErrores).length > 0) {
      toast.error("Revisa los campos marcados en el formulario.");
      return;
    }

    await buscarClienteFacturacion();
    setPaso(2);
  };

  const enviarCotizacion = () => {
    if (carrito.length === 0) {
      toast.error("Debes agregar al menos una prueba.");
      return;
    }

    const detallePruebas = carrito
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} - $${Number(item.price).toFixed(2)}`
      )
      .join("\n");

    const etiquetaIdentificacion =
      paciente.tipoIdentificacion === "CEDULA" ? "Cédula" : "Pasaporte";

    const mensaje = `Hola, solicito realizarme estos exámenes.

Tipo de toma de muestra: ${tipoMuestra}

Datos del paciente:
- ${etiquetaIdentificacion}: ${paciente.identificacion}
- Nombres: ${paciente.nombres}
- Email: ${paciente.email}
- Teléfono: ${paciente.telefono}
${
  tipoMuestra === "DOMICILIO"
    ? `- Dirección: ${paciente.direccion}\n`
    : ""
}Pruebas solicitadas:
${detallePruebas}

Total referencial: $${total.toFixed(2)}`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      mensaje
    )}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.light }}>
      <section
        className="relative overflow-hidden py-16 text-white"
        style={{
          background: `linear-gradient(to right, ${COLORS.primaryDark}, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,white,transparent_35%),radial-gradient(circle_at_bottom_left,white,transparent_25%)]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <span className="mb-4 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium backdrop-blur">
            Cotización • Laboratorio clínico
          </span>

          <h1 className="mb-4 text-4xl font-bold sm:text-5xl">
            Cotizador de Exámenes
          </h1>

          <p className="mx-auto max-w-3xl text-base leading-7 text-white/90 sm:text-lg">
            Selecciona tus exámenes, registra los datos del paciente y genera una
            cotización referencial de manera rápida y organizada.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-10">
        <div className="mb-8 flex justify-center">
          <div
            className="rounded-3xl px-10 py-6 text-center shadow-sm"
            style={{
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <p className="text-5xl font-black" style={{ color: COLORS.primary }}>
              ${total.toFixed(2)}
            </p>
            <p
              className="mt-3 text-xs leading-5"
              style={{ color: COLORS.textSoft }}
            >
              * Nos reservamos el derecho de modificar precios sin previo aviso.
              <br />
              * Aplican restricciones.
            </p>
          </div>
        </div>

        <div className="mb-8 flex justify-center gap-4">
          <div
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: paso === 1 ? COLORS.primary : COLORS.white,
              color: paso === 1 ? COLORS.white : COLORS.textSoft,
              border: paso === 1 ? "none" : `1px solid ${COLORS.border}`,
            }}
          >
            1. Datos del paciente
          </div>

          <div
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: paso === 2 ? COLORS.secondaryDark : COLORS.white,
              color: paso === 2 ? COLORS.white : COLORS.textSoft,
              border: paso === 2 ? "none" : `1px solid ${COLORS.border}`,
            }}
          >
            2. Selección de pruebas
          </div>
        </div>

        {paso === 1 && (
          <div
            className="mx-auto max-w-2xl rounded-3xl p-6 shadow-sm md:p-8"
            style={{
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <h2
              className="mb-6 text-center text-xl font-semibold"
              style={{ color: COLORS.dark }}
            >
              Información del paciente
            </h2>

            <div className="space-y-5">
              <div>
                <label
                  className="mb-3 block text-sm font-medium"
                  style={{ color: COLORS.dark }}
                >
                  Tipo de identificación{" "}
                  <span style={{ color: COLORS.danger }}>*</span>
                </label>

                <div className="flex gap-6">
                  <label
                    className="flex cursor-pointer items-center gap-2"
                    style={{ color: COLORS.dark }}
                  >
                    <input
                      type="radio"
                      name="tipoIdentificacion"
                      checked={paciente.tipoIdentificacion === "CEDULA"}
                      onChange={() => {
                        handlePacienteChange("tipoIdentificacion", "CEDULA");
                        setPaciente((prev) => ({
                          ...prev,
                          identificacion: "",
                        }));
                        setClienteAutocompletado(false);
                      }}
                    />
                    <span>Cédula ecuatoriana</span>
                  </label>

                  <label
                    className="flex cursor-pointer items-center gap-2"
                    style={{ color: COLORS.dark }}
                  >
                    <input
                      type="radio"
                      name="tipoIdentificacion"
                      checked={paciente.tipoIdentificacion === "PASAPORTE"}
                      onChange={() => {
                        handlePacienteChange("tipoIdentificacion", "PASAPORTE");
                        setPaciente((prev) => ({
                          ...prev,
                          identificacion: "",
                        }));
                        setClienteAutocompletado(false);
                      }}
                    />
                    <span>Pasaporte</span>
                  </label>
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium"
                  style={{ color: COLORS.dark }}
                >
                  {paciente.tipoIdentificacion === "CEDULA"
                    ? "Cédula"
                    : "Pasaporte"}{" "}
                  <span style={{ color: COLORS.danger }}>*</span>
                </label>
                <input
                  type="text"
                  value={paciente.identificacion}
                  onChange={(e) =>
                    handlePacienteChange(
                      "identificacion",
                      paciente.tipoIdentificacion === "CEDULA"
                        ? e.target.value.replace(/\D/g, "")
                        : e.target.value.toUpperCase()
                    )
                  }
                  onBlur={buscarClienteFacturacion}
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{
                    borderColor: errores.identificacion
                      ? COLORS.danger
                      : COLORS.border,
                    backgroundColor: COLORS.light,
                  }}
                  placeholder={
                    paciente.tipoIdentificacion === "CEDULA"
                      ? "Ingresa la cédula ecuatoriana"
                      : "Ingresa el pasaporte"
                  }
                />
                {errores.identificacion ? (
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{ color: COLORS.danger }}
                  >
                    {errores.identificacion}
                  </p>
                ) : buscandoCliente ? (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: COLORS.textSoft }}
                  >
                    Consultando datos guardados...
                  </p>
                ) : clienteAutocompletado ? (
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{ color: COLORS.success }}
                  >
                    Datos autocompletados desde clientes de facturación.
                  </p>
                ) : (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: COLORS.textSoft }}
                  >
                    {paciente.tipoIdentificacion === "CEDULA"
                      ? "Se validará automáticamente el número de cédula ecuatoriana."
                      : "Si eres extranjero, escribe tu número de pasaporte."}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium"
                  style={{ color: COLORS.dark }}
                >
                  Nombres <span style={{ color: COLORS.danger }}>*</span>
                </label>
                <input
                  type="text"
                  value={paciente.nombres}
                  onChange={(e) =>
                    handlePacienteChange("nombres", e.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{
                    borderColor: errores.nombres
                      ? COLORS.danger
                      : COLORS.border,
                    backgroundColor: COLORS.light,
                  }}
                  placeholder="Ingresa los nombres completos"
                />
                {errores.nombres && (
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{ color: COLORS.danger }}
                  >
                    {errores.nombres}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium"
                  style={{ color: COLORS.dark }}
                >
                  Email <span style={{ color: COLORS.danger }}>*</span>
                </label>
                <input
                  type="email"
                  value={paciente.email}
                  onChange={(e) =>
                    handlePacienteChange("email", e.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{
                    borderColor: errores.email ? COLORS.danger : COLORS.border,
                    backgroundColor: COLORS.light,
                  }}
                  placeholder="Ingresa el correo electrónico"
                />
                {errores.email && (
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{ color: COLORS.danger }}
                  >
                    {errores.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium"
                  style={{ color: COLORS.dark }}
                >
                  Teléfono <span style={{ color: COLORS.danger }}>*</span>
                </label>
                <input
                  type="text"
                  value={paciente.telefono}
                  onChange={(e) =>
                    handlePacienteChange("telefono", e.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{
                    borderColor: errores.telefono
                      ? COLORS.danger
                      : COLORS.border,
                    backgroundColor: COLORS.light,
                  }}
                  placeholder="Ingresa el teléfono"
                />
                {errores.telefono && (
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{ color: COLORS.danger }}
                  >
                    {errores.telefono}
                  </p>
                )}
              </div>

              {tipoMuestra === "DOMICILIO" && (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium"
                    style={{ color: COLORS.dark }}
                  >
                    Dirección <span style={{ color: COLORS.danger }}>*</span>
                  </label>
                  <textarea
                    value={paciente.direccion}
                    onChange={(e) =>
                      handlePacienteChange("direccion", e.target.value)
                    }
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: errores.direccion
                        ? COLORS.danger
                        : COLORS.border,
                      backgroundColor: COLORS.light,
                    }}
                    placeholder="Ingresa la dirección para la toma de muestra"
                    rows={3}
                  />
                  {errores.direccion && (
                    <p
                      className="mt-1 text-xs font-medium"
                      style={{ color: COLORS.danger }}
                    >
                      {errores.direccion}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label
                  className="mb-3 block text-sm font-medium"
                  style={{ color: COLORS.dark }}
                >
                  Toma de muestras <span style={{ color: COLORS.danger }}>*</span>
                </label>

                <div className="flex gap-6">
                  <label
                    className="flex cursor-pointer items-center gap-2"
                    style={{ color: COLORS.dark }}
                  >
                    <input
                      type="radio"
                      name="muestras"
                      checked={tipoMuestra === "VENTANILLA"}
                      onChange={() => setTipoMuestra("VENTANILLA")}
                    />
                    <span>VENTANILLA</span>
                  </label>

                  <label
                    className="flex cursor-pointer items-center gap-2"
                    style={{ color: COLORS.dark }}
                  >
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
                className="w-full rounded-xl py-3 font-medium text-white transition hover:opacity-95"
                style={{
                  background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <>
            <div className="mb-8 flex justify-center">
              <input
                type="text"
                placeholder="Buscar examen..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full max-w-md rounded-xl border px-4 py-3 text-sm shadow-sm outline-none"
                style={{
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.white,
                }}
              />
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="max-h-[650px] space-y-4 overflow-y-auto pr-1">
                {pruebasFiltradas.length > 0 ? (
                  pruebasFiltradas.map((p, index) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-2xl p-4 shadow-sm"
                      style={{
                        backgroundColor:
                          index % 2 === 0
                            ? COLORS.primarySoft
                            : COLORS.secondarySoft,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <div>
                        <h3
                          className="font-semibold"
                          style={{ color: COLORS.dark }}
                        >
                          {p.name}
                        </h3>
                        <p
                          className="text-sm"
                          style={{ color: COLORS.textSoft }}
                        >
                          ${Number(p.price).toFixed(2)}
                        </p>
                      </div>

                      <button
                        onClick={() => agregar(p)}
                        className="rounded-xl px-3 py-2 text-sm text-white transition hover:opacity-95"
                        style={{ backgroundColor: COLORS.primary }}
                      >
                        Agregar
                      </button>
                    </div>
                  ))
                ) : (
                  <div
                    className="rounded-2xl p-4 shadow-sm"
                    style={{
                      backgroundColor: COLORS.white,
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.textSoft,
                    }}
                  >
                    No se encontraron exámenes.
                  </div>
                )}
              </div>

              <div
                className="sticky top-6 h-fit rounded-3xl p-6 shadow-sm"
                style={{
                  backgroundColor: COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <h2
                  className="mb-4 text-lg font-semibold"
                  style={{ color: COLORS.dark }}
                >
                  Resumen de cotización
                </h2>

                <div
                  className="mb-4 space-y-1 text-sm"
                  style={{ color: COLORS.dark }}
                >
                  <p>
                    <span className="font-medium">
                      {paciente.tipoIdentificacion === "CEDULA"
                        ? "Cédula"
                        : "Pasaporte"}
                      :
                    </span>{" "}
                    {paciente.identificacion}
                  </p>
                  <p>
                    <span className="font-medium">Paciente:</span>{" "}
                    {paciente.nombres}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span> {paciente.email}
                  </p>
                  <p>
                    <span className="font-medium">Teléfono:</span>{" "}
                    {paciente.telefono}
                  </p>
                  {tipoMuestra === "DOMICILIO" && (
                    <p>
                      <span className="font-medium">Dirección:</span>{" "}
                      {paciente.direccion}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Atención:</span>{" "}
                    {tipoMuestra}
                  </p>
                </div>

                <hr className="my-4" style={{ borderColor: COLORS.border }} />

                {carrito.length > 0 ? (
                  <div className="space-y-3">
                    {carrito.map((item, i) => (
                      <div
                        key={`${item.id}-${i}`}
                        className="flex items-center justify-between gap-3 border-b pb-2"
                        style={{ borderColor: COLORS.border }}
                      >
                        <div>
                          <p
                            className="text-sm font-medium"
                            style={{ color: COLORS.dark }}
                          >
                            {item.name}
                          </p>
                          <p
                            className="text-sm"
                            style={{ color: COLORS.textSoft }}
                          >
                            ${Number(item.price).toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => quitar(i)}
                          className="text-sm hover:underline"
                          style={{ color: COLORS.danger }}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}

                    <div
                      className="flex justify-between pt-2 text-lg font-bold"
                      style={{ color: COLORS.dark }}
                    >
                      <span>Total:</span>
                      <span style={{ color: COLORS.primary }}>
                        ${total.toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <button
                        onClick={() => setPaso(1)}
                        className="rounded-xl border py-3 font-medium transition hover:bg-slate-50"
                        style={{
                          borderColor: COLORS.border,
                          color: COLORS.dark,
                        }}
                      >
                        Volver
                      </button>

                      <button
                        onClick={enviarCotizacion}
                        className="rounded-xl py-3 font-medium text-white transition hover:opacity-95"
                        style={{
                          background: "#16A34A",
                        }}
                      >
                        Escribir a WhatsApp
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p
                      className="mb-4 text-sm"
                      style={{ color: COLORS.textSoft }}
                    >
                      Aún no has agregado exámenes.
                    </p>

                    <button
                      onClick={() => setPaso(1)}
                      className="w-full rounded-xl border py-3 font-medium transition hover:bg-slate-50"
                      style={{
                        borderColor: COLORS.border,
                        color: COLORS.dark,
                      }}
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