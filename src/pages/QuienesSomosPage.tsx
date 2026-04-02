export default function QuienesSomosPage() {
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
            Institucional • Laboratorio clínico
          </span>

          <h1 className="mb-4 text-4xl font-bold sm:text-5xl">
            Quiénes Somos
          </h1>

          <p className="mx-auto max-w-3xl text-base leading-7 text-white/90 sm:text-lg">
            Somos un laboratorio clínico comprometido con la precisión, la ética profesional y la excelencia
            en cada resultado, brindando atención confiable para apoyar el cuidado de la salud de nuestros pacientes.
          </p>
        </div>
      </section>

      {/* PRESENTACIÓN */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.primary }}
            >
              Nuestra institución
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: COLORS.dark }}>
              Comprometidos con resultados confiables y atención humana
            </h2>

            <p className="mt-5 leading-7" style={{ color: COLORS.textSoft }}>
              En nuestro laboratorio trabajamos con responsabilidad, vocación de servicio y enfoque profesional,
              ofreciendo análisis clínicos que contribuyen al diagnóstico oportuno y al seguimiento de la salud
              de cada paciente.
            </p>

            <p className="mt-4 leading-7" style={{ color: COLORS.textSoft }}>
              Nuestra labor se basa en procesos organizados, atención respetuosa y el compromiso permanente
              con la calidad, para que cada persona reciba un servicio claro, seguro y confiable.
            </p>
          </div>

          <div
            className="rounded-3xl bg-white p-8 shadow-sm"
            style={{ border: `1px solid ${COLORS.border}` }}
          >
            <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
              Nuestro compromiso
            </h3>

            <div className="mt-6 space-y-4">
              {[
                "Atención profesional y responsable.",
                "Resultados orientados a la confiabilidad.",
                "Respeto por la confidencialidad del paciente.",
                "Mejora continua en nuestros procesos.",
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

      {/* HISTORIA + TRAYECTORIA */}
      <section style={{ backgroundColor: COLORS.white }} className="py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p
                className="text-sm font-semibold uppercase tracking-[0.2em]"
                style={{ color: COLORS.secondaryDark }}
              >
                Nuestra historia
              </p>

              <h2 className="mt-3 text-3xl font-bold" style={{ color: COLORS.dark }}>
                Trayectoria basada en confianza y servicio
              </h2>

              <div className="mt-6 space-y-4 leading-7" style={{ color: COLORS.textSoft }}>
                <p>
                  A lo largo de nuestra trayectoria, hemos trabajado con el propósito de ofrecer un servicio
                  de laboratorio clínico que combine precisión técnica, trato humano y compromiso con la salud.
                </p>
                <p>
                  Nuestra experiencia nos ha permitido fortalecer procesos, mejorar continuamente la atención
                  y consolidar una cultura institucional enfocada en la calidad y la responsabilidad profesional.
                </p>
                <p>
                  Cada resultado que entregamos representa nuestro compromiso con los pacientes, sus familias
                  y los profesionales de la salud que confían en nuestro trabajo.
                </p>
              </div>
            </div>

            <div
              className="rounded-3xl p-8"
              style={{
                backgroundColor: COLORS.secondarySoft,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <h3 className="text-xl font-bold" style={{ color: COLORS.secondaryDark }}>
                Enfoque institucional
              </h3>
              <p className="mt-4 text-sm leading-7" style={{ color: COLORS.dark }}>
                Nos enfocamos en ofrecer una atención cercana, procesos responsables y resultados que aporten
                valor al diagnóstico clínico y al bienestar de nuestros pacientes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MISIÓN Y VISIÓN */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div
            className="rounded-3xl p-8"
            style={{
              backgroundColor: COLORS.primarySoft,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.primary }}
            >
              Misión
            </p>
            <h3 className="mt-3 text-2xl font-bold" style={{ color: COLORS.dark }}>
              Servir con precisión y responsabilidad
            </h3>
            <p className="mt-4 leading-7" style={{ color: COLORS.dark }}>
              Brindar servicios de análisis clínico con calidad, ética profesional y atención humana,
              contribuyendo al cuidado integral de la salud mediante resultados confiables y oportunos.
            </p>
          </div>

          <div
            className="rounded-3xl p-8"
            style={{
              backgroundColor: COLORS.secondarySoft,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.secondaryDark }}
            >
              Visión
            </p>
            <h3 className="mt-3 text-2xl font-bold" style={{ color: COLORS.dark }}>
              Consolidarnos como referente de confianza
            </h3>
            <p className="mt-4 leading-7" style={{ color: COLORS.dark }}>
              Ser reconocidos por nuestra excelencia en el servicio, la confiabilidad de nuestros procesos
              y el compromiso constante con la mejora continua en beneficio de nuestros pacientes.
            </p>
          </div>
        </div>
      </section>

      {/* VALORES */}
      <section className="py-16" style={{ backgroundColor: COLORS.white }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.primary }}
            >
              Nuestros valores
            </p>
            <h2 className="mt-3 text-3xl font-bold" style={{ color: COLORS.dark }}>
              Principios que guían nuestro trabajo
            </h2>
            <p className="mx-auto mt-4 max-w-2xl" style={{ color: COLORS.textSoft }}>
              Nuestra forma de trabajar se basa en principios que fortalecen la confianza y la calidad del servicio.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Precisión",
                text: "Trabajamos con rigor y responsabilidad en cada análisis realizado.",
                bg: COLORS.primarySoft,
              },
              {
                title: "Ética profesional",
                text: "Actuamos con honestidad, respeto y compromiso con la salud.",
                bg: COLORS.secondarySoft,
              },
              {
                title: "Confidencialidad",
                text: "Protegemos la información y la privacidad de cada paciente.",
                bg: COLORS.primarySoft,
              },
              {
                title: "Mejora continua",
                text: "Buscamos optimizar nuestros procesos y fortalecer la calidad del servicio.",
                bg: COLORS.secondarySoft,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl p-6"
                style={{
                  backgroundColor: item.bg,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div className="mb-4 text-4xl">✔</div>
                <h3 className="text-lg font-bold" style={{ color: COLORS.dark }}>
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6" style={{ color: COLORS.textSoft }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPROMISO CON EL PACIENTE */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-2">
          <div
            className="rounded-3xl p-8 text-white"
            style={{
              background: `linear-gradient(to bottom right, ${COLORS.primary}, ${COLORS.secondaryDark})`,
            }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              Enfoque al paciente
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Tu bienestar es el centro de nuestro servicio
            </h2>
            <p className="mt-4 leading-7 text-white/90">
              Entendemos que detrás de cada examen existe una necesidad real de orientación, seguimiento
              y tranquilidad. Por eso, buscamos ofrecer una experiencia cercana, clara y segura en cada etapa del proceso.
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
                "Atención clara y respetuosa.",
                "Procesos organizados y oportunos.",
                "Confianza en cada resultado entregado.",
                "Compromiso con la calidad del servicio.",
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
            Confianza, calidad y compromiso en cada resultado
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-white/90">
            Seguimos trabajando para brindar una atención profesional y cercana, orientada a respaldar el cuidado de la salud de nuestros pacientes.
          </p>
        </div>
      </section>
    </div>
  );
}