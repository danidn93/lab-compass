export default function ServiciosPage() {
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
    textSoft: "#64748B",
    white: "#FFFFFF",
  };

  const servicios = [
    {
      icon: "🧪",
      title: "Análisis clínicos",
      desc: "Realizamos pruebas generales y especializadas orientadas a apoyar el diagnóstico y seguimiento de la salud.",
      bg: COLORS.primarySoft,
    },
    {
      icon: "🏠",
      title: "Toma de muestras a domicilio",
      desc: "Brindamos atención en casa o lugar de trabajo para mayor comodidad y seguridad del paciente.",
      bg: COLORS.secondarySoft,
    },
    {
      icon: "⚡",
      title: "Entrega oportuna de resultados",
      desc: "Buscamos ofrecer resultados de forma ágil, organizada y confiable según el tipo de examen realizado.",
      bg: COLORS.primarySoft,
    },
    {
      icon: "🔬",
      title: "Procesos con enfoque profesional",
      desc: "Trabajamos con responsabilidad y compromiso en cada etapa del procesamiento de muestras.",
      bg: COLORS.secondarySoft,
    },
  ];

  const areas = [
    "Hematología",
    "Química clínica",
    "Parasitología",
    "Uroanálisis",
    "Serología",
    "Perfiles y chequeos",
  ];

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
            Servicios • Laboratorio clínico
          </span>

          <h1 className="mb-4 text-4xl font-bold sm:text-5xl">
            Nuestros Servicios
          </h1>

          <p className="mx-auto max-w-3xl text-base leading-7 text-white/90 sm:text-lg">
            Ofrecemos servicios de laboratorio clínico orientados a la confianza,
            la precisión y la atención oportuna para apoyar el cuidado de la salud.
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
              Atención integral
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: COLORS.dark }}>
              Soluciones confiables para cada necesidad clínica
            </h2>

            <p className="mt-5 leading-7" style={{ color: COLORS.textSoft }}>
              Nuestros servicios están orientados a brindar una atención organizada,
              profesional y cercana, facilitando a los pacientes y profesionales de salud
              el acceso a análisis clínicos confiables.
            </p>

            <p className="mt-4 leading-7" style={{ color: COLORS.textSoft }}>
              Trabajamos para que cada proceso, desde la toma de muestra hasta la entrega
              de resultados, se desarrolle con responsabilidad, claridad y compromiso con la calidad.
            </p>
          </div>

          <div
            className="rounded-3xl bg-white p-8 shadow-sm"
            style={{ border: `1px solid ${COLORS.border}` }}
          >
            <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
              Lo que buscamos ofrecer
            </h3>

            <div className="mt-6 space-y-4">
              {[
                "Atención profesional y respetuosa.",
                "Procesos claros y organizados.",
                "Resultados oportunos y confiables.",
                "Comodidad para el paciente en cada etapa.",
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

      {/* CARDS DE SERVICIOS */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.secondaryDark }}
            >
              Servicios principales
            </p>
            <h2 className="mt-3 text-3xl font-bold" style={{ color: COLORS.dark }}>
              Lo que ponemos a tu disposición
            </h2>
            <p className="mx-auto mt-4 max-w-2xl" style={{ color: COLORS.textSoft }}>
              Contamos con servicios pensados para facilitar el acceso a exámenes clínicos
              con atención responsable y enfoque en la calidad.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {servicios.map((s, i) => (
              <div
                key={i}
                className="rounded-3xl p-6 transition hover:-translate-y-1 hover:shadow-lg"
                style={{
                  backgroundColor: s.bg,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div className="mb-4 text-5xl">{s.icon}</div>
                <h3 className="text-lg font-bold" style={{ color: COLORS.dark }}>
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-6" style={{ color: COLORS.textSoft }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ÁREAS DE SERVICIO */}
      <section className="py-16" style={{ backgroundColor: COLORS.light }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-[0.2em]"
                style={{ color: COLORS.primary }}
              >
                Áreas de análisis
              </p>
              <h2 className="mt-3 text-3xl font-bold" style={{ color: COLORS.dark }}>
                Exámenes y perfiles en distintas áreas clínicas
              </h2>
              <p className="mt-5 leading-7" style={{ color: COLORS.textSoft }}>
                Disponemos de distintas áreas de análisis para responder a múltiples
                necesidades clínicas, brindando apoyo al diagnóstico médico y al seguimiento
                del estado de salud del paciente.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {areas.map((area, index) => (
                <div
                  key={area}
                  className="rounded-2xl p-5"
                  style={{
                    backgroundColor:
                      index % 2 === 0 ? COLORS.primarySoft : COLORS.secondarySoft,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <p className="font-semibold" style={{ color: COLORS.dark }}>
                    {area}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE DOMICILIO */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div
              className="rounded-3xl p-8 text-white"
              style={{
                background: `linear-gradient(to bottom right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
              }}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
                Servicio especial
              </p>
              <h2 className="mt-3 text-3xl font-bold">
                Toma de muestras a domicilio
              </h2>
              <p className="mt-4 leading-7 text-white/90">
                Pensando en la comodidad de nuestros pacientes, ofrecemos la posibilidad
                de realizar la toma de muestras en casa o lugar de trabajo, manteniendo
                el compromiso con la atención responsable y segura.
              </p>
            </div>

            <div
              className="rounded-3xl bg-white p-8 shadow-sm"
              style={{ border: `1px solid ${COLORS.border}` }}
            >
              <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Beneficios del servicio a domicilio
              </h3>

              <div className="mt-6 space-y-4">
                {[
                  "Mayor comodidad para el paciente.",
                  "Atención en casa o trabajo.",
                  "Ahorro de tiempo y desplazamientos.",
                  "Servicio útil para personas con movilidad reducida o agendas ocupadas.",
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

      {/* PROCESO */}
      <section className="py-16" style={{ backgroundColor: COLORS.light }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.secondaryDark }}
            >
              Nuestro proceso
            </p>
            <h2 className="mt-3 text-3xl font-bold" style={{ color: COLORS.dark }}>
              ¿Cómo se desarrolla el servicio?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl" style={{ color: COLORS.textSoft }}>
              Buscamos que cada etapa del servicio sea clara, práctica y orientada a la confianza del paciente.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Consulta",
                text: "El paciente consulta el examen o servicio requerido.",
              },
              {
                step: "02",
                title: "Atención",
                text: "Se coordina la atención en laboratorio o a domicilio.",
              },
              {
                step: "03",
                title: "Procesamiento",
                text: "La muestra es procesada con responsabilidad y orden.",
              },
              {
                step: "04",
                title: "Entrega",
                text: "Los resultados se ponen a disposición del paciente de forma oportuna.",
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
                  style={{ color: index % 2 === 0 ? COLORS.primary : COLORS.secondaryDark }}
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

      {/* CTA */}
      <section
        className="py-16 text-white"
        style={{
          background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
        }}
      >
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Servicios pensados para tu confianza y bienestar
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-white/90">
            Nuestro compromiso es brindar una atención profesional, clara y confiable en cada uno de nuestros servicios de laboratorio clínico.
          </p>
        </div>
      </section>
    </div>
  );
}