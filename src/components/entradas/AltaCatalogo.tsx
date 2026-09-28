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

import { DataTable, Pildora } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { listarBandejas, listarEntradas } from '@/lib/actions/entradas'
import type { BandejaLiberada, Entrada, EstadoEntrada, EstadoTanda } from '@/types/entradas'
import { FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { CotejoAltaModal } from '@/components/entradas/alta/CotejoAltaModal'
import { diasEnCola, textoAntiguedad, urgenciaDeCola } from '@/components/entradas/columnas-entrada'
import {
    BandejasDeIngreso,
    agruparPorIngreso,
    totalesDeIngreso,
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

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 33 (27 Sep 2026 · usuario) — LA TABLA DEL PADRE, EN LA ANATOMÍA DEL FLUJO.
//
// El usuario: *«la tabla de entradas por cotejar es una versión anterior; me gustaría usar la que
// usamos en la fase de entradas, donde la tabla está bien acomodada, y los detalles muestran la
// tabla de detalles bien ordenada. Esta etapa ya es para ingresar a almacén.»*
//
// Antes el padre tenía **3 columnas con todo apilado** (`Ingreso` = folio + micro-línea ·
// `En el puesto` = una píldora · `Acción`). Ese apilado ya se había **revertido en Recepción**
// (24 Sep: *«todo junto folio/fecha/botón se ve muy mal… se ve mucho más amontonado»*).
// Ahora: **una columna por dato**, como `RecepcionCatalogo`, con la vara de ESTA etapa (L6):
//   · `Productos`     = las BANDEJAS del puesto (huellas a resolver) — no las partidas declaradas.
//   · `POR COTEJAR`   = piezas que faltan por ingresar al stock.
//   · `SKU`           = cuántos productos esperan SKU: es lo que separa «recibí» de «ingresé».
// La densidad es de **ESCRITORIO** (sin `modoTactil`): el puesto de dedo es Revisión.
// ═══════════════════════════════════════════════════════════════════════════════

/** Cuántos productos del ingreso esperan SKU (grupos sin `id_producto`). */
function skusPorResolver(bandejas: BandejaLiberada[]): number {
    return new Set(bandejas.filter((b) => !b.id_producto).map((b) => b.id_partida_resuelta)).size
}

/** Antigüedad del ingreso en el puesto: la de su tanda más vieja (la que manda el tono, L1). */
function diasDeIngreso(bandejas: BandejaLiberada[]): number {
    if (bandejas.length === 0) return 0
    const masVieja = bandejas.reduce((a, b) =>
        a.fecha_primera_liberacion <= b.fecha_primera_liberacion ? a : b
    )
    return diasEnCola(masVieja.fecha_primera_liberacion)
}

/** Identidad del ingreso: SOLO el folio (la celda de identidad no apila metadatos). */
const columnaFolioCotejo: ColumnaIngreso = {
    accessorKey: 'folio',
    label: 'Folio',
    movil: 'critica',
    size: 150,
    render: (valor) => (
        <span className="font-mono text-[15px] tabular-nums">{String(valor ?? '')}</span>
    ),
}

const columnaProveedorCotejo: ColumnaIngreso = {
    accessorKey: 'proveedor_nombre',
    label: 'Proveedor',
    movil: 'secundaria',
    render: (_v, i) => <span className="block truncate">{i.proveedor_nombre ?? '—'}</span>,
}

/** Las bandejas del puesto: la vara de la etapa (L6), no el conteo de partidas declaradas. */
const columnaProductosCotejo: ColumnaIngreso = {
    id: 'productos',
    accessorFn: (i) => i.bandejas.length,
    label: 'Productos',
    align: 'derecha',
    movil: 'secundaria',
    size: 104,
    render: (_v, i) => <span className="tabular-nums">{i.bandejas.length}</span>,
}

/** Lo que falta por ingresar al stock. */
const columnaPorCotejarCotejo: ColumnaIngreso = {
    id: 'por_cotejar',
    accessorFn: (i) => totalesDeIngreso(i.bandejas).piezas,
    label: 'POR COTEJAR',
    align: 'derecha',
    movil: 'critica',
    size: 130,
    render: (_v, i) => {
        const piezas = totalesDeIngreso(i.bandejas).piezas
        if (piezas === 0) return <span className="text-muted-foreground">—</span>
        return <span className="text-[16px] font-bold tabular-nums">{piezas}</span>
    },
}

/** Los SKU que hay que resolver para poder dar el alta. */
const columnaSkuCotejo: ColumnaIngreso = {
    id: 'sku',
    accessorFn: (i) => skusPorResolver(i.bandejas),
    label: 'SKU',
    align: 'derecha',
    movil: 'critica',
    size: 140,
    render: (_v, i) => {
        if (i.bandejas.length === 0) return <span className="text-muted-foreground">—</span>
        const n = skusPorResolver(i.bandejas)
        if (n === 0) return <Pildora texto="Resueltos" tono="listo" />
        return (
            <span className="text-[14px] font-semibold tabular-nums text-warning">
                {n} por resolver
            </span>
        )
    },
}

/** El estado en el idioma de la ETAPA (L1): «Por cotejar», con la antigüedad mandando el tono. */
const columnaEstadoCotejo: ColumnaIngreso = {
    id: 'estado',
    accessorFn: (i) => (i.bandejas.length > 0 ? 'cotejar' : 'cerrar'),
    label: 'Estado',
    align: 'centro',
    movil: 'critica',
    size: 200,
    render: (_v, i) => {
        if (i.bandejas.length === 0) {
            return <Pildora texto="Listo para cerrar" tono="info" />
        }
        const dias = diasDeIngreso(i.bandejas)
        const { tono, pulsa } = urgenciaDeCola(dias)
        return (
            <Pildora
                texto={`Por cotejar · ${textoAntiguedad(dias)}`}
                tono={tono}
                className={pulsa ? 'animate-pulse' : undefined}
            />
        )
    },
}

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

    // ── Padre: la puerta del ingreso. Con mercancía en el puesto abre su cotejo; sin bandejas,
    //    coteja el SALDO del documento (lo que no salió por tandas, R27). Densidad de escritorio:
    //    el botón del kit (`size="sm"` = h-8), no el de 52px del puesto de dedo. ─────────────────
    const columnaAccionCotejo = useMemo<ColumnaIngreso>(
        () => ({
            id: 'accion',
            label: 'Acción',
            align: 'centro',
            movil: 'critica',
            size: 200,
            render: (_v, i) => {
                if (!puedeAprobar) return null
                if (i.bandejas.length > 0) {
                    // La más antigua primero (el orden de la cola lo manda su antigüedad, L1).
                    const primera = i.bandejas.reduce((a, b) =>
                        a.fecha_primera_liberacion <= b.fecha_primera_liberacion ? a : b
                    )
                    return (
                        <Button
                            type="button"
                            size="sm"
                            title="Abre el cotejo de la tanda que más espera; las demás están al desplegar el ingreso."
                            onClick={() => setBandejaSel(primera)}
                        >
                            Cotejar
                        </Button>
                    )
                }
                const e = i.entrada
                if (!e || e.estado !== 'en_almacen') return null
                return (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSeleccion(e)}
                    >
                        Cotejar el saldo
                    </Button>
                )
            },
        }),
        [puedeAprobar]
    )

    const columnasIngreso = useMemo<ColumnaIngreso[]>(
        () => [
            columnaFolioCotejo,
            columnaProveedorCotejo,
            columnaProductosCotejo,
            columnaPorCotejarCotejo,
            columnaSkuCotejo,
            columnaEstadoCotejo,
            columnaAccionCotejo,
        ],
        [columnaAccionCotejo]
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
                // ⭐ MEJORA 27 Sep 2026 — un detalle a la vez: el patrón de detalles del módulo es
                // uno solo (MEJORA 34/35 en las otras colas).
                unaFilaExpandida
                onRetry={() => {
                    void recargar()
                }}
                pageSize={Math.max(ingresos.length, 10)}
                page={1}
                totalPages={1}
                renderFilaExpandida={(i) => (
                    <BandejasDeIngreso
                        bandejas={i.bandejas}
                        accion={accionDeBandeja}
                        densidad="kit"
                        sku
                        agruparPorPartida
                    />
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
