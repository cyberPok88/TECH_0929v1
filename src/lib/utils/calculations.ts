import Decimal from "decimal.js";

// ═══════════════════════════════════════════════════════════════════════════════
// INFRAESTRUCTURA DE CALCULO — DECIMAL.JS
//
// Este archivo hace DOS cosas que deben permanecer juntas:
//   1. Configura Decimal.js globalmente (precision y redondeo)
//   2. Provee funciones matematicas de uso universal
//
// Las funciones de negocio (calculos de impuestos, totales de pedido, etc.)
// van en src/lib/utils/calculations/[modulo].ts y heredan la configuracion
// global porque este modulo se importa primero en el arbol de dependencias.
// ═══════════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────────
// CONFIGURACION GLOBAL DE DECIMAL.JS
// Se aplica al importar este modulo por primera vez.
// Afecta a todas las instancias de Decimal en la aplicacion.
// ───────────────────────────────────────────────────────────────────────────────

Decimal.set({
    // 20 digitos significativos — cubre billones con 6 decimales de precision
    precision: 20,

    // Estandar bancario: 0.005 → 0.01 (no 0.00)
    // Es el comportamiento que esperan sistemas fiscales de LATAM
    rounding: Decimal.ROUND_HALF_UP,

    // Notacion cientifica solo para numeros fuera del rango normal de operacion
    toExpNeg: -9,
    toExpPos: 21,
});

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES DE USO UNIVERSAL
// Sin logica de negocio — aplican en cualquier nicho
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Redondea un valor a N decimales con ROUND_HALF_UP (estandar bancario).
 *
 * Usar al guardar montos en la BD, mostrarlos al usuario o
 * compararlos con otros valores formateados.
 *
 * @param valor      Numero a redondear
 * @param decimales  Posiciones decimales (default: 2 para moneda)
 *
 * @example
 *   redondear(49.555)    → Decimal(49.56)
 *   redondear(49.554)    → Decimal(49.55)
 *   redondear(1.2345, 3) → Decimal(1.235)
 */
export function redondear(valor: number | Decimal, decimales: number = 2): Decimal {
    return new Decimal(valor).toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP);
}

/**
 * Aplica un descuento porcentual sobre un valor base.
 *
 * @param base       Valor original antes del descuento
 * @param porcentaje Descuento en porcentaje (0-100). Ejemplo: 15 = 15%
 * @returns          Valor despues de aplicar el descuento
 *
 * @example
 *   aplicarDescuento(1000, 15) → Decimal(850)   // 1000 - 15% = 850
 *   aplicarDescuento(500, 0)   → Decimal(500)    // Sin descuento
 */
export function aplicarDescuento(
    base: number | Decimal,
    porcentaje: number | Decimal
): Decimal {
    const baseDecimal = new Decimal(base);
    const factor = new Decimal(1).minus(new Decimal(porcentaje).dividedBy(100));
    return baseDecimal.times(factor);
}

/**
 * Calcula el monto de un porcentaje sobre una base.
 * Util para calcular cualquier tasa o cargo: impuestos, comisiones, etc.
 *
 * @param base       Valor base sobre el que se calcula el porcentaje
 * @param porcentaje Porcentaje como numero entero (0-100). Ejemplo: 16 = 16%
 * @returns          Monto del porcentaje (no el total — solo la parte)
 *
 * @example
 *   calcularPorcentaje(1000, 16) → Decimal(160)   // 16% de 1000
 *   calcularPorcentaje(850, 8)   → Decimal(68)    // 8% de 850
 */
export function calcularPorcentaje(
    base: number | Decimal,
    porcentaje: number | Decimal
): Decimal {
    return new Decimal(base).times(new Decimal(porcentaje).dividedBy(100));
}

/**
 * Convierte un Decimal a number nativo de JavaScript.
 * Siempre redondea a 2 decimales antes de convertir para evitar
 * que la precision extendida de Decimal produzca numeros como 49.999999999.
 *
 * Usar al serializar datos para JSON, APIs o bases de datos
 * que no aceptan el tipo Decimal directamente.
 *
 * @example
 *   toNumber(new Decimal(49.555)) → 49.56
 *   toNumber(new Decimal(1000))   → 1000
 */
export function toNumber(valor: Decimal): number {
    return redondear(valor, 2).toNumber();
}

/**
 * Suma un array de valores con precision Decimal.
 * Equivalente seguro a array.reduce((a, b) => a + b, 0) para montos.
 *
 * @example
 *   sumar([100.1, 200.2, 300.3]) → Decimal(600.6)
 *   sumar([])                    → Decimal(0)
 */
export function sumar(valores: (number | Decimal)[]): Decimal {
    return valores.reduce<Decimal>(
        (acum, val) => acum.plus(new Decimal(val)),
        new Decimal(0)
    );
}
