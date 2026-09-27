'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ACONDICIONAMIENTO CATALOGO — Cola del acondicionador (Guía 1.6 · P5 · Smart)
//
// ⭐ MEJORA 25/27 (24-25 Sep 2026 · decisión 22) — la cola del acondicionador es una BANDEJA.
//
// La fila de trabajo es la bandeja: lo que la Revisión ya liberó, agrupado por **grupo
// (partida + huella) + estado**, de modo que el mismo producto en el mismo momento del trabajo es
// UNA fila aunque haya llegado en varias tandas (decisión 22.g) — es el camino PARALELO: la
// entrada sigue en revisión y la mercancía ya fluye.
//
// ⭐ MEJORA 31 ① (25 Sep 2026 · usuario) — FUERA EL TOGGLE DE VISTAS; la página es la BANDEJA.
// El usuario: *«no sé de dónde nació que en la página arriba en los botones haya uno que diga
// "Por acondicionar" — que es lo que debería ver el usuario — pero además está una pestaña
// [Folio · Proveedor · Partidas · RECIBIDAS], cuando no debería tener esa vista de las entradas»*.
// El arreglo obvio (borrar la pestaña) rompía el flujo — medido: `tomarAcondicionamiento` y
// `completarAcondicionamiento` se llaman SOLO desde `AcondicionamientoModal`, que solo se montaba
// desde esa vista. Es la **bomba del documento**:
//
//     ajustada ──tomar──▶ en_acondicionamiento ──completar──▶ en_almacen
//
// ⭐ MEJORA 31 ② (25 Sep 2026 · usuario) — LA COLA SE AGRUPA POR INGRESO.
// El usuario: *«se puede agrupar por folio de entrada, algo así como las otras vistas del flujo?
// El ítem padre (1 fila) es la entrada… y dentro las tandas, para que se puedan colapsar»*.
// Con el ingreso como fila PADRE, la bomba del documento deja de necesitar una sección aparte:
// es la **acción del propio padre** — un ingreso sin tandas aparece solo, con su botón de cierre
// (el mockup de Almacén llama a esto «tandas + saldo» en una sola cola, y descarta por L6 tener
// el mismo trabajo en dos lugares). Anatomía y agrupación: `BandejasDeIngreso.tsx`.
//
// Diseño aprobado: `DOCS/design/entradas/liberacion-parcial-revision-acondicionamiento.html` §5 ·
// `DOCS/design/entradas/almacen-hub-cotejo-por-tanda.html` §2 (opción B, agrupada por entrada).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageCheck, PackageOpen, Sparkles } from 'lucide-react'

import { DataTable } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import {
    entregarTodoDeIngreso,
    listarBandejas,
    listarEntradas,
    tomarTodoDeIngreso,
} from '@/lib/actions/entradas'
import type { BandejaLiberada, Entrada, EstadoEntrada, EstadoTanda } from '@/types/entradas'
import { FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { AcondicionamientoModal } from '@/components/entradas/AcondicionamientoModal'
import { TandaAcondicionamientoModal } from '@/components/entradas/TandaAcondicionamientoModal'
import {
    BandejasDeIngreso,
    agruparPorIngreso,
    columnaIngresoIdentidad,
    columnaIngresoResumen,
    type AccionBandeja,
    type ColumnaIngreso,
    type IngresoEnCola,
} from '@/components/entradas/BandejasDeIngreso'
import { cn } from '@/lib/utils'

const RUTA = '/dashboard/entradas/acondicionamiento'

const Acondicionable = (e: Entrada): boolean =>
    e.estado === 'ajustada' || e.estado === 'en_acondicionamiento' || (e.estado === 'recien_creada' && e.es_sin_revision)

/**
 * Estados de DOCUMENTO cuyo cierre todavía le toca a este puesto: es lo que acota la consulta en
 * servidor (`listarEntradas` → `in('estado', …)`). El predicado fino lo aplica `Acondicionable`
 * después, porque el «camino 2» no es un estado sino `recien_creada` **+** `es_sin_revision` — y
 * `estados` (un `in`) no sabe expresar una conjunción.
 */
const ESTADOS_DOCUMENTO: EstadoEntrada[] = ['ajustada', 'en_acondicionamiento', 'recien_creada']

/**
 * Tope de la cola de documentos. ⚠️ Deuda declarada, del mismo tipo que el tope de `listarBandejas`:
 * la consulta no puede acotar `es_sin_revision` en servidor, así que se traen los tres estados y el
 * filtro exacto corre en cliente. El conjunto es chico por construcción (sólo lo que espera en este
 * puesto), pero con cientos de documentos abiertos el corte escondería los más **viejos** — que son
 * justo los que pueden quedar varados. Se resuelve con un filtro de servidor, no subiendo el número.
 */
const TAMANO_DOCUMENTOS = 100

/** Qué estados de tanda ve esta etapa. `en_almacen` y `confirmada` son LECTURA: ya salieron de aquí. */
const CHIPS_TANDA: { id: string; label: string; estados: EstadoTanda[] }[] = [
    // ⭐ MEJORA 29 — «Todas» va PRIMERO y es el default: el chip activo queda en orden de lectura.
    { id: 'todas', label: 'Todas', estados: [] },
    { id: 'por_limpiar', label: 'Por limpiar', estados: ['por_limpiar'] },
    { id: 'en_limpieza', label: 'En limpieza', estados: ['en_limpieza'] },
    { id: 'entregadas', label: 'Entregadas al almacén', estados: ['en_almacen', 'confirmada'] },
]

export function AcondicionamientoCatalogo() {
    const [bandejas, setBandejas] = useState<BandejaLiberada[]>([])
    const [documentos, setDocumentos] = useState<Entrada[]>([])
    const [estadoBandejas, setEstadoBandejas] = useState<EstadoTabla>('loading')
    const [estadoDocumentos, setEstadoDocumentos] = useState<EstadoTabla>('loading')
    // ⭐ MEJORA 31 ① (fix 25 Sep 2026) — la cola abre en **«Todas»**, no en «Por limpiar».
    // El acondicionador necesita VER TODO lo que hay en su puesto al entrar (lo que falta, lo que
    // está en sus manos y lo ya entregado): arrancar filtrado escondía trabajo real y hacía parecer
    // la bandeja vacía. El filtro sigue disponible, solo deja de venir preseleccionado.
    const [chipTanda, setChipTanda] = useState('todas')
    const [seleccion, setSeleccion] = useState<Entrada | null>(null)
    const [bandejaSel, setBandejaSel] = useState<BandejaLiberada | null>(null)
    // ⭐ MEJORA 32 (usuario) — la acción MASIVA del ingreso, pendiente de confirmación:
    // *«un botón que justo haga eso, limpiar todas… y un botón general para terminar y entregar todo»*.
    const [masiva, setMasiva] = useState<{ ingreso: IngresoEnCola; tipo: 'limpiar' | 'entregar' } | null>(
        null
    )

    const puedeEditar = useCanAction(RUTA, 'editar')

    const estadosTanda = useMemo(
        () => CHIPS_TANDA.find((c) => c.id === chipTanda)?.estados ?? [],
        [chipTanda]
    )

    // Las BANDEJAS (las hijas) — se recargan con cada chip.
    useEffect(() => {
        let activo = true
        void (async () => {
            const res = await listarBandejas(estadosTanda.length > 0 ? estadosTanda : undefined)
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
    }, [estadosTanda])

    // Los DOCUMENTOS que esperan el cierre de esta etapa (el padre sin tandas).
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
            setDocumentos((res.data ?? []).filter(Acondicionable))
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
            listarBandejas(estadosTanda.length > 0 ? estadosTanda : undefined),
            listarEntradas({ ...FILTROS_ENTRADAS_DEFAULT, estados: ESTADOS_DOCUMENTO }, 1, TAMANO_DOCUMENTOS),
        ])
        if (resBandejas.success) {
            setBandejas(resBandejas.data ?? [])
            setEstadoBandejas('idle')
        } else {
            setEstadoBandejas('error')
        }
        if (resDocumentos.success) {
            setDocumentos((resDocumentos.data ?? []).filter(Acondicionable))
            setEstadoDocumentos('idle')
        } else {
            setEstadoDocumentos('error')
        }
    }, [estadosTanda])

    /** El padre: el ingreso, con sus bandejas dentro y el documento cuando le toca cerrarse. */
    const ingresos = useMemo(() => agruparPorIngreso(bandejas, documentos), [bandejas, documentos])

    // La tabla espera a las DOS consultas: mostrar «vacío» mientras una carga sería mentir.
    const estado: EstadoTabla =
        estadoBandejas === 'error' || estadoDocumentos === 'error'
            ? 'error'
            : estadoBandejas === 'loading' || estadoDocumentos === 'loading'
              ? 'loading'
              : 'idle'

    // ── Hija: el trabajo FÍSICO de la bandeja (limpiar y entregar). ───────────────────────────
    const accionDeBandeja = useCallback(
        (b: BandejaLiberada): AccionBandeja => {
            const cerrada = b.estado === 'en_almacen' || b.estado === 'confirmada'
            return {
                etiqueta:
                    b.estado === 'por_limpiar'
                        ? 'Iniciar acondicionamiento'
                        : b.estado === 'en_limpieza'
                          ? 'Terminar y entregar'
                          : 'Ver',
                icono: PackageCheck,
                dominante: b.estado === 'por_limpiar',
                disabled: !puedeEditar || cerrada,
                title: cerrada
                    ? 'Esta tanda ya salió de acondicionamiento.'
                    : puedeEditar
                      ? undefined
                      : 'No tienes permiso para acondicionar.',
                onClick: () => setBandejaSel(b),
            }
        },
        [puedeEditar]
    )

    // ── Padre: la BOMBA DEL DOCUMENTO. Sólo aparece cuando el ingreso ya puede cerrarse. ──────
    const columnaAccionDocumento = useMemo<ColumnaIngreso>(
        () => ({
            id: 'accion',
            label: 'Acción',
            align: 'centro',
            movil: 'critica',
            size: 260,
            render: (_v, i) => {
                const e = i.entrada
                if (!e || !puedeEditar) return null
                const enAcondicionamiento = e.estado === 'en_acondicionamiento'
                return (
                    <Button
                        type="button"
                        variant={enAcondicionamiento ? 'default' : 'outline'}
                        className="min-h-[52px] w-full"
                        onClick={() => setSeleccion(e)}
                    >
                        <PackageCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        {enAcondicionamiento ? 'Completar acondicionamiento' : 'Tomar para acondicionar'}
                    </Button>
                )
            },
        }),
        [puedeEditar]
    )

    /**
     * ⭐ MEJORA 32 — la **barra del ingreso**: el atajo del puesto, calcado del de la fase 2
     * (`PartidasAvance` · «Liberar todo (n)»). Sin él hay que abrir el modal bandeja por bandeja.
     * Dice solo lo que el conteo del padre NO dice —cuánto falta limpiar y cuánto está en las manos—
     * porque el resto ya está en la fila (SPEC §2.6: dos lugares diciendo lo mismo es peor que uno).
     */
    const barraMasiva = useCallback(
        (i: IngresoEnCola) => {
            const pzPorLimpiar = i.bandejas
                .filter((b) => b.estado === 'por_limpiar')
                .reduce((s, b) => s + b.piezas, 0)
            const pzEnLimpieza = i.bandejas
                .filter((b) => b.estado === 'en_limpieza')
                .reduce((s, b) => s + b.piezas, 0)
            if (!puedeEditar || (pzPorLimpiar === 0 && pzEnLimpieza === 0)) return null
            return (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2.5">
                    <span className="text-[12.5px] text-muted-foreground">
                        <span className="font-semibold tabular-nums text-foreground">{pzPorLimpiar}</span>{' '}
                        por limpiar ·{' '}
                        <span className="font-semibold tabular-nums text-foreground">{pzEnLimpieza}</span>{' '}
                        en limpieza
                    </span>
                    <span className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 gap-1.5 px-3.5"
                            disabled={pzPorLimpiar === 0}
                            onClick={() => setMasiva({ ingreso: i, tipo: 'limpiar' })}
                            title="Pone a limpieza TODO lo que está por limpiar de este ingreso."
                        >
                            <Sparkles className="h-4 w-4" aria-hidden="true" />
                            Limpiar todas ({pzPorLimpiar})
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 gap-1.5 px-3.5"
                            disabled={pzEnLimpieza === 0}
                            onClick={() => setMasiva({ ingreso: i, tipo: 'entregar' })}
                            title="Entrega al almacén TODO lo que está en limpieza de este ingreso."
                        >
                            <PackageOpen className="h-4 w-4" aria-hidden="true" />
                            Terminar y entregar todo ({pzEnLimpieza})
                        </Button>
                    </span>
                </div>
            )
        },
        [puedeEditar]
    )

    /** Las piezas que la acción masiva va a mover: es lo que la confirmación dice. */
    const masivaPiezas = useMemo(() => {
        if (!masiva) return 0
        const desde = masiva.tipo === 'limpiar' ? 'por_limpiar' : 'en_limpieza'
        return masiva.ingreso.bandejas
            .filter((b) => b.estado === desde)
            .reduce((s, b) => s + b.piezas, 0)
    }, [masiva])

    const columnasIngreso = useMemo<ColumnaIngreso[]>(
        () => [columnaIngresoIdentidad, columnaIngresoResumen, columnaAccionDocumento],
        [columnaAccionDocumento]
    )

    const filtrosBarra = useMemo(
        () => (
            <div className="flex flex-wrap items-center gap-2">
                {CHIPS_TANDA.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        aria-pressed={chipTanda === c.id}
                        onClick={() => {
                            setEstadoBandejas('loading')
                            setChipTanda(c.id)
                        }}
                        className={cn(
                            'min-h-11 rounded-full border px-3.5 text-[14px] transition-colors',
                            chipTanda === c.id
                                ? 'border-acc-entradas bg-acc-entradas/15 font-semibold'
                                : 'border-border bg-surface-raised text-muted-foreground hover:bg-hover-background'
                        )}
                    >
                        {c.label}
                    </button>
                ))}
                <span className="ml-auto text-[12.5px] text-muted-foreground tabular-nums">
                    {ingresos.length} {ingresos.length === 1 ? 'ingreso' : 'ingresos'} ·{' '}
                    {bandejas.length} {bandejas.length === 1 ? 'bandeja' : 'bandejas'}
                </span>
            </div>
        ),
        [chipTanda, ingresos.length, bandejas.length]
    )

    usePageConfig({
        info: { title: 'Acondicionamiento', subtitle: 'Entradas' },
        path: RUTA,
        filtros: filtrosBarra,
    })

    return (
        <>
            {/* ── El PUESTO DE TRABAJO: una fila por INGRESO, y dentro sus bandejas ─────────────
                ⚠️ Sin paginación de servidor a propósito: una tanda son N filas y paginar por fila
                podía partir una tanda entre dos páginas. El volumen real es de un puñado por día. */}
            <DataTable<IngresoEnCola>
                columns={columnasIngreso}
                data={ingresos}
                rowKey={(i) => i.id_entrada}
                estado={estado}
                emptyMessage="No hay nada por acondicionar en esta vista."
                modoTactil
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
                        accionesMasivas={barraMasiva(i)}
                    />
                )}
            />

            {/* Camino de la BANDEJA (decisión 22.g): limpiar y entregar — agrupa las tandas del
                mismo producto para que la fila no se repita. */}
            <TandaAcondicionamientoModal
                key={bandejaSel?.clave ?? 'ninguna-bandeja'}
                open={bandejaSel !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setBandejaSel(null)
                }}
                bandeja={bandejaSel}
                onGuardado={() => {
                    void recargar()
                }}
            />
            {/* Camino del DOCUMENTO: tomar (→ en_acondicionamiento) o completar (→ en_almacén). */}
            <AcondicionamientoModal
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

            {/* ⭐ MEJORA 32 — la acción MASIVA del ingreso, con confirmación: mueve mercancía que ya
                está en el piso, así que dice cuántas piezas y —al entregar— que no se deshace. */}
            <ConfirmarAccionDialog
                open={masiva !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setMasiva(null)
                }}
                titulo={
                    masiva?.tipo === 'entregar' ? '¿Entregar todo al almacén?' : '¿Poner todo a limpiar?'
                }
                descripcion={
                    masiva
                        ? `${masivaPiezas} pieza(s) de ${masiva.ingreso.folio} ${
                              masiva.tipo === 'entregar'
                                  ? 'pasan a la cola de cotejo del almacén'
                                  : 'pasan a limpieza'
                          }.`
                        : ''
                }
                detalle={
                    masiva?.tipo === 'entregar'
                        ? 'Una entrega no se deshace: si algo salió mal, el camino es una divergencia.'
                        : undefined
                }
                confirmLabel={masiva?.tipo === 'entregar' ? 'Terminar y entregar todo' : 'Limpiar todas'}
                successMessage={
                    masiva?.tipo === 'entregar' ? 'Todo entregado al almacén' : 'Todo puesto a limpiar'
                }
                tactil
                onConfirm={async () => {
                    if (!masiva) return { error: 'No hay ingreso seleccionado.' }
                    const res =
                        masiva.tipo === 'entregar'
                            ? await entregarTodoDeIngreso(masiva.ingreso.id_entrada)
                            : await tomarTodoDeIngreso(masiva.ingreso.id_entrada)
                    if (!res.success) return { error: res.error ?? 'No se pudo avanzar el ingreso.' }
                    await recargar()
                    return { error: null }
                }}
            />
        </>
    )
}
