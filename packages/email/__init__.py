"""
CEREBRO v7 — Email Package
Resend integration for transactional emails.
All email templates live here.
"""
import httpx
from packages.core import config, get_logger

logger = get_logger("email")

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str, from_addr: str = None) -> bool:
    """Send a transactional email via Resend."""
    if not config.RESEND_KEY:
        logger.warning(f"RESEND_API_KEY not set — skipping email to {to}")
        return False

    from_addr = from_addr or config.EMAIL_FROM or "carlos@dolarafuera.co"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {config.RESEND_KEY}",
                    "Content-Type": "application/json",
                },
                json={"from": from_addr, "to": to, "subject": subject, "html": html},
            )
            if resp.status_code in (200, 201):
                logger.info(f"Email sent to {to}: {subject}")
                return True
            else:
                logger.error(f"Resend error {resp.status_code}: {resp.text[:200]}")
                return False
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return False


async def send_welcome_email(email: str, nombre: str = None, tema: str = None) -> bool:
    """Welcome email for new leads."""
    nombre_display = nombre or "amigo"
    tema_line = f"<p>Vi que te interesa <strong>{tema}</strong>. Tengo contenido específico para eso.</p>" if tema else ""

    html = f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Dólar Afuera</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="margin-bottom:32px;">
      <span style="color:#22c55e;font-weight:700;font-size:18px;letter-spacing:2px;">⚡ DÓLAR AFUERA</span>
    </div>

    <!-- Headline -->
    <h1 style="color:#f1f5f9;font-size:24px;font-weight:700;line-height:1.3;margin:0 0 16px;">
      Hola {nombre_display}, bienvenido.
    </h1>

    <!-- Body -->
    <p style="color:#94a3b8;font-size:16px;line-height:1.7;margin:0 0 16px;">
      Soy Carlos Medina. Llevo más de 10 años ayudando a colombianos a manejar su plata afuera del sistema bancario tradicional colombiano.
    </p>

    {tema_line}

    <p style="color:#94a3b8;font-size:16px;line-height:1.7;margin:0 0 24px;">
      En los próximos días te voy a enviar las guías más importantes que necesitas saber para proteger tus ahorros y acceder al sistema financiero internacional desde Colombia.
    </p>

    <!-- CTA -->
    <div style="margin:32px 0;">
      <a href="https://dolarafuera.co"
         style="display:inline-block;background:#22c55e;color:#0f172a;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">
        Ver las guías →
      </a>
    </div>

    <!-- Tip box -->
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="color:#22c55e;font-size:12px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">
        💡 Mientras tanto
      </p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
        El colombiano promedio pierde entre el <strong style="color:#f1f5f9;">5% y 8%</strong> del valor de sus remesas en comisiones y tasas de cambio.
        Con las opciones correctas, eso baja a menos del <strong style="color:#22c55e;">1%</strong>.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1e293b;margin-top:40px;padding-top:24px;">
      <p style="color:#475569;font-size:13px;line-height:1.6;margin:0;">
        Carlos Medina · Dólar Afuera<br>
        <a href="https://dolarafuera.co" style="color:#22c55e;text-decoration:none;">dolarafuera.co</a>
      </p>
      <p style="color:#334155;font-size:12px;margin:8px 0 0;">
        Recibiste este email porque te registraste en dolarafuera.co.
      </p>
    </div>

  </div>
</body>
</html>
"""
    return await send_email(
        to=email,
        subject="Bienvenido a Dólar Afuera 🇨🇴",
        html=html,
    )


async def send_calculator_results_email(
    email: str,
    nombre: str = None,
    monto_mensual: float = 0,
    metodo: str = "",
    perdida_anual: float = 0,
    ahorro_potencial: float = 0,
) -> bool:
    """Email with full calculator results after lead capture."""
    nombre_display = nombre or "amigo"
    monto_fmt = f"${monto_mensual:,.0f}"
    perdida_fmt = f"${perdida_anual:,.0f}"
    ahorro_fmt = f"${ahorro_potencial:,.0f}"

    html = f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <div style="margin-bottom:32px;">
      <span style="color:#22c55e;font-weight:700;font-size:18px;letter-spacing:2px;">⚡ DÓLAR AFUERA</span>
    </div>

    <h1 style="color:#f1f5f9;font-size:22px;font-weight:700;line-height:1.3;margin:0 0 8px;">
      Tu análisis de remesas, {nombre_display}
    </h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 32px;">Resultados completos de la calculadora</p>

    <!-- Results -->
    <div style="background:#1e293b;border:1px solid #ef4444;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Lo que pierdes al año con {metodo}</p>
      <p style="color:#ef4444;font-size:36px;font-weight:800;margin:0;">{perdida_fmt} USD</p>
      <p style="color:#64748b;font-size:13px;margin:4px 0 0;">sobre {monto_fmt} USD/mes</p>
    </div>

    <div style="background:#1e293b;border:1px solid #22c55e;border-radius:12px;padding:24px;margin-bottom:32px;">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Lo que podrías ahorrar al año</p>
      <p style="color:#22c55e;font-size:36px;font-weight:800;margin:0;">{ahorro_fmt} USD</p>
      <p style="color:#64748b;font-size:13px;margin:4px 0 0;">usando las opciones recomendadas</p>
    </div>

    <!-- Recommendations -->
    <h2 style="color:#f1f5f9;font-size:18px;font-weight:700;margin:0 0 16px;">Las 3 mejores opciones para colombianos</h2>

    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #1e293b;">
          <div style="color:#22c55e;font-weight:700;font-size:15px;">1. Cuenta USD offshore (banco panameño)</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:2px;">Cuenta bancaria real en USD desde Colombia. Fee: ~0.5%. Sin comisiones ocultas.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #1e293b;">
          <div style="color:#f1f5f9;font-weight:600;font-size:15px;">2. Wise</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:2px;">Transferencias internacionales. Fee: 0.4–1.5%. Tasa de cambio interbancaria.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <div style="color:#f1f5f9;font-weight:600;font-size:15px;">3. Remitly</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:2px;">Para enviar a familia. Fee: 1–3%. Mejor que bancario tradicional.</div>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="margin:32px 0;">
      <a href="https://dolarafuera.co/articulo/como-abrir-cuenta-en-dolares-desde-colombia"
         style="display:inline-block;background:#22c55e;color:#0f172a;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">
        Ver guía: cómo abrir cuenta USD →
      </a>
    </div>

    <div style="border-top:1px solid #1e293b;margin-top:40px;padding-top:24px;">
      <p style="color:#475569;font-size:13px;margin:0;">
        Carlos Medina · <a href="https://dolarafuera.co" style="color:#22c55e;text-decoration:none;">dolarafuera.co</a>
      </p>
    </div>

  </div>
</body>
</html>
"""
    return await send_email(
        to=email,
        subject=f"Pierdes {perdida_fmt} USD/año en remesas (+ cómo solucionarlo)",
        html=html,
    )
