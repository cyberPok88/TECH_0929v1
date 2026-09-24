import Decimal from "decimal.js";

// ═══════════════════════════════════════════════════════════════════════════════
// INFRAESTRUCTURA DE FORMATEO — PRESENTACION AL USUARIO
//
// Todas las funciones usan APIs nativas de JavaScript (Intl) — sin
// dependencias externas. Compatible con cualquier locale y moneda.
//
// Las funciones especificas de negocio (formateo de estados de pedido,
// etiquetas de semaforo de vencimiento, etc.) van en sus modulos
// correspondientes e importan desde aqui lo que necesiten.
// ═══════════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────────
// FORMATEO DE MONEDA Y NUMEROS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un monto como moneda con simbolo.
 * El locale y la moneda son configurables para soportar cualquier pais.
 *
 * @param monto   Valor a formatear (Decimal o number)
 * @param locale  Locale BCP 47 (default: 'es-MX')
 * @param moneda  Codigo ISO 4217 (default: 'MXN')
 *
 * @example
 *   formatearMoneda(49182.02)               → "$49,182.02"
 *   formatearMoneda(49182.02, 'es-CO', 'COP') → "$ 49.182,02"
 *   formatearMoneda(49182.02, 'en-US', 'USD') → "$49,182.02"
 */
export function formatearMoneda(
    monto: Decimal | number,
    locale: string = "es-MX",
    moneda: string = "MXN"
): string {
    const valor = monto instanceof Decimal ? monto.toNumber() : monto;
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: moneda,
    }).format(valor);
}

/**
 * Formatea un numero con separador de miles y 2 decimales fijos.
 * Util cuando se quiere el valor numerico sin simbolo de moneda.
 *
 * @example
 *   formatearNumero(49182.02) → "49,182.02"   (locale es-MX)
 *   formatearNumero(49182.02, 'de-DE') → "49.182,02"
 */
export function formatearNumero(
    valor: Decimal | number,
    locale: string = "es-MX"
): string {
    const num = valor instanceof Decimal ? valor.toNumber() : valor;
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

/**
 * Formatea un decimal (0-1) como porcentaje legible.
 *
 * @param valor   Decimal entre 0 y 1 (0.16 = 16%)
 * @param locale  Locale BCP 47 (default: 'es-MX')
 *
 * @example
 *   formatearPorcentaje(0.16) → "16 %"
 *   formatearPorcentaje(0.08) → "8 %"
 */
export function formatearPorcentaje(
    valor: number,
    locale: string = "es-MX"
): string {
    return new Intl.NumberFormat(locale, { style: "percent" }).format(valor);
}

/**
 * Convierte un string de moneda formateado de vuelta a Decimal.
 * Util para procesar inputs del usuario que ya vienen formateados.
 *
 * @example
 *   parsearMoneda("$49,182.02") → Decimal(49182.02)
 *   parsearMoneda("49.182,02")  → Decimal(4918202)  ← atencion al locale
 */
export function parsearMoneda(monedaStr: string): Decimal {
    // Elimina simbolo de moneda, espacios y separadores de miles comunes
    const limpio = monedaStr.replace(/[$€£¥,\s]/g, "");
    return new Decimal(limpio);
}

// ───────────────────────────────────────────────────────────────────────────────
// FORMATEO DE FECHAS
// Para operaciones con fechas (sumar dias, comparar) usar date-fns.
// Para presentar una fecha ya calculada, estas funciones son suficientes.
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha en formato corto: dd/mm/aaaa.
 *
 * @example
 *   formatearFecha(new Date('2026-04-14')) → "14/04/2026"
 *   formatearFecha('2026-04-14')           → "14/04/2026"
 */
export function formatearFecha(
    fecha: Date | string,
    locale: string = "es-MX"
): string {
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

/**
 * Formatea una fecha con hora: dd/mm/aaaa HH:mm.
 * Usa formato de 24 horas — estandar en sistemas de negocio de LATAM.
 *
 * @example
 *   formatearFechaHora(new Date('2026-04-14T14:30:00')) → "14/04/2026 14:30"
 */
export function formatearFechaHora(
    fecha: Date | string,
    locale: string = "es-MX"
): string {
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}

/**
 * Formatea una fecha en formato largo con nombre del mes.
 * Util para encabezados de documentos, reportes y confirmaciones.
 *
 * @example
 *   formatearFechaLarga(new Date('2026-04-14')) → "14 de abril de 2026"
 */
export function formatearFechaLarga(
    fecha: Date | string,
    locale: string = "es-MX"
): string {
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(date);
}

/**
 * Formatea una fecha como tiempo relativo al momento actual.
 * Util para feeds de actividad, timestamps de comentarios, etc.
 *
 * @example
 *   formatearTiempoRelativo(hace 2 dias) → "hace 2 dias"
 *   formatearTiempoRelativo(en 3 horas)  → "en 3 horas"
 */
export function formatearTiempoRelativo(
    fecha: Date | string,
    locale: string = "es-MX"
): string {
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    const ahora = new Date();
    const diffMs = date.getTime() - ahora.getTime();
    const diffSegundos = Math.round(diffMs / 1000);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    // Seleccionar la unidad mas legible segun la magnitud de la diferencia
    const abs = Math.abs(diffSegundos);
    if (abs < 60) return rtf.format(diffSegundos, "second");
    if (abs < 3600) return rtf.format(Math.round(diffSegundos / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diffSegundos / 3600), "hour");
    if (abs < 2592000) return rtf.format(Math.round(diffSegundos / 86400), "day");
    if (abs < 31536000) return rtf.format(Math.round(diffSegundos / 2592000), "month");
    return rtf.format(Math.round(diffSegundos / 31536000), "year");
}
