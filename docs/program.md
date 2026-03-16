# CEREBRO AutoLoop — Protocolo de Experimentación
## program.md v1.0

> El operador humano edita este archivo. El agente AutoLoop lo lee y ejecuta.
> Equivalente al program.md de Karpathy AutoResearch.

---

## MÉTRICA ESCALAR (nunca cambiar sin razón)

```
revenue_per_100_visits = (partner_clicks × valor_por_click) / (visits / 100)
```

NUNCA optimizar por tráfico solo, bounce rate, o vanity metrics.

## BUDGET

- Mínimo **100 visitas** antes de evaluar variante
- Máximo **3 variantes activas** por página
- **3 variantes consecutivas pierden** → PAUSA + alerta humana

## PRIORIDADES DE OPTIMIZACIÓN

### P1: Headlines
- 3-5 variantes del título
- Probar: longitud, números, pregunta vs afirmación, urgencia
- Mantener keyword principal siempre

### P2: CTA Copy y Posición  
- Probar posición: párrafo 3 vs final vs después de H2
- Probar copy: "Descarga ikigii" vs "Prueba gratis" vs "Abre tu cuenta en 5 min"
- Probar urgencia: "Hoy" vs sin fecha

### P3: Estructura
- FAQ arriba vs abajo
- Comparativa visible vs accordion
- Calculadora embedida vs link
- Tabla comparativa vs narrativa

### P4: Trust
- Con/sin badge "Regulado SBP"
- Con/sin testimonios
- Con/sin datos citados visibles

## NO TOCAR

- Datos factuales verificados
- Disclosure de afiliación
- Autor (Carlos Medina)
- Schema markup
- URLs indexadas

## GENERACIÓN DE HIPÓTESIS

1. Patrones de top 5 páginas por RPP
2. Patrones de bottom 5 páginas por RPP
3. Historial de experimentos previos (tabla experiments)
4. Benchmarks de industria

Cada hipótesis: específica, medible, reversible.

## CICLO

```
MEDIR → ANALIZAR → HIPÓTESIS → DEPLOY → ESPERAR (100 visits) → EVALUAR → COMMIT → LOG → REPETIR
```

## NOTAS DEL OPERADOR

- [2026-03-15] Sistema iniciado. Foco: headlines + CTA position.
- Cluster prioritario: "abrir cuenta USD"
- ikigii quiere enfatizar facilidad (< 5 minutos)
