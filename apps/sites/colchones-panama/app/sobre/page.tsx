import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre Nosotros — Dra. Sofía Reyes | ColchonesPanamá",
  description:
    "Conoce a Dra. Sofía Reyes, especialista en ergonomía del sueño y fundadora de ColchonesPanamá. Metodología transparente, sin patrocinios.",
  openGraph: {
    title: "Sobre Nosotros — Dra. Sofía Reyes | ColchonesPanamá",
    description:
      "Conoce a Dra. Sofía Reyes, especialista en ergonomía del sueño y fundadora de ColchonesPanamá. Metodología transparente, sin patrocinios.",
  },
};

// ─── Criteria Card ────────────────────────────────────────────────────────────

interface CriteriaCardProps {
  icon: string;
  name: string;
  description: string;
}

function CriteriaCard({ icon, name, description }: CriteriaCardProps) {
  return (
    <div className="
      bg-white dark:bg-card-dark
      border border-gray-100 dark:border-gray-800
      rounded-2xl p-6
      shadow-sm hover:shadow-md
      transition-shadow duration-200
      flex flex-col gap-3
    ">
      <span className="text-4xl" role="img" aria-label={name}>
        {icon}
      </span>
      <h3 className="
        font-serif text-lg font-bold
        text-primary dark:text-white
        leading-snug
      ">
        {name}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  value: string;
  label: string;
  sublabel: string;
}

function StatCard({ value, label, sublabel }: StatCardProps) {
  return (
    <div className="
      flex-1 min-w-[200px]
      bg-white dark:bg-card-dark
      border border-gray-100 dark:border-gray-800
      rounded-2xl p-8
      shadow-sm
      flex flex-col items-center text-center gap-2
    ">
      <span className="
        font-serif text-5xl font-bold
        text-accent
        leading-none
      ">
        {value}
      </span>
      <span className="
        font-sans text-base font-semibold
        text-primary dark:text-white
        mt-1
      ">
        {label}
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {sublabel}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SobrePage() {
  return (
    <>
      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <section className="
        relative overflow-hidden
        bg-primary dark:bg-[#0e1020]
        py-24 px-6
      ">
        {/* Subtle background radial glow */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-0
            bg-[radial-gradient(ellipse_at_60%_40%,_rgba(13,148,136,0.18)_0%,_transparent_70%)]
          "
        />

        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center text-center gap-8">
          {/* Avatar */}
          <div
            aria-hidden="true"
            className="
              w-36 h-36 rounded-full
              flex items-center justify-center
              shadow-2xl
              ring-4 ring-accent/30
              select-none
            "
            style={{
              background:
                "linear-gradient(135deg, #0d9488 0%, #115e59 45%, #1a1f36 100%)",
            }}
          >
            <span
              className="font-serif text-white text-4xl font-bold tracking-widest"
              style={{ letterSpacing: "0.12em" }}
            >
              SR
            </span>
          </div>

          {/* Headline */}
          <div className="flex flex-col gap-3">
            <h1 className="
              font-serif text-4xl md:text-5xl font-bold
              text-white
              leading-tight
            ">
              Sobre Dra. Sofía Reyes
            </h1>
            <p className="
              font-sans text-lg md:text-xl
              text-accent-300
              font-medium tracking-wide
            "
            style={{ color: "#5eead4" }}
            >
              Especialista en Ergonomía del Sueño
            </p>
          </div>

          {/* Decorative rule */}
          <div className="w-16 h-px bg-accent/60" aria-hidden="true" />
        </div>
      </section>

      {/* ── 2. EXPERT BACKGROUND STORY ──────────────────────────────────── */}
      <section className="bg-bg-light dark:bg-bg-dark py-20 px-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-7">
          <h2 className="
            font-serif text-3xl md:text-4xl font-bold
            text-primary dark:text-white
            leading-snug
          ">
            Mi historia
          </h2>

          <p className="font-sans text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            Soy ergónoma con más de 12 años de experiencia estudiando el impacto
            del sueño en la salud. Me especialicé en biomecánica del sueño en la
            Universidad Latina de Panamá y he trabajado con clínicas ortopédicas
            en todo el país, acompañando a pacientes que sufren dolores de
            espalda, cuello y articulaciones directamente relacionados con una
            superficie de descanso inadecuada.
          </p>

          <p className="font-sans text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            Cansada de ver a mis pacientes tomar malas decisiones de compra
            basadas en publicidad engañosa, decidí crear ColchonesPanamá: un
            recurso completamente independiente donde cada evaluación se basa en
            ciencia, no en comisiones. No tengo acuerdos comerciales con ninguna
            marca y nunca los tendré — eso es lo que me permite hablar con
            total honestidad.
          </p>

          <p className="font-sans text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            Mi misión es simple: que cada panameño pueda tomar una decisión
            informada sobre su colchón, sin importar su presupuesto. Un buen
            descanso no debería ser un privilegio — debería ser una realidad
            accesible para todos.
          </p>

          <p className="font-sans text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            En este sitio encontrarás análisis profundos, comparativas objetivas
            y guías prácticas redactadas desde la perspectiva de alguien que
            lleva más de una década estudiando cómo dormimos y qué necesita
            nuestro cuerpo para recuperarse de verdad.
          </p>
        </div>
      </section>

      {/* ── 3. METODOLOGÍA ──────────────────────────────────────────────── */}
      <section
        id="metodologia"
        className="bg-white dark:bg-card-dark py-20 px-6 border-t border-gray-100 dark:border-gray-800"
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-12">
          {/* Heading */}
          <div className="flex flex-col gap-4 max-w-2xl">
            <h2 className="
              font-serif text-3xl md:text-4xl font-bold
              text-primary dark:text-white
              leading-snug
            ">
              Nuestra Metodología
            </h2>
            <p className="font-sans text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              Cada colchón que evaluamos pasa por un protocolo riguroso de cuatro
              dimensiones clave. No publicamos ninguna reseña hasta haber
              completado el ciclo completo.
            </p>
          </div>

          {/* Criteria grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <CriteriaCard
              icon="🌡️"
              name="Temperatura"
              description="Medimos la regulación térmica durante la noche. Un colchón que retiene calor deteriora la calidad del sueño aunque sea muy cómodo al principio."
            />
            <CriteriaCard
              icon="🦴"
              name="Soporte lumbar"
              description="Evaluamos la alineación de la columna en distintas posiciones de descanso usando registros de presión y observación postural directa."
            />
            <CriteriaCard
              icon="⚡"
              name="Transferencia de movimiento"
              description="Determinamos cuánto se propaga el movimiento de una zona a otra — crítico para parejas con horarios distintos o sueño ligero."
            />
            <CriteriaCard
              icon="⏳"
              name="Durabilidad"
              description="Sometemos el colchón a ciclos de carga repetitiva y comparamos las características antes y después para proyectar su vida útil real."
            />
          </div>

          {/* Timeline banner */}
          <div className="
            flex flex-col sm:flex-row items-center gap-5
            bg-accent/10 dark:bg-accent/[0.08]
            border border-accent/30
            rounded-2xl px-8 py-6
          ">
            <span className="text-4xl" aria-hidden="true">🌙</span>
            <p className="font-sans text-base md:text-lg text-primary dark:text-accent-200 font-medium leading-relaxed"
               style={{ color: undefined }}
            >
              <span className="
                font-bold text-accent
              ">
                30 noches de prueba por colchón
              </span>{" "}
              antes de publicar cualquier evaluación. El cuerpo necesita tiempo
              para adaptarse — y nosotros también para observar cómo se comporta
              el colchón a lo largo de semanas reales.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. ¿POR QUÉ ESTE SITIO? ────────────────────────────────────── */}
      <section className="bg-bg-light dark:bg-bg-dark py-20 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-2xl mx-auto flex flex-col gap-8">
          <h2 className="
            font-serif text-3xl md:text-4xl font-bold
            text-primary dark:text-white
            leading-snug
          ">
            ¿Por qué este sitio?
          </h2>

          {/* Mission statement box */}
          <blockquote className="
            border-l-4 border-accent
            bg-accent/5 dark:bg-accent/[0.07]
            rounded-r-2xl
            px-8 py-7
            flex flex-col gap-4
          ">
            <p className="font-sans text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              Creamos ColchonesPanamá porque no existía un recurso independiente
              y honesto sobre colchones en Panamá. La mayoría de sitios son
              tiendas disfrazadas de blogs — recomiendan lo que les genera mayor
              comisión, no lo que le conviene a tu espalda.
            </p>
            <p className="
              font-sans text-base md:text-lg font-semibold
              text-primary dark:text-accent-300
            "
            style={{ color: undefined }}
            >
              Nosotros no vendemos colchones —{" "}
              <span className="text-accent">evaluamos colchones.</span>
            </p>
          </blockquote>

          <p className="font-sans text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            Ninguna marca nos paga por una reseña positiva ni tenemos acuerdos
            de afiliación que puedan sesgar nuestras conclusiones. Si algo nos
            parece malo, lo decimos. Si hay una opción de bajo precio que supera
            a alternativas de lujo, lo decimos también.
          </p>
        </div>
      </section>

      {/* ── 5. TRUST SIGNALS ────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-card-dark py-20 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto flex flex-col gap-10">
          <h2 className="
            font-serif text-3xl md:text-4xl font-bold
            text-primary dark:text-white
            leading-snug text-center
          ">
            Lo que nos define
          </h2>

          <div className="flex flex-wrap justify-center gap-6">
            <StatCard
              value="12+"
              label="Colchones evaluados"
              sublabel="Analizados con protocolo completo de 30 noches y cuatro criterios objetivos."
            />
            <StatCard
              value="$0"
              label="Sin patrocinios"
              sublabel="No pagamos ni recibimos pagos por reseñas. Cero acuerdos comerciales."
            />
            <StatCard
              value="↺"
              label="Actualización constante"
              sublabel="Revisamos precios y disponibilidad mensualmente para que la info siempre sea vigente."
            />
          </div>
        </div>
      </section>

      {/* ── 6. CONTACT CTA ──────────────────────────────────────────────── */}
      <section className="
        bg-primary dark:bg-[#0e1020]
        py-20 px-6
        border-t border-primary/20
      ">
        <div className="
          max-w-xl mx-auto
          flex flex-col items-center text-center gap-7
        ">
          <div
            aria-hidden="true"
            className="w-12 h-px bg-accent/50"
          />
          <h2 className="
            font-serif text-3xl md:text-4xl font-bold
            text-white leading-snug
          ">
            ¿Tienes preguntas o sugerencias?
          </h2>
          <p className="font-sans text-base md:text-lg text-gray-300 leading-relaxed">
            Siempre estoy dispuesta a escuchar. Si tienes dudas sobre algún
            colchón específico, quieres que evalúe un modelo en particular, o
            simplemente quieres darme tu opinión — escríbeme.
          </p>
          <Link
            href="/contacto"
            className="
              inline-flex items-center gap-2
              bg-accent hover:bg-accent-700
              text-white font-sans font-semibold
              px-8 py-4 rounded-xl
              transition-colors duration-200
              shadow-lg hover:shadow-accent/30
              text-base
            "
            style={{ background: "#0d9488" }}
          >
            Escríbenos
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <div
            aria-hidden="true"
            className="w-12 h-px bg-accent/50"
          />
        </div>
      </section>
    </>
  );
}
