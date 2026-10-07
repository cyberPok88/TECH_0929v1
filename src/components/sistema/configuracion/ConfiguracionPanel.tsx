'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — el panel de la ruta (Guía 2.4 · 05 Oct 2026)
//
// Dos capas:
//   1. el ÍNDICE de fichas — el patrón de aterrizaje de Entradas y Almacén, que además
//      es el mapa de LO QUE ESTA INSTALACIÓN PUEDE HACER (con el candado apagado
//      muestra una sola ficha);
//   2. el CONTENIDO — la tarjeta de descripciones, y el acceso al borrado.
//
// ⚠️ ESTE ARCHIVO NO IMPORTA `lib/utils/entorno.ts`, y esa es toda la garantía del
//    candado: la variable `ENTORNO` es server-only, así que la decisión de mostrar el
//    borrado llega desde `page.tsx` (Server Component) COMO PROP.
//
// ⭐ La ficha de borrado es un BOTÓN, no un `Link`: el borrado vive en un modal (E5) y
//   un enlace a `#borrar` sería un enlace muerto — el usuario hace clic y no pasa nada.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { Eye, Trash2 } from 'lucide-react'

import { TarjetaBorradoDatos } from '@/components/sistema/configuracion/TarjetaBorradoDatos'
import { TarjetaDescripciones } from '@/components/sistema/configuracion/TarjetaDescripciones'
import { FichaAcceso } from '@/components/ui/FichaAcceso'
import { usePageConfig } from '@/hooks/usePageConfig'
import { cn } from '@/lib/utils'

const RUTA = '/dashboard/sistema/configuracion'

interface ConfiguracionPanelProps {
    /** ⭐ Lo calcula el SERVIDOR (`permiteBorradoBd()`); acá solo se obedece. */
    permiteBorrado: boolean
}

export function ConfiguracionPanel({ permiteBorrado }: ConfiguracionPanelProps) {
    const [borradoAbierto, setBorradoAbierto] = useState(false)

    usePageConfig({
        info: { title: 'Configuración', subtitle: 'Sistema' },
        path: RUTA,
    })

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Sistema
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                    Preferencias de pantalla y mantenimiento del sistema.
                </span>
            </div>

            {/* 1 · El índice: qué se puede hacer en esta instalación. */}
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                <FichaAcceso
                    href="#descripciones"
                    numero="01"
                    icono={Eye}
                    titulo="Descripciones en pantalla"
                    eyebrow="Preferencia · tu usuario"
                    acento="sistema"
                />
                {permiteBorrado ? (
                    <button
                        type="button"
                        onClick={() => setBorradoAbierto(true)}
                        className={cn(
                            'group relative flex min-h-[150px] flex-col gap-3.5 overflow-hidden rounded-lg border border-border bg-surface-2 p-[18px] text-left',
                            'touch-manipulation transition-all',
                            'hover:-translate-y-0.5 hover:border-destructive hover:bg-destructive',
                            'active:translate-y-0 active:scale-[0.99]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-3.5 top-0.5 font-mono text-[68px] font-bold leading-none text-destructive/15 transition-colors group-hover:text-primary-fg/25"
                        >
                            02
                        </span>
                        <span className="relative grid size-10 shrink-0 place-items-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive transition-colors group-hover:border-primary-fg/30 group-hover:bg-primary-fg/20 group-hover:text-primary-fg">
                            <Trash2 className="size-5" aria-hidden="true" />
                        </span>
                        <span className="relative mt-auto min-w-0">
                            <span className="block truncate font-display text-[13.5px] font-semibold tracking-wide text-foreground transition-colors group-hover:text-primary-fg">
                                Borrar datos de la BD
                            </span>
                            <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-primary-fg/85">
                                Mantenimiento · solo el dueño
                            </span>
                        </span>
                    </button>
                ) : null}
            </div>

            {/* 2 · El contenido. */}
            <TarjetaDescripciones />

            {/* El modal se monta SIEMPRE (cierra por `open`): desmontarlo a mitad de la
                animación es el defecto que el kit documenta como «overlay colgado». */}
            {permiteBorrado ? (
                <TarjetaBorradoDatos open={borradoAbierto} onOpenChange={setBorradoAbierto} />
            ) : null}
        </div>
    )
}
