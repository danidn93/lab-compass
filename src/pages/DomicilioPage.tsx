export default function DomicilioPage() {
  return (
    <div className="min-h-screen bg-white">

      <section className="py-20 text-center bg-gradient-to-r from-[#68A883] to-[#4f8f70] text-white">
        <h1 className="text-4xl font-bold mb-4">Servicio a Domicilio</h1>
        <p>Nos acercamos a ti</p>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600 mb-6">
          Realizamos toma de muestras en casa con personal capacitado.
        </p>

        <button className="px-6 py-3 bg-[#68A883] text-white rounded-lg hover:bg-[#5a9c72]">
          Solicitar Servicio
        </button>
      </section>

    </div>
  );
}