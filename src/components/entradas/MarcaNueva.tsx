'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// MARCA NUEVA — Guía 1.6 · MEJORA 54 (09 Oct 2026) · Dumb
//
// EL MARCADOR de «esta entrada es nueva», aprobado en el mockup
// `DOCS/design/entradas/02-revision/nuevas-en-la-cola.html` (opción **A+B**).
//
// ── POR QUÉ ES UNA SOLA PIEZA Y NO DOS ─────────────────────────────────────────
// Tiene **dos razones** para estar ahí, y se dibuja **una** vez:
//   · **B · recencia** — `created_at` dentro de la ventana de 24 h (el criterio
//     puro vive en `lib/avisos-entradas.ts`, con sus pruebas). **Sobrevive a la
//     recarga** porque el dato ya viene en el listado.
//   · **A · llegó en vivo** — la fila entró por Realtime en esta sesión ⇒ **pulsa**.
//     Ese hecho es de la SESIÓN, así que vive en el store; y **se apaga cuando el
//     operario abre la entrada** (decisión del dueño, 09 Oct 2026).
//
// ── POR QUÉ NO ES UNA PÍLDORA DEL KIT ──────────────────────────────────────────
// Los **10 tonos** de `Pildora` ya están tomados por los estados del flujo, y la
// píldora es redonda: «nueva» **no es un estado del documento**, es un hecho con
// fecha. Se distingue por **forma y movimiento**, no por color — el mockup lo
// declaró (variante (ii) descartada) y la SPEC se corrige al validar.
//
// ── ⚠️ TRES DESVÍOS DEL MOCKUP, DELIBERADOS Y ANOTADOS ────────────────────────
//   ① `prefers-reduced-motion` **explícito**: el mockup lo pedía y `animate-pulse`
//      del kit no lo trae de fábrica ⇒ `motion-reduce:animate-none`.
//   ② El pulso es el `animate-pulse` **del kit** (2 s), no un keyframe propio de
//      1,6 s: es la animación que el proyecto ya usa —el mismo archivo de columnas
//      la usa dos veces— y no se inventa una segunda.
//   ③ El `title` dice **horas enteras** («hace menos de 1 h» · «hace 22 h») y no
//      el decimal crudo del mockup («0,03 h»): un tooltip se lee, no se interpreta.
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'
import { esNuevaPorRecencia, textoRecencia } from '@/lib/avisos-entradas'
import { useEsNuevaEnVivo } from '@/lib/stores/avisos-entradas-store'

interface MarcaNuevaProps {
    idEntrada: string
    /** `entradas.created_at` (ISO) — la fecha de CAPTURA, no la del documento. */
    createdAt?: string | null
}

export function MarcaNueva({ idEntrada, createdAt }: MarcaNuevaProps) {
    const enVivo = useEsNuevaEnVivo(idEntrada)

    // B · recencia — se evalúa en el render: el listado ya trae el dato y no vale
    // la pena un estado propio para algo que el reloj resuelve solo.
    const nueva = enVivo || esNuevaPorRecencia(createdAt)
    if (!nueva) return null

    const titulo = enVivo
        ? 'Nueva: acaba de llegar a tu cola'
        : `Nueva: se capturó hace ${textoRecencia(createdAt ?? '')}`

    return (
        <span
            // ⚠️ Los DOS roles son a propósito: el que ACABA de llegar es un evento
            // y se anuncia (`status` = región viva); el que solo es RECIENTE es una
            // propiedad de la fila (`img` + `aria-label`). Con `status` en los dos,
            // abrir una cola de 25 filas dispararía 25 anuncios seguidos.
            role={enVivo ? 'status' : 'img'}
            aria-label="Nueva"
            title={titulo}
            className={cn(
                'inline-flex shrink-0 items-center gap-[5px] rounded-md border border-border bg-surface-2 px-1.5 py-px',
                'whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground',
                // Solo el «llegó en vivo» pulsa, y se rinde ante quien pidió menos movimiento.
                enVivo && 'animate-pulse motion-reduce:animate-none'
            )}
        >
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
            {/* ⚠️ La etiqueta aparece recién en ≥1300px (decisión del mockup): en un
                puesto de 1024–1280 el ancho lo pelea la tabla, y el PUNTO ya dice
                «nueva» sin gastar una palabra. */}
            <span className="hidden min-[1300px]:inline">Nueva</span>
        </span>
    )
}
