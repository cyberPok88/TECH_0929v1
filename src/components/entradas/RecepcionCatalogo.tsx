'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RECEPCION CATALOGO — Listado de entradas (Guía 1.6 · P2 · Smart)
// Cola de trabajo del recepcionista: todas las entradas, filtrables por estado.
// Paginación SERVIDOR. Acciones por fila: Ver (expediente) · Editar (recién_creada).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, Pencil, Plus, Printer } from 'lucide-react'

import { DataTable, crearColumnaAcciones } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import type { ToolbarAction } from '@/types/shell'
import { listarEntradas, listarPartidasEntrada } from '@/lib/actions/entradas'
import type { Entrada, FiltrosEntradas, PartidaEntrada } from '@/types/entradas'
import { RecepcionFilters, FILTROS_RECEPCION_DEFAULT, hayFiltrosRecepcion } from '@/components/entradas/RecepcionFilters'
import { EntradaModal } from '@/components/entradas/EntradaModal'
import { EntradaDetailModal } from '@/components/entradas/EntradaDetailModal'
import { AjusteDevModal } from '@/components/entradas/AjusteDevModal'
import { exportarEntradasCsv } from '@/components/entradas/exportar-entradas-csv'
import { PartidasExpandidas } from '@/components/entradas/PartidasExpandidas'
import { AvanceRevisionModal } from '@/components/entradas/AvanceRevisionModal'
import { EtapasIngresoModal } from '@/components/entradas/EtapasIngresoModal'
import { DocumentoImprimible } from '@/components/imprimibles'
import { NotaEntradaImprimible } from '@/components/entradas/NotaEntradaImprimible'
import { construirDatosNotaEntrada } from '@/components/entradas/datos-nota-entrada'
import { NotaCompraDetalleModal } from '@/components/compras/NotaCompraDetalleModal'
import {
    columnaFecha,
    columnaFolio,
    columnaPartidas,
    columnaPiezas,
    columnaProveedor,
    crearColumnaDevolucion,
    crearColumnaEstadoRecepcion,
    crearColumnaFinal,
    crearColumnaNota,
    type ColumnaEntrada,
} from '@/components/entradas/columnas-entrada'

const RUTA = '/dashboard/entradas/recepcion'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

type ModalState = { modo: 'crear' } | { modo: 'editar'; entrada: Entrada } | null

export function RecepcionCatalogo() {
    const [entradas, setEntradas] = useState<Entrada[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    // ⚠️ 24 Sep 2026 (usuario) — el default es **ver TODAS** (la más reciente primero). Se probó
    // abrir la cola filtrada a lo que Recepción debe cerrar y se descartó: el filtro por defecto
    // es el listado completo. La vista sigue en el select «Cola» para acotarla.
    const [filtros, setFiltros] = useState<FiltrosEntradas>(FILTROS_RECEPCION_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [modal, setModal] = useState<ModalState>(null)
    const [detalle, setDetalle] = useState<Entrada | null>(null)
    const [ajuste, setAjuste] = useState<Entrada | null>(null)
    // ⭐ MEJORA 22 Sep 2026 — nota de compra en MODAL: consultarla ya no saca de Recepción.
    const [notaDetalle, setNotaDetalle] = useState<string | null>(null)
    // ⭐ MEJORA 24 Sep 2026 (usuario) — «En revisión técnica» abre el AVANCE de la revisión: la
    // píldora del estado es la puerta (L3) y el avance se ve en la misma tabla de ítems de la Fase 2.
    const [avanceRevision, setAvanceRevision] = useState<Entrada | null>(null)
    // ⭐ MEJORA 27 Sep 2026 (usuario) — la TOOLBAR DE DETALLES del desglose abre «Etapas del ingreso»:
    // las 4 etapas en solo lectura, para que el puesto vea cómo evoluciona sin salir de su cola.
    const [etapasIngreso, setEtapasIngreso] = useState<Entrada | null>(null)
    /**
     * ⭐ MEJORA 27 Sep 2026 (usuario) — **«falta el botón imprimir en la toolbar del shell»**: el papel
     * de Recepción es la **nota de entrada**, y la imprime la entrada cuyos **detalles están abiertos**
     * (el desglose avisa con `onExpandida`, mismo patrón que la toolbar de Revisión con el acta).
     * Las **partidas declaradas** se piden al pulsar (no en cada despliegue): son solo para el papel.
     */
    const [expandida, setExpandida] = useState<Entrada | null>(null)
    const [notaImprimible, setNotaImprimible] = useState<{
        entrada: Entrada
        partidas: PartidaEntrada[]
    } | null>(null)

    const imprimirNota = useCallback(async (e: Entrada) => {
        const r = await listarPartidasEntrada(e.id)
        setNotaImprimible({ entrada: e, partidas: r.success ? (r.data ?? []) : [] })
    }, [])

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeExportar = useCanAction(RUTA, 'exportar')

    useEffect(() => {
        let activo = true
        void listarEntradas(filtros, pagina, tamano).then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setEntradas(res.data ?? [])
            setTotal(res.total ?? 0)
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [filtros, pagina, tamano])

    const recargar = useCallback(async () => {
        setEstadoTabla('loading')
        const res = await listarEntradas(filtros, pagina, tamano)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setEntradas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstadoTabla('idle')
    }, [filtros, pagina, tamano])

    const manejarFiltros = useCallback((patch: Partial<FiltrosEntradas>) => {
        // ⭐ MEJORA 26 Sep 2026 — anunciar la recarga (ver ExistenciasCatalogo): con filas en
        // pantalla la tabla se atenúa y dice «Actualizando…» en vez de quedarse muda.
        setEstadoTabla('loading')
        setFiltros((prev) => ({ ...prev, ...patch }))
        setPagina(1)
    }, [])

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    const editable = (e: Entrada) => e.estado === 'recien_creada'
    const ajustable = (e: Entrada) =>
        ['con_dev', 'revisada_sin_dev'].includes(e.estado) && !e.id_nota

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<Entrada>({
                // ⚠️ DESCARTADO 24 Sep 2026 (usuario): `modoTactil: true` (acciones con etiqueta en
                // la fila) hacía las filas demasiado altas y anchas. Vuelven los iconos compactos
                // con las secundarias en el menú ⋯: la tabla tiene que seguir pareciendo tabla.
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver',
                        dataAccion: 'ver',
                        onClick: (e) => setDetalle(e),
                    },
                ],
                secundarias: [
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Pencil,
                                  label: 'Editar',
                                  dataAccion: 'editar',
                                  disabled: (e: Entrada) => !editable(e),
                                  onClick: (e: Entrada) => setModal({ modo: 'editar', entrada: e }),
                              },
                          ]
                        : []),
                    {
                        icon: FileText,
                        // ⭐ MEJORA 24 Sep 2026 (Fase 1) — vocabulario del piso (ley L7): el botón
                        // GENERA un documento, y ahora que va con etiqueta en la fila hay espacio.
                        // ⭐ MEJORA 27 Sep 2026 (usuario) — «Ajustar + nota»: la MISMA frase en los
                        // controles de la acción (columna Final · desglose · toolbar · ⋮ · modal),
                        // para no tener dos nombres para lo mismo (ley L7).
                        label: 'Ajustar + nota',
                        // ⭐ FIX 24 Sep 2026 — decía `dataAccion: 'editar'`, el MISMO selector que
                        // Editar: cualquier prueba/automatización por `data-accion` los confundía.
                        // Con las dos ahora dentro del menú ⋮ el choque era visible en el mismo DOM.
                        dataAccion: 'ajustar-nota',
                        disabled: (e: Entrada) => !ajustable(e),
                        onClick: (e: Entrada) => setAjuste(e),
                    },
                ],
            }),
        [puedeEditar]
    )

    // ⭐ MEJORA 20 Sep 2026 — RECEPCIÓN muestra los agregados del ingreso: partidas ·
    // piezas · total · devolución · nota de compra (necesidad del recepcionista).
    // ⭐ MEJORA 22 Sep 2026 (Fase 1) — el orden cuenta la EVOLUCIÓN que pidió el usuario:
    // Partidas · Recibidas · DEV · Final · Total (el total ya sale con la cantidad vigente;
    // el total "original" no se muestra: no aporta).
    // ⚠️ REVERTIDO 24 Sep 2026 (usuario) — se probó apilar FECHA y NOTA bajo el FOLIO para ganar
    // ~215px de ancho, y el veredicto fue claro: *«no poner la NC donde está el ingreso, eso ya se
    // ve muy mal, todo junto folio/fecha/botón… aparecen menos datos que antes y se ve mucho más
    // amontonado; se veía bien antes con la devolución en píldora al lado, la NC → regresemos»*.
    // La celda de identidad vuelve a ser SOLO el folio y fecha/nota recuperan su columna, cada una
    // con su píldora. El ancho se resuelve donde corresponde (no apilando datos en una celda).
    const columnas = useMemo<ColumnaEntrada[]>(
        () => [
            columnaFolio,
            // ⭐ MEJORA 26 Sep 2026 — EL FILTRO DE FECHA VIVE EN SU ENCABEZADO.
            // Antes era un rango dentro de la barra de filtros; ahora el embudo del `<th>`
            // «Fecha» abre el mismo `RangoFechas` del kit en un panel. El estado NO se
            // duplica: escribe sobre `filtros.fecha_desde/fecha_hasta`, el mismo par que
            // consume `listarEntradas`, así que el servidor no cambia una línea.
            {
                ...columnaFecha,
                filtro: {
                    tipo: 'rango-fechas' as const,
                    valor: { desde: filtros.fecha_desde, hasta: filtros.fecha_hasta },
                    // El parámetro va anotado: `ColumnDef` de TanStack es una unión de formas
                    // y eso derrota la inferencia contextual dentro del literal de la columna.
                    onValorChange: (rango: { desde: string; hasta: string }) =>
                        manejarFiltros({ fecha_desde: rango.desde, fecha_hasta: rango.hasta }),
                    activo: filtros.fecha_desde !== '' || filtros.fecha_hasta !== '',
                },
            },
            columnaProveedor,
            columnaPartidas,
            columnaPiezas, // «RECIBIDAS» — lo declarado
            // «DEV» — lo rechazado: píldora-botón que abre la devolución (partida · producto ·
            // motivo · estado) con el ajuste y la nota ahí mismo.
            crearColumnaDevolucion((e) => setAjuste(e)),
            // El resultado: Σ vigente — y, si el ajuste está pendiente, el BOTÓN que lo abre.
            crearColumnaFinal((e) => setAjuste(e)),
            // La NOTA con su columna: la píldora del folio (consultar) o, si falta y la entrada ya
            // se puede cerrar, la píldora «Crear» — que abre el MISMO modal donde se genera.
            crearColumnaNota(
                (e) => setNotaDetalle(e.id_nota ?? null),
                (e) => setAjuste(e)
            ),
            // El estado en el idioma de la ETAPA. «En revisión técnica» es PUERTA: abre el avance
            // de la revisión (solo lectura) con la misma tabla de ítems que despliega la Fase 2.
            crearColumnaEstadoRecepcion((e) => setAvanceRevision(e)),
            columnaAcciones,
        ],
        // ⚠️ `filtros.fecha_*` en las dependencias: el descriptor del filtro lleva el VALOR
        // dentro. Sin esto, el panel abriría siempre con las fechas de la primera pintada.
        [columnaAcciones, filtros.fecha_desde, filtros.fecha_hasta, manejarFiltros]
    )

    const acciones = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []
        if (puedeCrear) {
            lista.push({
                id: 'nuevo',
                label: 'Nueva entrada',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: () => setModal({ modo: 'crear' }),
            })
        }
        if (puedeExportar) {
            lista.push({
                id: 'exportar',
                label: 'Exportar',
                icon: Download,
                accion: 'exportar',
                variant: 'outline',
                onClick: () => {
                    void (async () => {
                        const res = await listarEntradas(filtros, 1, 1000)
                        if (!res.success || !res.data?.length) return
                        exportarEntradasCsv(res.data)
                    })()
                },
            })
        }
        // ⭐ MEJORA 27 Sep 2026 (usuario) — «falta el botón imprimir en la toolbar del shell».
        // Se activa cuando los detalles de una entrada están abiertos; apagado dice POR QUÉ.
        lista.push({
            id: 'imprimir-nota',
            label: 'Imprimir nota',
            icon: Printer,
            accion: 'ver',
            variant: 'outline',
            disabled: !expandida,
            title: expandida
                ? `Nota de entrada de ${expandida.folio}, para firmar.`
                : 'Abre los detalles de una entrada para imprimir su nota de entrada.',
            onClick: () => {
                if (expandida) void imprimirNota(expandida)
            },
        })
        return lista
    }, [puedeCrear, puedeExportar, filtros, expandida, imprimirNota])

    const filtrosBarra = useMemo(
        () => <RecepcionFilters filtros={filtros} onFiltrosChange={manejarFiltros} contador={total} />,
        [filtros, manejarFiltros, total]
    )

    usePageConfig({
        info: { title: 'Recepción', subtitle: 'Entradas' },
        path: RUTA,
        actions: acciones,
        filtros: filtrosBarra,
    })

    return (
        <>
            <DataTable<Entrada>
                columns={columnas}
                data={entradas}
                rowKey={(e) => e.id}
                estado={estadoTabla}
                emptyMessage="No hay entradas registradas."
                // ⭐ MEJORA 26 Sep 2026 — el vacío dice la verdad: «no hay entradas» y
                // «ninguna coincide con tus filtros» son dos pantallas distintas, y la
                // segunda ofrece la salida.
                filtrosActivos={hayFiltrosRecepcion(filtros)}
                onLimpiarFiltros={() => manejarFiltros(FILTROS_RECEPCION_DEFAULT)}
                onRetry={() => {
                    void recargar()
                }}
                pageSize={tamano}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                page={pagina}
                totalPages={totalPaginas}
                onPageChange={(p) => {
                    setEstadoTabla('loading')
                    setPagina(p)
                }}
                onPageSizeChange={(n) => {
                    setEstadoTabla('loading')
                    setTamano(n)
                    setPagina(1)
                }}
                // ⭐ PROMOCIÓN 20 Sep — primer consumidor de la fila expandible del kit:
                // las partidas de la entrada se ven dentro de su fila.
                // ⭐ MEJORA 22 Sep 2026: recibe la FILA completa (no solo el id) para mostrar
                // la evolución (declaradas → DEV → final) y el timeline sin otra consulta.
                // ⭐ MEJORA 34 (usuario, 27 Sep 2026) — **un detalle a la vez** (mismo acordeón que la
                // cola de Revisión): el patrón de detalles de Entradas es uno solo en las dos colas.
                unaFilaExpandida
                renderFilaExpandida={(e) => (
                    // ⭐ MEJORA 27 Sep 2026 — la toolbar del desglose lleva las puertas de la ENTRADA:
                    // «Etapas del ingreso» (las 4 etapas, solo lectura) y la nota cuando ya existe.
                    <PartidasExpandidas
                        entrada={e}
                        onAjustar={(x) => setAjuste(x)}
                        onVerEtapas={(x) => setEtapasIngreso(x)}
                        onVerNota={(x) => setNotaDetalle(x.id_nota ?? null)}
                        onImprimir={(x) => void imprimirNota(x)}
                        onExpandida={setExpandida}
                    />
                )}
                // ⚠️ DESCARTADO 24 Sep 2026 (usuario): se probó rotular el control de despliegue
                // («2 partidas» → «Ocultar») y se vio **exagerado** — pidió «mínimo como estaba,
                // solo la flechita». El kit volvió a su chevron y aquí no se pasa etiqueta.
                // ⚠️ DESCARTADO 24 Sep 2026 (usuario): se probó el MODO TÁCTIL del puesto
                // (`modoTactil`: objetivos de 44px y acciones con etiqueta) y el veredicto fue
                // «salen unas filas muy grandes, ya no parece tabla… la intención es que se vea
                // mayor información en una fila». Recepción vuelve a la densidad del kit; el eje
                // `modoTactil` queda en el kit para un puesto que de verdad se opere con el dedo.
                showColumnSelector
            />
            <EntradaModal
                open={modal !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setModal(null)
                }}
                modo={modal?.modo === 'editar' ? 'editar' : 'crear'}
                entrada={modal?.modo === 'editar' ? modal.entrada : null}
                onGuardado={() => {
                    void recargar()
                }}
            />
            <EntradaDetailModal
                open={detalle !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setDetalle(null)
                }}
                entrada={detalle}
            />
            <AjusteDevModal
                key={ajuste?.id ?? 'ninguna'}
                open={ajuste !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setAjuste(null)
                }}
                entrada={ajuste}
                onGuardado={() => {
                    void recargar()
                }}
            />
            <NotaCompraDetalleModal
                open={notaDetalle !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setNotaDetalle(null)
                }}
                notaId={notaDetalle}
            />
            {/* ⭐ MEJORA 24 Sep 2026 — el avance de la revisión, visto desde Recepción.
                `key` CALIFICADA (`avance-…`): cada entrada abre su propio estado y «cargando»
                arranca limpio sin un `setState` dentro del efecto (patrón `AjusteDevModal`).
                ⚠️ FIX 24 Sep 2026 (reportado por el usuario con la BD vacía): la `key` SIN
                calificar chocaba con la de `AjusteDevModal` —dos hermanos con la MISMA key
                (`'ninguna'`) cuando los dos están cerrados → «Encountered two children with the
                same key, `ninguna`»—. Y también habrían chocado las dos **abiertas sobre la misma
                entrada**, porque ambas usan `entrada.id`. El placeholder calificado es el patrón
                que ya usa `RevisionCatalogo` (`lib-…`). */}
            <AvanceRevisionModal
                key={`avance-${avanceRevision?.id ?? 'ninguna'}`}
                open={avanceRevision !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setAvanceRevision(null)
                }}
                entrada={avanceRevision}
            />
            {/* ⭐ MEJORA 27 Sep 2026 — la toolbar de detalles abre las 4 etapas del ingreso.
                `key` calificada (`etapas-…`): el padre la monta por entrada, así que cada una abre su
                propio estado y la etapa inicial sale del primer render (patrón `AvanceRevisionModal`). */}
            <EtapasIngresoModal
                key={`etapas-${etapasIngreso?.id ?? 'ninguna'}`}
                open={etapasIngreso !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setEtapasIngreso(null)
                }}
                entrada={etapasIngreso}
            />
            {/* ⭐ MEJORA 27 Sep 2026 — el papel de Recepción, imprimible desde las DOS toolbars
                (la del shell y la de detalles). Mismo documento que el expediente.
                ⭐ MEJORA 27 Sep 2026 (carril de plantillas) — pasa por `DocumentoImprimible`:
                si el tipo `nota_entrada` tiene una plantilla ACTIVA en la BD, se imprime ESA
                (el diseño que el usuario armó en /dashboard/sistema/plantillas); si no, el
                respaldo en código imprime lo de siempre. Desactivar la plantilla vuelve acá. */}
            <DocumentoImprimible
                tipo="nota_entrada"
                datos={
                    notaImprimible
                        ? construirDatosNotaEntrada(notaImprimible.entrada, notaImprimible.partidas)
                        : {}
                }
                open={notaImprimible !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setNotaImprimible(null)
                }}
                titulo="Nota de entrada"
                nombreArchivo={`entrada-${notaImprimible?.entrada.folio ?? 'sin-folio'}`}
                fallback={NotaEntradaImprimible}
            />
        </>
    )
}
