export default function QuienesSomosPage() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* HERO */}
      <section className="bg-gradient-to-r from-[#68A883] to-[#4f8f70] text-white py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Quiénes Somos</h1>
        <p className="max-w-2xl mx-auto opacity-90">
          Comprometidos con la salud, la precisión y la excelencia en cada resultado.
        </p>
      </section>

      {/* CONTENIDO */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
        
        <div>
          <h2 className="text-2xl font-bold mb-4">Nuestra Historia</h2>
          <p className="text-gray-600 mb-4">
            Somos un laboratorio clínico con años de experiencia brindando resultados confiables.
          </p>
          <p className="text-gray-600">
            Nuestro compromiso es apoyar el diagnóstico médico con tecnología de última generación.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <h3 className="font-semibold mb-4">Valores</h3>
          <ul className="space-y-3 text-gray-600">
            <li>✔ Precisión</li>
            <li>✔ Ética profesional</li>
            <li>✔ Confidencialidad</li>
            <li>✔ Innovación</li>
          </ul>
        </div>

      </section>

    </div>
  );
}