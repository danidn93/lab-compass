export default function ContactanosPage() {
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
            Contacto • Atención al paciente
          </span>

          <h1 className="mb-4 text-4xl font-bold sm:text-5xl">
            Contáctanos
          </h1>

          <p className="mx-auto max-w-3xl text-base leading-7 text-white/90 sm:text-lg">
            Estamos disponibles para brindarte orientación, resolver tus consultas y ayudarte
            con la información que necesites sobre nuestros servicios de laboratorio clínico.
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
              Estamos para ayudarte
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: COLORS.dark }}>
              Atención clara, cercana y oportuna
            </h2>

            <p className="mt-5 leading-7" style={{ color: COLORS.textSoft }}>
              Si necesitas información sobre nuestros servicios, horarios, ubicación o atención,
              puedes comunicarte con nosotros a través de nuestros canales de contacto.
            </p>

            <p className="mt-4 leading-7" style={{ color: COLORS.textSoft }}>
              Nuestro objetivo es brindarte una atención cordial y orientarte de manera clara
              para facilitar tu experiencia con el laboratorio.
            </p>
          </div>

          <div
            className="rounded-3xl bg-white p-8 shadow-sm"
            style={{ border: `1px solid ${COLORS.border}` }}
          >
            <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
              ¿En qué podemos ayudarte?
            </h3>

            <div className="mt-6 space-y-4">
              {[
                "Información sobre horarios de atención.",
                "Orientación sobre servicios y exámenes.",
                "Ubicación y referencia del laboratorio.",
                "Consultas generales de contacto.",
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

      {/* CONTACTO + MAPA */}
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-2">
          {/* INFO */}
          <div
            className="rounded-3xl p-8 shadow-sm"
            style={{
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.white,
            }}
          >
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: COLORS.secondaryDark }}
            >
              Información de contacto
            </p>

            <h3 className="mt-3 text-2xl font-bold" style={{ color: COLORS.dark }}>
              Canales de atención
            </h3>

            <div className="mt-8 space-y-5">
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: COLORS.primarySoft }}
              >
                <p className="text-sm font-semibold" style={{ color: COLORS.primary }}>
                  Teléfono
                </p>
                <p className="mt-2 text-base font-medium" style={{ color: COLORS.dark }}>
                  📞 04-2713028
                </p>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: COLORS.secondarySoft }}
              >
                <p className="text-sm font-semibold" style={{ color: COLORS.secondaryDark }}>
                  Correo electrónico
                </p>
                <p className="mt-2 text-base font-medium" style={{ color: COLORS.dark }}>
                  ✉️ laboratorio@email.com
                </p>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: COLORS.primarySoft }}
              >
                <p className="text-sm font-semibold" style={{ color: COLORS.primary }}>
                  Ubicación
                </p>
                <p className="mt-2 text-base font-medium" style={{ color: COLORS.dark }}>
                  📍 Milagro, Ecuador
                </p>
              </div>
            </div>
          </div>

          {/* MAPA */}
          <div
            className="overflow-hidden rounded-3xl shadow-sm"
            style={{ border: `1px solid ${COLORS.border}` }}
          >
            <div
              className="px-6 py-5"
              style={{
                background: `linear-gradient(to right, ${COLORS.primarySoft}, ${COLORS.secondarySoft})`,
              }}
            >
              <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Nuestra ubicación
              </h3>
              <p className="mt-2 text-sm" style={{ color: COLORS.textSoft }}>
                Encuéntranos fácilmente y visítanos en nuestras instalaciones.
              </p>
            </div>

            <iframe
              title="Ubicación del laboratorio"
              className="h-[420px] w-full rounded-2xl shadow"
              src="https://www.google.com/maps?q=-2.126406,-79.593346&z=17&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            
          </div>
        </div>
      </section>

      {/* HORARIOS */}
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
                Horarios
              </p>
              <h2 className="mt-3 text-3xl font-bold">
                Atención en horarios accesibles
              </h2>
              <p className="mt-4 leading-7 text-white/90">
                Buscamos brindar una atención organizada y disponible para que nuestros pacientes
                puedan realizar sus consultas y acceder a nuestros servicios con mayor facilidad.
              </p>
            </div>

            <div
              className="rounded-3xl bg-white p-8 shadow-sm"
              style={{ border: `1px solid ${COLORS.border}` }}
            >
              <h3 className="text-xl font-bold" style={{ color: COLORS.dark }}>
                Horario referencial
              </h3>

              <div className="mt-6 space-y-4">
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: COLORS.primarySoft }}
                >
                  <p className="font-semibold" style={{ color: COLORS.primary }}>
                    Lunes a viernes
                  </p>
                  <p className="mt-1" style={{ color: COLORS.dark }}>
                    07:00 a.m. – 06:00 p.m.
                  </p>
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: COLORS.secondarySoft }}
                >
                  <p className="font-semibold" style={{ color: COLORS.secondaryDark }}>
                    Sábados
                  </p>
                  <p className="mt-1" style={{ color: COLORS.dark }}>
                    07:00 a.m. – 01:00 p.m.
                  </p>
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: COLORS.primarySoft }}
                >
                  <p className="font-semibold" style={{ color: COLORS.primary }}>
                    Consultas
                  </p>
                  <p className="mt-1" style={{ color: COLORS.dark }}>
                    Comunícate con nosotros para confirmar atención y orientación.
                  </p>
                </div>
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
            Estamos listos para atenderte
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-white/90">
            Ponte en contacto con nosotros para resolver tus dudas y recibir la información que necesitas sobre nuestros servicios.
          </p>
        </div>
      </section>
    </div>
  );
}