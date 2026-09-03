import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <span className="text-2xl font-bold text-blue-700">Doqit</span>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Iniciar sesión</Link>
          <Link href="/register" className="text-sm bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800">Registrarse gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 py-24 text-center">
        <div className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
          MVP — Versión Inicial
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Gestión documental<br />para reclutamiento
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Invita candidatos, centraliza sus documentos y valídalos desde un panel simple. Sin papeles, sin email interminable.
        </p>
        <Link href="/register" className="inline-block bg-blue-700 text-white text-lg px-8 py-4 rounded-xl hover:bg-blue-800 font-semibold shadow-lg">
          Comenzar gratis →
        </Link>
        <p className="text-sm text-gray-400 mt-4">Sin tarjeta de crédito · Gratis hasta 50 candidatos</p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: '📨', title: 'Invita por link', desc: 'Envía un link único a cada candidato. Se registra y sube sus documentos sin crear cuenta de empresa.' },
          { icon: '📁', title: 'Documentos centralizados', desc: 'Todos los archivos en un solo lugar. Aprueba o rechaza con un click desde el panel.' },
          { icon: '✅', title: 'Estado en tiempo real', desc: 'Sabes exactamente qué candidatos están listos y cuáles tienen documentos pendientes o vencidos.' },
        ].map(f => (
          <div key={f.title} className="bg-gray-50 rounded-2xl p-6">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
