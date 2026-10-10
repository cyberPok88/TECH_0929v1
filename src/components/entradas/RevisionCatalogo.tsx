'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// REVISION CATALOGO — Cola del técnico (Guía 1.6 · P3 · Smart)
// Lista todas las entradas; "Revisar" (pendiente) abre el wizard · "Resultado"
// (revisada+) abre el resumen. Paginación servidor.
// ⭐ 06 Oct 2026 (Fase 2 · mockup aprobado) — el **chevron YA NO DESPLIEGA la fila**: abre
// `AvanceRevisionModal` con el mismo desglose (`PartidasAvance enModal`), ya interactivo.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, ScanLine } from 'lucide-react'

import { DataTable } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { listarEntradas } from '@/lib/actions/entradas'
import { useAvisosEntradasStore, useContadorEtapa } from '@/lib/stores/avisos-entradas-store'
import type { Entrada, FiltrosEntradas, PartidaConAvance } from '@/types/entradas'
import {
    RevisionFilters,
    FILTROS_REVISION_DEFAULT,
    estadosDeVista,
    hayFiltrosRevision,
} from '@/components/entradas/RevisionFilters'
import { WizardRevision } from '@/components/entradas/revision/WizardRevision'
import { ResultadoRevisionModal } from '@/components/entradas/ResultadoRevisionModal'
import { AvanceRevisionModal } from '@/components/entradas/AvanceRevisionModal'
import { AjusteDevModal } from '@/components/entradas/AjusteDevModal'
import { LiberarAvanceModal } from '@/components/entradas/LiberarAvanceModal'
import { DocumentoImprimible } from '@/components/imprimibles'
import { ActaRevisionImprimible } from '@/components/entradas/imprimibles/ActaRevisionImprimible'
import { construirDatosActaRevision } from '@/components/entradas/imprimibles/datos-acta-revision'
import type { ToolbarAction } from '@/types/shell'
import {
    columnaAvanceRevision,
    columnaEstadoRevision,
    columnaFecha,
    columnaFolio,
    columnaPartidas,
    columnaProveedor,
    type ColumnaEntrada,
} from '@/components/entradas/columnas-entrada'

const RUTA = '/dashboard/entradas/revision'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

// ⭐ MEJORA 24 Sep 2026 — de UNA sola fuente: los estados «A revisar» son los mismos que filtra la
// cola (`RevisionFilters`). Antes era un literal suelto que podía desincronizarse del filtro.
const PENDIENTES = new Set<string>(estadosDeVista('revisar'))

export function RevisionCatalogo() {
    const [entradas, setEntradas] = useState<Entrada[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosEntradas>(FILTROS_REVISION_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [revisando, setRevisando] = useState<Entrada | null>(null)
    const [partidaInicial, setPartidaInicial] = useState<string | undefined>(undefined)
    const [resultado, setResultado] = useState<Entrada | null>(null)
    // ⭐ MEJORA 24 Sep 2026 (Fase 2) — la DEV abierta desde la píldora «n malas» de una partida.
    const [devEntrada, setDevEntrada] = useState<Entrada | null>(null)
    const [devPartida, setDevPartida] = useState<string | null>(null)
    // ⭐ MEJORA 25 — la liberación parcial. Una sola instancia del modal, DOS puertas: la píldora
    // «n listas» de la cola y el botón «Liberar» del desglose (y el pie del wizard).
    const [liberarEntrada, setLiberarEntrada] = useState<Entrada | null>(null)
    const [liberarPartida, setLiberarPartida] = useState<string | null>(null)
    /** ⭐ MEJORA 28 — la huella exacta cuando la partida rindió varias marcas. */
    const [liberarGrupo, setLiberarGrupo] = useState<string | null>(null)
    /**
     * ⭐ FIX 25 Sep 2026 (usuario) — **el desglose también se refresca**. El desglose trae sus
     * propios datos (`listarPartidasConAvance`) en un `useState` con `useEffect`, así que recargar la
     * LISTA no lo toca: al liberar, la fila que se abrió seguía mostrando sus «Liberar n» y sus cifras
     * viejas *«hasta que cierro los detalles y los vuelvo a abrir»*. Este contador entra en las
     * dependencias del efecto del desglose. Sube al guardar la liberación, el ajuste de la DEV y el
     * wizard (los tres cambian lo que el desglose pinta).
     * ⭐ 06 Oct 2026 — el desglose vive en el MODAL: el contador se le pasa a `AvanceRevisionModal`
     * (mismo contrato), y el efecto que re-consulta es el suyo.
     */
    const [refresco, setRefresco] = useState(0)
    /**
     * ⭐ MEJORA 34 (usuario) — **quién es «el detalle abierto» para la toolbar de la PÁGINA**.
     * El desglose le presta sus datos (`onDatos`) y al cerrarse los suelta; el botón «Imprimir
     * revisión» apunta al último que sigue abierto.
     * ⭐ 06 Oct 2026 (gate G8) — **la fuente CAMBIÓ**: era el `onDatos` de la fila expandida (el
     * contenedor que este cambio retiró) y ahora es el `onDatos` de `AvanceRevisionModal`. Sin
     * re-apuntarla, el botón de la toolbar quedaba apagado para siempre. El contrato es idéntico.
     */
    const [abiertos, setAbiertos] = useState<
        { entrada: Entrada; partidas: PartidaConAvance[] }[]
    >([])
    /**
     * ⭐ 06 Oct 2026 — la entrada cuyo desglose se está mirando en el MODAL. Es PRESENTACIONAL
     * (SPEC §5③): no carga nada ni decide permisos — la carga y las 4 acciones las sigue resolviendo
     * este catálogo, que es donde están sus efectos.
     */
    const [detalleRevision, setDetalleRevision] = useState<Entrada | null>(null)
    const [acta, setActa] = useState(false)
    /**
     * ⚠️ Memoizado: entra en las dependencias del efecto del desglose (si cambiara, re-consultaría).
     * ⭐ 06 Oct 2026 — lo alimenta el `onDatos` del **modal** (antes, el de la fila expandida).
     */
    const alCargarDesglose = useCallback(
        (idEntrada: string, datos: { entrada: Entrada; partidas: PartidaConAvance[] } | null) => {
            setAbiertos((prev) => {
                const otros = prev.filter((d) => d.entrada.id !== idEntrada)
                return datos ? [...otros, datos] : otros
            })
        },
        []
    )
    /**
     * El objetivo de la impresión de la página: el detalle abierto del que se tienen datos.
     * ⭐ 06 Oct 2026 — con el desglose en un MODAL hay UNO a la vez (el acordeón lo garantizaba
     * antes con `unaFilaExpandida`): la lista conserva su forma —soltar uno y agregar otro— porque
     * el contrato de `onDatos` es el mismo y así la toolbar no cambia una línea.
     */
    const detalle = abiertos[abiertos.length - 1] ?? null

    const puedeEditar = useCanAction(RUTA, 'editar')

    /**
     * ⭐ MEJORA 53 (09 Oct 2026) — **LA COLA SE DESPIERTA SOLA.** Este contador sube cuando
     * Realtime avisa que llegó trabajo a ESTA etapa (lo publica `AvisosEntradas`, montado una
     * sola vez en el layout del dashboard: entre hermanos no hay props que bajen). Entra en las
     * dependencias del efecto de carga y con eso la fila nueva aparece **sin recargar la
     * página** — que es literalmente el pedido del dueño del 09 Oct 2026.
     * ⚠️ NO se reusa el `refresco` de abajo: aquel es del DESGLOSE (lo sube guardar/liberar) y
     *    mezclarlos haría que un aviso ajeno recargara el modal abierto. Son dos relojes.
     */
    const avisoRevision = useContadorEtapa('revision')

    /**
     * ⭐ MEJORA 54 (09 Oct 2026) — **LA SEGUNDA PUERTA DEL PULSO.** La marca de «nueva»
     * (módulo `MarcaNueva`) tiene dos razones: la RECENCIA se apaga sola con el reloj, y el
     * PULSO —el «llegó mientras mirabas»— se apaga cuando el operario **abre** la entrada.
     * Esta cola tiene **dos caminos** para abrirla y los dos lo apagan: el **chevron**
     * (`onDesplegar`) y el botón **«Revisar ahora»**. Es la decisión del dueño del 09 Oct
     * 2026 (*«al abrir la entrada»*), tomada sobre las dos puertas reales y no sobre una.
     */
    const apagarNuevaEnVivo = useAvisosEntradasStore((s) => s.apagarNuevaEnVivo)

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
    }, [filtros, pagina, tamano, avisoRevision])

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
        // ⭐ 06 Oct 2026 — EL DETALLE ABIERTO SE RE-APUNTA AL OBJETO FRESCO, igual que en Recepción.
        // Mientras el desglose vivía en la fila, la recarga lo refrescaba SOLA: el padre reemplazaba
        // los objetos y el efecto del contenedor retirado (que dependía de `entrada`) volvía a correr.
        // El modal guarda su propia entrada, así que sin esto se quedaría mostrando el estado viejo
        // justo después de ajustar la DEV o liberar (que es lo que acaba de pasar detrás). No cambia
        // el alcance: es la MISMA entrada, con el objeto recargado.
        setDetalleRevision((prev) =>
            prev ? ((res.data ?? []).find((e) => e.id === prev.id) ?? prev) : prev
        )
    }, [filtros, pagina, tamano])

    const manejarFiltros = useCallback((patch: Partial<FiltrosEntradas>) => {
        // ⭐ MEJORA 26 Sep 2026 — anunciar la recarga (ver ExistenciasCatalogo).
        setEstadoTabla('loading')
        setFiltros((prev) => ({ ...prev, ...patch }))
        setPagina(1)
    }, [])

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    // ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — LA ACCIÓN, EN VERSIÓN TÁCTIL.
    // ⚠️ Se RETIRA `crearColumnaAcciones` (iconos + menú ⋯) de esta fase: en un puesto de dedo el
    // ⋯ obliga a apuntar a 24px y elegir a ciegas, y el diseño aprobado
    // (`DOCS/design/entradas/02-revision/revision-puesto-tactil.html` §2) pide **un botón con etiqueta**.
    //
    // ⚠️ 25 Sep 2026 (usuario) — AQUÍ vivió «Liberar n» y **se retira**, por dos razones medidas:
    //  (1) **No es el paso siguiente.** La decisión **22.a** del mapa pone la entrega en el WIZARD
    //      (*«el wizard tiene dos acciones: Guardar avance y Liberar a acondicionamiento»*): en la
    //      fila de la cola se leía como «lo que sigue es liberar», que es justo lo que el usuario
    //      señaló. La puerta sigue en el desglose por partida y en el pie del wizard.
    //  (2) **Ofrecía una acción imposible.** Se pintaba con `listas > 0` sin mirar el estado: de las
    //      8 entradas vivas salía en las **7 ya avanzadas** (`ajustada`/`revisada_sin_dev`, todas con
    //      aprobadas y 0 liberadas) y **no** salía en la única liberable (`ING-0008`, 24/24 ya
    //      liberadas) → el servidor respondía «La entrada ya avanzó…» y no pasaba nada.
    const columnaAccion = useMemo<ColumnaEntrada>(
        () => ({
            id: 'accion',
            label: 'Acción',
            movil: 'critica',
            size: 184,
            render: (_valor, fila) => {
                if (!PENDIENTES.has(fila.estado)) {
                    return (
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-[52px] w-full"
                            onClick={() => setResultado(fila)}
                        >
                            Ver resultado
                        </Button>
                    )
                }
                return (
                    <Button
                        type="button"
                        className="min-h-[52px] w-full"
                        disabled={!puedeEditar}
                        title={puedeEditar ? undefined : 'No tienes permiso para revisar entradas.'}
                        onClick={() => {
                            // ⭐ MEJORA 54 — ABRIR la entrada apaga el pulso de «nueva»
                            // (decisión del dueño, 09 Oct 2026). La marca por RECENCIA
                            // se queda: eso es un hecho con fecha, no una novedad.
                            apagarNuevaEnVivo(fila.id)
                            setPartidaInicial(undefined)
                            setRevisando(fila)
                        }}
                    >
                        <ScanLine className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Revisar ahora
                    </Button>
                )
            },
        }),
        // ⚠️ `apagarNuevaEnVivo` va en las dependencias (MEJORA 54): es un MÉTODO del
        // store —referencia estable, así que no re-crea la columna— pero dejarlo fuera
        // enciende el warning de `exhaustive-deps`, y un warning nuevo tapa los 5 viejos.
        [puedeEditar, apagarNuevaEnVivo]
    )

    // ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — la cola del técnico.
    // · `columnaAvanceRevision` (③) sustituye a «RECIBIDAS»: al técnico no le dice nada cuántas
    //   llegaron, le dice cuánto lleva revisado de lo que llegó.
    // · `columnaEstadoRevision` habla la ETAPA (verbo + antigüedad) en vez del documento.
    // · `columnaAccion` es un botón con etiqueta, no un menú ⋯ (④ táctil).
    // · FUERA `columnaResultado`: «Con malas» / «Sin malas» no distingue 1 de 40 malas; el conteo
    //   real vive en el desglose, junto a la devolución que lo produce (diseño §2/§3).
    const columnas = useMemo<ColumnaEntrada[]>(
        () => [
            columnaFolio,
            // ⭐ MEJORA 26 Sep 2026 — EL FILTRO DE FECHA VIVE EN SU ENCABEZADO (mismo contrato
            // que Recepción): el embudo del `<th>` «Fecha» abre el `RangoFechas` del kit y
            // escribe sobre `filtros.fecha_desde/fecha_hasta`, el mismo par que consume la
            // Server Action. El servidor no cambia una línea.
            {
                ...columnaFecha,
                // Anotado: `ColumnDef` de TanStack es una unión de formas y derrota la
                // inferencia contextual dentro del literal de la columna.
                filtro: {
                    tipo: 'rango-fechas' as const,
                    valor: { desde: filtros.fecha_desde, hasta: filtros.fecha_hasta },
                    onValorChange: (rango: { desde: string; hasta: string }) =>
                        manejarFiltros({ fecha_desde: rango.desde, fecha_hasta: rango.hasta }),
                    activo: filtros.fecha_desde !== '' || filtros.fecha_hasta !== '',
                },
            },
            columnaProveedor,
            columnaPartidas,
            // ⭐ 25 Sep 2026 — la celda del avance quedó SOLO con cifra + barra (una línea): la
            // puerta «Liberar n» se movió a `columnaAccion`.
            columnaAvanceRevision,
            columnaEstadoRevision,
            columnaAccion,
        ],
        // ⚠️ `filtros.fecha_*` en las dependencias: el descriptor lleva el VALOR dentro; sin
        // esto el panel abriría siempre con las fechas de la primera pintada.
        [columnaAccion, filtros.fecha_desde, filtros.fecha_hasta, manejarFiltros]
    )

    const filtrosBarra = useMemo(
        () => <RevisionFilters filtros={filtros} onFiltrosChange={manejarFiltros} contador={total} />,
        [filtros, manejarFiltros, total]
    )

    /**
     * ⭐ MEJORA 34 (usuario) — **«Imprimir revisión» en la toolbar de la PÁGINA**, y se **activa cuando
     * los detalles de una entrada están abiertos**: el desglose le presta sus datos (`onDatos`) y
     * mientras no haya ninguno abierto el botón queda **apagado diciendo por qué** (`title`) — la SPEC
     * §2.3 prohíbe deshabilitar sin motivo.
     * 🔴 G8 (06 Oct 2026) — la fuente de `detalle` se **re-apuntó al modal**: era la fila expandida,
     * que este cambio retira. Sin esto el botón quedaba apagado para siempre (una regresión, no un
     * detalle). El texto del `disabled` NO se cataloga: es **bandera** (vaciarlo dejaría el botón mudo).
     */
    const acciones = useMemo<ToolbarAction[]>(
        () => [
            {
                id: 'imprimir-revision',
                label: 'Imprimir revisión',
                icon: Printer,
                accion: 'ver',
                variant: 'outline',
                disabled: !detalle,
                title: detalle
                    ? `Acta de revisión de ${detalle.entrada.folio}, para firmar.`
                    : 'Abre los detalles de una entrada para imprimir su acta de revisión.',
                onClick: () => setActa(true),
            },
        ],
        [detalle]
    )

    usePageConfig({
        info: { title: 'Revisión', subtitle: 'Entradas' },
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
                // SPEC §2.5 — el vacío va en el idioma del operador y en negativo explícito
                // («No hay entradas registradas.»), no «Sin datos» a secas.
                emptyMessage="No hay entradas registradas."
                // ⭐ MEJORA 26 Sep 2026 — «no hay entradas» ≠ «ninguna coincide con tus filtros».
                filtrosActivos={hayFiltrosRevision(filtros)}
                onLimpiarFiltros={() => manejarFiltros(FILTROS_REVISION_DEFAULT)}
                // ⭐ ④ PROMOCIÓN 24 Sep 2026 — la Revisión es un PUESTO DE TRABAJO TÁCTIL: se
                // opera con el dedo en tablet o pantalla touch, no con ratón. `modoTactil` fuerza
                // la densidad de dedo aunque el ancho de la tablet (1024–1280px) hiciera que el
                // kit eligiera «compacto» = objetivos de 32px.
                modoTactil
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
                // ⭐ 06 Oct 2026 (Fase 2 · mockup aprobado · decisión D1-A) — **EL CHEVRON YA NO
                // DESPLIEGA LA FILA: ABRE EL MODAL** (el opt-in `DataTable.onDesplegar`, el mismo
                // que estrenó Recepción). El desglose vivía dentro de la fila y competía con la
                // lista: la empujaba ≈260px con 1 partida y ≈1100px con 16, la teñía y perdía el
                // scroll. Acá solo se elige QUÉ entrada se mira; el contenido, la carga y las
                // acciones los resuelve el `PartidasAvance` que hospeda el modal.
                // ⚠️ Ya NO se pasa `renderFilaExpandida` (ni `unaFilaExpandida`): la tabla, sus
                // columnas, sus filtros y su toolbar NO cambian — solo cambia a dónde lleva el
                // chevron. El acordeón «un detalle a la vez» (MEJORA 34) queda cubierto por el
                // propio modal: siempre hay UN detalle abierto. ⚠️ El camino viejo sigue intacto
                // para los CRUDs que SÍ despliegan la fila (Acondicionamiento · Alta · Notas).
                onDesplegar={(e) => {
                    // ⭐ MEJORA 54 — la 1ª de las dos puertas que apagan el pulso (ver arriba).
                    apagarNuevaEnVivo(e.id)
                    setDetalleRevision(e)
                }}
                // ⭐ El nombre accesible del chevron dice el FOLIO, no el UUID de la fila
                // («Abrir ING-0004» en vez de «Abrir la fila 94a2cbe9-…»).
                etiquetaFila={(e) => e.folio}
                showColumnSelector
            />
            {/* La devolución de la partida (②): el MISMO modal de Recepción, acotado a esa partida
                — una puerta, dos profundidades. `key` para que cada partida abra su propio estado. */}
            <AjusteDevModal
                key={`${devEntrada?.id ?? 'sin'}-${devPartida ?? 'todas'}`}
                open={devEntrada !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) {
                        setDevEntrada(null)
                        setDevPartida(null)
                    }
                }}
                entrada={devEntrada}
                idPartidaFiltro={devPartida}
                onGuardado={() => {
                    void recargar()
                    // ⭐ FIX 25 Sep 2026 — el desglose de ESTA entrada se vuelve a consultar: sin
                    // esto, lo que acaba de cambiar seguía viéndose viejo hasta cerrar el acordeón.
                    setRefresco((n) => n + 1)
                }}
            />
            {/* ⭐ 06 Oct 2026 — **EL DESGLOSE DE LA REVISIÓN, EN MODAL**: el chevron de la fila ya
                no la despliega, abre esto (mismo contenido: `PartidasAvance enModal`).
                🔴 G7 — las 4 puertas bajan del CRUD: el modal las REENVÍA al desglose y jamás las
                inventa. El modal no mira permisos; si una puerta no llega, no se pinta.
                `key` CALIFICADA (`detalle-…`, gate G6): hay hermanos montados con `key` y una
                cuarta con el placeholder SIN calificar chocaría con `WizardRevision` —los dos
                cerrados son `'ninguna'`— → «Encountered two children with the same key,
                ninguna», el defecto medido el 24 Sep 2026. */}
            <AvanceRevisionModal
                key={`detalle-${detalleRevision?.id ?? 'ninguna'}`}
                open={detalleRevision !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setDetalleRevision(null)
                }}
                entrada={detalleRevision}
                // ⭐ FIX 25 Sep 2026 — ESTA cola se opera con el dedo (el mismo `modoTactil` que
                // lleva la tabla): sus puertas miden 44, no los 32 del kit. Se REENVÍA; no se
                // deduce del ancho.
                tactil
                onIniciar={(idPartida) => {
                    setPartidaInicial(idPartida)
                    setRevisando(detalleRevision)
                }}
                onVerDev={(entrada, idPartida) => {
                    setDevPartida(idPartida)
                    setDevEntrada(entrada)
                }}
                onVerResultado={(entrada) => setResultado(entrada)}
                onLiberar={(entrada, idPartida, idGrupo) => {
                    setLiberarPartida(idPartida)
                    setLiberarGrupo(idGrupo ?? null)
                    setLiberarEntrada(entrada)
                }}
                // 🔴 G8 — el desglose del modal le PRESTA sus datos a la toolbar de la PÁGINA: es la
                // fuente que reemplaza al `onDatos` de la fila expandida, que este cambio retiró.
                // Sin esto, «Imprimir revisión» quedaba apagado para siempre.
                onDatos={alCargarDesglose}
                // ⭐ FIX 25 Sep 2026 — y se re-consulta cuando algo cambia lo que pinta.
                refresco={refresco}
            />
            <WizardRevision
                key={revisando?.id ?? 'ninguna'}
                open={revisando !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) {
                        setRevisando(null)
                        setPartidaInicial(undefined)
                    }
                }}
                entrada={revisando}
                partidaInicialId={partidaInicial}
                onLiberar={(entrada, idPartida, idGrupo) => {
                    setLiberarPartida(idPartida)
                    setLiberarGrupo(idGrupo ?? null)
                    setLiberarEntrada(entrada)
                }}
                onGuardado={() => {
                    void recargar()
                    // ⭐ FIX 25 Sep 2026 — el desglose de ESTA entrada se vuelve a consultar: sin
                    // esto, lo que acaba de cambiar seguía viéndose viejo hasta cerrar el acordeón.
                    setRefresco((n) => n + 1)
                }}
            />
            {/* ⭐ MEJORA 25 — la liberación parcial (decisión 22). La entrada NO cambia de estado:
                lo que sale es mercancía, hacia la cola de limpieza. */}
            <LiberarAvanceModal
                key={`lib-${liberarEntrada?.id ?? 'sin'}-${liberarPartida ?? 'todas'}-${liberarGrupo ?? 'todos'}`}
                open={liberarEntrada !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) {
                        setLiberarEntrada(null)
                        setLiberarPartida(null)
                    }
                }}
                entrada={liberarEntrada}
                idPartidaFiltro={liberarPartida}
                idGrupoFiltro={liberarGrupo}
                onGuardado={() => {
                    void recargar()
                    // ⭐ FIX 25 Sep 2026 — el desglose de ESTA entrada se vuelve a consultar: sin
                    // esto, lo que acaba de cambiar seguía viéndose viejo hasta cerrar el acordeón.
                    setRefresco((n) => n + 1)
                }}
            />
            <ResultadoRevisionModal
                open={resultado !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setResultado(null)
                }}
                entrada={resultado}
            />
            {/* ⭐ MEJORA 34 — el acta que imprime la toolbar de la página. Mismo documento que el de la
                toolbar de detalles: una sola plantilla, dos puertas.
                ⭐ MEJORA 41 (29 Sep 2026 · carril PLANTILLA) — pasa por `DocumentoImprimible`: si el
                tipo `acta_revision` tiene plantilla ACTIVA se imprime ESA; si no, el respaldo en
                código. El papel ya no está hardcodeado ni lleva el membrete escrito a mano. */}
            <DocumentoImprimible
                tipo="acta_revision"
                datos={detalle ? construirDatosActaRevision(detalle.entrada, detalle.partidas) : {}}
                open={acta}
                onOpenChange={setActa}
                titulo={`Acta de revisión · ${detalle?.entrada.folio ?? ''}`}
                nombreArchivo={`acta-revision-${detalle?.entrada.folio ?? 'entrada'}`}
                fallback={ActaRevisionImprimible}
            />
        </>
    )
}
