export default function ServiciosPage() {
  const servicios = [
    { icon: "🧪", title: "Análisis Clínicos", desc: "Pruebas generales y especializadas." },
    { icon: "🏠", title: "Domicilio", desc: "Atención desde tu hogar." },
    { icon: "⚡", title: "Resultados Rápidos", desc: "Entrega eficiente." },
    { icon: "🔬", title: "Alta Tecnología", desc: "Equipos modernos." },
  ];

  return (
    <div className="min-h-screen bg-white">

      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Nuestros Servicios</h1>
        <p className="text-gray-600">Soluciones completas para tu salud</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
        {servicios.map((s, i) => (
          <div
            key={i}
            className="bg-gray-50 p-6 rounded-xl shadow hover:shadow-2xl transition transform hover:-translate-y-2"
          >
            <div className="text-5xl mb-4">{s.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
            <p className="text-gray-600 text-sm">{s.desc}</p>
          </div>
        ))}
      </section>

    </div>
  );
}