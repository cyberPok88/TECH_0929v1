// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN DE FILTROS DEL SHELL — Guía 0.6 · decisión 25 (01 Sep 2026)
//
// El ESPACIO donde cada página registra sus controles de filtro. Igual que la
// Toolbar recibe las acciones (usePageConfig.actions), esta sección recibe los
// filtros (usePageConfig.filtros). Colapsa si la página no registra nada.
//
// ⭐ MEJORA 26 Sep 2026 — TECHO EN MÓVIL (medido en Chrome headless, 320×568):
// el shell es `fixed inset-0 … overflow-hidden` (FIX 26 Ago 2026), así que el
// documento NUNCA scrollea y no hay forma de escapar del bloque de filtros. Sin
// techo, un apartado con multiselect + rango + switch + segmented medía 315px
// (55% de la pantalla) y dejaba la tabla en 67px ≈ 1.5 filas. Con el techo de
// 38svh (y scroll interno propio) la tabla recupera 194px ≈ 4.3 filas (×3).
// `svh` (no `vh`) mide el viewport PEQUEÑO: con la barra del navegador visible
// el techo encoge y el espacio que se libera va a la tabla, no al hueco.
// `overscroll-contain` corta el encadenado del scroll hacia <main>.
//
// ⭐ MEJORA 26 Sep 2026 (2ª iteración) — EL BLOQUE SE APARTA AL BAJAR (móvil).
// El techo lo acotaba, pero seguía ocupando la parte de arriba de la pantalla
// para siempre: con la tabla scrolleando por dentro, el usuario no podía
// recuperar ese alto. Ahora, en <md, al bajar por una tabla larga el bloque se
// pliega (max-height 0) y al subir vuelve. Es el gesto que el usuario pidió:
// «que se esconda o que se mueva hacia arriba cuando scrollea».
//   · Solo <md: en escritorio el bloque mide UNA línea y no estorba.
//   · Lee el scroll de `#shell-main` (contrato declarado en el layout) — el
//     layout no conoce los filtros y esta sección no conoce el layout.
//   · NO se pliega con el scroll pegado al fondo: al encogerse el bloque, el
//     navegador recorta `scrollTop` y el recorte se leería como «subió», lo que
//     devolvería el bloque en un bucle. Ver `alFondo` abajo.
//   · Los controles NO se desmontan: se pliegan. El texto a medio teclear del
//     buscador y el estado local de CatalogoFilters sobreviven al pliegue.
// ═══════════════════════════════════════════════════════════════════════════════
'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { usePageContextStore } from '@/lib/stores/page-context-store'

/** Contenedor de scroll del Shell — lo declara `app/dashboard/layout.tsx`. */
const ID_SCROLL = 'shell-main'

/** Px de scroll necesarios para reaccionar. Bajo esto, el gesto es ruido. */
const UMBRAL = 10

/** Hasta este ancho el bloque se aparta solo; de md en adelante mide una línea. */
const CONSULTA_MOVIL = '(max-width: 767px)'

export function FiltrosBar() {
    const filtros = usePageContextStore((s) => s.filtros)
    const [apartado, setApartado] = useState(false)

    useEffect(() => {
        const scroller = document.getElementById(ID_SCROLL)
        if (scroller === null) return

        const movil = window.matchMedia(CONSULTA_MOVIL)
        let ultimoTop = scroller.scrollTop

        const alScrollear = () => {
            if (!movil.matches) return

            const top = scroller.scrollTop
            const delta = top - ultimoTop
            ultimoTop = top

            // Arriba del todo es el estado de reposo: siempre visible.
            if (top <= 8) {
                setApartado(false)
                return
            }

            // Pegado al fondo NO se aparta: al plegarse, el contenedor pierde
            // alto, el navegador recorta `scrollTop` y ese recorte (grande y
            // hacia arriba) se leería como «el usuario subió» → volvería a
            // mostrarse y se plegaría otra vez. Un parpadeo por gesto.
            const alFondo = top + scroller.clientHeight >= scroller.scrollHeight - 8

            if (delta > UMBRAL && !alFondo) setApartado(true)
            else if (delta < -UMBRAL) setApartado(false)
        }

        // Al salir de móvil (rotar, agrandar la ventana) el bloque vuelve: el
        // pliegue es una decisión de móvil, no un estado que viaje con el ancho.
        const alCambiarAncho = () => {
            if (!movil.matches) setApartado(false)
        }

        scroller.addEventListener('scroll', alScrollear, { passive: true })
        movil.addEventListener('change', alCambiarAncho)
        return () => {
            scroller.removeEventListener('scroll', alScrollear)
            movil.removeEventListener('change', alCambiarAncho)
        }
    }, [])

    // Sin filtros registrados → la sección no existe (colapsa).
    if (filtros == null) return null

    return (
        <div
            className={cn(
                'custom-scrollbar flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-3 py-2',
                'max-h-[38svh] overflow-y-auto overscroll-contain',
                'transition-[max-height,opacity,padding] duration-200 ease-out motion-reduce:transition-none',
                'md:max-h-none md:flex-row md:flex-wrap md:items-center md:overflow-visible',
                // cn resuelve los conflictos: max-h-0 gana a max-h-[38svh],
                // py-0 a py-2 y border-b-0 a border-b. Los `md:` sobreviven.
                apartado && 'max-h-0 border-b-0 py-0 opacity-0'
            )}
        >
            {filtros}
        </div>
    )
}
