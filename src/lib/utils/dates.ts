import {
    format,
    formatDistance,
    formatRelative,
    differenceInDays,
    differenceInHours,
    differenceInMinutes,
    addDays,
    addMonths,
    subDays,
    subMonths,
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    isAfter,
    isBefore,
    isWithinInterval,
    parseISO,
} from "date-fns";
import { es } from "date-fns/locale";

// ═══════════════════════════════════════════════════════════════════════════════
// INFRAESTRUCTURA DE FECHAS — DATE-FNS
//
// Este archivo hace DOS cosas:
//   1. Configura el locale en espanol para todas las operaciones de fecha
//   2. Provee funciones temporales de uso universal
//
// Las funciones de dominio (semaforos de vencimiento, dias habiles,
// rangos fiscales, logica FEFO) van en /src/lib/utils/dates/[modulo].ts
// e importan desde aquí, heredando el locale configurado.
// ═══════════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────────
// LOCALE — configuracion central
// Cambiar este valor afecta a todas las funciones de este modulo y a
// los modulos de negocio que importen desde aqui.
// ───────────────────────────────────────────────────────────────────────────────
const locale = es;

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES DE FORMATEO CON DATE-FNS
// Para formateo de presentacion simple (sin manipulacion) preferir
// las funciones de formatters.ts que usan Intl nativo.
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha con un patron personalizado de date-fns en espanol.
 * Consultar patrones disponibles: https://date-fns.org/docs/format
 *
 * @example
 *   formatearConPatron(new Date(), 'EEEE dd MMMM yyyy') → "lunes 14 abril 2026"
 *   formatearConPatron(new Date(), 'MMM yyyy')          → "abr 2026"
 */
export function formatearConPatron(fecha: Date | string, patron: string): string {
    const date = typeof fecha === "string" ? parseISO(fecha) : fecha;
    return format(date, patron, { locale });
}

/**
 * Formatea una fecha para inputs HTML type="date".
 * Los inputs de fecha del navegador requieren el formato yyyy-MM-dd exactamente.
 *
 * @example
 *   formatearParaInput(new Date('2026-04-14')) → "2026-04-14"
 */
export function formatearParaInput(fecha: Date | string): string {
    const date = typeof fecha === "string" ? parseISO(fecha) : fecha;
    return format(date, "yyyy-MM-dd");
}

/**
 * Formatea una fecha como distancia relativa al momento actual en espanol.
 * Para tiempo relativo simple preferir formatearTiempoRelativo() de formatters.
 * Usar esta cuando se necesita la version de date-fns con mas control.
 *
 * @example
 *   formatearDistancia(hace3Dias) → "hace 3 dias"
 *   formatearDistancia(en2Horas)  → "en 2 horas"
 */
export function formatearDistancia(
    fecha: Date | string,
    base: Date = new Date()
): string {
    const date = typeof fecha === "string" ? parseISO(fecha) : fecha;
    return formatDistance(date, base, { locale, addSuffix: true });
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES DE CALCULO TEMPORAL
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Calcula la diferencia en dias entre dos fechas.
 * El resultado es positivo si fechaFin es posterior a fechaInicio.
 *
 * @example
 *   diferenciaDias('2026-04-01', '2026-04-14') → 13
 *   diferenciaDias('2026-04-14', '2026-04-01') → -13
 */
export function diferenciaDias(
    fechaInicio: Date | string,
    fechaFin: Date | string = new Date()
): number {
    const inicio = typeof fechaInicio === "string" ? parseISO(fechaInicio) : fechaInicio;
    const fin = typeof fechaFin === "string" ? parseISO(fechaFin) : fechaFin;
    return differenceInDays(fin, inicio);
}

/**
 * Verifica si una fecha cae dentro de un rango (inclusivo en ambos extremos).
 *
 * @example
 *   estaEnRango('2026-04-14', '2026-04-01', '2026-04-30') → true
 *   estaEnRango('2026-05-01', '2026-04-01', '2026-04-30') → false
 */
export function estaEnRango(
    fecha: Date | string,
    inicio: Date | string,
    fin: Date | string
): boolean {
    const date = typeof fecha === "string" ? parseISO(fecha) : fecha;
    const start = typeof inicio === "string" ? parseISO(inicio) : inicio;
    const end = typeof fin === "string" ? parseISO(fin) : fin;
    return isWithinInterval(date, { start, end });
}

/**
 * Retorna el rango del mes actual: { inicio, fin }.
 * Util para filtros por defecto en listados y reportes.
 *
 * @example
 *   rangoMesActual() → { inicio: 2026-04-01 00:00:00, fin: 2026-04-30 23:59:59 }
 */
export function rangoMesActual(): { inicio: Date; fin: Date } {
    const ahora = new Date();
    return {
        inicio: startOfMonth(ahora),
        fin: endOfMonth(ahora),
    };
}

// ───────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS — funciones de date-fns listas para usar con locale configurado
// Los modulos de negocio importan desde aqui en lugar de importar date-fns
// directamente, manteniendo el locale centralizado.
// ───────────────────────────────────────────────────────────────────────────────
export {
    addDays,
    addMonths,
    subDays,
    subMonths,
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    isAfter,
    isBefore,
    parseISO,
    differenceInHours,
    differenceInMinutes,
    formatRelative,
    locale as localeEs,
};
