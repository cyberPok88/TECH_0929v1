'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// BANDEJAS DE INGRESO — la cola AGRUPADA POR INGRESO (Guía 1.6 · Fases 3 y 4)
//
// ⭐ MEJORA 31 (25 Sep 2026 · usuario) — la fila PADRE es el ingreso; las bandejas son sus hijas.
//
// El usuario, mirando la cola de Acondicionamiento:
//   *«me gustaría ordenar cómo se muestra la tabla… se puede agrupar por folio de entrada, algo
//    así como las otras vistas del flujo? El ítem padre (1 fila) es la entrada: 0001 · datos · y
//    dentro -t1 -t2 … para que se puedan colapsar y ocultar. Lo mismo sería para entradas por
//    cotejar, no?»*
//
// **No es diseño nuevo: es el patrón que el flujo ya usa.** En Recepción y Revisión la fila padre
// es la entrada y se despliega su contenido (`renderFilaExpandida` → `PartidasExpandidas` /
// `PartidasRevision`), y el mecanismo es del **kit 0.8** — la «fila expandible» fue una PROMOCIÓN
// del 20 Sep que salió de este mismo módulo. Para Almacén ya estaba decidido en el mockup
// `DOCS/design/entradas/almacen-hub-cotejo-por-tanda.html` §2 (opción **B = recomendada**;
// «hoy: dos vistas planas» = **descartada** por L6: dos lugares diciendo lo mismo es peor que uno).
//
// ⚠️ QUÉ ES UNA FILA HIJA (decisión del usuario + decisión 22.g ya medida): el **grupo
// (partida + huella) + estado**, que ACUMULA sus tandas — **no** cada liberación. Si fuera por
// liberación, el mismo producto en el mismo momento del trabajo saldría repetido: medido en
// `ING-0001`, sus dos tandas del mismo ADATA se veían en 2 filas y quedaron en 1.
//
// ⚠️ LA DERIVACIÓN YA ESTÁ EN LA FILA (`origenDeBandeja`): «PARTIDA 1 · 6 PIEZAS · 2 TANDAS» es la
// sub-línea del producto, así que el padre no necesita explicarla dos veces.
//
// ⚠️ El padre NO pinta el estado del DOCUMENTO a propósito. Pintarlo obligaba a cargar TODAS las
// entradas para enriquecer cada fila, y con tope de filas eso deja fuera a la más vieja — que es
// justo la que puede quedar varada sin poder cerrarse. Las consultas de la cola van **acotadas por
// estado** (las que de verdad esperan algo en este puesto), así que el conjunto es chico y el tope
// no puede esconder trabajo. La anatomía del padre es la del mockup de Almacén §2:
// **Ingreso (folio + de qué está hecho) · En el puesto (tandas y piezas) · Acción del documento**.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { BotonDespliegue, CLASE_THEAD_TABLA, Pildora } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { foliosDeBandeja, origenDeBandeja, productoDeBandeja } from '@/components/entradas/columnas-entrada'
import { cn } from '@/lib/utils'
import type { ColumnDefExtension } from '@/types/table'
import type { BandejaLiberada, Entrada } from '@/types/entradas'
import { TEXTO_ESTADO_TANDA, TONO_ESTADO_TANDA } from '@/types/entradas'

/** Mismo encabezado de la sub-tabla que el desglose de Recepción (`PartidasExpandidas`). */
const TH = 'px-2.5 py-1.5 font-medium'

/**
 * Una fila PADRE de la cola: **el ingreso**.
 *
 * `bandejas` son sus hijas (vacío = no liberó tandas) y `entrada` es el DOCUMENTO, que sólo viaja
 * cuando el ingreso entra a la cola por su propio estado (cierre del acondicionamiento / saldo por
 * cotejar). Un ingreso puede estar en la cola por las dos vías a la vez — y ahí está el valor:
 * **un solo lugar para el trabajo del puesto** (L6).
 */
export interface IngresoEnCola {
    id_entrada: string
    folio: string
    proveedor_nombre: string | null
    entrada: Entrada | null
    bandejas: BandejaLiberada[]
}

export type ColumnaIngreso = ColumnDef<IngresoEnCola> & ColumnDefExtension<IngresoEnCola>

/** Totales del ingreso, derivados de sus bandejas (el padre no necesita otra consulta). */
export interface TotalesIngreso {
    tandas: number
    piezas: number
    /** Huellas derivadas = grupos distintos (partida + huella). */
    huellas: number
    /** Partidas DECLARADAS que alimentan este ingreso (por eso el «1 partida declarada»). */
    partidas: number
}

export function totalesDeIngreso(bandejas: BandejaLiberada[]): TotalesIngreso {
    const tandas = new Set<number>()
    const huellas = new Set<string>()
    const partidas = new Set<number>()
    let piezas = 0
    for (const b of bandejas) {
        for (const t of b.tandas) tandas.add(t)
        huellas.add(b.id_partida_resuelta)
        if (b.partida_numero !== null) partidas.add(b.partida_numero)
        piezas += b.piezas
    }
    return { tandas: tandas.size, piezas, huellas: huellas.size, partidas: partidas.size }
}

/**
 * Agrupa las bandejas por INGRESO y les cuelga el documento cuando lo hay.
 *
 * El orden es el que devuelve `listarBandejas` (los ingresos con mercancía en el puesto van
 * primero, en el orden en que la soltó la Revisión) y al final los ingresos que entran **sólo** por
 * su estado — sin tandas que trabajar, con el documento pendiente de cerrar.
 */
export function agruparPorIngreso(
    bandejas: BandejaLiberada[],
    entradas: Entrada[] = []
): IngresoEnCola[] {
    const porIngreso = new Map<string, IngresoEnCola>()

    for (const b of bandejas) {
        const actual = porIngreso.get(b.id_entrada)
        if (actual) {
            actual.bandejas.push(b)
            continue
        }
        porIngreso.set(b.id_entrada, {
            id_entrada: b.id_entrada,
            folio: b.entrada_folio,
            proveedor_nombre: b.proveedor_nombre,
            entrada: null,
            bandejas: [b],
        })
    }

    for (const e of entradas) {
        const actual = porIngreso.get(e.id)
        if (actual) {
            actual.entrada = e
            continue
        }
        porIngreso.set(e.id, {
            id_entrada: e.id,
            folio: e.folio,
            proveedor_nombre: e.proveedor_nombre,
            entrada: e,
            bandejas: [],
        })
    }

    return [...porIngreso.values()]
}

/** Identidad del ingreso: el folio y de qué está hecho. */
export const columnaIngresoIdentidad: ColumnaIngreso = {
    accessorKey: 'folio',
    label: 'Ingreso',
    movil: 'critica',
    size: 340,
    render: (_v, i) => {
        const t = totalesDeIngreso(i.bandejas)
        const micro =
            i.bandejas.length === 0
                ? [i.proveedor_nombre ?? '—', 'Sin tandas liberadas'].join(' · ')
                : [
                      i.proveedor_nombre ?? '—',
                      `${t.partidas} ${t.partidas === 1 ? 'partida declarada' : 'partidas declaradas'}`,
                      `${t.huellas} ${t.huellas === 1 ? 'huella derivada' : 'huellas derivadas'}`,
                  ].join(' · ')
        return (
            <span className="grid gap-0.5">
                <span className="font-mono text-[15px] tabular-nums">
                    <b>{i.folio}</b>
                </span>
                <span className="text-[11.5px] text-muted-foreground">{micro}</span>
            </span>
        )
    },
}

/** Cuánto mercancía trae dentro el ingreso. */
export const columnaIngresoResumen: ColumnaIngreso = {
    id: 'resumen',
    accessorFn: (i) => totalesDeIngreso(i.bandejas).piezas,
    label: 'En el puesto',
    align: 'centro',
    movil: 'critica',
    size: 190,
    render: (_v, i) => {
        const t = totalesDeIngreso(i.bandejas)
        if (t.tandas === 0) return <Pildora texto="Sin tandas" tono="neutro" />
        return (
            <Pildora
                texto={`${t.tandas} ${t.tandas === 1 ? 'TANDA' : 'TANDAS'} · ${t.piezas} PZA`}
                tono="info"
            />
        )
    },
}

/** La acción de una fila hija. El puesto decide qué dice y qué abre. */
export interface AccionBandeja {
    etiqueta: string
    icono: LucideIcon
    onClick: () => void
    disabled?: boolean
    title?: string
    /** `true` = dominante (hay trabajo aquí); `false` = contorno (sólo lectura). */
    dominante?: boolean
}

interface BandejasDeIngresoProps {
    bandejas: BandejaLiberada[]
    accion: (b: BandejaLiberada) => AccionBandeja
    /**
     * ⭐ MEJORA 32 — barra de acciones **masivas del ingreso** («Limpiar todas» · «Terminar y
     * entregar todo»), como la de la fase 2 en el desglose de la entrada. Es un **slot**: la pieza
     * compartida no sabe de reglas de negocio ni de permisos — el puesto decide qué botones pone.
     */
    accionesMasivas?: ReactNode
    /**
     * ⭐ MEJORA 33 (27 Sep 2026) — **densidad por PUESTO** (L8): `puesto` = la acción de la fila a
     * 52px (puesto de dedo, comportamiento de siempre) · `kit` = el botón del kit `h-8` (escritorio,
     * el mismo de `PartidasExpandidas`). La decide quien hospeda, no la pieza.
     */
    densidad?: 'puesto' | 'kit'
    /**
     * ⭐ MEJORA 33 — agrega la columna **«SKU que la recibe»** (se resuelve en Almacén, decisión 17).
     * Es el dato que separa «recibí mercancía» de «ingresé a inventario».
     */
    sku?: boolean
    /**
     * ⭐ MEJORA 33 — pinta una **fila de PARTIDA** sobre sus productos: hace visible que N huellas
     * (→ N SKU) salieron de **una** partida declarada (la derivación, L4 · decisión 22.j).
     */
    agruparPorPartida?: boolean
}

/** Una fila de la sub-tabla: la de PARTIDA (resumen) o la de un producto (bandeja). */
interface FilaDesglose {
    tipo: 'partida' | 'producto'
    /** Sólo en la fila de partida: el número de partida declarada. */
    partida: number | null
    /** Sólo en las filas de producto. */
    bandeja?: BandejaLiberada
    /** Σ de piezas de la fila (en la de partida, la de sus productos). */
    piezas: number
    /** Grupos de la fila que todavía no tienen SKU. */
    sinSku: number
    /** Cuántos productos derivados cuelgan de la partida (sólo en su fila). */
    productos: number
    /** Categoría declarada, que sí viaja en la bandeja (`categoria_nombre`). */
    categoria: string | null
}

/** Arma las filas del desglose: opcionalmente agrupadas por PARTIDA declarada. */
function filasDeDesglose(bandejas: BandejaLiberada[], agruparPorPartida: boolean): FilaDesglose[] {
    const aProducto = (b: BandejaLiberada): FilaDesglose => ({
        tipo: 'producto',
        partida: b.partida_numero,
        bandeja: b,
        piezas: b.piezas,
        sinSku: b.id_producto ? 0 : 1,
        productos: 1,
        categoria: b.categoria_nombre,
    })

    if (!agruparPorPartida) return bandejas.map(aProducto)

    const porPartida = new Map<string, BandejaLiberada[]>()
    for (const b of bandejas) {
        const k = String(b.partida_numero ?? '—')
        porPartida.set(k, [...(porPartida.get(k) ?? []), b])
    }

    const filas: FilaDesglose[] = []
    for (const lista of porPartida.values()) {
        filas.push({
            tipo: 'partida',
            partida: lista[0].partida_numero,
            piezas: lista.reduce((s, b) => s + b.piezas, 0),
            sinSku: lista.filter((b) => !b.id_producto).length,
            productos: lista.length,
            categoria: lista[0].categoria_nombre,
        })
        for (const b of lista) filas.push(aProducto(b))
    }
    return filas
}

/**
 * La sub-tabla que se despliega dentro de la fila padre: **una línea por grupo (partida + huella)
 * + estado**, con su acción de 52px (puesto de dedo: el ⋯ obliga a apuntar a 24px y elegir a
 * ciegas, L11).
 */
export function BandejasDeIngreso({
    bandejas,
    accion,
    accionesMasivas,
    densidad = 'puesto',
    sku = false,
    agruparPorPartida = false,
}: BandejasDeIngresoProps) {
    // ⭐ MEJORA 33 — el MISMO gesto de la Fase 1 en el SEGUNDO nivel: la fila de PARTIDA se pliega
    // (`BotonDespliegue` `sm`, kit 0.8) y esconde sus subpartidas. El estado vive aquí porque la
    // tabla es tonta; el `useState` va ANTES del return temprano (reglas de hooks).
    const [plegadas, setPlegadas] = useState<Record<string, boolean>>({})
    const alternarPartida = (clave: string) =>
        setPlegadas((prev) => ({ ...prev, [clave]: !prev[clave] }))

    if (bandejas.length === 0) {
        return (
            <p className="text-[13px] text-muted-foreground">
                Este ingreso no tiene tandas liberadas todavía: lo que le falta a esta etapa es
                cerrar el documento.
            </p>
        )
    }

    const filas = filasDeDesglose(bandejas, agruparPorPartida)
    const esKit = densidad === 'kit'

    return (
        <div className="flex flex-col gap-3">
            {accionesMasivas}
            <div className="overflow-hidden rounded-md border border-border bg-surface-raised">
                <table className="w-full text-[14.5px]">
                <thead className={CLASE_THEAD_TABLA}>
                    <tr>
                        <th className={cn(TH, 'w-28 text-left')}>Tanda</th>
                        <th className={cn(TH, 'text-left')}>Producto</th>
                        {sku && <th className={cn(TH, 'w-44 text-left')}>SKU que la recibe</th>}
                        <th className={cn(TH, 'w-20')}>Piezas</th>
                        <th className={cn(TH, 'w-40')}>Estado</th>
                        <th className={cn(TH, esKit ? 'w-36' : 'w-56')}>
                            <span className="sr-only">Acción</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {filas.map((f, idx) => {
                        // ── Fila de PARTIDA: el resumen de lo que UNA partida declarada rindió (L4) ──
                        if (f.tipo === 'partida') {
                            const clave = String(f.partida ?? 'x')
                            return (
                                <tr
                                    key={`partida-${clave}-${idx}`}
                                    // ⭐ MEJORA 33 — la fila de PARTIDA se distingue por TINTE y por el RIEL
                                    // de acento de su primera celda (el mismo criterio que la Fase 1).
                                    className="border-t-2 border-border bg-hover-background"
                                >
                                    <td className="px-2.5 py-2 text-center shadow-[inset_3px_0_0_var(--acc-entradas)]">
                                        <span className="inline-flex items-center gap-1">
                                            <BotonDespliegue
                                                abierto={!plegadas[clave]}
                                                onAlternar={() => alternarPartida(clave)}
                                                sujeto={`la partida ${f.partida ?? ''}`}
                                                tamano="sm"
                                            />
                                            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.09em] text-acc-entradas">
                                                PARTIDA {f.partida ?? '—'} · {f.productos}{' '}
                                                {f.productos === 1 ? 'producto' : 'productos'}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="px-2.5 py-2 text-muted-foreground">
                                        {f.categoria ?? 'Declarada en recepción'}
                                    </td>
                                    {sku && (
                                        <td className="px-2.5 py-2">
                                            {f.sinSku > 0 ? (
                                                <Pildora
                                                    texto={`${f.sinSku} por resolver`}
                                                    tono="advertencia"
                                                />
                                            ) : (
                                                <Pildora texto="Resueltos" tono="listo" />
                                            )}
                                        </td>
                                    )}
                                    <td className="px-2.5 py-2 text-center text-[14px] font-semibold tabular-nums">
                                        {f.piezas}
                                    </td>
                                    <td className="px-2.5 py-2 text-center">
                                        <Pildora texto="Por cotejar" tono="info" />
                                    </td>
                                    <td className="px-2.5 py-2" />
                                </tr>
                            )
                        }

                        // ── Fila de PRODUCTO (la subpartida que produjo la revisión): su huella, sus
                        //    piezas, su SKU y su acción. Se OCULTA si su partida está plegada. ──
                        const b = f.bandeja as BandejaLiberada
                        if (agruparPorPartida && plegadas[String(f.partida ?? 'x')]) return null
                        const a = accion(b)
                        return (
                            <tr key={b.clave} className="border-t border-border/70">
                                <td
                                    className={cn(
                                        'px-2.5 py-2 font-mono text-[13px] tabular-nums',
                                        agruparPorPartida && 'pl-6'
                                    )}
                                >
                                    <b>{foliosDeBandeja(b)}</b>
                                </td>
                                <td className="px-2.5 py-2">
                                    <span className="grid gap-0.5">
                                        <span className="font-semibold">
                                            {productoDeBandeja(b) || 'Sin huella'}
                                        </span>
                                        <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                                            {origenDeBandeja(b)}
                                        </span>
                                    </span>
                                </td>
                                {sku && (
                                    <td className="px-2.5 py-2">
                                        {b.id_producto ? (
                                            <Pildora texto={b.producto_sku ?? 'Resuelto'} tono="listo" />
                                        ) : (
                                            <Pildora texto="Por resolver" tono="advertencia" />
                                        )}
                                    </td>
                                )}
                                <td className="px-2.5 py-2 text-center text-[16px] font-bold tabular-nums">
                                    {b.piezas}
                                </td>
                                <td className="px-2.5 py-2 text-center">
                                    <Pildora
                                        texto={TEXTO_ESTADO_TANDA[b.estado]}
                                        tono={TONO_ESTADO_TANDA[b.estado]}
                                    />
                                </td>
                                <td className="px-2.5 py-2">
                                    {/* Densidad por PUESTO (L8): el escritorio usa el botón del kit
                                        (`h-8`, como `PartidasExpandidas`); el puesto de dedo conserva
                                        la acción de 52px con etiqueta. */}
                                    <Button
                                        type="button"
                                        variant={a.dominante ? 'default' : 'outline'}
                                        size={esKit ? 'sm' : 'default'}
                                        className={esKit ? undefined : 'min-h-[52px] w-full'}
                                        disabled={a.disabled}
                                        title={a.title}
                                        onClick={a.onClick}
                                    >
                                        {!esKit && (
                                            <a.icono className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                        )}
                                        {a.etiqueta}
                                    </Button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            </div>
        </div>
    )
}
