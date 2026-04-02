export default function DomicilioPage() {
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
  };

  const WHATSAPP_NUMBER = "593985044520";

  const solicitarPorWhatsApp = () => {
    const mensaje = encodeURIComponent(
      "Hola, deseo solicitar el servicio de toma de muestras a domicilio. Por favor, necesito información sobre cobertura, horarios y el proceso de atención."
    );

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`, "_blank");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.light }}>
      {/* HERO */}
      <section
        className="relative overflow-hidden py-20 text-white"
        style={{
          background: `linear-gradient(to right, ${COLORS.primaryDark}, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,white,transparent_35%),radial-gradient(circle_at_bottom_left,white,transparent_25%)]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <span className="mb-4 inline-flex rounded-full bg-white/15 px-4 py-1 text-sm font-medium backdrop-blur">
            Servicio especial • Atención a domicilio
          </span>

          <h1 className="mb-4 text-4xl font-bold sm:text-5xl">
            Servicio a Domicilio
          </h1>

          <p className="mx-auto max-w-3xl text-base leading-7 text-white/90 sm:text-lg">
            Llevamos la atención hasta tu hogar o lugar de trabajo para brindarte
            mayor comodidad, seguridad y facilidad en la toma de muestras.
          </p>
        </div>
      </section>

      {/* INTRO */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.primary }}
            >
              Comodidad y confianza
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: COLORS.dark }}>
              Atención profesional sin salir de casa
            </h2>

            <p className="mt-5 leading-7" style={{ color: COLORS.textSoft }}>
              Nuestro servicio a domicilio está pensado para pacientes que desean
              realizarse exámenes con mayor comodidad, evitando desplazamientos
              innecesarios y recibiendo atención en un entorno más conveniente.
            </p>

            <p className="mt-4 leading-7" style={{ color: COLORS.textSoft }}>
              Realizamos la toma de muestras con personal capacitado, manteniendo
              un enfoque profesional, organizado y orientado a la confianza del paciente.
            </p>
          </div>

          <div
            className="rounded-3xl bg-white p-8 shadow-sm"
            style={{ border: `1px solid ${COLORS.border}` }}
          >
            <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
              Beneficios del servicio
            </h3>

            <div className="mt-6 space-y-4">
              {[
                "Mayor comodidad para el paciente.",
                "Atención en casa o lugar de trabajo.",
                "Ahorro de tiempo y desplazamientos.",
                "Servicio útil para personas con movilidad reducida, adultos mayores o agendas ocupadas.",
              ].map((item) => (
                <div key={item} className="flex gap-3">
                  <span className="text-xl" style={{ color: COLORS.primary }}>
                    ✔
                  </span>
                  <p style={{ color: COLORS.dark }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.secondaryDark }}
            >
              Proceso de atención
            </p>
            <h2 className="mt-3 text-3xl font-bold" style={{ color: COLORS.dark }}>
              ¿Cómo funciona el servicio a domicilio?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl" style={{ color: COLORS.textSoft }}>
              Hemos estructurado el proceso para que la solicitud y atención sean claras y sencillas.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Solicitud",
                text: "El paciente se comunica para solicitar la toma de muestras a domicilio.",
              },
              {
                step: "02",
                title: "Coordinación",
                text: "Se confirma información de ubicación, horario y requisitos previos.",
              },
              {
                step: "03",
                title: "Toma de muestra",
                text: "El personal realiza la atención en el lugar acordado.",
              },
              {
                step: "04",
                title: "Procesamiento",
                text: "La muestra es trasladada y procesada según el examen solicitado.",
              },
            ].map((item, index) => (
              <div
                key={item.step}
                className="rounded-3xl p-6"
                style={{
                  backgroundColor:
                    index % 2 === 0 ? COLORS.primarySoft : COLORS.secondarySoft,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div
                  className="mb-4 text-3xl font-bold"
                  style={{
                    color: index % 2 === 0 ? COLORS.primary : COLORS.secondaryDark,
                  }}
                >
                  {item.step}
                </div>
                <h3 className="text-lg font-bold" style={{ color: COLORS.dark }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6" style={{ color: COLORS.textSoft }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECOMENDADO PARA */}
      <section className="py-16" style={{ backgroundColor: COLORS.light }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div
              className="rounded-3xl p-8 text-white"
              style={{
                background: `linear-gradient(to bottom right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
              }}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
                Ideal para
              </p>
              <h2 className="mt-3 text-3xl font-bold">
                Pacientes que buscan comodidad y atención organizada
              </h2>
              <p className="mt-4 leading-7 text-white/90">
                Este servicio resulta especialmente útil para personas que requieren
                mayor comodidad o que prefieren recibir atención en su domicilio
                por razones de tiempo, movilidad o facilidad.
              </p>
            </div>

            <div
              className="rounded-3xl bg-white p-8 shadow-sm"
              style={{ border: `1px solid ${COLORS.border}` }}
            >
              <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Recomendado para
              </h3>

              <div className="mt-6 space-y-4">
                {[
                  "Adultos mayores.",
                  "Pacientes con movilidad reducida.",
                  "Personas con horarios limitados.",
                  "Pacientes que prefieren atención en casa o trabajo.",
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <span className="text-xl" style={{ color: COLORS.secondaryDark }}>
                      •
                    </span>
                    <p style={{ color: COLORS.dark }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-16 text-white"
        style={{
          background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Solicita tu atención a domicilio
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-white/90">
            Contáctanos para coordinar la toma de muestras y recibir información
            sobre cobertura, horarios y condiciones del servicio.
          </p>

          <button
            onClick={solicitarPorWhatsApp}
            className="mt-8 rounded-xl px-8 py-3 font-semibold text-white transition hover:opacity-95"
            style={{ backgroundColor: "#16A34A" }}
          >
            Escribir a WhatsApp
          </button>
        </div>
      </section>
    </div>
  );
}