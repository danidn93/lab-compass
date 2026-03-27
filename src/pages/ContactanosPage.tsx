export default function ContactanosPage() {
  return (
    <div className="min-h-screen bg-gray-50">

      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Contáctanos</h1>
        <p className="text-gray-600">Estamos para ayudarte</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-10 pb-20">
        
        {/* INFO */}
        <div className="bg-white p-8 rounded-2xl shadow">
          <h3 className="font-semibold mb-6">Información</h3>
          <p>📞 04-2594010</p>
          <p>✉️ laboratorio@email.com</p>
          <p>📍 Guayaquil, Ecuador</p>
        </div>

        {/* MAPA */}
        <iframe
          className="w-full h-[400px] rounded-2xl shadow"
          src="https://maps.google.com/maps?q=guayaquil&t=&z=13&ie=UTF8&iwloc=&output=embed"
        />

      </section>

    </div>
  );
}