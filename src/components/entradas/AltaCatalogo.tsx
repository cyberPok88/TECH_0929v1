'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ALTA CATALOGO — Cola de cotejo del almacenista (Guía 1.6 · P6 · Smart)
//
// ⭐ MEJORA 25 (24 Sep 2026 · decisión 22) — DOS VISTAS, y la de BANDEJAS era la de trabajo:
//   · **Bandejas** — lo que el acondicionador ya entregó (`en_almacen`), resultado de la liberación
//     parcial: los discos urgentes llegan aquí sin que la entrada haya cerrado su revisión.
//   · **Entradas** — el camino clásico, que cotejaba sólo el **saldo no liberado** para no subir
//     stock dos veces.
//
// ⭐ MEJORA 31 (25 Sep 2026 · usuario) — UNA SOLA COLA, AGRUPADA POR INGRESO.
// El usuario: *«lo mismo sería para entradas por cotejar, no?»* — y ya lo había decidido él mismo
// el 24 Sep en el mockup `DOCS/design/entradas/almacen-hub-cotejo-por-tanda.html` §2:
//
//   · **B — Una cola agrupada por entrada (tandas + saldo)** · *«una fila por ingreso y dentro sus
//     tandas. Un solo lugar para el trabajo del puesto, y el ingreso explica sus partes»* →
//     **recomendada**.
//   · **A — Hoy: dos vistas planas (Tandas · Entradas)** → **descartada**: *«la tabla de tandas no
//     dice a qué ingreso pertenece cada una ni cuántas hermanas tiene; el saldo clásico está en otra
//     pestaña y el mismo trabajo se hace en dos lugares (L6)»*.
//
// El ingreso es el PADRE y sus tandas las HIJAS; el **saldo clásico** deja de ser una vista y pasa a
// ser un ingreso **sin tandas**, con su acción de cotejo en la propia fila. Es exactamente la
// decisión D2 del mockup, que quedaba abierta: **la cola agrupada reemplaza las dos vistas**.
//
// ⚠️ Lo que se pierde, y estaba declarado en el mockup: la lectura «lista plana de pendientes» y,
// con ella, la columna de NOTA de compra que vivía en la vista «Entradas» (el almacenista la
// consulta desde Compras). Si vuelve a hacer falta, es una línea en la fila padre, no una vista.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageOpen } from 'lucide-react'

import { DataTable } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { listarBandejas, listarEntradas } from '@/lib/actions/entradas'
import type { BandejaLiberada, Entrada, EstadoEntrada, EstadoTanda } from '@/types/entradas'
import { FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { CotejoAltaModal } from '@/components/entradas/alta/CotejoAltaModal'
import {
    BandejasDeIngreso,
    agruparPorIngreso,
    columnaIngresoIdentidad,
    columnaIngresoResumen,
    type AccionBandeja,
    type ColumnaIngreso,
    type IngresoEnCola,
} from '@/components/entradas/BandejasDeIngreso'

const RUTA = '/dashboard/entradas/alta'

/**
 * Lo que este puesto ve: `en_almacen` (por cotejar) y `confirmada` (ya dado de alta) — la segunda
 * es lectura, para poder volver sobre lo hecho.
 */
const ESTADOS_BANDEJA: EstadoTanda[] = ['en_almacen', 'confirmada']

/** El DOCUMENTO que espera el cotejo de su **saldo** (`Σ aprobadas − Σ liberadas`, R27). */
const ESTADOS_DOCUMENTO: EstadoEntrada[] = ['en_almacen']

/**
 * Tope de la cola de saldos. El conjunto es chico por construcción (sólo los documentos que ya
 * están en `en_almacen` y todavía no cerraron), pero es la misma deuda declarada que el tope de
 * `listarBandejas`: con cientos de ingresos abiertos el corte escondería los más viejos.
 */
const TAMANO_DOCUMENTOS = 100

export function AltaCatalogo() {
    const [bandejas, setBandejas] = useState<BandejaLiberada[]>([])
    const [documentos, setDocumentos] = useState<Entrada[]>([])
    const [estadoBandejas, setEstadoBandejas] = useState<EstadoTabla>('loading')
    const [estadoDocumentos, setEstadoDocumentos] = useState<EstadoTabla>('loading')
    const [seleccion, setSeleccion] = useState<Entrada | null>(null)
    const [bandejaSel, setBandejaSel] = useState<BandejaLiberada | null>(null)

    const puedeAprobar = useCanAction(RUTA, 'aprobar')

    // Las TANDAS entregadas por acondicionamiento (las hijas).
    useEffect(() => {
        let activo = true
        void (async () => {
            const res = await listarBandejas(ESTADOS_BANDEJA)
            if (!activo) return
            if (!res.success) {
                setEstadoBandejas('error')
                return
            }
            setBandejas(res.data ?? [])
            setEstadoBandejas('idle')
        })()
        return () => {
            activo = false
        }
    }, [])

    // Los DOCUMENTOS cuyo saldo todavía hay que cotejar (el padre sin tandas).
    useEffect(() => {
        let activo = true
        void (async () => {
            const res = await listarEntradas(
                { ...FILTROS_ENTRADAS_DEFAULT, estados: ESTADOS_DOCUMENTO },
                1,
                TAMANO_DOCUMENTOS
            )
            if (!activo) return
            if (!res.success) {
                setEstadoDocumentos('error')
                return
            }
            setDocumentos(res.data ?? [])
            setEstadoDocumentos('idle')
        })()
        return () => {
            activo = false
        }
    }, [])

    const recargar = useCallback(async () => {
        setEstadoBandejas('loading')
        setEstadoDocumentos('loading')
        const [resBandejas, resDocumentos] = await Promise.all([
            listarBandejas(ESTADOS_BANDEJA),
            listarEntradas({ ...FILTROS_ENTRADAS_DEFAULT, estados: ESTADOS_DOCUMENTO }, 1, TAMANO_DOCUMENTOS),
        ])
        if (resBandejas.success) {
            setBandejas(resBandejas.data ?? [])
            setEstadoBandejas('idle')
        } else {
            setEstadoBandejas('error')
        }
        if (resDocumentos.success) {
            setDocumentos(resDocumentos.data ?? [])
            setEstadoDocumentos('idle')
        } else {
            setEstadoDocumentos('error')
        }
    }, [])

    /** El padre: el ingreso, con sus tandas dentro y el saldo cuando todavía queda por cotejar. */
    const ingresos = useMemo(() => agruparPorIngreso(bandejas, documentos), [bandejas, documentos])

    const estado: EstadoTabla =
        estadoBandejas === 'error' || estadoDocumentos === 'error'
            ? 'error'
            : estadoBandejas === 'loading' || estadoDocumentos === 'loading'
              ? 'loading'
              : 'idle'

    // ── Hija: el cotejo de una TANDA (su SKU se resuelve aquí, decisión 22.e / R19). ──────────
    const accionDeBandeja = useCallback(
        (b: BandejaLiberada): AccionBandeja => {
            const hecha = b.estado === 'confirmada'
            return {
                etiqueta: hecha ? 'Ya en almacén' : 'Cotejar y dar alta',
                icono: PackageOpen,
                dominante: !hecha,
                disabled: !puedeAprobar || hecha,
                title: hecha
                    ? 'Esta tanda ya está en almacén.'
                    : puedeAprobar
                      ? undefined
                      : 'No tienes permiso para dar el alta.',
                onClick: () => setBandejaSel(b),
            }
        },
        [puedeAprobar]
    )

    // ── Padre: el cotejo del SALDO del documento (lo que no salió por tandas). ────────────────
    const columnaAccionDocumento = useMemo<ColumnaIngreso>(
        () => ({
            id: 'accion',
            label: 'Acción',
            align: 'centro',
            movil: 'critica',
            size: 240,
            render: (_v, i) => {
                const e = i.entrada
                // `confirmada` ya cerró: el padre sólo informa, no ofrece acción.
                if (!e || e.estado !== 'en_almacen' || !puedeAprobar) return null
                return (
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[52px] w-full"
                        onClick={() => setSeleccion(e)}
                    >
                        <PackageOpen className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Cotejar el saldo
                    </Button>
                )
            },
        }),
        [puedeAprobar]
    )

    const columnasIngreso = useMemo<ColumnaIngreso[]>(
        () => [columnaIngresoIdentidad, columnaIngresoResumen, columnaAccionDocumento],
        [columnaAccionDocumento]
    )

    const filtrosBarra = useMemo(
        () => (
            <span className="text-[12.5px] text-muted-foreground tabular-nums">
                {ingresos.length} {ingresos.length === 1 ? 'ingreso' : 'ingresos'} · {bandejas.length}{' '}
                {bandejas.length === 1 ? 'tanda' : 'tandas'} entregadas por acondicionamiento
            </span>
        ),
        [ingresos.length, bandejas.length]
    )

    usePageConfig({
        info: { title: 'Alta en almacén', subtitle: 'Entradas' },
        path: RUTA,
        filtros: filtrosBarra,
    })

    return (
        <>
            {/* Una fila por INGRESO y dentro sus tandas: un solo lugar para el trabajo del puesto
                (opción B del mockup, L6). Sin paginación de servidor: el volumen es de un puñado. */}
            <DataTable<IngresoEnCola>
                columns={columnasIngreso}
                data={ingresos}
                rowKey={(i) => i.id_entrada}
                estado={estado}
                emptyMessage="No hay nada por cotejar."
                modoTactil
                onRetry={() => {
                    void recargar()
                }}
                pageSize={Math.max(ingresos.length, 10)}
                page={1}
                totalPages={1}
                renderFilaExpandida={(i) => (
                    <BandejasDeIngreso bandejas={i.bandejas} accion={accionDeBandeja} />
                )}
            />

            {/* Alta de una BANDEJA (decisión 22.g) — agrupa las tandas del mismo producto */}
            <CotejoAltaModal
                key={bandejaSel?.clave ?? 'ninguna-bandeja'}
                open={bandejaSel !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setBandejaSel(null)
                }}
                entrada={null}
                bandeja={bandejaSel}
                onGuardado={() => {
                    void recargar()
                }}
            />
            {/* Alta del SALDO de la ENTRADA (camino clásico) */}
            <CotejoAltaModal
                key={seleccion?.id ?? 'ninguna'}
                open={seleccion !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setSeleccion(null)
                }}
                entrada={seleccion}
                onGuardado={() => {
                    void recargar()
                }}
            />
        </>
    )
}
