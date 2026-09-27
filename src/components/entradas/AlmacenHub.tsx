'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ALMACÉN HUB — aterrizaje del PUESTO de Almacén (Guía 1.6 · Fase 4)
//
// El usuario (24 Sep 2026): *«cuando hablamos de un propio HUB es tipo una página con fichas
// así que abran lo que es: las entradas que se deben cotejar para el flujo de ingreso, link o
// botón al CRUD de productos, y de movimientos al inventario / kardex. Solo eso.»*
//
// Paridad con el HUB de la V5 (`40_Almacen.gs` + `DISENO_ALMACEN_SKU.md §6`): al abrir Almacén
// **no** se carga la consulta más pesada del módulo — se muestran sus destinos y cada uno carga
// solo lo suyo. V5: Ingresos/Recepciones · Productos · Movimientos.
//
// · Ficha I (patrón de `EntradasDashboard`): número fantasma + icono en cuadro + nombre/rol, con
//   hover sólido en el acento del MÓDULO (`acc-entradas` — un dominio, un acento).
// · La ficha 1 lleva el **conteo** de lo pendiente: todo número accionable es una puerta (L3).
// · Los destinos salen del `menu[]` ya recortado por permisos (no se pinta lo que el rol no ve).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, Package, PackageCheck } from 'lucide-react'

import { Pildora } from '@/components/data-table'
import { FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { usePageConfig } from '@/hooks/usePageConfig'
import { listarEntradas, listarTandas } from '@/lib/actions/entradas'
import { useAuth } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'

const RUTA = '/dashboard/entradas/alta'

/** La cola de cotejo vive como ruta hija: el submódulo `alta` la cubre por prefijo. */
export const HREF_COTEJO = '/dashboard/entradas/alta/cotejo'

interface FichaAlmacen {
    href: string
    numero: string
    icono: typeof Package
    nombre: string
    rol: string
    /** Solo la ficha del cotejo lleva conteo: es la que tiene cola. */
    cuentaCotejo?: boolean
}

const FICHAS: FichaAlmacen[] = [
    {
        href: HREF_COTEJO,
        numero: '01',
        icono: PackageCheck,
        nombre: 'Entradas por cotejar',
        rol: 'Cotejo físico y alta al inventario',
        cuentaCotejo: true,
    },
    {
        href: '/dashboard/catalogos/productos',
        numero: '02',
        icono: Package,
        nombre: 'Productos (SKU)',
        rol: 'Catálogo, existencia y stock mínimo',
    },
    {
        href: '/dashboard/inventario/existencias',
        numero: '03',
        icono: ArrowLeftRight,
        nombre: 'Movimientos al inventario',
        rol: 'Kardex por producto y salidas',
    },
]

interface Pendientes {
    tandas: number
    piezas: number
    entradas: number
}

export function AlmacenHub() {
    const puedeVerPagina = useAuth((s) => s.puedeVerPagina)
    const [pendientes, setPendientes] = useState<Pendientes | null>(null)

    usePageConfig({
        info: { title: 'Almacén', subtitle: 'Panel del puesto · Alta a inventario' },
        path: RUTA,
    })

    useEffect(() => {
        let activo = true
        void (async () => {
            const [tandas, entradas] = await Promise.all([
                listarTandas(['en_almacen']),
                // El saldo clásico (la entrada que llegó completa) también se coteja aquí.
                listarEntradas({ ...FILTROS_ENTRADAS_DEFAULT, estados: ['en_almacen'] }, 1, 1),
            ])
            if (!activo) return
            const lista = tandas.success ? (tandas.data ?? []) : []
            setPendientes({
                tandas: lista.length,
                piezas: lista.reduce((s, t) => s + t.piezas, 0),
                entradas: entradas.success ? (entradas.total ?? 0) : 0,
            })
        })()
        return () => {
            activo = false
        }
    }, [])

    const fichas = FICHAS.filter((f) => puedeVerPagina(f.href))

    if (fichas.length === 0) {
        return (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface p-6">
                <p className="text-sm text-muted-foreground">Tu rol no tiene destinos de Almacén asignados.</p>
            </div>
        )
    }

    return (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {fichas.map((f) => {
                const Icon = f.icono
                return (
                    <Link
                        key={f.href}
                        href={f.href}
                        className={cn(
                            'group relative flex min-h-[150px] flex-col gap-3.5 overflow-hidden rounded-lg border border-border bg-surface-2 p-[18px]',
                            'touch-manipulation transition-all',
                            'hover:-translate-y-0.5 hover:border-acc-entradas hover:bg-acc-entradas hover:shadow-premium-md',
                            'active:translate-y-0 active:scale-[0.99]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc-entradas focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                        )}
                    >
                        {/* Número fantasma — decorativo (el nombre lo lee el lector en el <h2>). */}
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-3.5 top-0.5 font-mono text-[68px] font-bold leading-none text-acc-entradas/15 transition-colors group-hover:text-primary-fg/25"
                        >
                            {f.numero}
                        </span>

                        <span className="relative grid size-10 shrink-0 place-items-center rounded-md border border-acc-entradas/30 bg-acc-entradas/10 text-acc-entradas transition-colors group-hover:border-primary-fg/30 group-hover:bg-primary-fg/20 group-hover:text-primary-fg">
                            <Icon className="size-5" aria-hidden="true" />
                        </span>

                        <div className="relative mt-auto min-w-0">
                            <h2 className="truncate font-display text-[13.5px] font-semibold tracking-wide text-foreground transition-colors group-hover:text-primary-fg">
                                {f.nombre}
                            </h2>
                            <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-primary-fg/85">
                                {f.rol}
                            </span>
                            {f.cuentaCotejo && (
                                <span className="mt-2.5 block">
                                    {pendientes === null ? (
                                        <Pildora texto="Leyendo la cola…" tono="neutro" />
                                    ) : pendientes.tandas + pendientes.entradas === 0 ? (
                                        <Pildora texto="Nada por cotejar" tono="listo" />
                                    ) : (
                                        <Pildora
                                            texto={`${pendientes.tandas} ${pendientes.tandas === 1 ? 'tanda' : 'tandas'} · ${pendientes.piezas} pza${
                                                pendientes.entradas > 0 ? ` + ${pendientes.entradas} entrada(s)` : ''
                                            }`}
                                            tono="advertencia"
                                        />
                                    )}
                                </span>
                            )}
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
