'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// TARJETA DE DESCRIPCIONES — la V2 del estándar de ayudas (Guía 2.4 · 05 Oct 2026)
//
// Es el envoltorio del `<PanelAyudas>` que vive en el kit. El panel ya sabe leer y
// escribir la preferencia (store + Server Action); acá solo va el MARCO.
//
// ⭐ ESTA ES LA ÚNICA PANTALLA DEL ERP DONDE SE APAGA **TEXTO POR TEXTO**.
//   El Popover del Topbar apaga por CATEGORÍA a propósito: 330px de ancho no son lugar
//   para decenas de casillas. La pantalla completa es la que puede bajar al detalle —
//   y es lo que el propio `AyudasToggler` anticipaba desde su primera línea.
//
// ⚠️ `mostrarTextos` es lo que enciende esa V2. Sin esa prop, el panel se comporta como
//    el del Topbar y el texto suelto deja de existir en toda la aplicación.
// ⚠️ E4 de la anatomía §7: INLINE, no modal. Son casillas que aplican al instante —no hay
//    submit— y el buscador necesita alto. El modal se reserva para lo destructivo (P4).
// ═══════════════════════════════════════════════════════════════════════════════

import { Eye } from 'lucide-react'

import { PanelAyudas } from '@/components/ui/PanelAyudas'

export function TarjetaDescripciones() {
    return (
        <section
            id="descripciones"
            className="overflow-hidden rounded-lg border border-border bg-surface-2"
        >
            <header className="flex items-start gap-2.5 border-b border-border px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-acc-sistema/30 bg-acc-sistema/10 text-acc-sistema">
                    <Eye className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 className="font-display text-[13.5px] font-semibold tracking-wide text-foreground">
                        Descripciones en pantalla
                    </h2>
                    <p className="text-[11.5px] text-muted-foreground">
                        Se guardan en tu usuario: te siguen a otra PC. Apagar una categoría apaga
                        todos sus textos; apagar un texto apaga solo ese.
                    </p>
                </div>
            </header>

            {/* El scroll acotado mantiene el encabezado del módulo (y su contador) a la vista. */}
            <div className="max-h-[560px] overflow-y-auto">
                <PanelAyudas mostrarTextos />
            </div>
        </section>
    )
}
