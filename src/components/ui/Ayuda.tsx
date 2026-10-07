'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AYUDA — el componente del ESTÁNDAR (MEJORA 47 · 04 Oct 2026 · pieza de kit/UI)
//          extendido por la GUÍA 2.4 (05 Oct 2026): el TEXTO SUELTO.
//
// Muestra un texto de ayuda del registro… **si el usuario lo tiene prendido**.
//
// ⭐ DOS FORMAS, porque los textos viven en dos lugares distintos:
//      <Ayuda k="revision.algo" />          → en el JSX
//      useAyuda('revision.algo')            → en un prop (`descripcion`, `title`…)
//
// ⭐ GUÍA 2.4 — AHORA SON DOS NIVELES, y la CATEGORÍA es el maestro:
//      visible  =  (categoría prendida)  Y  (texto suelto prendido)
//    · apagar la categoría `nota` apaga TODAS las notas del módulo, aunque un texto
//      suelto esté prendido;
//    · apagar un texto apaga SOLO ese.
//    Lo que no esté declarado en la preferencia **se ve** (el defecto es ver).
//
// ⚠️ LEE la preferencia del store de auth (`usuario.preferencias.ayudas`), igual que
//    el `ThemeToggler` lee el tema: es la MISMA preferencia de UI del mismo JSONB.
//    **No hay provider nuevo**.
// ⚠️ **El defecto es VER**: si la preferencia no existe (fila vieja, o nadie la
//    tocó) la ayuda se muestra. Ocultar por defecto sería quitarle información a
//    alguien que no lo pidió.
// ⚠️ **La categoría decide el INTERRUPTOR, no el estilo.** El aspecto lo sigue
//    poniendo la pantalla por `className`.
// ⚠️ Si la clave no está en el registro devuelve vacío y **no rompe**.
// ═══════════════════════════════════════════════════════════════════════════════

import { definicionDe, esOcultable, moduloDeClave } from '@/config/ayudas'
import { useAuth } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'
import type { PreferenciasAyudas } from '@/types/ayudas'

/** Reemplaza `{clave}` por su valor. Sin variables devuelve el texto tal cual. */
function conVariables(texto: string, vars?: Record<string, string | number>): string {
    if (!vars) return texto
    return texto.replace(/\{(\w+)\}/g, (todo, clave: string) =>
        clave in vars ? String(vars[clave]) : todo
    )
}

/**
 * ⭐ TERCERA FORMA, **sin hook**: el texto de una ayuda a partir de la preferencia que
 * le pasen. Existe por dos casos reales que aparecieron al cablear Revisión:
 *   · un `title` que se elige con un ternario (no se pueden llamar hooks adentro);
 *   · un texto que se **guarda en estado** (`setNota(...)`) o se usa en un callback.
 * ⚠️ En el caso del estado, el texto queda **congelado** al momento de guardarlo.
 *
 * 🔑 **Acá vive la regla de los dos niveles** (Guía 2.4): si se decidiera solo en el
 *    componente, los textos consumidos por `title` ignorarían los dos interruptores.
 */
export function textoAyuda(
    clave: string,
    prefs: PreferenciasAyudas | undefined,
    vars?: Record<string, string | number>
): string {
    const def = definicionDe(clave)
    if (!def) return ''
    // 🔴 `fijo` = no se oculta nunca (el candado dentro de una confirmación).
    if (!esOcultable(clave)) return conVariables(def.texto, vars)

    const delModulo = prefs?.[moduloDeClave(clave)]
    // El MAESTRO: la categoría. Y el texto suelto solo puede apagar más.
    const categoriaPrendida = delModulo?.[def.tipo] ?? true
    const textoPrendido = delModulo?.textos?.[clave] ?? true

    return categoriaPrendida && textoPrendido ? conVariables(def.texto, vars) : ''
}

/**
 * El texto de una ayuda, o `''` si está apagada (o si la clave no existe).
 * Se usa en los **props** que no admiten un componente (`descripcion`, `title`…).
 */
export function useAyuda(clave: string, vars?: Record<string, string | number>): string {
    const ayudas = useAuth((s) => s.usuario?.preferencias?.ayudas)
    return textoAyuda(clave, ayudas, vars)
}

interface AyudaProps {
    /** La clave del registro: `modulo.algo-en-kebab`. */
    k: string
    /** Valores para los `{marcadores}` del texto. */
    vars?: Record<string, string | number>
    /** El aspecto: lo pone la pantalla (el componente no inventa estilos). */
    className?: string
    /**
     * `true` = se pinta **en línea**, para ir dentro de un párrafo que ya existe.
     * Por defecto va como bloque, que es como estaban estos textos antes (`<p>`).
     */
    inline?: boolean
}

export function Ayuda({ k, vars, className, inline }: AyudaProps) {
    const texto = useAyuda(k, vars)
    if (!texto) return null
    // `<span>` y no `<p>`: así también es válido dentro de un párrafo que ya existe.
    return <span className={cn(inline ? 'inline' : 'block', className)}>{texto}</span>
}
