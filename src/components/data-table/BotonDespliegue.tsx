'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// BOTÓN DE DESPLIEGUE — Guía 0.8 · P9 · B8 (contrato agregado 26 Sep 2026)
//
// El chevron que abre y cierra una fila. Nació de un pedido literal del usuario:
// *«los botones de detalles darles un poco más de vista; la flechita se ve bien pero
// ahora muestra información importante — algo ligero que indique que es un botón»*.
//
// Es el MISMO gesto en los DOS niveles de la tabla:
//   · en la TABLA MADRE, la fila de entrada (lo monta el `DataTable`);
//   · en la TABLA DE DETALLE, la fila de PARTIDA (lo monta `PartidasExpandidas`).
// Si se ven distintos, el usuario no aprende que son lo mismo.
//
// DECISIÓN (usuario, 26 Sep 2026): fantasma con marco al HOVER. En reposo no tiene caja
// —no compite con los datos—; al pasar el ratón aparece el marco y sube la tinta, que es
// lo que lo delata como botón. Sin relleno sólido y sin sombra: «algo ligero».
//
// ⭐ CAMBIO DE DECISIÓN (usuario, 27 Sep 2026): *«hay que darle forma de botón a los chevrones, que el
// contorno sea apegado al tema, y que el hover se vea»*. El fantasma-en-reposo **no se leía como
// botón**: ahora lleva **contorno del tema** (`border-border` + `bg-surface`) siempre visible, y el
// hover **rellena** (`bg-hover-background` + tinta de primer plano), que es lo que hace visible que
// responde. Sigue sin sombra y sin relleno sólido: «algo ligero» se respeta; lo que cambió es que el
// contorno ya no es transparente. ⚠️ El porqué anterior queda escrito arriba a propósito: la decisión
// cambió, no se borró.
//
// ⚠️ `aria-expanded` es obligatorio: el estado abierto/cerrado no puede vivir solo en el
// giro del icono. `aria-label` describe la ACCIÓN sobre el sujeto («Contraer la partida 1»),
// no el icono.
// ═══════════════════════════════════════════════════════════════════════════════

import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface BotonDespliegueProps {
    /** ¿Está desplegado? Gobierna el giro y `aria-expanded`. */
    abierto: boolean
    /** Alterna. El padre es dueño del estado (la tabla es tonta). */
    onAlternar: () => void
    /** Qué describe la acción: «la entrada ING-0002», «la partida 1». Va en el `aria-label`. */
    sujeto: string
    /** Tamaño del objetivo táctil: `md` (kit, 44px de fila) o `sm` (dentro de una tabla anidada). */
    tamano?: 'md' | 'sm'
    /** `id` del contenedor que se muestra/oculta — `aria-controls`. */
    controles?: string
    className?: string
}

export function BotonDespliegue({
    abierto,
    onAlternar,
    sujeto,
    tamano = 'md',
    controles,
    className,
}: BotonDespliegueProps) {
    return (
        <button
            type="button"
            onClick={onAlternar}
            aria-expanded={abierto}
            aria-controls={controles}
            aria-label={abierto ? `Contraer ${sujeto}` : `Desplegar ${sujeto}`}
            title={abierto ? `Contraer ${sujeto}` : `Desplegar ${sujeto}`}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded',
                // Ley 5: 44px de dedo en móvil dentro de la fila del kit; en la tabla de
                // detalle (que ya vive dentro de esa fila) el objetivo es más chico.
                tamano === 'md' ? 'h-11 w-11 md:h-8 md:w-8' : 'size-7',
                'border border-border bg-surface text-muted-foreground',
                'transition-colors duration-150',
                'hover:bg-hover-background hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                className
            )}
        >
            <ChevronRight
                aria-hidden="true"
                className={cn('size-3.5 transition-transform duration-150', abierto && 'rotate-90')}
            />
        </button>
    )
}
