'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRADAS DASHBOARD — aterrizaje del módulo (Guía 1.6 · remasterizado · Smart)
//                        Guía 2.4 (05 Oct 2026): consume la ficha del KIT.
//
// La lista de etapas sale del menu[] (ya recortado por permisos_navegacion);
// el ORDEN, el NOMBRE, el ROL y la DESCRIPCIÓN son estáticos (el flujo es fijo).
//
// ⭐ GUÍA 2.4 — LA FICHA SE FUE AL KIT. Este archivo tenía la tarjeta copiada inline
//   (número fantasma, hover sólido, densidades duales). Ahora usa `<FichaAcceso>` con
//   `acento="entradas"`: misma piel, un solo lugar que la mantiene. Es la PRIMERA de
//   las dos copias que la promoción retira.
// ═══════════════════════════════════════════════════════════════════════════════

import { Fragment } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { FichaAcceso } from '@/components/ui/FichaAcceso'
import { getIcon } from '@/config/icon-map'
import { usePageConfig } from '@/hooks/usePageConfig'
import { menuAplanado, useAuth } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'

const RUTA = '/dashboard/entradas'

interface EtapaFlujo {
    href: string
    nombre: string
    orden: number
    rol: string
    desc: string
}

// Flujo fijo del ingreso de mercancía (FLUJO_01). El orden y el rol son contrato.
const ETAPAS_FLUJO: EtapaFlujo[] = [
    { href: '/dashboard/entradas/recepcion', nombre: 'Recepción', orden: 1, rol: 'Recepcionista', desc: 'Registrar la mercancía que llega.' },
    { href: '/dashboard/entradas/revision', nombre: 'Revisión técnica', orden: 2, rol: 'Técnico', desc: 'Revisar pieza por pieza y resolver el SKU.' },
    { href: '/dashboard/entradas/acondicionamiento', nombre: 'Acondicionamiento', orden: 3, rol: 'Acondicionador', desc: 'Dejar lo aprobado listo para el almacén.' },
    { href: '/dashboard/entradas/alta', nombre: 'Alta a inventario', orden: 4, rol: 'Almacenista', desc: 'Cotejar lo físico y dar ingreso al inventario.' },
    { href: '/dashboard/entradas/divergencias', nombre: 'Divergencias', orden: 5, rol: 'Administrador', desc: 'Resolver lo que no cuadró en el cotejo.' },
]

const ETAPA_POR_HREF: Record<string, EtapaFlujo> = Object.fromEntries(
    ETAPAS_FLUJO.map((e) => [e.href, e])
)

/** El número fantasma, ya formateado (la ficha no impone formato). */
function numero(orden: number): string {
    return String(orden).padStart(2, '0')
}

export function EntradasDashboard() {
    const menu = useAuth(menuAplanado)
    const etapas = menu
        .filter((f) => f.href.startsWith('/dashboard/entradas/'))
        .sort((a, b) => a.orden_submodulo - b.orden_submodulo)

    const accesibles = new Set(etapas.map((e) => e.href))

    usePageConfig({ info: { title: 'Entradas', subtitle: 'Panel de ingreso de mercancía' }, path: RUTA })

    if (etapas.length === 0) {
        return (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface p-6">
                <p className="text-sm text-muted-foreground">Tu rol no tiene etapas de Entradas asignadas.</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* ── Strip del flujo ─────────────────────────────────────────── */}
            {/* Alturas duales: 44px táctil en móvil, 32px de escritorio (§11). */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5">
                <span className="mr-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Flujo
                </span>
                {ETAPAS_FLUJO.map((etapa, i) => {
                    const accesible = accesibles.has(etapa.href)
                    const chip = (
                        <>
                            <span className="font-mono text-[10px]">{numero(etapa.orden)}</span>
                            {etapa.nombre}
                        </>
                    )
                    return (
                        <Fragment key={etapa.href}>
                            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-border" aria-hidden="true" />}
                            {accesible ? (
                                <Link
                                    href={etapa.href}
                                    className={cn(
                                        // `rounded-md`: los chips de etapa son CONTROLES (navegan), no píldoras de estado.
                                        'inline-flex h-11 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-[12px] font-semibold text-acc-entradas transition-colors md:h-8',
                                        'hover:bg-hover-background',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc-entradas'
                                    )}
                                >
                                    <span aria-hidden="true" className="size-1.5 rounded-full bg-acc-entradas" />
                                    {chip}
                                </Link>
                            ) : (
                                <span className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-[12px] font-semibold text-muted-foreground/60 md:h-8">
                                    {chip}
                                </span>
                            )}
                        </Fragment>
                    )
                })}
            </div>

            {/* ── Fichas de etapa (pieza del KIT) ─────────────────────────── */}
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {etapas.map((e) => {
                    const etapa = ETAPA_POR_HREF[e.href]
                    return (
                        <FichaAcceso
                            key={e.href}
                            href={e.href}
                            numero={numero(etapa.orden)}
                            icono={getIcon(e.icono_submodulo)}
                            titulo={e.nombre_submodulo}
                            eyebrow={etapa.rol}
                            acento="entradas"
                        />
                    )
                })}
            </div>
        </div>
    )
}
