// ═══════════════════════════════════════════════════════════════════════════════
// GENERADOR DE CONTRASEÑA — Guía 0.9 (Decisión 5)
//
// crypto.getRandomValues, NUNCA Math.random(): la contraseña temporal es la
// única credencial del usuario nuevo hasta que la cambie. Math.random no es
// criptográficamente seguro y su secuencia es predecible.
//
// El alfabeto garantiza AL MENOS un carácter de cada clase que exige la política
// de Supabase Auth, reflejada en lib/validations/password.ts: mayúscula,
// minúscula, número y símbolo. Sin esa garantía una password de 16 caracteres
// podría salir sin símbolo y el propio validador del front la rechazaría.
// ═══════════════════════════════════════════════════════════════════════════════

const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'   // sin I ni O (se confunden al dictar)
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz'   // sin l
const NUMEROS = '23456789'                        // sin 0 ni 1
const SIMBOLOS = '!@#$%^&*()_+-='                  // subconjunto seguro del set de Supabase

const TODOS = MAYUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS

/** Entero aleatorio en [0, max) con el CSPRNG del runtime. */
function enteroSeguro(max: number): number {
    const buffer = new Uint32Array(1)
    globalThis.crypto.getRandomValues(buffer)
    return buffer[0] % max
}

/**
 * Genera una contraseña que SIEMPRE cumple validarPassword():
 * un carácter obligatorio de cada clase + relleno aleatorio, todo barajado.
 *
 * @param longitud total de caracteres (mínimo 8; default 16)
 */
export function generarPassword(longitud = 16): string {
    const largo = Math.max(8, longitud)

    // Uno de cada clase primero — así la política nunca falla por azar.
    const obligatorios = [
        MAYUSCULAS[enteroSeguro(MAYUSCULAS.length)],
        MINUSCULAS[enteroSeguro(MINUSCULAS.length)],
        NUMEROS[enteroSeguro(NUMEROS.length)],
        SIMBOLOS[enteroSeguro(SIMBOLOS.length)],
    ]

    const relleno: string[] = []
    for (let i = obligatorios.length; i < largo; i++) {
        relleno.push(TODOS[enteroSeguro(TODOS.length)])
    }

    // Barajado Fisher–Yates con el mismo CSPRNG: sin barajar, los 4 obligatorios
    // quedarían siempre al principio en el mismo orden de clase.
    const caracteres = [...obligatorios, ...relleno]
    for (let i = caracteres.length - 1; i > 0; i--) {
        const j = enteroSeguro(i + 1)
        const tmp = caracteres[i]
        caracteres[i] = caracteres[j]
        caracteres[j] = tmp
    }

    return caracteres.join('')
}
