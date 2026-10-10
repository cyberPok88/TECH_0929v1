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
// Diseño aprobado: `DOCS/design/entradas/03-acondicionamiento/liberacion-parcial-revision-acondicionamiento.html` §5 ·
// `DOCS/design/entradas/04-almacen/almacen-hub-cotejo-por-tanda.html` §2 (opción B, agrupada por entrada).
//
// ⭐ 06 Oct 2026 (Guía 1.6 · Fase 3 · mockup aprobado `DOCS/design/entradas/03-acondicionamiento/01-detalle-acondicionamiento.html`)
// — **EL CHEVRON YA NO DESPLIEGA LA FILA: ABRE EL MODAL DEL DETALLE** (decisión del dueño **D1-A**,
// tercera aplicación del patrón). El desglose vivía dentro de la fila y **competía con la lista**:
// la empujaba **303px** con 1 partida/1 producto y **1175px** con 6 partidas/12 productos (medido en
// el mockup), la teñía y perdía el scroll. Ahora la fila **mide 68px y no se mueve**, y el desglose
// vive en `AcondicionamientoDetalleModal`, que hospeda la MISMA pieza (`BandejasDeIngreso enModal`):
// **una sola fuente del display**. Acá sólo se elige QUÉ ingreso se mira.
//
// ⚠️ LO QUE CAMBIA EN ESTE CATÁLOGO, y nada más (gate G2): ① `onDesplegar` + `etiquetaFila` (el folio,
// no el UUID), ② **deja de pasar** `renderFilaExpandida`/`unaFilaExpandida`, ③ monta el modal. ⚠️ El
// acordeón «un detalle a la vez» (MEJORA 27) queda cubierto por el propio modal: siempre hay UNO.
//
// 🔴 EL EQUIVALENTE DE G8 DE REVISIÓN **NO APLICA ACÁ**, y se midió: en Revisión el botón «Imprimir
// revisión» de la toolbar de la PÁGINA se alimentaba del desglose de la fila (`onDatos`) y al retirar
// ese contenedor había que re-apuntar su fuente. **Esta página no tiene ninguna acción en su toolbar**
// (`usePageConfig` se llama con `info`/`path`/`filtros`, sin `actions`) y lo único que resume la cola
// —«N ingresos · M bandejas»— sale del estado de la PÁGINA (`ingresos.length`/`bandejas.length`), no
// del desglose de una fila ⇒ **no hay fuente que re-apuntar**.
//
// ⭐ Y las AYUDAS: el módulo **nace** en `config/ayudas/acondicionamiento.ts` (medido: no existía, y
// este archivo tenía 3 `title` inline y **0 `useAyuda`** ⇒ su explicación no se podía apagar).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageCheck, PackageOpen, Sparkles } from 'lucide-react'

import { DataTable } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { textoAyuda, useAyuda } from '@/components/ui/Ayuda'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { useAuth } from '@/lib/stores/auth-store'
import { useContadorEtapa } from '@/lib/stores/avisos-entradas-store'
import {
    entregarTodoDeIngreso,
    listarBandejas,
    listarEntradas,
    tomarTodoDeIngreso,
} from '@/lib/actions/entradas'
import type { BandejaLiberada, Entrada, EstadoEntrada, EstadoTanda } from '@/types/entradas'
import { FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { AcondicionamientoDetalleModal } from '@/components/entradas/AcondicionamientoDetalleModal'
import { AcondicionamientoModal } from '@/components/entradas/AcondicionamientoModal'
import { TandaAcondicionamientoModal } from '@/components/entradas/TandaAcondicionamientoModal'
import {
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
    /**
     * ⭐ 06 Oct 2026 (Fase 3 · decisión D1-A) — **el ingreso cuyo desglose se está mirando en el
     * MODAL**. El chevron ya no despliega la fila: la elige. Guarda el objeto (no el id) porque es
     * el MISMO `IngresoEnCola` que alimenta la fila — la pieza recibe sus `bandejas` y su `folio` ya
     * cargados.
     */
    const [detalle, setDetalle] = useState<IngresoEnCola | null>(null)

    const puedeEditar = useCanAction(RUTA, 'editar')

    // ═══════════════════════════════════════════════════════════════════════════
    // ⭐ 06 Oct 2026 · LAS AYUDAS DE PANTALLA (mockup aprobado · `config/ayudas/acondicionamiento.ts`)
    //
    // Hasta hoy este archivo escribía sus explicaciones como `title` **inline** y no importaba
    // `useAyuda` (medido: 0 apariciones) ⇒ **no se podían apagar**. Ahora las 4 que este catálogo
    // construye salen del registro y se prenden/apagan por módulo, categoría y texto suelto.
    //
    // ⚠️ Lo que **NO** se cataloga, a propósito (clasificador del estándar · §1.2 del mockup):
    //   · el **porqué de un control apagado** («Esta tanda ya salió de acondicionamiento.» · «No
    //     tienes permiso para acondicionar.» · «No queda nada por limpiar en este ingreso.») es
    //     **BANDERA**: vaciarla dejaría el botón mudo y el puesto creería que puede;
    //   · la **frase de conteo** de Z1 y el **saldo** de la columna son **DATO** (la fila de estado
    //     del puesto) — el interruptor apaga explicaciones, jamás el estado.
    // ═══════════════════════════════════════════════════════════════════════════
    const ayudaLimpiarTodas = useAyuda('acondicionamiento.limpiar-todas')
    const ayudaEntregarTodo = useAyuda('acondicionamiento.entregar-todo')
    /**
     * ⚠️ Las 2 ayudas de la ACCIÓN DE LA BANDEJA van por `textoAyuda` (no por `useAyuda`): su texto
     * lleva `{n}` y el número es **de la fila que se está pintando** ⇒ el hook no sirve (el
     * `.map()` de la sub-tabla no es un componente). Es la tercera forma del estándar, y por eso
     * acá se leen las preferencias: las dos claves se consumen unas líneas más abajo.
     */
    const preferenciasAyudas = useAuth((s) => s.usuario?.preferencias?.ayudas)

    const estadosTanda = useMemo(
        () => CHIPS_TANDA.find((c) => c.id === chipTanda)?.estados ?? [],
        [chipTanda]
    )

    /**
     * ⭐ MEJORA 53 (09 Oct 2026) — **ESTA ETAPA TIENE DOS PUERTAS Y LAS DOS SE DESPIERTAN**:
     * la mercancía llega como **tanda** (`liberaciones_entrada`, que NO mueve
     * `entradas.estado`) o como **documento** (la entrada `ajustada` / `recien_creada` sin
     * revisión). El contador entra en las dependencias de los DOS efectos de carga.
     */
    const avisoAcondicionamiento = useContadorEtapa('acondicionamiento')

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
    }, [estadosTanda, avisoAcondicionamiento])

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
    }, [avisoAcondicionamiento])

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
        /**
         * ⭐ 06 Oct 2026 (gate **G9** · el refresco) — **EL DETALLE ABIERTO SE RE-APUNTA AL OBJETO
         * FRESCO**, igual que hizo Revisión. Mientras el desglose vivía en la fila, la recarga lo
         * refrescaba SOLA (el padre reemplazaba los objetos y el contenedor retirado dependía de la
         * entrada); el modal guarda su propio `IngresoEnCola` ⇒ sin esto seguiría mostrando la
         * bandeja en el estado anterior —ofreciendo otra vez una acción que ya se ejecutó— justo
         * después de iniciar/entregar una bandeja o de disparar la acción masiva.
         *
         * ⚠️ Y cuando el ingreso **ya no está en la cola** (su última bandeja salió del puesto y su
         * documento no espera nada acá) el detalle se suelta: **`null`, no `prev`**. Es la única
         * diferencia deliberada con Revisión —allá el modal re-consulta su contenido por su cuenta y
         * el objeto viejo sólo aporta la cabecera; acá **el contenido ES `i.bandejas`**, así que
         * conservarlo sería mostrar una bandeja en un estado que ya cambió.
         *
         * ⚠️ Se re-apunta SÓLO si las DOS consultas volvieron bien: si alguna falla, el estado de
         * error lo pinta la tabla y este detalle se queda con lo último bueno que tenía.
         */
        if (resBandejas.success && resDocumentos.success) {
            const frescos = agruparPorIngreso(
                resBandejas.data ?? [],
                (resDocumentos.data ?? []).filter(Acondicionable)
            )
            setDetalle((prev) =>
                prev
                    ? (frescos.find((i) => i.id_entrada === prev.id_entrada) ?? null)
                    : prev
            )
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
                // ⚠️ DOS textos distintos según el momento (y son de dos clases distintas):
                //   · APAGADO ⇒ **bandera** (el porqué), inline: vaciarla dejaría el botón mudo;
                //   · ENCENDIDO ⇒ **nota** catalogada, que explica qué va a pasar y con cuántas
                //     piezas (MEJORA 47 · `config/ayudas/acondicionamiento.ts`).
                // Va con `textoAyuda` y no con `useAyuda` porque el `{n}` es de LA FILA (aquí no se
                // puede llamar un hook: este callback no es un componente) — la tercera forma del
                // estándar, la misma que usan las acciones de `PartidasAvance`.
                // `|| undefined` para que una ayuda apagada deje el botón SIN `title` (no vacío).
                title: cerrada
                    ? 'Esta tanda ya salió de acondicionamiento.'
                    : !puedeEditar
                      ? 'No tienes permiso para acondicionar.'
                      : textoAyuda(
                            b.estado === 'en_limpieza'
                                ? 'acondicionamiento.detalle-entregar'
                                : 'acondicionamiento.detalle-iniciar',
                            preferenciasAyudas,
                            { n: b.piezas }
                        ) || undefined,
                onClick: () => setBandejaSel(b),
            }
        },
        [puedeEditar, preferenciasAyudas]
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
                if (!puedeEditar) return null
                const e = i.entrada
                /**
                 * ⭐ FIX 08 Oct 2026 (2ª VF del dueño) — **LA ACCIÓN SE PINTA SIEMPRE, aunque el
                 * DOCUMENTO no esté en esta fase.**
                 *
                 * Lo reportó así: *«en 0001 no sale el botón»*. Y era exacto: `i.entrada` es **null**
                 * para un ingreso que llega **sólo por sus bandejas** (`agruparPorIngreso` las crea con
                 * `entrada: null` y sólo la rellena si la entrada está en la consulta de documentos,
                 * que pide `ajustada`/`en_acondicionamiento`/`recien_creada`). Una entrada en
                 * `revisada_sin_dev` —recién liberada, que es **el estado normal del trabajo de este
                 * puesto**— no entra en esa consulta ⇒ el botón no existía y su trabajo quedaba
                 * alcanzable **sólo por el chevron**: justo lo contrario de la decisión A.
                 *
                 * ⇒ El botón se pinta por **el TRABAJO que hay en la fila** (sus bandejas), y usa el
                 * documento sólo para el rótulo. El orden de los rótulos es el del puesto: primero lo
                 * físico (limpiar/entregar), después el cierre del documento.
                 */
                const pzPorLimpiar = i.bandejas
                    .filter((b) => b.estado === 'por_limpiar')
                    .reduce((s, b) => s + b.piezas, 0)
                const pzEnLimpieza = i.bandejas
                    .filter((b) => b.estado === 'en_limpieza')
                    .reduce((s, b) => s + b.piezas, 0)
                const puedeTomar =
                    !!e && (e.estado === 'ajustada' || (e.estado === 'recien_creada' && e.es_sin_revision))
                const etiqueta =
                    pzPorLimpiar > 0
                        ? 'Iniciar acondicionamiento'
                        : pzEnLimpieza > 0
                          ? 'Continuar acondicionamiento'
                          : e?.estado === 'en_acondicionamiento'
                            ? 'Continuar acondicionamiento'
                            : puedeTomar
                              ? 'Iniciar acondicionamiento'
                              : 'Abrir el trabajo'
                return (
                    <Button
                        type="button"
                        variant={pzPorLimpiar > 0 || e?.estado === 'en_acondicionamiento' ? 'default' : 'outline'}
                        className="min-h-[52px] w-full"
                        onClick={() => setDetalle(i)}
                        title={
                            pzPorLimpiar > 0
                                ? `Abre el trabajo del ingreso: ${pzPorLimpiar} pieza(s) por limpiar en sus bandejas.`
                                : pzEnLimpieza > 0
                                  ? `Abre el trabajo del ingreso: ${pzEnLimpieza} pieza(s) en limpieza, listas para entregar.`
                                  : e?.estado === 'en_acondicionamiento'
                                    ? 'Abre el trabajo del ingreso: sus partidas, sus tandas y el cierre del documento.'
                                    : puedeTomar
                                      ? `Abre el trabajo del ingreso: sus partidas, sus tandas y el cierre del documento (saldo ${Math.max(0, e.piezas_aprobadas - e.piezas_liberadas)} pza).`
                                      : 'Abre el trabajo del ingreso: sus partidas y sus tandas.'
                        }
                    >
                        <PackageCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        {etiqueta}
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
     *
     * ⭐ 06 Oct 2026 (Fase 3 · mockup aprobado · decisión D3.c) — **ESTA BARRA ES LA Z1 DEL MODAL**:
     * viaja por el slot `accionesMasivas` de `BandejasDeIngreso` (gate G7) y al mudarla se le da el
     * marco que hoy no tenía (`border-primary/30 bg-primary-bg shadow-premium-sm`, la tinta de la
     * toolbar de Z1 de Recepción/Revisión): antes era un `bg-surface-raised` sin borde propio sobre
     * el fondo de la fila desplegada. ⚠️ Es el único cambio de aspecto de la mudanza y está declarado
     * como pendiente **P-5** (se juzga en la VF): el ancho NO cambia (medido en el mockup).
     * ⭐ Y lleva el **folio** adelante: dentro del modal la fila quedó detrás del velo borroso, así
     * que la banda es lo que dice de qué ingreso se está hablando (el mockup lo dibuja en su Z1 y el
     * `DialogTitle` va `sr-only` justamente porque el folio ya vive acá — L6).
     * ⚠️ Las 2 puertas se **apagan diciendo por qué**, no se esconden (SPEC §2.6): antes, sin nada
     * que mover, la barra entera desaparecía y el puesto no sabía si la puerta no existía o no
     * correspondía. El texto del apagado es **bandera** ⇒ inline, NO se cataloga.
     */
    const barraMasiva = useCallback(
        (i: IngresoEnCola) => {
            const pzPorLimpiar = i.bandejas
                .filter((b) => b.estado === 'por_limpiar')
                .reduce((s, b) => s + b.piezas, 0)
            const pzEnLimpieza = i.bandejas
                .filter((b) => b.estado === 'en_limpieza')
                .reduce((s, b) => s + b.piezas, 0)
            if (!puedeEditar) return null
            return (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary-bg px-3 py-2.5 shadow-premium-sm">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-[13px] font-bold tracking-[0.06em] text-foreground">
                            {i.folio}
                        </span>
                        {/* ⚠️ Esta frase es DATO (la fila de estado del puesto) ⇒ no se cataloga. */}
                        <span className="text-[12.5px] text-muted-foreground">
                            <span className="font-semibold tabular-nums text-foreground">
                                {pzPorLimpiar}
                            </span>{' '}
                            por limpiar ·{' '}
                            <span className="font-semibold tabular-nums text-foreground">
                                {pzEnLimpieza}
                            </span>{' '}
                            en limpieza
                        </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 gap-1.5 bg-surface-raised px-3.5"
                            disabled={pzPorLimpiar === 0}
                            onClick={() => setMasiva({ ingreso: i, tipo: 'limpiar' })}
                            title={
                                pzPorLimpiar === 0
                                    ? 'No queda nada por limpiar en este ingreso.'
                                    : ayudaLimpiarTodas
                            }
                        >
                            <Sparkles className="h-4 w-4" aria-hidden="true" />
                            Limpiar todas ({pzPorLimpiar})
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 gap-1.5 bg-surface-raised px-3.5"
                            disabled={pzEnLimpieza === 0}
                            onClick={() => setMasiva({ ingreso: i, tipo: 'entregar' })}
                            title={
                                pzEnLimpieza === 0
                                    ? 'No hay nada en limpieza en este ingreso.'
                                    : ayudaEntregarTodo
                            }
                        >
                            <PackageOpen className="h-4 w-4" aria-hidden="true" />
                            Terminar y entregar todo ({pzEnLimpieza})
                        </Button>
                        {/* ⭐ FIX 08 Oct 2026 (decisión A del dueño) — **EL CIERRE DEL DOCUMENTO, ACÁ
                            ADENTRO.** Con la fila abriendo el trabajo, este es el único lugar donde
                            vive el camino del DOCUMENTO (`ajustada → en_acondicionamiento →
                            en_almacen`): el que existe para el ingreso **que nadie liberó** (MEJORA
                            42-bis). Abre el mismo `AcondicionamientoModal` de siempre — no cambia la
                            acción ni su contrato, cambia **dónde se ofrece**.
                            ⚠️ Se pinta sólo si el documento ADMITE la acción (`Acondicionable`): es la
                            misma doctrina del botón que no se ofrece para que el servidor lo rechace. */}
                        {i.entrada && Acondicionable(i.entrada) ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 gap-1.5 bg-surface-raised px-3.5"
                                onClick={() => setSeleccion(i.entrada)}
                                title={
                                    i.entrada.estado === 'en_acondicionamiento'
                                        ? 'Cierra el acondicionamiento del DOCUMENTO y lo manda al almacén.'
                                        : 'Toma el ingreso COMPLETO para acondicionarlo. Al tomarlo, la entrega por tandas de la revisión se cierra: lo que no se haya liberado entra por este camino.'
                                }
                            >
                                <PackageCheck className="h-4 w-4" aria-hidden="true" />
                                {i.entrada.estado === 'en_acondicionamiento'
                                    ? 'Completar acondicionamiento'
                                    : 'Acondicionar el documento'}
                            </Button>
                        ) : null}
                    </span>
                </div>
            )
        },
        [puedeEditar, ayudaLimpiarTodas, ayudaEntregarTodo]
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
                            // ⭐ MEJORA 27 Sep 2026 — `rounded-md`: chip de CONTROL, no píldora de estado.
                            'min-h-11 rounded-md border px-3.5 text-[14px] transition-colors',
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

    /**
     * 🔴 G8 (06 Oct 2026) — **el equivalente del gate de Revisión NO aplica en este catálogo**, y se
     * midió antes de darlo por hecho: acá **no hay `actions`** en la configuración de la página (a
     * diferencia de Revisión, donde «Imprimir revisión» se alimentaba del desglose de la fila por
     * `onDatos`) ⇒ **no hay ninguna fuente que re-apuntar al modal**. Lo único que resume la cola
     * —«N ingresos · M bandejas»— sale del estado de la página (`ingresos`/`bandejas`), no del
     * desglose de una fila.
     */
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
                // ⭐ 06 Oct 2026 (Fase 3 · decisión D1-A) — **EL CHEVRON YA NO DESPLIEGA LA FILA:
                // ABRE EL MODAL** (el opt-in `DataTable.onDesplegar`, el mismo que estrenaron
                // Recepción y Revisión). El desglose vivía dentro de la fila y competía con la lista:
                // la empujaba 303px con 1 partida/1 producto y 1175px con 6/12, la teñía y perdía el
                // scroll. Acá sólo se elige QUÉ ingreso se mira; el contenido lo resuelve el
                // `BandejasDeIngreso` que hospeda el modal.
                // ⚠️ Ya NO se pasa `renderFilaExpandida` (ni `unaFilaExpandida`): la tabla, sus
                // columnas, sus filtros y su toolbar NO cambian — solo cambia a dónde lleva el
                // chevron. El acordeón «un detalle a la vez» (MEJORA 27) queda cubierto por el propio
                // modal. ⚠️ El camino viejo sigue intacto para los CRUDs que SÍ despliegan la fila
                // (Almacén/Alta · Notas de remisión).
                onDesplegar={(i) => setDetalle(i)}
                // ⭐ El nombre accesible del chevron dice el FOLIO, no el UUID de la fila
                // («Abrir ING-0004» en vez de «Abrir la fila 94a2cbe9-…»).
                etiquetaFila={(i) => i.folio}
                onRetry={() => {
                    void recargar()
                }}
                pageSize={Math.max(ingresos.length, 10)}
                page={1}
                totalPages={1}
            />

            {/* ⭐ 06 Oct 2026 (Fase 3) — **EL DESGLOSE DEL INGRESO, EN MODAL**: el chevron de la fila
                ya no la despliega, abre esto (la MISMA pieza: `BandejasDeIngreso enModal`).
                ⚠️ Es **presentacional**: el modal no carga nada ni decide permisos — recibe el
                ingreso con sus bandejas y **reenvía** la acción de cada bandeja y las 2 puertas
                masivas del ingreso (gate G7), que es el atajo del puesto: sin ellas quedaría sólo en
                la fila desplegada que este cambio retira (regresión funcional).
                ⚠️ `key` CALIFICADA (`detalle-…`, gate G6): el catálogo ya monta 2 hermanos con `key`
                (`'ninguna-bandeja'` y `'ninguna'`); un tercero con el placeholder SIN calificar
                chocaría cuando los tres están cerrados → «Encountered two children with the same
                key», el defecto medido el 24 Sep 2026 en el módulo.
                ⚠️ Y queda montado **ANTES** que `TandaAcondicionamientoModal` y que el
                `ConfirmarAccionDialog` a propósito: las 2 acciones que el detalle abre (la bandeja y
                la masiva) se apilan **ENCIMA** de él (con el mismo z, el portal montado después
                gana) — es la prueba que pide **P-1** de los 3 modales de la fase. */}
            <AcondicionamientoDetalleModal
                key={`detalle-${detalle?.id_entrada ?? 'ninguna'}`}
                open={detalle !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setDetalle(null)
                }}
                ingreso={detalle}
                accion={accionDeBandeja}
                accionesMasivas={detalle ? barraMasiva(detalle) : null}
                // ⭐ La densidad del PUESTO se REENVÍA; no se deduce del ancho de la pantalla
                // (SPEC §1.1 · L8): este puesto se opera con el dedo (`modoTactil` en la tabla) y la
                // acción de la bandeja mide 52. `'kit'` (36) es el escritorio de Almacén.
                densidad="puesto"
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
