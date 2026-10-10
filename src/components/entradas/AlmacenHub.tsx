'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ALMACÉN HUB — aterrizaje del PUESTO de Almacén (Guía 1.6 · Fase 4)
//                Guía 2.4 (05 Oct 2026): consume la ficha del KIT.
//
// El usuario (24 Sep 2026): *«cuando hablamos de un propio HUB es tipo una página con fichas
// así que abran lo que es: las entradas que se deben cotejar para el flujo de ingreso, link o
// botón al CRUD de productos, y de movimientos al inventario / kardex. Solo eso.»*
//
// Paridad con el HUB de la V5 (`40_Almacen.gs` + `DISENO_ALMACEN_SKU.md §6`): al abrir Almacén
// **no** se carga la consulta más pesada del módulo — se muestran sus destinos y cada uno carga
// solo lo suyo. V5: Ingresos/Recepciones · Productos · Movimientos.
//
// ⭐ GUÍA 2.4 — LA FICHA SE FUE AL KIT. Este archivo tenía la tarjeta copiada inline: era la
//   SEGUNDA copia del patrón (la primera era `EntradasDashboard`). Ahora usa `<FichaAcceso>`
//   con `acento="entradas"`, y con esto la promoción queda CERRADA: el patrón vive en UN
//   archivo de todo `src/`.
// ⭐ El conteo de la cola entra por la RANURA `children` de la ficha: la ficha no sabe de
//   colas, de tonos ni de carga — eso es de este puesto.
// · Los destinos salen del `menu[]` ya recortado por permisos (no se pinta lo que el rol no ve).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { ArrowLeftRight, Package, PackageCheck, ScanLine } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Pildora } from '@/components/data-table'
import { FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { FichaAcceso } from '@/components/ui/FichaAcceso'
import { usePageConfig } from '@/hooks/usePageConfig'
import { listarEntradas, listarTandas } from '@/lib/actions/entradas'
import { useAuth } from '@/lib/stores/auth-store'
import { useContadorEtapa } from '@/lib/stores/avisos-entradas-store'

const RUTA = '/dashboard/entradas/alta'

/** La cola de cotejo vive como ruta hija: el submódulo `alta` la cubre por prefijo. */
export const HREF_COTEJO = '/dashboard/entradas/alta/cotejo'

/** ⭐ MEJORA 29 Sep 2026 — la consulta del concentrado, también ruta hija de `alta`. */
export const HREF_NS = '/dashboard/entradas/alta/ns'

interface FichaAlmacen {
    href: string
    numero: string
    icono: LucideIcon
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
    /**
     * ⭐ MEJORA 29 Sep 2026 (usuario) — **LA 4ª FICHA: CONTROL DE NS.**
     * Es la consulta del concentrado: de dónde vino un serial y qué pasó con él (garantía,
     * devolución, o el proveedor intentando colar la pieza que ya se le devolvió).
     *
     * ⚠️ **Corrige la frase del propio usuario del 24 Sep** —*«solo eso»*, los 3 destinos—: el
     * puesto creció y el HUB lo dice.
     */
    {
        href: HREF_NS,
        numero: '04',
        icono: ScanLine,
        nombre: 'Control de NS',
        rol: 'De dónde vino un serial y qué pasó con él',
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

    // ⭐ MEJORA 53 (09 Oct 2026) — el panel de Almacén cuenta trabajo pendiente (tandas y
    // documentos en `en_almacen`): sin esto, el número que ve el almacenista se queda viejo
    // hasta que alguien recarga. El contador lo publica `AvisosEntradas` (Realtime).
    const avisoAlmacen = useContadorEtapa('almacen')

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
    }, [avisoAlmacen])

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
            {fichas.map((f) => (
                <FichaAcceso
                    key={f.href}
                    href={f.href}
                    numero={f.numero}
                    icono={f.icono}
                    titulo={f.nombre}
                    eyebrow={f.rol}
                    acento="entradas"
                >
                    {f.cuentaCotejo ? (
                        pendientes === null ? (
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
                        )
                    ) : null}
                </FichaAcceso>
            ))}
        </div>
    )
}
