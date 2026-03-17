import type { Metadata } from "next";
import EmailCaptureForm from "@/components/EmailCaptureForm";
import StepChecklist from "./StepChecklist";

const SITE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;

export const metadata: Metadata = {
  title: "Cómo Abrir una Cuenta en Dólares desde Colombia: Guía Paso a Paso 2026 | Dólar Afuera",
  description: "Guía completa para abrir una cuenta bancaria en USD desde Colombia. Sin viajar. Sin apostilla. En 15 minutos. Actualizada 2026.",
  alternates: { canonical: `${SITE_URL}/guia/abrir-cuenta-dolares-paso-a-paso` },
  openGraph: {
    title: "Guía: Abrir cuenta en dólares desde Colombia (2026)",
    description: "Paso a paso, sin viajar, en 15 minutos.",
    url: `${SITE_URL}/guia/abrir-cuenta-dolares-paso-a-paso`,
    type: "article",
    siteName: "Dólar Afuera",
  },
};

const steps = [
  {
    n: 1,
    title: "Elige el banco correcto",
    desc: "Para colombianos, un banco panameño online es la opción más accesible: 100% digital, sin visitar Panamá, sin monto mínimo de apertura.",
    detail: "Otros bancos como BAC, Banistmo o Global Bank requieren presencia física o referencias bancarias panameñas, lo que los hace inaccesibles para la mayoría.",
  },
  {
    n: 2,
    title: "Reúne los documentos",
    desc: "Solo necesitas: Cédula colombiana vigente + Pasaporte (opcional pero recomendado) + Selfie con documento.",
    detail: "No necesitas: apostilla, declaración de renta, extractos bancarios colombianos ni referencias comerciales.",
  },
  {
    n: 3,
    title: "Completa el formulario online",
    desc: "El proceso es 100% digital. Tarda aproximadamente 15 minutos.",
    detail: "Llenas datos personales, subes fotos del documento y selfie. El sistema hace verificación automática de identidad (KYC).",
  },
  {
    n: 4,
    title: "Espera la verificación",
    desc: "La verificación de identidad tarda entre 24-72 horas hábiles.",
    detail: "Recibes email de confirmación. En algunos casos piden documentación adicional (comprobante de dirección o fuente de fondos).",
  },
  {
    n: 5,
    title: "Activa tu cuenta y fondéala",
    desc: "Una vez aprobado, recibes tus datos bancarios: número de cuenta, código SWIFT y routing number.",
    detail: "Puedes fondear desde Colombia vía transferencia SWIFT desde cualquier banco colombiano, o recibir pagos directamente de clientes internacionales.",
  },
  {
    n: 6,
    title: "Empieza a usarla",
    desc: "Ya puedes recibir pagos, hacer transferencias internacionales y mantener saldo en USD.",
    detail: "La tarjeta débil Mastercard llega en 2-4 semanas para usar en compras online y retiros en ATM.",
  },
];

export default function GuiaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "Cómo abrir una cuenta en dólares desde Colombia",
            description: "Guía paso a paso para abrir cuenta bancaria en USD desde Colombia sin viajar",
            step: steps.map((s) => ({
              "@type": "HowToStep",
              position: s.n,
              name: s.title,
              text: s.desc,
            })),
          }),
        }}
      />

      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header */}
        <header>
          <nav className="text-xs text-slate-600 mb-6 flex items-center gap-2">
            <a href="/" className="hover:text-slate-400">Inicio</a>
            <span>›</span>
            <span className="text-slate-500">Guías</span>
            <span>›</span>
            <span className="text-slate-500">Abrir cuenta en dólares</span>
          </nav>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1 rounded-full">Actualizado 2026</span>
            <span className="text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 px-3 py-1 rounded-full">15 minutos</span>
            <span className="text-xs font-medium text-slate-400 bg-slate-400/10 border border-slate-400/20 px-3 py-1 rounded-full">Sin viajar</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 leading-tight mb-4">
            Cómo abrir una cuenta en dólares desde Colombia: Guía completa 2026
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Paso a paso, sin burocracia, sin apostillas y sin poner un pie en Panamá. Más de 3,000 colombianos ya lo hicieron.
          </p>
        </header>

        {/* Quick summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Tiempo total", value: "~15 min", icon: "⏱️" },
            { label: "Documentos", value: "Solo cédula", icon: "📄" },
            { label: "Costo apertura", value: "$0", icon: "💰" },
          ].map((item) => (
            <div key={item.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-lg font-bold text-slate-100">{item.value}</div>
              <div className="text-xs text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Interactive checklist */}
        <section>
          <h2 className="text-xl font-bold text-slate-100 mb-4">Los 6 pasos (marca tu progreso)</h2>
          <StepChecklist steps={steps} />
        </section>

        {/* Requirements */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4">¿Qué necesitas exactamente?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-green-400 mb-2">✓ Sí necesitas</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• Cédula colombiana vigente</li>
                <li>• Email activo</li>
                <li>• Smartphone con cámara</li>
                <li>• Conexión a internet</li>
                <li>• Ser mayor de 18 años</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-2">✗ NO necesitas</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• Viajar a Panamá</li>
                <li>• Apostilla de documentos</li>
                <li>• Declaración de renta</li>
                <li>• Monto mínimo de depósito</li>
                <li>• Referencias bancarias</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6">
          <p className="text-sm font-bold text-green-400 mb-2">¿Quieres el comparativo actualizado?</p>
          <p className="text-sm text-slate-400 mb-4">
            Te enviamos el comparativo con los mejores bancos para colombianos, fees reales y requisitos actualizados.
          </p>
          <a
            href="#email-capture"
            className="inline-block bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Recibir comparativo gratis →
          </a>
        </div>

        {/* Email capture */}
        <EmailCaptureForm
          origenUrl={`${SITE_URL}/guia/abrir-cuenta-dolares-paso-a-paso`}
          temaInteres="abrir cuenta dolares colombia"
          intentScore={8}
          headline="Recibe la checklist completa por email"
          subheadline="Te enviamos la guía en PDF con todos los pasos y los documentos necesarios."
          ctaText="Enviar checklist →"
        />

        {/* Related */}
        <div className="border-t border-slate-800 pt-8">
          <h3 className="text-sm font-medium text-slate-400 mb-3">También te puede interesar</h3>
          <div className="space-y-2">
            <a href="/comparar/wise-vs-western-union-colombia" className="block text-sm text-green-400 hover:text-green-300">→ Wise vs Western Union: comparativa para colombianos</a>
            <a href="/herramientas/calculadora-remesas" className="block text-sm text-green-400 hover:text-green-300">→ Calculadora: ¿Cuánto pierdes enviando remesas?</a>
            <a href="/herramientas/quiz-cuenta-ideal" className="block text-sm text-green-400 hover:text-green-300">→ Quiz: ¿Qué tipo de cuenta es ideal para ti?</a>
          </div>
        </div>
      </div>
    </>
  );
}
