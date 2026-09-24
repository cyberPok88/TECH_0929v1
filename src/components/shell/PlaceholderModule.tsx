'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER MODULE — Guía 0.6 · Dumb Component
//
// El contenido de las 28 páginas que aún no tienen módulo.
// Cierra el enchufe #12: sin esto, 28 clics del Sidebar darían 404 y el Shell
// no se podría probar navegando.
//
// Dice EN QUÉ GUÍA se construirá cada módulo: el sistema se levanta frente a
// los usuarios que lo van a operar, y "en construcción" a secas genera una
// pregunta que esta línea responde.
// ═══════════════════════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'

import { EstadoBadge, ESTADO_TEXTO } from '@/components/shell/EstadoBadge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { EstadoDesarrollo } from '@/types/auth'

interface PlaceholderModuleProps {
    titulo: string
    descripcion: string
    icon: LucideIcon
    estado: EstadoDesarrollo
    /** Ej: "Guía 1.1". Se muestra tal cual. */
    guiaDestino: string
}

/** Mensaje por estado. Tres plazos distintos merecen tres mensajes distintos:
 *  igualarlos haría esperar Facturación CFDI con la misma inminencia que Usuarios. */
const MENSAJE: Record<EstadoDesarrollo, string> = {
    disponible:
        'El módulo está aprobado y sus permisos ya están sembrados en la base de datos. La pantalla se construye en',
    en_construccion:
        'Esta pantalla forma parte del alcance y está en la fila de construcción. Llega en',
    planeado:
        'Funcionalidad prevista para la segunda versión del sistema. Se documenta en',
}

export function PlaceholderModule({
    titulo,
    descripcion,
    icon: Icon,
    estado,
    guiaDestino,
}: PlaceholderModuleProps) {
    return (
        <div className="animate-fade-up space-y-6">
            {/* ─── Encabezado de la página ─────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-semibold text-foreground">
                    {titulo}
                </h1>
                <EstadoBadge estado={estado} variante="larga" />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{descripcion}</p>

            {/* ─── Tarjeta de estado ───────────────────────────────────────── */}
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                    <span
                        className={cn(
                            'flex h-14 w-14 items-center justify-center rounded-full',
                            estado === 'planeado' ? 'bg-info-bg text-info' : 'bg-warning-bg text-warning'
                        )}
                    >
                        <Icon className="h-7 w-7" aria-hidden="true" />
                    </span>

                    <div className="space-y-1">
                        <p className="font-medium text-foreground">
                            {ESTADO_TEXTO[estado]}
                        </p>
                        <p className="max-w-md text-sm text-muted-foreground">
                            {MENSAJE[estado]}{' '}
                            <span className="font-medium text-foreground">{guiaDestino}</span>.
                        </p>
                    </div>

                    {/* Prueba viva del Shell: si esta página se ve, el layout, el
                        Sidebar, el título del Topbar y el Toolbar respondieron a
                        la ruta correctamente. */}
                    <p className="mt-2 text-xs text-muted-foreground/70">
                        La navegación, el título y la barra de acciones de esta ruta ya funcionan.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
