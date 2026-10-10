// ═══════════════════════════════════════════════════════════════════════════════
// ERRORES — el código viaja SIEMPRE (convención, 05 Oct 2026)
//
// Responde una sola pregunta: **¿cómo se le muestra un error de la base al usuario?**
//
// ⚠️ EL PROBLEMA QUE CIERRA, y está medido con su costo: el 05 Oct 2026 un toast dijo
//    `DELETE requires a WHERE clause` —crudo y **sin código**— y costó **una sesión
//    entera** de diagnóstico (se buscó en la función, en los triggers, en los permisos
//    y en las extensiones). Con el código al lado, se resuelve en un minuto.
//
// ⭐ LA REGLA, en dos mitades:
//    ① donde la casa YA traduce (`traducirErrorX(codigo, mensaje)`), el fallback
//       **agrega el código** en vez de devolver el mensaje pelado;
//    ② donde mostraba `error.message` a secas, ahora pasa por acá.
//
// ⚠️ **Esto NO traduce.** Traducir es escribir una frase en español por cada caso
//    (`duplicate key … uq_ubicaciones_nombre` → «Ya existe una ubicación con ese
//    nombre»), y eso es **una decisión de redacción por caso**: se hace módulo por
//    módulo, cuando ese módulo se toca. Acá solo se garantiza que **nunca falte el
//    código**, que es la mitad mecánica y la que evita los acertijos.
//
// ⚠️ Y NO se aplica a los mensajes de **validación** (los de Zod, `parsed.error
//    .issues[…]`): esos ya están escritos en español para el usuario y **no tienen
//    código de Postgres** — envolverlos agregaría un `(undefined)` que solo hace ruido.
// ═══════════════════════════════════════════════════════════════════════════════

/** La forma mínima de un error de PostgREST / supabase-js. Permisiva a propósito. */
interface ErrorConCodigo {
    message: string
    /** El SQLSTATE (`23505`, `P0001`, `42501`…) o el código de PostgREST. */
    code?: string | null
}

/**
 * El mensaje del error **con su código**, para mostrarlo tal cual.
 *
 * ⚠️ Devuelve `undefined` si no hay error, **a propósito**: así los llamadores que hoy
 *    escriben `errX?.message ?? 'algo'` **conservan su fallback** en vez de perderlo.
 *    (Si devolviera un texto por defecto, el `??` quedaría muerto y el usuario vería
 *    ese texto genérico en lugar del específico que el módulo ya había elegido.)
 *
 * ⚠️ **Y por eso, en un sitio que exige `string`, NO alcanza con llamarlo solo.**
 *    TypeScript **no puede estrechar** el resultado aunque el error sea no-nulo —el
 *    parámetro es opcional— así que un retorno `: string` pide una guardia. Las dos
 *    formas válidas: `describirError(e) ?? mensaje` (lo que usan los 8 `traducirErrorX`)
 *    o `describirErrorTexto(e)`.
 *    🔴 **Ese `?? mensaje` NO es código muerto: es la guardia de tipo.** El 06 Oct 2026
 *    lo quité por «redundante» y `tsc` tiró **7 errores** en los 8 traductores.
 */
export function describirError(error?: ErrorConCodigo | null): string | undefined {
    if (!error) return undefined
    return error.code ? `${error.message} (${error.code})` : error.message
}

/**
 * Igual que `describirError`, pero **siempre devuelve texto** — para los sitios donde el
 * tipo de retorno exige `error: string` y no admite `undefined`.
 */
export function describirErrorTexto(error?: ErrorConCodigo | null): string {
    return describirError(error) ?? 'No se pudo completar la operación.'
}
