'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADO BADGE — Guía 0.6 · Dumb Component
//
// Insignia de submodulos.estado_desarrollo. Es lo que convierte al menú en el
// mapa de avance del proyecto: el usuario ve qué existe y qué viene, en vez de
// hacer clic en promesas rotas.
//
// `disponible` NO dibuja nada a propósito: es el estado normal y un badge en
// 12 de 29 rutas sería ruido que le quitaría fuerza a las excepciones.
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'
import type { EstadoDesarrollo } from '@/types/auth'

/** Etiqueta única por estado. Compartida con PlaceholderModule para que el
 *  Sidebar y la página nunca digan cosas distintas de la misma ruta. */
export const ESTADO_TEXTO: Record<EstadoDesarrollo, string> = {
    disponible: 'Disponible',
    en_construccion: 'En construcción',
    planeado: 'Planeado · V2',
}

/** Versión corta para el Sidebar, donde el ancho es escaso. */
const ESTADO_TEXTO_CORTO: Record<EstadoDesarrollo, string> = {
    disponible: '',
    en_construccion: 'Pronto',
    planeado: 'V2',
}

/** Color del punto, por estado. Mismos tokens que la píldora: el punto no es
 *  otro lenguaje, es la misma señal sin la caja. */
const ESTADO_PUNTO: Record<EstadoDesarrollo, string> = {
    disponible: '',
    en_construccion: 'bg-warning',
    planeado: 'bg-info',
}

interface EstadoBadgeProps {
    estado: EstadoDesarrollo
    /** 'punto' para el Sidebar · 'corta' para listas · 'larga' para el encabezado de la página */
    variante?: 'punto' | 'corta' | 'larga'
    className?: string
}

export function EstadoBadge({ estado, variante = 'corta', className }: EstadoBadgeProps) {
    // El estado normal no se señala. Solo la excepción.
    if (estado === 'disponible') return null

    // En el Sidebar el ancho es el recurso escaso: con 29 rutas, una píldora de
    // texto empuja la etiqueta del submódulo al truncado. El punto ocupa 6px y
    // dice lo mismo; el texto sigue disponible por title y para lectores de
    // pantalla, que es donde importa que no se pierda.
    if (variante === 'punto') {
        return (
            <span
                title={ESTADO_TEXTO[estado]}
                aria-label={ESTADO_TEXTO[estado]}
                role="img"
                className={cn('size-1.5 shrink-0 rounded-full', ESTADO_PUNTO[estado], className)}
            />
        )
    }

    const texto = variante === 'corta' ? ESTADO_TEXTO_CORTO[estado] : ESTADO_TEXTO[estado]

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center rounded-full font-medium',
                'border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                variante === 'larga' && 'px-2.5 py-1 text-xs',
                // Tokens semánticos: warning = pendiente · info = dato neutro.
                // destructive sugeriría un error, y no lo hay.
                estado === 'en_construccion' &&
                    'border-warning/30 bg-warning/10 text-warning',
                estado === 'planeado' &&
                    'border-info/30 bg-info/10 text-info',
                className
            )}
        >
            {texto}
        </span>
    )
}
