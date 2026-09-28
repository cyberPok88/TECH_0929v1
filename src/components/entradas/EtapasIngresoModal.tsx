'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPAS DEL INGRESO — el avance de las 4 etapas, visto desde Recepción (Guía 1.6 · Fase 1)
//
// ⭐ MEJORA 27 Sep 2026 (usuario) — *«Recepción es un puesto importante, prácticamente un usuario
// administrador que ve todas las etapas, tiene jerarquía alta, y justo es para que él pueda revisar
// cómo va evolucionando las cosas sin abandonar Entradas»*.
//
// Descartado NAVEGAR (se pierden filtros, página y la fila abierta) y descartados **cuatro** modales
// (uno por etapa): el usuario eligió **una puerta — la toolbar de detalles — y un modal con las
// etapas dentro**. Diseño aprobado: `DOCS/design/entradas/toolbar-detalles-etapas-recepcion.html`.
//
// La pieza clave es la **barra de etapas**: el mismo timeline que el desglose ya pinta al pie
// (Recepción · Revisión · Acondicionamiento · Almacén), convertido en navegación — cada etapa dice su
// hito, su fecha y su estado, y se puede abrir.
//
// ⚠️ **CONSULTA PURA** (decisión ⑧ del mockup): este modal NO cambia nada. Las etapas que no son de
// Recepción se miran, no se operan: la RLS por etapa (MEJORA 26) sigue siendo la única autoridad y
// no se duplican aquí las puertas de escritura de cada puesto.
//
// ⚠️ **Desviación declarada del mockup (§③).** El mockup dibujaba el panel de Recepción con la tabla
// completa de partidas y productos; aquí el panel es el **resumen de la etapa** (fechas · partidas ·
// productos · piezas · DEV y su estado · nota). Motivo (ley **L6**): esa tabla exacta está **detrás
// del modal** — el desglose del que se abrió esta puerta— y repetirla sería «dos lugares diciendo lo
// mismo con distinta precisión». Los otros tres paneles sí van completos porque **no** están detrás.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

import {
    CLASE_CAJA_TABLA,
    CLASE_TBODY_KIT,
    CLASE_TD_FILA,
    CLASE_TH_TABLA,
    CLASE_THEAD_TABLA,
    Pildora,
} from '@/components/data-table'
import type { TonoPildora } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { PartidasAvance } from '@/components/entradas/PartidasAvance'
import { formatearFechaEntrada, valoresAtributos } from '@/components/entradas/columnas-entrada'
import { listarEtapasDeIngreso, listarPartidasConAvance } from '@/lib/actions/entradas'
import { cn } from '@/lib/utils'
import {
    TEXTO_ETAPA_RECEPCION,
    TONO_ETAPA_RECEPCION,
    TEXTO_ESTADO_TANDA,
    TONO_ESTADO_TANDA,
} from '@/types/entradas'
import type { Entrada, EtapasDeIngreso, PartidaConAvance } from '@/types/entradas'

type Etapa = 'recepcion' | 'revision' | 'acondicionamiento' | 'almacen'

interface EtapasIngresoModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
}

/** El encabezado de una celda de las tablas de etapa (misma piel que el kit: `estilos-tabla`). */
const TH = cn(CLASE_TH_TABLA, 'px-2.5 py-1.5')
/** Una celda de cuerpo. */
const TD = cn(CLASE_TD_FILA, 'px-2.5 py-2')

/**
 * ¿En qué etapa hay que abrir el modal?
 * La que **le toca al que mira**: si Recepción tiene algo pendiente (DEV por ajustar / nota sin
 * generar) se abre ahí, porque es lo único que este puesto puede cerrar; si no, se abre en la etapa
 * donde la entrada está viva.
 */
function etapaInicial(e: Entrada): Etapa {
    if ((e.estado === 'con_dev' || e.estado === 'revisada_sin_dev') && !e.id_nota) return 'recepcion'
    if (e.estado === 'recien_creada' || e.estado === 'lista_para_revision' || e.estado === 'en_revision')
        return 'revision'
    if (e.estado === 'ajustada' || e.estado === 'en_acondicionamiento') return 'acondicionamiento'
    return 'almacen'
}

export function EtapasIngresoModal({ open, onOpenChange, entrada }: EtapasIngresoModalProps) {
    /** Los datos de la entrada; los dos reads se piden juntos (uno por cada par de etapas). */
    const [partidas, setPartidas] = useState<PartidaConAvance[] | null>(null)
    const [etapas, setEtapas] = useState<EtapasDeIngreso | null>(null)
    /**
     * La etapa abierta. Arranca en la que **le toca al que mira** y se inicializa en el PRIMER render:
     * el padre monta este modal con `key={entrada.id}`, así que cada entrada es un montaje nuevo — y
     * un `setState` dentro del efecto para lo mismo sería un render en cascada (lo marca el linter).
     */
    const [activa, setActiva] = useState<Etapa>(() => (entrada ? etapaInicial(entrada) : 'recepcion'))

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void Promise.all([listarPartidasConAvance(entrada.id), listarEtapasDeIngreso(entrada.id)]).then(
            ([rPartidas, rEtapas]) => {
                if (!activo) return
                setPartidas(rPartidas.success ? (rPartidas.data ?? []) : [])
                setEtapas(
                    rEtapas.success
                        ? (rEtapas.data ?? { acondicionamiento: [], cotejo: [], divergencias: [] })
                        : { acondicionamiento: [], cotejo: [], divergencias: [] }
                )
            }
        )
        return () => {
            activo = false
        }
    }, [open, entrada])

    const cargando = partidas === null || etapas === null

    /** Los totales que resumen cada etapa (los mismos números que dicen sus barras). */
    const r = useMemo(() => {
        const ps = partidas ?? []
        const acond = etapas?.acondicionamiento ?? []
        const cotejo = etapas?.cotejo ?? []
        const aprobadas = ps.reduce((s, p) => s + p.aprobadas, 0)
        const dev = ps.reduce((s, p) => s + p.dev_cantidad, 0)
        const revisadas = ps.reduce((s, p) => s + p.revisadas, 0)
        const porLimpiar = acond
            .filter((l) => l.estado === 'por_limpiar' || l.estado === 'en_limpieza')
            .reduce((s, l) => s + l.cantidad, 0)
        const enAlmacen = acond
            .filter((l) => l.estado === 'en_almacen' || l.estado === 'confirmada')
            .reduce((s, l) => s + l.cantidad, 0)
        const porAlta = cotejo.reduce((s, l) => s + l.cantidad_pendiente, 0)
        const porTanda = cotejo.reduce((s, l) => s + (l.cantidad_aprobada - l.cantidad_pendiente), 0)
        return { aprobadas, dev, revisadas, porLimpiar, enAlmacen, porAlta, porTanda, acond, cotejo }
    }, [partidas, etapas])

    /** El estado de cada hito de la barra: hecho · en curso · pendiente. */
    const hitos = useMemo(() => {
        const e = entrada
        if (!e) return null
        const revisionHecha = r.revisadas > 0 && r.revisadas >= e.piezas_total
        const acondHecho = r.acond.length > 0 && r.porLimpiar === 0
        const almacenHecho = e.estado === 'confirmada'
        return {
            recepcion: { punto: 'done', detalle: `${e.piezas_total} pza declaradas` },
            revision: {
                punto: r.revisadas === 0 ? 'pend' : revisionHecha ? 'done' : 'act',
                detalle:
                    r.revisadas === 0
                        ? 'sin revisar'
                        : `${r.aprobadas} aprobadas · DEV ${r.dev}`,
            },
            acondicionamiento: {
                punto: r.acond.length === 0 ? 'pend' : acondHecho ? 'done' : 'act',
                detalle:
                    r.acond.length === 0
                        ? 'sin piezas liberadas'
                        : r.porLimpiar > 0
                          ? `${r.porLimpiar} pza por limpiar`
                          : `${r.enAlmacen} pza en almacén`,
            },
            almacen: {
                punto: almacenHecho ? 'done' : r.porTanda > 0 || r.porAlta === 0 ? 'act' : 'pend',
                detalle: almacenHecho
                    ? 'en inventario'
                    : r.porTanda > 0
                      ? `${r.porTanda} por tanda · ${r.porAlta} por dar de alta`
                      : 'sin empezar',
            },
        }
    }, [entrada, r])

    const ETAPAS: { clave: Etapa; nombre: string; icono: string }[] = [
        { clave: 'recepcion', nombre: 'Recepción', icono: '①' },
        { clave: 'revision', nombre: 'Revisión', icono: '②' },
        { clave: 'acondicionamiento', nombre: 'Acondicionamiento', icono: '③' },
        { clave: 'almacen', nombre: 'Almacén', icono: '④' },
    ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader className="flex-row items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="min-h-11 shrink-0 gap-1.5 px-3 text-[14px]"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                    <DialogTitle>Etapas de {entrada?.folio ?? 'la entrada'}</DialogTitle>
                    {entrada && (
                        <span className="ml-auto">
                            <Pildora
                                texto={TEXTO_ETAPA_RECEPCION[entrada.estado]}
                                tono={TONO_ETAPA_RECEPCION[entrada.estado]}
                            />
                        </span>
                    )}
                </DialogHeader>

                {entrada === null ? null : cargando ? (
                    <Spinner etiqueta="Leyendo las etapas del ingreso…" className="py-4" />
                ) : (
                    <>
                        {/* ── La BARRA DE ETAPAS: el timeline del desglose, convertido en navegación ── */}
                        <div className="flex flex-wrap items-stretch gap-1.5 rounded-md border border-border bg-surface-2 p-1.5">
                            {ETAPAS.map((et) => {
                                const hito = hitos?.[et.clave]
                                const encendida = activa === et.clave
                                return (
                                    <button
                                        key={et.clave}
                                        type="button"
                                        onClick={() => setActiva(et.clave)}
                                        aria-current={encendida ? 'true' : undefined}
                                        className={cn(
                                            'flex flex-1 basis-44 items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                                            encendida
                                                ? 'border-acc-entradas/45 bg-surface-raised'
                                                : 'border-transparent hover:bg-hover-background'
                                        )}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'size-2.5 shrink-0 rounded-full border-2',
                                                hito?.punto === 'done' && 'border-success bg-success',
                                                hito?.punto === 'act' && 'border-warning bg-warning',
                                                hito?.punto === 'pend' && 'border-border'
                                            )}
                                        />
                                        <span className="min-w-0">
                                            <span
                                                className={cn(
                                                    'block text-[12px] font-semibold',
                                                    hito?.punto === 'pend' && 'font-medium text-muted-foreground'
                                                )}
                                            >
                                                {et.nombre}
                                            </span>
                                            <span className="block text-[11px] text-muted-foreground">
                                                {hito?.detalle ?? ''}
                                            </span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* ── ① RECEPCIÓN · el resumen de la etapa (el detalle está en el desglose) ── */}
                        {activa === 'recepcion' && (
                            <div className={CLASE_CAJA_TABLA}>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
                                    <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                        Declarado
                                    </span>
                                    <span className="text-[15px]">
                                        <b className="tabular-nums">{entrada.partidas_count}</b> partidas ·{' '}
                                        <b className="tabular-nums">{entrada.piezas_total}</b> piezas
                                    </span>
                                    <span className="text-[15px]">
                                        DEV{' '}
                                        <b className="tabular-nums text-destructive">
                                            {entrada.devolucion_total}
                                        </b>{' '}
                                        · final{' '}
                                        <b className="tabular-nums">{entrada.piezas_vigentes}</b>
                                    </span>
                                    <span className="ml-auto flex items-center gap-2">
                                        <Pildora
                                            texto="Nota de compra"
                                            tono={entrada.id_nota ? 'listo' : 'neutro'}
                                        />
                                        <span className="text-[12.5px] text-muted-foreground">
                                            {entrada.id_nota
                                                ? 'generada y consultable desde la columna NOTA'
                                                : 'sin generar — la genera «Ajustar + nota»'}
                                        </span>
                                    </span>
                                </div>
                                <p className="border-t border-border px-3 py-2 text-[12.5px] text-muted-foreground">
                                    El detalle por <b className="text-foreground">fila de partida</b> y{' '}
                                    <b className="text-foreground">fila de producto</b> de esta etapa está en el
                                    desglose del que se abrió esta puerta — aquí no se repite.
                                </p>
                            </div>
                        )}

                        {/* ── ② REVISIÓN · la misma superficie del técnico, en solo lectura ── */}
                        {activa === 'revision' && (
                            <PartidasAvance entrada={entrada} partidas={partidas ?? []} />
                        )}

                        {/* ── ③ ACONDICIONAMIENTO · las liberaciones de ESTE ingreso (read nuevo) ── */}
                        {activa === 'acondicionamiento' && (
                            <div className="flex flex-col gap-2">
                                <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                    {r.acond.length} bandeja{r.acond.length === 1 ? '' : 's'} ·{' '}
                                    {r.porLimpiar} pza por limpiar · {r.enAlmacen} ya en almacén
                                </span>
                                {r.acond.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sin piezas liberadas: la revisión todavía no ha entregado nada de esta
                                        entrada a limpieza.
                                    </p>
                                ) : (
                                    <div className={CLASE_CAJA_TABLA}>
                                        <table className="w-full text-[12.5px]">
                                            <thead className={CLASE_THEAD_TABLA}>
                                                <tr>
                                                    <th className={cn(TH, 'text-left')}>Bandeja (producto)</th>
                                                    <th className={cn(TH, 'w-16')}>Tanda</th>
                                                    <th className={cn(TH, 'w-16')}>Partida</th>
                                                    <th className={cn(TH, 'w-16')}>Piezas</th>
                                                    <th className={cn(TH, 'w-24')}>Liberada</th>
                                                    <th className={cn(TH, 'w-24')}>Inicio limpieza</th>
                                                    <th className={cn(TH, 'w-24')}>Entregada</th>
                                                    <th className={cn(TH, 'w-24')}>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className={CLASE_TBODY_KIT}>
                                                {r.acond.map((l) => (
                                                    <tr key={l.id}>
                                                        <td className={cn(TD, 'text-left')}>
                                                            <span className="font-semibold">
                                                                {l.marca_nombre ?? 'Sin marca'}
                                                            </span>
                                                            {valoresAtributos(l.atributos) && (
                                                                <span className="text-muted-foreground">
                                                                    {' '}
                                                                    · {valoresAtributos(l.atributos)}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className={cn(TD, 'text-center tabular-nums')}>
                                                            {l.tanda ?? '—'}
                                                        </td>
                                                        <td className={cn(TD, 'text-center tabular-nums')}>
                                                            {l.partida_numero ?? '—'}
                                                        </td>
                                                        <td className={cn(TD, 'text-center tabular-nums')}>
                                                            {l.cantidad}
                                                        </td>
                                                        <td className={cn(TD, 'text-center tabular-nums')}>
                                                            {l.fecha_liberacion
                                                                ? formatearFechaEntrada(l.fecha_liberacion)
                                                                : '—'}
                                                        </td>
                                                        <td
                                                            className={cn(
                                                                TD,
                                                                'text-center tabular-nums',
                                                                !l.fecha_inicio_acond && 'text-muted-foreground'
                                                            )}
                                                        >
                                                            {l.fecha_inicio_acond
                                                                ? formatearFechaEntrada(l.fecha_inicio_acond)
                                                                : '—'}
                                                        </td>
                                                        <td
                                                            className={cn(
                                                                TD,
                                                                'text-center tabular-nums',
                                                                !l.fecha_entrega && 'text-muted-foreground'
                                                            )}
                                                        >
                                                            {l.fecha_entrega
                                                                ? formatearFechaEntrada(l.fecha_entrega)
                                                                : '—'}
                                                        </td>
                                                        <td className={cn(TD, 'text-center')}>
                                                            <Pildora
                                                                texto={TEXTO_ESTADO_TANDA[l.estado]}
                                                                tono={TONO_ESTADO_TANDA[l.estado]}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <p className="text-[12.5px] text-muted-foreground">
                                    La <b className="text-foreground">bandeja</b> es la unidad del acondicionador
                                    (partida + huella). Esta etapa se <b>mira</b>: para tomar o entregar se usa la
                                    cola del puesto de acondicionamiento.
                                </p>
                            </div>
                        )}

                        {/* ── ④ ALMACÉN · el cotejo: qué SKU se resolvió y qué falta ── */}
                        {activa === 'almacen' && (
                            <div className="flex flex-col gap-2">
                                <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                    {r.cotejo.length} producto{r.cotejo.length === 1 ? '' : 's'} ·{' '}
                                    {r.porAlta} por dar de alta · {r.porTanda} por tanda
                                </span>
                                {r.cotejo.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sin líneas de cotejo: esta entrada no ha llegado a Almacén.
                                    </p>
                                ) : (
                                    <div className={CLASE_CAJA_TABLA}>
                                        <table className="w-full text-[12.5px]">
                                            <thead className={CLASE_THEAD_TABLA}>
                                                <tr>
                                                    <th className={cn(TH, 'text-left')}>
                                                        Producto (huella de la revisión)
                                                    </th>
                                                    <th className={cn(TH, 'text-left')}>SKU resuelto</th>
                                                    <th className={cn(TH, 'w-24')}>Aprobadas</th>
                                                    <th className={cn(TH, 'w-28')}>Por dar de alta</th>
                                                    <th className={cn(TH, 'w-24')}>Por tanda</th>
                                                    <th className={cn(TH, 'w-32')}>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className={CLASE_TBODY_KIT}>
                                                {r.cotejo.map((l) => {
                                                    /**
                                                     * ⚠️ `cantidad_pendiente` = «falta por dar de alta» (lo que
                                                     * el alta clásica debe cotejar). Por eso lo que YA salió es
                                                     * `aprobada − pendiente` = **por tanda**, no «ingresado»:
                                                     * «en inventario» solo se afirma con la entrada
                                                     * `confirmada`. (Sin esta distinción, ING-0003 —que está
                                                     * `con_dev`— se leería como «9 ingresadas».)
                                                     */
                                                    const porTanda = l.cantidad_aprobada - l.cantidad_pendiente
                                                    const confirmada = entrada.estado === 'confirmada'
                                                    const tono: TonoPildora = confirmada
                                                        ? 'exito'
                                                        : l.cantidad_pendiente === 0 && porTanda > 0
                                                          ? 'listo'
                                                          : porTanda > 0
                                                            ? 'advertencia'
                                                            : 'neutro'
                                                    const texto = confirmada
                                                        ? 'En inventario'
                                                        : l.cantidad_pendiente === 0 && porTanda > 0
                                                          ? 'Salió por tandas'
                                                          : porTanda > 0
                                                            ? 'A medias'
                                                            : 'Sin empezar'
                                                    return (
                                                        <tr key={l.id_partida_resuelta}>
                                                            <td className={cn(TD, 'text-left')}>
                                                                <span className="font-semibold">
                                                                    {l.marca_nombre ?? 'Sin marca'}
                                                                </span>
                                                                {valoresAtributos(l.atributos) && (
                                                                    <span className="text-muted-foreground">
                                                                        {' '}
                                                                        · {valoresAtributos(l.atributos)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td
                                                                className={cn(
                                                                    TD,
                                                                    'text-left font-mono',
                                                                    !l.sku && 'text-muted-foreground'
                                                                )}
                                                            >
                                                                {l.sku || '— (Almacén lo resuelve)'}
                                                            </td>
                                                            <td className={cn(TD, 'text-center tabular-nums')}>
                                                                {l.cantidad_aprobada}
                                                            </td>
                                                            <td
                                                                className={cn(
                                                                    TD,
                                                                    'text-center tabular-nums',
                                                                    l.cantidad_pendiente > 0 && 'text-warning'
                                                                )}
                                                            >
                                                                {l.cantidad_pendiente}
                                                            </td>
                                                            <td className={cn(TD, 'text-center tabular-nums')}>
                                                                {porTanda}
                                                            </td>
                                                            <td className={cn(TD, 'text-center')}>
                                                                <Pildora texto={texto} tono={tono} />
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {etapas && etapas.divergencias.length > 0 && (
                                    <div className="rounded-md border border-destructive/45 bg-destructive/10 px-3 py-2.5">
                                        <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-destructive">
                                            {etapas.divergencias.length} divergencia
                                            {etapas.divergencias.length === 1 ? '' : 's'}
                                        </span>
                                        <ul className="mt-1 flex flex-col gap-0.5 text-[12.5px]">
                                            {etapas.divergencias.map((d) => (
                                                <li key={d.id}>
                                                    {d.causa_nombre ?? 'Sin causa'} · esperadas{' '}
                                                    <b className="tabular-nums">{d.cantidad_esperada}</b>,
                                                    encontradas{' '}
                                                    <b className="tabular-nums">{d.cantidad_encontrada}</b> ·{' '}
                                                    {d.estado === 'resuelta' ? 'resuelta' : 'abierta'}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <p className="text-[12.5px] text-muted-foreground">
                                    La huella viene de <b className="text-foreground">Revisión</b>; el{' '}
                                    <b className="text-foreground">SKU lo resuelve Almacén</b>. Una línea sin SKU
                                    es una pieza <b>pendiente</b>, no un error.
                                    <br />
                                    <b className="text-foreground">Por dar de alta</b> es lo que falta cotejar con
                                    el alta clásica · <b className="text-foreground">por tanda</b> es lo que ya
                                    salió de Revisión hacia limpieza. «En inventario» solo se afirma cuando la
                                    entrada está <b className="text-foreground">confirmada</b>: lo que salió por
                                    tanda todavía no es stock.
                                </p>
                            </div>
                        )}
                    </>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[52px] px-5 text-[15px]"
                        onClick={() => onOpenChange(false)}
                    >
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
