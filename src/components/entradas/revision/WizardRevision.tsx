'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// WIZARD REVISION — Revisión técnica por PARTIDA (Guía 1.6 · MEJORA 44)
// ═══════════════════════════════════════════════════════════════════════════════
// Vocabulario (usuario 20 Sep): ENTRADA/INGRESO → PARTIDA → PIEZA.
// NO se usa "lote": el técnico elige la PARTIDA, revisa PIEZAS y guarda su AVANCE.
//
// ⭐ MEJORA 44 (30 Sep – 1 Oct 2026) — RECONSTRUCCIÓN DEL MODAL. El disco dice lo que antes se
// capturaba a mano, así que la captura manual SE FUE. Diseño aprobado:
// `DOCS/design/revision/` (las **7 etapas del modal**, 1 Oct 2026) — el de
// `DOCS/design/entradas/02-revision/revision-lector-discos.html` (v2) fue el de la anatomía anterior.
//
// ⭐ LO QUE AGREGÓ LA ETAPA 1 (1 Oct 2026, pedido del usuario): la partida se elige en
// **bloques tocables de 62px** y **elegirla es un ACTO** — sin partida elegida NO se enciende
// ninguna puerta (ni el lector ni la captura a mano); **elegida una, las demás se esconden**
// hasta cerrar esa revisión; **«← Atrás» tiene DOS escalones** (en una partida vuelve a la
// lista · en la lista cierra el modal) y **pregunta antes de perder** una ronda sin guardar;
// el modal es **más ancho** (`min(1120px,94vw)`) y **no se cierra al tocar afuera** (el velo
// ignora el clic; `Esc` pasa por el MISMO guardián). `cerrar()` limpia el turno: este wizard
// está siempre montado y sin eso el primer frame pintaba la partida de la ENTRADA ANTERIOR.
//
//   **SE VA** (era la captura manual): el selector de marca · los RPM · los botones
//   PASA/NO_PASA de 116px · el motivo · el % de salud con teclado −/+ · la bandera
//   «esta partida lleva NS» · la barra «Avance de la partida» · el campo «¿cuántas
//   piezas tomas en este turno?».
//
//   **SE QUEDA**: `Leer discos` · las FICHAS (sin un solo botón dentro) · la barra de
//   acciones debajo de las fichas (`Formatear` + `Registrar`) · `Registrar` que se
//   activa recién cuando el formateo terminó · y el pie de 3: `← Atrás` · `Liberar` ·
//   `Guardar avance`.
//
// ⭐ LA RONDA (corrección del usuario): **`Registrar` ACUMULA, no guarda.** Junta las
// piezas en memoria y `Guardar avance` (el pie) escribe TODO de una vez. Por eso la
// lista de la ronda vive acá y el guardado es un solo viaje.
//
// ⚠️ CUANDO NO HAY LECTOR el modal sigue siendo el de antes: el panel no se muestra
// (la categoría no lo pide, o el ingreso es directo) y el técnico captura a mano. El
// lector **NUNCA bloquea** (D11).
//
// ⚠️ EL AVANCE DE LA PARTIDA YA NO SE PINTA: lo quitó el usuario. El contador de la
// ronda es el que habla; el tope contra lo restante lo aplica el SERVIDOR (MEJORA 25).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Check, Minus, Package, PackageCheck, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Ayuda, useAyuda } from '@/components/ui/Ayuda'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pildora } from '@/components/data-table'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

import { crearMarcaConCategorias, listarLineasPorMarca, listarMarcasPorCategoria } from '@/lib/actions/productos'
import { aLectura, atributosDesdeDisco, capacidadTextoDesdeGb, desvioDeCapacidad } from '@/lib/lector-discos'
import type { NsTanda } from '@/types/entradas'
import { CapturaNsTanda } from '@/components/entradas/revision/CapturaNsTanda'
import { PanelLectorDiscos, type EstadoPanel, type ItemRonda } from '@/components/entradas/revision/PanelLectorDiscos'
import {
    guardarAvanceRevision,
    listarCategoriasCapturables,
    listarMotivosRechazo,
    listarPartidasConAvance,
} from '@/lib/actions/entradas'
import type {
    CategoriaCapturable,
    Entrada,
    LecturaEntrada,
    MotivoRechazo,
    PartidaConAvance,
    PiezaRevision,
} from '@/types/entradas'

interface WizardRevisionProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    /** Partida con la que abre (el acordeón pasa la elegida). */
    partidaInicialId?: string
    /**
     * ⭐ MEJORA 25 — abre la puerta de la liberación parcial para ESA partida. La monta el catálogo
     * (una sola instancia del modal, dos puertas: el pie del wizard y el desglose de partidas).
     */
    onLiberar?: (entrada: Entrada, idPartida: string, idGrupo?: string) => void
    onGuardado?: () => void
}

// ⭐ 06 Oct 2026 — un atributo `multi` vale un CONJUNTO: el array se **PRESERVA**. Un
// `String(v)` lo volvería `"AM4,AM5"` y el control de chips no reconocería ningún
// seleccionado — y el valor viajaría como texto, que es justo lo que la BD no debe recibir.
const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string | string[]> =>
    Object.fromEntries(
        Object.entries(at ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => String(x)) : String(v ?? '')])
    )

/** Una pieza en la ronda: la pieza + su lectura (si se capturó con el lector). */
interface PiezaEnRonda {
    pieza: PiezaRevision
    lectura?: LecturaEntrada
    /** Para pintar la fila: la marca y el veredicto ya resueltos. */
    marcaNombre: string
    etiqueta: string
    tono: 'exito' | 'peligro' | 'advertencia'
}

/**
 * ⭐ FIX 08 Oct 2026 (lo pidió el dueño en la VF) — **la descripción de una partida declarada**.
 *
 * *«En la descripción, por ejemplo, solo dice Partida 1 HDD — falta ahí poner la capacidad.»* Y tiene
 * razón: dos partidas de la MISMA categoría (una de 1TB y otra de 2TB) se leían **idénticas**, así que
 * elegir el turno era adivinar. La `capacidad` va **primero** (es el discriminador real) y el resto de
 * lo declarado después, con las claves **ordenadas** porque `atributos` es `jsonb` y Postgres no
 * conserva el orden.
 */
function describirAtributosDePartida(at: Record<string, unknown> | null | undefined): string {
    const pares = Object.keys(at ?? {})
        .sort()
        .map((k) => [k, String((at as Record<string, unknown>)[k] ?? '').trim()] as const)
        .filter(([, v]) => v !== '')
    const capacidad = pares.filter(([k]) => k === 'capacidad')
    const resto = pares.filter(([k]) => k !== 'capacidad')
    return [...capacidad, ...resto].map(([, v]) => v).join(' · ')
}

export function WizardRevision({
    open,
    onOpenChange,
    entrada,
    partidaInicialId,
    onLiberar,
    onGuardado,
}: WizardRevisionProps) {
    const [partidas, setPartidas] = useState<PartidaConAvance[]>([])
    const [motivos, setMotivos] = useState<MotivoRechazo[]>([])
    const [capturables, setCapturables] = useState<CategoriaCapturable[]>([])

    const [partidaSel, setPartidaSel] = useState('')
    /**
     * ⭐ MEJORA 44 (1 Oct 2026) — ¿ya llegaron las partidas de esta entrada? Sin esta bandera, el
     * primer render del modal afirmaba **«Esta entrada no tiene partidas.»** —una mentira de un
     * frame, porque `partidas` arranca en `[]`— y encima la puerta ya se pintaba encendida.
     * Un bloque que no llegó no se pinta, y tampoco se niega: se dice que está cargando.
     */
    const [cargado, setCargado] = useState(false)

    /**
     * ⭐ MEJORA 47 (04 Oct 2026) — las ayudas de la confirmación de salida.
     * ⚠️ Se llaman las DOS siempre, aunque solo se muestre una: la clave depende de
     *    `salidaPendiente` y un hook adentro de un ternario rompe el orden de los hooks.
     * 🔴 Las dos son `fijo` en el registro (no se ocultan): viven en el `detalle` del
     *    `ConfirmarAccionDialog`, que el kit pinta en ROJO, y son lo ÚNICO que dice qué
     *    se pierde. Apagarlas dejaría un «Salir igual» a ciegas.
     */
    const ayudaPierdeLista = useAyuda('revision.salir-pierde-avance-lista')
    const ayudaPierdeSalir = useAyuda('revision.salir-pierde-avance')
    /**
     * ⭐ MEJORA 44 (1 Oct 2026) — la salida que **espera confirmación**: `'lista'` = volver a elegir
     * partida (el turno se descarta), `'cerrar'` = salir del modal. `null` = no hay nada que
     * confirmar. Gracias a esto **el modal no se cierra en silencio** teniendo piezas sin guardar,
     * venga la salida del botón, de la `×`, del velo o de `Esc`.
     */
    const [salidaPendiente, setSalidaPendiente] = useState<'lista' | 'cerrar' | null>(null)
    const [marcas, setMarcas] = useState<{ id: string; nombre: string; alias: string[] }[]>([])
    const [atributos, setAtributos] = useState<Record<string, string | string[]>>({})
    /** La ronda: lo que se acumula y se escribe UNA vez al guardar. */
    const [ronda, setRonda] = useState<PiezaEnRonda[]>([])
    /**
     * ⭐ MEJORA 44 — la EVIDENCIA de la lectura. Viaja con la tanda y se escribe en
     * `lecturas_disco` en el mismo acto que las piezas y los NS (append-only).
     */
    const [lecturas, setLecturas] = useState<LecturaEntrada[]>([])

    /**
     * ⚠️ LA PUERTA DEL LECTOR MANUAL — solo para las categorías que NO usan el lector
     * (RAM) o el ingreso directo. Cuando el lector aplica, esta captura NO se pinta.
     */
    const [marcaSel, setMarcaSel] = useState('')
    const [resultado, setResultado] = useState<'PASA' | 'NO_PASA'>('PASA')
    const [idMotivo, setIdMotivo] = useState('')
    const [porcentajeSalud, setPorcentajeSalud] = useState('')

    /**
     * ⭐ MEJORA 35 — **el concentrado de la tanda**. Al pulsar Guardar, si la partida de
     * este turno lleva NS, se abren las dos pantallas de escaneo (los que pasaron / los que
     * no) y **hasta que no se completan no se escribe nada** (D2). `resolverNs` es la promesa
     * que resuelven: `null` = el técnico canceló → la tanda NO se guarda.
     * ⭐ MEJORA 44 — llega **PRELLENADO con los NS leídos** (editables como respaldo).
     */
    const [capturaNs, setCapturaNs] = useState<{ pasa: number; noPasa: number } | null>(null)
    const [resolverNs, setResolverNs] = useState<((v: NsTanda | null) => void) | null>(null)
    const [nsPrellenado, setNsPrellenado] = useState<NsTanda | null>(null)

    const [cargando, setCargando] = useState(false)

    const partidaActual = partidas.find((p) => p.id === partidaSel) ?? null
    const categoriaActual = partidaActual?.id_categoria
        ? capturables.find((c) => c.id === partidaActual.id_categoria) ?? null
        : null
    const esquema = useMemo(() => categoriaActual?.esquema ?? [], [categoriaActual])

    /**
     * ⭐ MEJORA 44 (30 Sep 2026) — **el lector se decide por BANDERA, no por el nombre.**
     * `categorias_producto.requiere_lector` (TRUE en HDD/SSD/M.2). Antes era una regex
     * sobre `categoria_nombre`: renombrar la categoría apagaba el lector EN SILENCIO.
     */
    const usaLector = categoriaActual?.requiere_lector === true

    /**
     * ⭐ MEJORA 44 (1 Oct 2026) — **sin partida elegida no hay puerta.** La puerta es de la
     * PARTIDA, no del modal: hasta que el técnico toque una no se enciende ninguna de las dos
     * (ni el lector ni la captura a mano). Un bloque que no llegó no se pinta — y sin partida
     * tampoco hay ronda ni avance que mostrar.
     */
    const hayPartida = partidaActual !== null
    /** Con lector, la marca y el resultado los resuelve el disco: no se piden a mano. */
    const capturaManual = hayPartida && !usaLector

    // ⭐ REVISIÓN = los `en_huella` que NO se capturaron en recepción.
    // ⭐ 06 Oct 2026 — **los `valor_default` TAMBIÉN se preguntan, pero PRESELECCIONADOS.** Antes se
    // aplicaban en silencio (nota «Automático: …») y **el técnico no podía corregirlos a mano**:
    // servía para `rpm` —donde el LECTOR es la otra vía— pero **no para un dato que solo puede activar
    // una persona**. El caso vivo es `es_servidor` de RAM: ahí el vacío **no existe** («no es
    // servidor» es un VALOR, no una ausencia) y un default imborrable volvería **todas las memorias
    // iguales en la huella** — el daño silencioso que este módulo ya pagó. El default se sigue
    // aplicando solo en `construirHuella`, así que «dejarlo como venga» cuesta lo mismo que antes.
    const enRevision = useMemo(
        () => esquema.filter((a) => a.en_huella && !a.en_entrada),
        [esquema]
    )
    // ⭐ Automáticos (ej. rpm=7200): NO se preguntan.
    const defaults = useMemo(() => esquema.filter((a) => !!a.valor_default), [esquema])

    const limpiarEditorManual = useCallback((conservarMarca = true) => {
        setResultado('PASA')
        setIdMotivo('')
        setPorcentajeSalud('')
        if (!conservarMarca) setMarcaSel('')
    }, [])

    /** Huella = atributos de recepción (snapshot) + revisión + automáticos. */
    const construirHuella = useCallback((): Record<string, string | string[]> => {
        const huella: Record<string, string | string[]> = { ...atributos }
        /**
         * ⭐ FIX 08 Oct 2026 — **con LECTOR, la LÍNEA no entra por acá: es de la PIEZA.**
         *
         * Los atributos `opciones_por_marca` (hoy `linea`) viajan **en la fila de la ronda de cada
         * disco**, porque un turno puede traer un WD Blue y un Seagate Barracuda. Si el valor general
         * entrara en la huella, **pisaría la elección de cada disco** — el defecto que reportó el
         * dueño (*«a lo mejor una es Barracuda y otro no»*). En la captura a mano el editor general
         * sigue mandando: ahí se agrega una pieza a la vez.
         */
        if (usaLector) {
            for (const at of esquema.filter((a) => a.opciones_por_marca)) delete huella[at.clave]
        }
        for (const d of defaults) {
            // ⭐ MEJORA 44 — la LECTURA manda: si el disco ya dijo el dato (un disco de
            // 5425 rpm no es de 7200), el `valor_default` NO lo pisa. El default queda
            // como respaldo para cuando nadie leyó el disco.
            if (huella[d.clave]) continue
            huella[d.clave] = d.valor_default as string
        }
        return huella
    }, [atributos, defaults, esquema, usaLector])

    const cargarPartidas = useCallback(async (idEntrada: string) => {
        const r = await listarPartidasConAvance(idEntrada)
        const ps = r.success ? r.data ?? [] : []
        setPartidas(ps)
        return ps
    }, [])

    // Carga inicial (partidas con avance · motivos · catálogo capturable).
    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void (async () => {
            const [ps, rm, rc] = await Promise.all([
                cargarPartidas(entrada.id),
                listarMotivosRechazo(),
                listarCategoriasCapturables(),
            ])
            if (!activo) return
            if (rm.success) setMotivos(rm.data ?? [])
            if (rc.success) setCapturables(rc.data ?? [])
            /**
             * ⭐ MEJORA 44 (1 Oct 2026, decisión del usuario) — **ELEGIR LA PARTIDA ES UN ACTO,
             * NO UN DEFAULT.** Antes, cuando nadie la había elegido (el botón «Revisar ahora» de
             * la fila de la entrada llega con `partidaInicialId = undefined`), el wizard tomaba
             * por su cuenta la 1ª con pendientes. Eso encendía el lector de discos **sin que el
             * técnico hubiera decidido nada**: podía leer y registrar discos para la partida
             * equivocada y las piezas quedaban donde el modal había resuelto en silencio.
             * Ahora la partida llega elegida **solo** si él la tocó en el desglose de partidas;
             * si no, no hay ninguna y **la puerta (lector o manual) no se pinta** hasta que toque
             * una — ni siquiera cuando la entrada tiene una sola partida.
             */
            const inicial =
                partidaInicialId && ps.some((p) => p.id === partidaInicialId) ? partidaInicialId : ''
            setPartidaSel(inicial)
            setAtributos(aTexto(ps.find((p) => p.id === inicial)?.atributos))
            setRonda([])
            setLecturas([])
            setMarcaSel('')
            limpiarEditorManual(false)
            setCargado(true)
        })()
        return () => {
            activo = false
        }
    }, [open, entrada, partidaInicialId, cargarPartidas, limpiarEditorManual])

    /**
     * ⭐ MEJORA 44 (1 Oct 2026) — **CERRAR LIMPIA EL TURNO.** Este wizard está SIEMPRE montado
     * (lo monta la cola; Radix solo desmonta su DOM) y su estado sobrevive al cierre: al reabrir,
     * el primer render pintaba **la partida de la entrada ANTERIOR** —y con ella su puerta, su
     * categoría y su ronda— antes de que respondieran las Server Actions. Es el MISMO parpadeo
     * que ya se corrigió por la punta de la categoría (ver `capturaManual`); con la regla nueva
     * era peor: el modal abría con una partida ya elegida que el técnico **no** había elegido.
     * ⚠️ Se limpia en el EVENTO de cierre, no en un efecto: un efecto corre DESPUÉS del paint (el
     * frame sucio ya se vio) y `react-hooks/set-state-in-effect` lo prohíbe — el estado se limpia
     * donde se decide, no donde se observa.
     */
    const limpiarTurno = useCallback(() => {
        setPartidas([])
        setPartidaSel('')
        setRonda([])
        setLecturas([])
        setCargado(false)
    }, [])

    /**
     * Toda salida del modal pasa por acá: la `×`, el velo, `Esc`, los dos «← Atrás» y el cierre
     * automático de `guardar` cuando ya no queda nada por revisar en la entrada.
     */
    const cerrar = useCallback(() => {
        limpiarTurno()
        onOpenChange(false)
    }, [limpiarTurno, onOpenChange])

    /** Radix avisa por acá cuando el técnico cierra con `Esc`, con el velo o con la `×`:
     *  **toda salida pasa por el mismo guardián** (nunca se cierra en silencio). */
    const alCambiarApertura = (v: boolean) => {
        if (v) onOpenChange(true)
        else intentarCerrar()
    }

    // Marcas por categoría de la partida (solo hacen falta cuando NO hay lector).
    useEffect(() => {
        if (!open || !partidaActual?.id_categoria) return
        let activo = true
        void listarMarcasPorCategoria(partidaActual.id_categoria).then((r) => {
            if (activo && r.success) {
                setMarcas(
                    (r.data ?? [])
                        .filter((m) => m.es_activo)
                        .map((m) => ({ id: m.id, nombre: m.nombre, alias: m.alias ?? [] }))
                )
            }
        })
        return () => {
            activo = false
        }
    }, [open, partidaActual?.id_categoria])

    /**
     * ⭐ MEJORA 52 (07 Oct 2026, decisión del dueño) — **LA PUERTA DE LA MARCA.**
     *
     * *«la que muestra la lectura debe ser alguna de las de la lista de marcas, si no hay es dar de
     * alta la marca para poder usarla o ponerla»*. **Hoy esa puerta no existía**: si la lectura traía
     * una marca fuera del catálogo, el wizard avisaba *«elegila a mano»* y asignaba `id_marca = ''`
     * — pero con lector **el select de marca no se pinta** ⇒ el disco **no se podía registrar**, y el
     * mensaje mandaba a hacer algo que esa pantalla no permitía.
     *
     * Devuelve el id de la marca (la que ya estaba, o la recién creada) y `null` si no se pudo: en ese
     * caso **no se registra nada** (no se arma una pieza a medias).
     * El alta va por `crearMarcaConCategorias` → RPC `registrar_marca_con_categorias`, que es
     * **SECURITY DEFINER** y la tiene concedida `authenticated` ⇒ el técnico puede darla de alta.
     */
    const asegurarMarca = useCallback(
        async (nombre: string | null | undefined): Promise<string | null> => {
            const limpio = (nombre ?? '').trim()
            if (!limpio) return null
            /**
             * ⭐ 09 Oct 2026 (`g12_a6_b1` · decisión del dueño) — **SE COMPARA TAMBIÉN POR ALIAS.**
             *
             * El caso, de su VF: *«justo es para poner una de esas y usar y **prevenir por ejemplo WD a
             * western digital**»*. El **agente** ya traduce el modelo al nombre del catálogo
             * (`REGLAS_MARCA`: `^(WDC|WD)\b|… → "Western Digital"`), pero **del lado de la app no había
             * red**: esto comparaba **sólo por nombre** y, al no encontrarlo, **CREABA la marca** ⇒ un
             * nombre no previsto producía una **marca duplicada** y con ella **dos huellas (dos SKU)**
             * del mismo disco — el descuadre que este proyecto persigue en todas partes.
             *
             * ⚠️ Se comparan **las dos formas sin distinguir mayúsculas** (nombre y cada alias): la
             * marca del catálogo manda y el alias es su puerta de entrada. Si de verdad no hay ninguna
             * que corresponda, se sigue dando de alta (la **marca al vuelo**, que es comportamiento
             * legítimo y documentado): lo que cambia es que ya no se inventa una por un alias.
             */
            const clave = limpio.toLowerCase()
            const coincide = (m: { nombre: string; alias: string[] }) =>
                m.nombre.toLowerCase() === clave ||
                (m.alias ?? []).some((a) => a.trim().toLowerCase() === clave)
            const ya = marcas.find(coincide)
            if (ya) return ya.id
            const idCat = partidaActual?.id_categoria
            if (!idCat) return null
            const res = await crearMarcaConCategorias(limpio, [idCat])
            if (!res.success || !res.data) {
                toast.error(res.error ?? `No se pudo dar de alta la marca «${limpio}».`)
                return null
            }
            toast.success(`Marca «${limpio}» dada de alta en la categoría`)
            // Se relee el catálogo de la categoría: la marca nueva tiene que quedar elegible ya.
            const r = await listarMarcasPorCategoria(idCat)
            const lista = r.success
                ? (r.data ?? [])
                      .filter((m) => m.es_activo)
                      .map((m) => ({ id: m.id, nombre: m.nombre, alias: m.alias ?? [] }))
                : []
            setMarcas(lista)
            return lista.find(coincide)?.id ?? res.data
        },
        [marcas, partidaActual?.id_categoria]
    )

    const cambiarPartida = (id: string) => {
        setPartidaSel(id)
        setMarcaSel('')
        setRonda([])
        // ⭐ MEJORA 44 — cambiar de partida descarta las lecturas del turno anterior: cada
        // lectura pertenece a la partida de su pieza y el turno ya no es el mismo.
        setLecturas([])
        setAtributos(aTexto(partidas.find((p) => p.id === id)?.atributos))
        limpiarEditorManual(false)
    }

    /**
     * ⭐ MEJORA 44 (1 Oct 2026, decisión del usuario) — **volver a la lista de partidas.** Descarta
     * el turno (la ronda sin guardar y las lecturas se pierden), que es justo lo que el guardián de
     * abajo avisa antes de hacerlo. Se reusa `cambiarPartida('')`: dejar la partida vacía es,
     * literalmente, volver a la lista.
     */
    const volverALista = () => cambiarPartida('')

    /**
     * ⭐ MEJORA 45 — **LO QUE EL WIZARD NO PODÍA VER.** El panel lector tiene su propio estado
     * (discos leídos sin registrar, formateo en curso, expulsión en curso) y el wizard no lo
     * alcanzaba: su guardián de salida solo miraba la ronda. Era el **pendiente declarado de la
     * MEJORA 44** (`onEstado`), y con el `Expulsar` del dock pasa a ser obligatorio: hay que
     * negarse a expulsar con un formateo activo, y avisar antes de descartar lecturas.
     *
     * ⚠️ `useCallback` a propósito: este callback entra en las dependencias de un `useEffect`
     * del panel. Una función nueva en cada render dispararía el efecto en cada render.
     */
    const [estadoPanel, setEstadoPanel] = useState<EstadoPanel>({
        formateando: false,
        expulsando: false,
        sinRegistrar: 0,
        marcaComun: null,
    })
    const alCambiarPanel = useCallback((e: EstadoPanel) => setEstadoPanel(e), [])

    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **LA LÍNEA, con píldoras del catálogo.**
     *
     * El atributo `linea` vive en los 33 Tipos (`en_huella: true`, **no requerido**, `opciones_por_marca`),
     * pero sus valores **no están en el esquema**: salen del **catálogo `lineas_producto`, filtrado por la
     * MARCA** — las líneas de WD (Blue · Purple · Black…) no aplican a Seagate (Barracuda · IronWolf…).
     * Se selecciona con **píldoras**, **ninguna por defecto**, y **vacía NO afecta la huella**.
     *
     * ¿Con qué marca se cargan? Con la que el wizard PUEDE ver:
     *   · vía MANUAL (RAM / ingreso directo) → la marca que el técnico elige (`marcaSel`)
     *   · vía LECTOR → la **marca común de los discos leídos** (la reporta el panel en su estado):
     *     el wizard no ve los discos, y el catálogo es POR MARCA.
     * Si los discos no comparten marca, no se ofrecen líneas: se registra por tandas de una misma
     * línea, que es como el técnico trabaja (*«todos los de una capacidad y luego otra»*).
     */
    const [lineasDe, setLineasDe] = useState<{ marca: string; items: { id: string; nombre: string }[] }>({
        marca: '',
        items: [],
    })
    /**
     * ⚠️ FIX 07 Oct 2026 (cazado por la VF del dueño) — **el catálogo se pide por el ID de la marca,
     * y con lector solo teníamos el NOMBRE.**
     *
     * El panel reporta `marcaComun` con la marca **tal como la dice el disco** (`"Seagate"`, que es lo
     * que el agente deduce del modelo) y `listarLineasPorMarca` consulta `id_marca` — un **UUID**.
     * ⇒ Se pedía `id_marca = 'Seagate'`, salían **0 filas** y la pantalla decía *«esta marca no tiene
     * líneas cargadas»* **con el catálogo lleno** (Seagate tenía sus 5). **No era la semilla: era esto.**
     * Se resuelve contra las marcas **de la categoría**, que el wizard ya carga para el select manual
     * (y que es la misma lista con la que `asegurarMarca` decide si hay que dar de alta la marca).
     */
    const marcaNombreEnCurso =
        (marcaSel ? marcas.find((m) => m.id === marcaSel)?.nombre : '') || estadoPanel.marcaComun || ''
    const idMarcaParaLinea =
        marcaSel ||
        marcas.find((m) => {
            // ⭐ 09 Oct 2026 (`g12_a6_b1`) — también por ALIAS: el panel reporta la marca **como la dice
            // el disco** («WD»), y sin esto las líneas de esa marca no aparecían aunque existieran.
            const n = (estadoPanel.marcaComun ?? '').trim().toLowerCase()
            return m.nombre.toLowerCase() === n || (m.alias ?? []).some((a) => a.trim().toLowerCase() === n)
        })?.id ||
        ''
    useEffect(() => {
        if (!open || !idMarcaParaLinea) return
        let activo = true
        void listarLineasPorMarca(idMarcaParaLinea).then((r) => {
            // Se guarda CON su marca: así el render nunca muestra las líneas de la marca anterior
            // mientras la nueva carga (y no hace falta limpiar el estado dentro del efecto).
            if (activo && r.success) setLineasDe({ marca: idMarcaParaLinea, items: r.data ?? [] })
        })
        return () => {
            activo = false
        }
    }, [open, idMarcaParaLinea])
    /** Las líneas de la marca EN CURSO (vacío si todavía no llegaron o no hay marca). */
    const lineas = idMarcaParaLinea && lineasDe.marca === idMarcaParaLinea ? lineasDe.items : []

    /**
     * Las píldoras de la LÍNEA (los atributos con `opciones_por_marca`; hoy, `linea`).
     * Se pintan en **las dos vías** —con lector y a mano— porque es **identidad que el disco no sabe**.
     * **Opcional**: tocar la píldora elegida la apaga (queda vacía) y **vacía no afecta la huella**.
     */
    const lineasDelEsquema = esquema.filter((a) => a.opciones_por_marca)
    const editorLinea =
        lineasDelEsquema.length > 0 ? (
            <div className="space-y-1.5">
                {lineasDelEsquema.map((at) => (
                    <div key={at.clave} className="space-y-1">
                        <Label className="text-[11px]">
                            {at.etiqueta}{' '}
                            <span className="font-normal text-muted-foreground">(opcional)</span>
                        </Label>
                        {lineas.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">
                                {idMarcaParaLinea
                                    ? `«${marcaNombreEnCurso}» no tiene líneas cargadas en el catálogo (se editan en 1.0 Catálogos).`
                                    : marcaNombreEnCurso
                                      ? `«${marcaNombreEnCurso}» todavía no está en las marcas de la categoría, así que no tiene líneas.`
                                      : 'Elegí la marca —o leé los discos— para ver sus líneas.'}
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {lineas.map((l) => {
                                    const sel = atributos[at.clave] === l.nombre
                                    return (
                                        <button
                                            key={l.id}
                                            type="button"
                                            disabled={cargando}
                                            aria-pressed={sel}
                                            title={sel ? 'Tocar de nuevo para dejarla vacía' : undefined}
                                            onClick={() =>
                                                setAtributos((prev) => ({
                                                    ...prev,
                                                    [at.clave]: sel ? '' : l.nombre,
                                                }))
                                            }
                                            className={`rounded-md border px-2 py-1 text-xs transition disabled:opacity-50 ${
                                                sel
                                                    ? 'border-primary bg-primary/10 font-medium text-foreground'
                                                    : 'border-border text-muted-foreground hover:border-primary/50'
                                            }`}
                                        >
                                            {l.nombre}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        ) : null

    /**
     * ⭐ FIX 08 Oct 2026 — **LA LÍNEA ES DE LA PIEZA, no del turno.**
     *
     * Lo cazó el dueño en la VF: *«en el modal donde pregunta la línea, eso es un dato que debe
     * seleccionársele **por disco**, no en general — a lo mejor una es Barracuda y otro no»*. Y tiene
     * razón: la línea es **identidad de la pieza** (R59 la mete en la huella), así que un turno con un
     * WD Blue y un Seagate Barracuda producía **una sola huella** con la línea del primero — o sea, un
     * SKU equivocado para uno de los dos discos.
     *
     * El catálogo es **por marca** (las líneas de WD no aplican a Seagate), así que se cargan las
     * líneas de **cada marca presente en la ronda** — una vez por marca, no por pieza.
     */
    const [lineasPorMarca, setLineasPorMarca] = useState<Record<string, { id: string; nombre: string }[]>>({})
    useEffect(() => {
        if (!open) return
        const marcasEnRonda = [
            ...new Set(ronda.map((r) => r.pieza.id_marca).filter((m): m is string => !!m)),
        ]
        const faltan = marcasEnRonda.filter((m) => !(m in lineasPorMarca))
        if (faltan.length === 0) return
        let activo = true
        void Promise.all(
            faltan.map(async (idMarca) => {
                const r = await listarLineasPorMarca(idMarca)
                return [idMarca, (r.success ? r.data : []) ?? []] as const
            })
        ).then((pares) => {
            if (!activo) return
            setLineasPorMarca((prev) => ({ ...prev, ...Object.fromEntries(pares) }))
        })
        return () => {
            activo = false
        }
    }, [open, ronda, lineasPorMarca])

    /**
     * La línea de **UNA** pieza de la ronda. Se escribe en `pieza.atributos[clave]` — que es lo que
     * `guardarAvanceRevision` agrupa por huella: con líneas distintas, **dos huellas y dos SKU**.
     */
    const cambiarAtributoDePieza = useCallback((indice: number, clave: string, valor: string) => {
        setRonda((prev) =>
            prev.map((r, i) =>
                i === indice
                    ? {
                          ...r,
                          pieza: {
                              ...r.pieza,
                              atributos: { ...(r.pieza.atributos ?? {}), [clave]: valor },
                          },
                      }
                    : r
            )
        )
    }, [])

    /** ¿Hay algo del panel que se pierda al descartar el turno? */
    const panelConRiesgo = estadoPanel.formateando || estadoPanel.expulsando || estadoPanel.sinRegistrar > 0
    /** ¿Hay algo que perder? La ronda sin guardar o el trabajo del panel. */
    const hayAlgoQuePerder = ronda.length > 0 || panelConRiesgo

    /**
     * El texto de lo que se pierde, nombrando CADA cosa. Antes decía siempre «N piezas en la
     * ronda»: con 0 piezas y 2 discos leídos sin registrar, el aviso no aparecía —o mentía—
     * justo en el caso que más importa.
     */
    const queSePierde = (): string => {
        const partes: string[] = []
        if (ronda.length > 0) {
            partes.push(`${ronda.length} pieza${ronda.length === 1 ? '' : 's'} en la ronda sin guardar`)
        }
        if (estadoPanel.sinRegistrar > 0) {
            partes.push(`${estadoPanel.sinRegistrar} lectura${estadoPanel.sinRegistrar === 1 ? '' : 's'} de disco sin registrar`)
        }
        if (estadoPanel.formateando) partes.push('un FORMATEO EN CURSO')
        if (estadoPanel.expulsando) partes.push('una expulsión del dock en curso')
        return partes.join(' · ')
    }

    /**
     * ⭐ MEJORA 44 · 45 — **el guardián de la salida.** Si hay algo que perder se pregunta (el
     * avance se pierde: `cerrar()` limpia el turno); si no hay nada que perder, se sale derecho.
     */
    const intentarCerrar = () => {
        if (hayAlgoQuePerder) {
            setSalidaPendiente('cerrar')
            return
        }
        cerrar()
    }

    /**
     * ⭐ MEJORA 44 — **«← Atrás» tiene DOS escalones** (decisión del usuario, 1 Oct):
     * ① estando en una partida vuelve a la **lista** para poder tomar otra sin cerrar el modal;
     * ② desde la lista cierra el turno y devuelve a la cola. Con algo sin guardar, primero
     * pregunta — volver a la lista descarta el turno y eso no se deshace.
     */
    const atras = () => {
        if (!hayPartida) {
            intentarCerrar()
            return
        }
        if (hayAlgoQuePerder) {
            setSalidaPendiente('lista')
            return
        }
        volverALista()
    }

    /**
     * ⭐ MEJORA 44 (1 Oct 2026, decisión del usuario) — **elegida la partida, las otras se
     * esconden.** El turno es de UNA partida: con las demás a la vista, un toque distraído cambia
     * de turno y se pierde lo acumulado. Vuelven al cerrar esa revisión, con «← Atrás».
     */
    const partidasVisibles = hayPartida ? partidas.filter((p) => p.id === partidaSel) : partidas

    const restantes = partidaActual?.restantes ?? 0
    const okRonda = ronda.filter((r) => r.pieza.resultado === 'PASA').length
    const malRonda = ronda.filter((r) => r.pieza.resultado === 'NO_PASA').length
    /** Los que quedaron SIN AVAL: ni aprobados ni devueltos — los decide el técnico. */
    const revisarRonda = ronda.filter((r) => r.etiqueta === 'REVISAR').length
    const motivoSel = motivos.find((m) => m.id === idMotivo) ?? null
    /** ⭐ MEJORA 25 — aprobadas de esta partida que todavía NO tienen tanda. */
    const liberables = useMemo(
        () =>
            (partidaActual?.huellas ?? []).reduce(
                (s, h) => s + Math.max(0, h.cantidad_aprobada - h.cantidad_liberada),
                0
            ),
        [partidaActual]
    )

    // ── ⭐ EL LECTOR: registrar la ronda ────────────────────────────────────────
    /**
     * El panel entrega TODOS los discos leídos, con su veredicto ya resuelto. Acá se
     * arma la pieza que viaja al servidor. **NO se escribe nada**: esto acumula.
     * ⚠️ `SIN_AVAL` entra como `NO_PASA` **sin motivo**: la pieza queda pendiente de que
     * el técnico decida. Mandarla a devolución con un motivo que el taller no avaló sería
     * inventar una devolución (regla del aval, 30 Sep 2026).
     */
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **de qué es la PARTIDA**, para avisar si un disco no lo es.
     *
     * ⚠️ Sale de **la PARTIDA** (`partidaActual.atributos`), **NUNCA de `atributos`** — que es el estado
     * de la RONDA y `registrarRonda` lo **sobreescribe con lo que dijo el disco**. Ese era el defecto que
     * cazó el dueño: al registrar, «lo declarado» pasaba a ser «lo medido» ⇒ el aviso **desaparecía**; y
     * al guardar el avance se recargaba lo declarado y **reaparecía**. El aviso tiene que estar **desde la
     * lectura**, que es cuando el técnico decide.
     */
    const opcionesCapacidad = useMemo(
        () => esquema.find((a) => a.clave === 'capacidad')?.opciones ?? [],
        [esquema]
    )
    const capacidadDeclaradaDeLaPartida = useMemo(
        () =>
            typeof partidaActual?.atributos?.capacidad === 'string'
                ? (partidaActual.atributos.capacidad as string)
                : null,
        [partidaActual]
    )

    const registrarRonda = useCallback(
        async (items: ItemRonda[]) => {
            if (items.length === 0) return
            if (items.length > restantes - ronda.length) {
                toast.error(`Solo quedan ${Math.max(0, restantes - ronda.length)} pieza(s) por revisar en esta partida.`)
                return
            }
            /**
             * ⭐ MEJORA 52 — **la marca se resuelve o se da de alta ANTES de armar las piezas.**
             * Con lector no hay select de marca: si la del disco no estaba en el catálogo, la pieza
             * nacía con `id_marca = ''` (y el guardado del concentrado la rechazaba). Si alguna no se
             * puede resolver, **no se registra NADA**: media ronda es peor que ninguna.
             */
            const idPorNombre = new Map<string, string>()
            for (const it of items) {
                const nombre = (it.disco.marca ?? '').trim()
                if (!nombre) continue
                if (idPorNombre.has(nombre.toLowerCase())) continue
                const id = await asegurarMarca(nombre)
                if (!id) {
                    toast.error(`Sin marca no se puede registrar «${nombre}»: revisá el catálogo de la categoría.`)
                    return
                }
                idPorNombre.set(nombre.toLowerCase(), id)
            }
            const nuevas: PiezaEnRonda[] = []
            const lecturasNuevas: LecturaEntrada[] = []
            for (const it of items) {
                const d = it.disco
                const idMarca = idPorNombre.get((d.marca ?? '').trim().toLowerCase()) ?? ''
                const marcaNombre = marcas.find((m) => m.id === idMarca)?.nombre ?? d.marca ?? '—'
                const leidos = atributosDesdeDisco(d, esquema)
                const huella = { ...construirHuella(), ...leidos }
                /**
                 * ⭐ MEJORA 52 — **la marca viaja con la pieza.** Si el disco no es de lo que declara la
                 * partida, se guarda el desvío (medido vs declarado) para que el guardado sepa que esta
                 * pieza **va por el camino de la reclasificación**. El técnico ya lo vio **en rojo, al
                 * leer** — antes de registrarla.
                 */
                const desvio = desvioDeCapacidad(
                    d.capacidad_texto,
                    capacidadDeclaradaDeLaPartida,
                    opcionesCapacidad
                )
                const sinAval = it.veredicto === 'SIN_AVAL'
                const esPasa = it.veredicto === 'PASA'
                nuevas.push({
                    pieza: {
                        id_partida_entrada: partidaSel,
                        id_marca: idMarca,
                        atributos: huella,
                        resultado: esPasa ? 'PASA' : 'NO_PASA',
                        id_motivo: esPasa ? undefined : it.motivoRechazoId,
                        porcentaje_salud: esPasa ? undefined : d.salud.puntaje ?? undefined,
                        desvio,
                        /* ⭐ MEJORA 52 — la DECISIÓN del técnico viaja con la pieza (y con el desvío). */
                        reclasificar: desvio ? it.reclasificar === true : false,
                        /**
                         * ⭐ MEJORA 52 — **la pieza reclasificada viaja con SU NS**, que es lo que permite
                         * que su número de serie quede apuntando a **la partida nueva** (decisión D5) sin
                         * depender del orden del concentrado: el concentrado solo garantiza las CANTIDADES,
                         * no a qué pieza pertenece cada NS.
                         */
                        ns: desvio && it.reclasificar ? (d.serial ?? undefined) : undefined,
                    },
                    lectura: aLectura(d, partidaSel, idMarca, it.contexto),
                    marcaNombre,
                    etiqueta: esPasa ? 'PASA' : sinAval ? 'REVISAR' : 'NO PASA',
                    tono: esPasa ? 'exito' : sinAval ? 'advertencia' : 'peligro',
                })
                if (d.serial) lecturasNuevas.push(aLectura(d, partidaSel, idMarca, it.contexto))
            }
            setRonda((prev) => [...prev, ...nuevas])
            setLecturas((prev) => [...prev, ...lecturasNuevas])
            // La huella de la partida se enriquece con lo que dijo el disco: la próxima
            // pieza arranca con esos atributos ya puestos.
            setAtributos((prev) => {
                const acc = { ...prev }
                for (const it of items) Object.assign(acc, atributosDesdeDisco(it.disco, esquema))
                return acc
            })
        },
        [marcas, esquema, construirHuella, partidaSel, restantes, ronda.length, asegurarMarca,
         capacidadDeclaradaDeLaPartida, opcionesCapacidad]
    )

    // ── La puerta manual (RAM / ingreso directo) ───────────────────────────────
    const agregarPiezaManual = () => {
        if (!marcaSel) {
            toast.error('Elige la marca antes de agregar.')
            return
        }
        if (resultado === 'NO_PASA' && !idMotivo) {
            toast.error('Elige el motivo del rechazo.')
            return
        }
        if (ronda.length >= restantes) {
            toast.error(`Solo quedan ${restantes} pieza(s) por revisar en esta partida.`)
            return
        }
        setRonda((prev) => [
            ...prev,
            {
                pieza: {
                    id_partida_entrada: partidaSel,
                    id_marca: marcaSel,
                    atributos: construirHuella(),
                    resultado,
                    id_motivo: resultado === 'NO_PASA' ? idMotivo : undefined,
                    porcentaje_salud:
                        resultado === 'NO_PASA' && porcentajeSalud !== '' ? Number(porcentajeSalud) : undefined,
                },
                marcaNombre: marcas.find((m) => m.id === marcaSel)?.nombre ?? '—',
                etiqueta: resultado === 'PASA' ? 'PASA' : 'NO PASA',
                tono: resultado === 'PASA' ? 'exito' : 'peligro',
            },
        ])
        limpiarEditorManual(true) // conserva la marca (el técnico suele repetirla)
    }

    const quitarPieza = (i: number) => {
        setRonda((prev) => prev.filter((_, idx) => idx !== i))
        setLecturas((prev) => prev.filter((_, idx) => idx !== i))
    }

    /**
     * ⭐ MEJORA 25 — persiste el turno y devuelve las partidas RECARGADAS (o `null` si no
     * se pudo). Se separa de `guardar` porque hay DOS consumidores: el guardado normal (que
     * cierra si ya no queda nada) y el «guardar y liberar» (que NO cierra).
     */
    const persistirTurno = async (): Promise<{ ps: PartidaConAvance[]; nsDeLaLectura: number } | null> => {
        if (!entrada || ronda.length === 0) {
            toast.error('Agrega al menos una pieza a tu avance.')
            return null
        }
        // ⚠️ Una pieza NO_PASA necesita motivo, SALVO las SIN AVAL: esas van sin motivo a
        // propósito, porque el taller no avaló el número que las condenaría.
        const sinMotivo = ronda.filter(
            (r) => r.pieza.resultado === 'NO_PASA' && !r.pieza.id_motivo && r.etiqueta !== 'REVISAR'
        )
        if (sinMotivo.length > 0) {
            toast.error('Toda pieza NO PASA necesita motivo.')
            return null
        }
        setCargando(true)
        const piezas = ronda.map((r) => r.pieza)
        /**
         * ⭐ MEJORA 35 — el CONCENTRADO: si la partida de este turno lleva NS, hacen falta ANTES
         * de escribir (D2: sin NS no se guarda una tanda). Primero los que pasaron, después
         * los que no. ⭐ MEJORA 44 — llegan PRELLENADOS con los NS que el lector ya obtuvo.
         * ⭐ MEJORA 48 (04 Oct 2026, decisión del dueño «A + B») — **y si el lector ya trajo TODOS,
         * NO SE PIDEN.** El flujo de HDD/SSD/M.2 **nace del escaneo**: cada pieza de la ronda trae
         * su `lectura.ns` (se ve en su fila, `N/S …`), así que abrir la captura era pedirle al técnico
         * que **confirmara lo que ya teníamos**.
         * 🔴 **NO se saltea cuando el prellenado quedó INCOMPLETO**: ahí la captura es la **única
         * fuente** de esos NS (categorías sin lector —la RAM no tiene SMART— o piezas revisadas sin
         * el dock) y **R12 + D2 los exigen**. En ese caso sigue abriendo, prellenada como siempre.
         */
        const pideNs = partidaActual?.lleva_ns === true
        const nPasa = piezas.filter((p) => p.resultado === 'PASA').length
        const nNoPasa = piezas.filter((p) => p.resultado === 'NO_PASA').length
        let nsTanda: NsTanda | undefined
        /** Cuántos NS se tomaron de la lectura sin preguntar (para decirlo al guardar · «B»). */
        let nsDeLaLectura = 0
        if (pideNs && nPasa + nNoPasa > 0) {
            // Los NS leídos, repartidos según el resultado de cada pieza de la ronda.
            const pasaLeidos: string[] = []
            const noPasaLeidos: string[] = []
            for (const r of ronda) {
                const ns = r.lectura?.ns?.trim()
                if (!ns) continue
                if (r.pieza.resultado === 'PASA') pasaLeidos.push(ns)
                else noPasaLeidos.push(ns)
            }
            const completo = pasaLeidos.length >= nPasa && noPasaLeidos.length >= nNoPasa
            if (completo) {
                // ⭐ «A» — el lector ya cerró las DOS listas: se guarda directo, sin preguntar nada.
                nsTanda = { pasa: pasaLeidos.slice(0, nPasa), noPasa: noPasaLeidos.slice(0, nNoPasa) }
                nsDeLaLectura = nPasa + nNoPasa
            } else {
                setNsPrellenado(
                    pasaLeidos.length || noPasaLeidos.length
                        ? { pasa: pasaLeidos.slice(0, nPasa), noPasa: noPasaLeidos.slice(0, nNoPasa) }
                        : null
                )
                const capturados = await new Promise<NsTanda | null>((resolve) => {
                    setResolverNs(() => resolve)
                    setCapturaNs({ pasa: nPasa, noPasa: nNoPasa })
                })
                setCapturaNs(null)
                setResolverNs(null)
                setNsPrellenado(null)
                if (!capturados) {
                    // ⚠️ Cancelar la captura NO puede dejar el wizard en «Guardando…»: sin liberar
                    // el estado, los botones del pie quedaban apagados y el modal parecía colgado.
                    setCargando(false)
                    return null
                }
                nsTanda = capturados
            }
        }

        const res = await guardarAvanceRevision({
            id_entrada: entrada.id,
            piezas,
            ns: nsTanda,
            // ⭐ MEJORA 44 — la EVIDENCIA de la lectura viaja con la tanda (si hubo lector).
            lecturas: lecturas.length ? lecturas : undefined,
        })
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo guardar el avance.')
            return null
        }
        setRonda([])
        setLecturas([])
        const ps = await cargarPartidas(entrada.id)
        const p = ps.find((x) => x.id === partidaSel)
        if (p) setAtributos(aTexto(p.atributos))
        onGuardado?.()
        return { ps, nsDeLaLectura }
    }

    const guardar = async () => {
        const r = await persistirTurno()
        if (!r) return
        // ⭐ MEJORA 48 · «B» — si los NS vinieron de la lectura, se DICE: el técnico tiene que poder
        // notar que se guardaron (y verlos: cada pieza los muestra en su fila, `N/S …`).
        toast.success(
            r.nsDeLaLectura > 0
                ? `Avance guardado · ${r.nsDeLaLectura} N/S tomados de la lectura`
                : 'Avance de revisión guardado'
        )
        // ⭐ HACER Y CERRAR — si ya no queda NADA por revisar en la entrada, la acción
        // resolvió y no hay siguiente paso: el modal se cierra solo.
        // ⚠️ Si queda trabajo NO se cierra: este wizard guarda RONDAS (el técnico puede
        // tomar otro bloque de piezas), y cerrar a la fuerza obligaría a reabrirlo.
        if (!r.ps.some((x) => x.restantes > 0)) cerrar()
    }

    /**
     * ⭐ MEJORA 25 (decisión 22.a) — **guardar NO es liberar**. El técnico guarda varias
     * veces por turno; liberar entrega mercancía a otro puesto y es una decisión aparte.
     */
    const guardarYLiberar = async () => {
        if (!entrada) return
        if (ronda.length > 0) {
            const r = await persistirTurno()
            if (!r) return
            toast.success(
                r.nsDeLaLectura > 0
                    ? `Avance guardado · ${r.nsDeLaLectura} N/S de la lectura · libera ahora lo que ya está listo`
                    : 'Avance guardado · libera ahora lo que ya está listo'
            )
        }
        onLiberar?.(entrada, partidaSel)
    }

    return (
        <Dialog open={open} onOpenChange={alCambiarApertura}>
            {/* ⭐ MEJORA 44 (1 Oct 2026, decisión del usuario) — **el modal se ensancha en
                horizontal** (`min(1120px, 94vw)`: ~962px en la tablet 1024×768 del almacén y
                1120px en un monitor) porque el puesto de trabajo son las FICHAS lado a lado.
                Y **no se cierra al tocar afuera**: el velo ignora el clic; la salida es siempre por
                un botón — o por `Esc`, que pasa por el mismo guardián de pérdida. */}
            <DialogContent
                className="max-h-[92vh] overflow-y-auto sm:max-w-[min(1120px,94vw)]"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader className="space-y-2">
                    {/* ⭐ El retroceso va en el ENCABEZADO, junto al pulgar: la salida natural
                        de una superficie táctil no es el `×` de la esquina. La fila va ANIDADA
                        (no como className del DialogHeader), o el eyebrow del módulo entra en
                        la fila y el título queda 6px abajo (SPEC §2.1). */}
                    <div className="flex flex-row items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 shrink-0 gap-1.5 px-3 text-[14px]"
                            onClick={atras}
                            disabled={cargando}
                            title={
                                hayPartida
                                    ? 'Volver a la lista de partidas (si hay piezas sin guardar, pregunta antes)'
                                    : 'Volver a la cola'
                            }
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Atrás
                        </Button>
                        <DialogTitle>
                            Revisión — {entrada?.folio ?? ''}
                            {partidaActual ? ` · Partida ${partidaActual.partida}` : ''}
                            {categoriaActual ? ` — ${categoriaActual.nombre}` : ''}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                {!cargado ? (
                    /* ⭐ MEJORA 44 — mientras no llegaron las partidas NO se dice «no tiene
                       partidas» (era una mentira de un frame) ni se pinta ninguna puerta. */
                    <Spinner etiqueta="Cargando las partidas de la entrada…" className="py-1" />
                ) : partidas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Esta entrada no tiene partidas.</p>
                ) : (
                    <div className="space-y-4">
                        {/* ⭐ MEJORA 44 — ELEGIR LA PARTIDA: bloques TOCABLES, no un `<select>`.
                            Medido (`DOCS/design/revision/01-elegir-partida.html`, etapa 1 de 7):
                            el `<select>` abre con el sistema operativo y su texto vive en una línea
                            de 11px — en la tablet del almacén eso es apuntar fino. El dato es EL
                            MISMO (`PartidaConAvance`): cambia el tamaño del blanco. 62px de alto y
                            «elegir» + «saber qué elegís» en un solo toque.
                            ⚠️ DESVIACIÓN DECLARADA del mockup: una partida COMPLETA sigue siendo
                            elegible (el mockup la pinta apagada). Es la ÚNICA puerta para entrar a
                            liberar lo que quedó pendiente de una partida ya revisada — apagarla
                            rompería el caso de la MEJORA 43 (`ajustada` con saldo por entregar). */}
                        <div className="space-y-1.5">
                            <Label className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                Partida
                            </Label>
                            <div
                                role="radiogroup"
                                aria-label="Partida de este turno"
                                className="flex flex-col gap-2.5"
                            >
                                {partidasVisibles.map((p) => {
                                    const elegida = p.id === partidaSel
                                    /**
                                     * ⭐ MEJORA 52 (07 Oct 2026) — **LO QUE HAY QUE REVISAR es el FINAL
                                     * de la partida, no lo declarado.**
                                     *
                                     * Una partida **NACIDA por reclasificación** no tiene NADA declarado
                                     * (`cantidad_original = 0` — y el CHECK lo garantiza: solo una nacida
                                     * puede tener 0) pero **SÍ trae piezas que revisar**: su vigente sube
                                     * al guardar la reclasificación. Con `cantidad_original`, esa fila
                                     * decía **«0 declaradas · 1 revisadas»** y **«1 / 0»** — los números de
                                     * la vista de Revisión no cuadraban (cazado por el dueño el 07 Oct).
                                     *
                                     * ⚠️ Y `vigente` NO cambia el caso normal: durante la revisión la DEV
                                     * todavía no se aplica (se aplica al emitir la nota), así que
                                     * `vigente === original` salvo cuando hubo una reclasificación, que es
                                     * **exactamente** el caso que esto arregla.
                                     */
                                    const esNacida = p.cantidad_original === 0
                                    const declaradas = Math.max(p.cantidad_vigente ?? 0, p.revisadas)
                                    const revisadas = p.revisadas
                                    const quedan = Math.max(0, p.restantes)
                                    const completa = quedan === 0
                                    const porc =
                                        declaradas > 0
                                            ? Math.min(100, Math.round((revisadas / declaradas) * 100))
                                            : 0
                                    return (
                                        <label
                                            key={p.id}
                                            data-accion="elegir-partida"
                                            data-partida={p.partida}
                                            className={cn(
                                                'relative flex min-h-[62px] w-full cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors',
                                                'border-border bg-surface hover:bg-hover-background',
                                                elegida && 'border-acc-entradas/40 bg-acc-entradas/10',
                                                cargando && 'cursor-not-allowed opacity-60'
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="partida-revision"
                                                className="peer sr-only"
                                                value={p.id}
                                                checked={elegida}
                                                disabled={cargando}
                                                onChange={() => cambiarPartida(p.id)}
                                            />
                                            {/* El foco del teclado se pinta sobre el bloque entero: el
                                                radio real va oculto, así que el anillo lo dibuja este
                                                velo (hermano POSTERIOR del input, por eso `peer-focus-visible`). */}
                                            <span
                                                aria-hidden="true"
                                                className="pointer-events-none absolute inset-0 rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                                            />
                                            <span
                                                className={cn(
                                                    'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-md border',
                                                    'border-border bg-surface-2 text-muted-foreground',
                                                    elegida && 'border-acc-entradas/40 bg-acc-entradas/10 text-acc-entradas',
                                                    completa && !elegida && 'text-success'
                                                )}
                                                aria-hidden="true"
                                            >
                                                {completa ? (
                                                    <Check className="h-4 w-4" />
                                                ) : (
                                                    <Package className="h-4 w-4" />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[14px] font-semibold leading-snug">
                                                    Partida {p.partida} · {p.categoria_nombre ?? 'sin categoría'}
                                                    {/* ⭐ FIX 08 Oct 2026 — LA CAPACIDAD, en la descripción. */}
                                                    {describirAtributosDePartida(p.atributos)
                                                        ? ` · ${describirAtributosDePartida(p.atributos)}`
                                                        : ''}
                                                </span>
                                                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                                                    {/* ⭐ FIX 08 Oct 2026 — CUÁNTAS PIEZAS SON, EN GRANDE:
                                                        es el número con el que el técnico decide qué turno
                                                        tomar, y estaba al mismo tamaño que el resto. */}
                                                    <b className="text-[15px] tabular-nums text-foreground">
                                                        {declaradas}
                                                    </b>{' '}
                                                    {esNacida ? 'por reclasificación' : 'declaradas'} ·{' '}
                                                    {revisadas} revisadas ·{' '}
                                                    {completa ? (
                                                        <b className="text-success">completa</b>
                                                    ) : (
                                                        <>
                                                            quedan <b className="text-foreground">{quedan}</b>
                                                        </>
                                                    )}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-right">
                                                <span className="flex h-[7px] w-24 overflow-hidden rounded-full bg-border">
                                                    {porc > 0 ? (
                                                        <span
                                                            className="block h-full bg-success"
                                                            style={{ width: `${porc}%` }}
                                                        />
                                                    ) : null}
                                                    {porc < 100 ? (
                                                        <span
                                                            className="block h-full bg-warning/55"
                                                            style={{ width: `${100 - porc}%` }}
                                                        />
                                                    ) : null}
                                                </span>
                                                <span className="mt-1 block font-mono text-[11px] tabular-nums text-muted-foreground">
                                                    {revisadas} / {declaradas}
                                                </span>
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                            {hayPartida ? (
                                <Ayuda
                                    k="revision.atras-vuelve-a-la-lista"
                                    className="text-[12px] text-muted-foreground"
                                />
                            ) : null}
                        </div>

                        {/* ⭐ MEJORA 44 — LEER LOS DISCOS DEL DOCK. El navegador no puede leer un
                            disco: se lo pide al AGENTE de esta misma PC. Trae el NS del firmware,
                            la marca, las horas y ⭐ LA SALUD. El panel solo se pinta si la
                            categoría lo pide por BANDERA (`requiere_lector`): la RAM no tiene
                            SMART y el ingreso directo no pasa por acá. */}
                        <PanelLectorDiscos
                            aplica={usaLector}
                            motivos={motivos}
                            onElegir={() => {
                                /* La marca y los atributos los resuelve `registrarRonda`: acá
                                   no hay que llenar ningún formulario (ya no existe). */
                            }}
                            onRegistrar={registrarRonda}
                            enRonda={ronda.length}
                            onEstado={alCambiarPanel}
                            /* ⭐ MEJORA 52 — de qué es la partida, para avisar si un disco NO lo es.
                               ⚠️ Sale de la PARTIDA, no del estado de la ronda (`atributos`): ese se
                               sobreescribe con lo que dijo el disco y hacía desaparecer el aviso. */
                            capacidadDeclarada={capacidadDeclaradaDeLaPartida}
                            opcionesCapacidad={opcionesCapacidad}
                        />

                        {/* ⭐ FIX 08 Oct 2026 — ACÁ YA NO VA EL EDITOR DE LÍNEA GENERAL.
                            Con LECTOR la línea es **de cada disco** y se elige en la fila de la ronda
                            (`lineasPorMarca` abajo): un turno puede traer un WD Blue y un Seagate
                            Barracuda, y el editor general les daba la MISMA a las dos.
                            El editor general sigue vivo en la captura a mano (una pieza a la vez). */}

                        {/* ⚠️ CAPTURA MANUAL — solo cuando NO hay lector (RAM, ingreso directo).
                            El disco no puede leer una RAM: no tiene SMART.

                            ⭐ EL PARPADEO QUE REPORTÓ EL USUARIO (1 Oct 2026): al abrir, se veía un
                            instante la vista VIEJA —los botones PASÓ / NO PASÓ, el motivo, el %— y
                            después se actualizaba sola. La causa: `require_lector` no se conoce hasta
                            que responden las Server Actions, y `categoriaActual` arranca en `null`,
                            así que `usaLector` era `false` en el primer render y `capturaManual` era
                            `true`. O sea: la captura manual se pintaba durante el instante en que
                            TODAVÍA NO SE SABÍA si hacía falta.
                            El arreglo no es esconderla: es **no pintar ninguna de las dos puertas
                            hasta saber cuál toca** — y mientras tanto decir que está cargando, que
                            es la regla del proyecto (un bloque que no llegó no se pinta vacío). */}
                        {capturables.length === 0 ? (
                            <Spinner etiqueta="Cargando la categoría de la partida…" className="py-1" />
                        ) : !hayPartida ? (
                            /* ⭐ MEJORA 44 — EL PASO QUE FALTABA: ELEGIR. Hasta que el técnico toque
                               una partida no se enciende ninguna de las dos puertas (mockup
                               `DOCS/design/revision/01-elegir-partida.html`, etapa 1 de 7). Se dice
                               qué va a pasar al tocar, en vez de pintar una puerta que no toca. */
                            <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted-foreground">
                                Elegí la partida de este turno: en cuanto la toques, el modal enciende{' '}
                                <b>la suya</b> — el lector de discos si la categoría lo pide, o la captura
                                a mano si no.
                            </p>
                        ) : capturaManual ? (
                            <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-4">
                                <p className="text-[13px]">
                                    Esta categoría <b>no se revisa con el lector</b> (no tiene SMART).
                                    Capturá la pieza a mano, como siempre.
                                </p>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground">Categoría</Label>
                                        <p className="text-sm font-medium">{categoriaActual?.nombre ?? '—'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px]">
                                            Marca <span className="text-destructive">*</span>
                                        </Label>
                                        <select
                                            className="h-11 w-full rounded-md border border-border bg-surface px-2 text-sm"
                                            value={marcaSel}
                                            onChange={(e) => setMarcaSel(e.target.value)}
                                            disabled={cargando}
                                        >
                                            <option value="">— elige marca —</option>
                                            {marcas.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {editorLinea}
                                    {enRevision.filter((at) => !at.opciones_por_marca).map((at) => (
                                        <div key={at.clave} className="space-y-1">
                                            <Label className="text-[11px]">
                                                {at.etiqueta}
                                                {at.requerido ? <span className="text-destructive"> *</span> : ''}
                                            </Label>
                                            {at.tipo === 'multi' && at.opciones ? (
                                                /* ⭐ 06 Oct 2026 — el CONJUNTO (sockets de un disipador,
                                                   puertos, conectores): chips que se encienden y se
                                                   apagan. El array viaja **sin ordenar** y la BD lo
                                                   canoniza (`fn_valor_canonico`) — así ningún escritor
                                                   puede producir dos SKU del mismo conjunto. */
                                                <div className="flex flex-wrap gap-1.5">
                                                    {at.opciones.map((op) => {
                                                        const lista = Array.isArray(atributos[at.clave])
                                                            ? (atributos[at.clave] as string[])
                                                            : []
                                                        const sel = lista.includes(op)
                                                        return (
                                                            <button
                                                                key={op}
                                                                type="button"
                                                                disabled={cargando}
                                                                aria-pressed={sel}
                                                                onClick={() =>
                                                                    setAtributos((prev) => {
                                                                        const actual = Array.isArray(prev[at.clave])
                                                                            ? (prev[at.clave] as string[])
                                                                            : []
                                                                        return {
                                                                            ...prev,
                                                                            [at.clave]: actual.includes(op)
                                                                                ? actual.filter((x) => x !== op)
                                                                                : [...actual, op],
                                                                        }
                                                                    })
                                                                }
                                                                className={`rounded-md border px-2 py-1 text-xs transition disabled:opacity-50 ${
                                                                    sel
                                                                        ? 'border-primary bg-primary/10 font-medium text-foreground'
                                                                        : 'border-border text-muted-foreground hover:border-primary/50'
                                                                }`}
                                                            >
                                                                {op}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            ) : at.tipo === 'select' && at.opciones ? (
                                                <select
                                                    className="h-11 w-full rounded-md border border-border bg-surface px-2 text-sm"
                                                    value={atributos[at.clave] ?? at.valor_default ?? ''}
                                                    onChange={(e) =>
                                                        setAtributos((prev) => ({ ...prev, [at.clave]: e.target.value }))
                                                    }
                                                    disabled={cargando}
                                                >
                                                    <option value="">—</option>
                                                    {at.opciones.map((op) => (
                                                        <option key={op} value={op}>
                                                            {op}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <Input
                                                    type={at.tipo === 'number' ? 'number' : 'text'}
                                                    className="h-11"
                                                    value={atributos[at.clave] ?? ''}
                                                    onChange={(e) =>
                                                        setAtributos((prev) => ({ ...prev, [at.clave]: e.target.value }))
                                                    }
                                                    disabled={cargando}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {defaults.length > 0 && (
                                    <p className="text-[11.5px] text-muted-foreground">
                                        Automático: {defaults.map((d) => `${d.etiqueta} = ${d.valor_default}`).join(' · ')}
                                    </p>
                                )}

                                {/* La decisión: dos botones de dedo, no un `select`. */}
                                <div className="space-y-2">
                                    <Label className="text-sm">¿Esta pieza pasó?</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setResultado('PASA')}
                                            disabled={cargando}
                                            aria-pressed={resultado === 'PASA'}
                                            className={cn(
                                                'flex min-h-[116px] flex-col items-center justify-center gap-1 rounded-lg border-2 text-xl font-bold transition-colors',
                                                resultado === 'PASA'
                                                    ? 'border-success/60 bg-success/15 text-success'
                                                    : 'border-border bg-surface-raised text-muted-foreground hover:bg-hover-background'
                                            )}
                                        >
                                            ✓ PASÓ
                                            <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                                                suma al avance
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setResultado('NO_PASA')}
                                            disabled={cargando}
                                            aria-pressed={resultado === 'NO_PASA'}
                                            className={cn(
                                                'flex min-h-[116px] flex-col items-center justify-center gap-1 rounded-lg border-2 text-xl font-bold transition-colors',
                                                resultado === 'NO_PASA'
                                                    ? 'border-destructive/60 bg-destructive/15 text-destructive'
                                                    : 'border-border bg-surface-raised text-muted-foreground hover:bg-hover-background'
                                            )}
                                        >
                                            ✕ NO PASÓ
                                            <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                                                pide motivo
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {resultado === 'NO_PASA' ? (
                                    <div className="space-y-3 rounded-lg border border-destructive/30 p-3">
                                        <div className="space-y-2">
                                            <Label className="text-sm">¿Por qué no pasó?</Label>
                                            <div className="grid gap-2">
                                                {motivos.map((m, i) => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => setIdMotivo(m.id)}
                                                        disabled={cargando}
                                                        aria-pressed={idMotivo === m.id}
                                                        className={cn(
                                                            'flex min-h-[62px] items-center gap-3 rounded-md border px-4 text-left text-sm font-semibold transition-colors',
                                                            idMotivo === m.id
                                                                ? 'border-warning bg-warning/10'
                                                                : 'border-border bg-surface-raised hover:bg-hover-background'
                                                        )}
                                                    >
                                                        <span className="font-mono text-xs text-muted-foreground">
                                                            {i + 1}
                                                        </span>
                                                        {m.nombre}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {motivoSel?.requiere_porcentaje && (
                                            <div className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-3">
                                                <Label className="text-xs uppercase tracking-wide text-warning">
                                                    {motivoSel.nombre} · indica el porcentaje
                                                </Label>
                                                <div className="grid grid-cols-[64px_1fr_64px] items-center gap-3">
                                                    <button
                                                        type="button"
                                                        aria-label="Bajar 5 por ciento"
                                                        disabled={cargando}
                                                        onClick={() =>
                                                            setPorcentajeSalud((v) =>
                                                                String(Math.max(0, Number(v || 0) - 5))
                                                            )
                                                        }
                                                        className="flex min-h-[64px] items-center justify-center rounded-md border border-border bg-surface-raised hover:bg-hover-background"
                                                    >
                                                        <Minus className="h-6 w-6" aria-hidden="true" />
                                                    </button>
                                                    <div className="text-center text-4xl font-bold tabular-nums">
                                                        {porcentajeSalud || '—'}
                                                        <span className="text-lg">%</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-label="Subir 5 por ciento"
                                                        disabled={cargando}
                                                        onClick={() =>
                                                            setPorcentajeSalud((v) =>
                                                                String(Math.min(100, Number(v || 0) + 5))
                                                            )
                                                        }
                                                        className="flex min-h-[64px] items-center justify-center rounded-md border border-border bg-surface-raised hover:bg-hover-background"
                                                    >
                                                        <Plus className="h-6 w-6" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : null}

                                <Button
                                    type="button"
                                    className="min-h-[64px] w-full text-base"
                                    onClick={agregarPiezaManual}
                                    disabled={cargando || !marcaSel || restantes <= ronda.length}
                                >
                                    <Plus className="mr-1.5 h-5 w-5" aria-hidden="true" />
                                    {resultado === 'PASA' ? 'Registrar PASÓ y seguir' : 'Registrar NO PASÓ y seguir'}
                                    <span className="ml-1.5 opacity-80">
                                        ({ronda.length + 1} de {restantes})
                                    </span>
                                </Button>
                            </div>
                        ) : null}

                        {/* ── LA RONDA: lo que se acumuló y todavía NO se escribió ────────
                            ⭐ MEJORA 44 (1 Oct 2026) — aparece recién con la partida elegida: sin
                            partida no hay «ronda de esta partida» ni avance que mostrar (el
                            contador diría «0/0», que se lee como un error de la app). */}
                        {hayPartida ? (
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Label className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                        Ronda de esta partida ({ronda.length}/{restantes})
                                    </Label>
                                    {ronda.length > 0 ? (
                                        <span className="flex items-center gap-2 text-[12px]">
                                            <Pildora texto={`${okRonda} pasa(n)`} tono="exito" />
                                            {malRonda > 0 ? <Pildora texto={`${malRonda} a devolución`} tono="peligro" /> : null}
                                            {revisarRonda > 0 ? (
                                                <Pildora texto={`${revisarRonda} por revisar`} tono="advertencia" />
                                            ) : null}
                                        </span>
                                    ) : null}
                                </div>

                                {ronda.length === 0 ? (
                                    <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted-foreground">
                                        {usaLector
                                            ? 'Leé los discos del dock, formatealos y registrá la ronda. Nada se escribe hasta que guardes el avance.'
                                            : 'Aún no has agregado piezas en esta ronda.'}
                                    </p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {ronda.map((r, i) => (
                                            <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                                                <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                                                <span className="font-semibold">{r.marcaNombre}</span>
                                                {/* ⭐ FIX 08 Oct 2026 — LA LÍNEA DE ESTE DISCO.
                                                    Un turno puede traer un WD Blue y un Seagate Barracuda:
                                                    la línea es identidad de la PIEZA y se elige acá, una
                                                    por disco (las opciones salen del catálogo de SU marca).
                                                    El disco no la sabe — el agente no la manda. */}
                                                {lineasDelEsquema.map((at) => {
                                                    const ops = lineasPorMarca[r.pieza.id_marca ?? ''] ?? []
                                                    if (ops.length === 0) return null
                                                    const elegida = String(r.pieza.atributos?.[at.clave] ?? '')
                                                    return (
                                                        <select
                                                            key={at.clave}
                                                            className={cn(
                                                                'h-8 shrink-0 rounded-md border bg-surface px-1.5 text-[12px]',
                                                                elegida
                                                                    ? 'border-primary/50 font-medium text-foreground'
                                                                    : 'border-border text-muted-foreground'
                                                            )}
                                                            value={elegida}
                                                            onChange={(e) =>
                                                                cambiarAtributoDePieza(i, at.clave, e.target.value)
                                                            }
                                                            disabled={cargando}
                                                            aria-label={`${at.etiqueta ?? at.clave} de la pieza ${i + 1}`}
                                                            title={`${at.etiqueta ?? at.clave} de ESTE disco — es identidad de la pieza`}
                                                        >
                                                            <option value="">
                                                                — {(at.etiqueta ?? at.clave).toLowerCase()} —
                                                            </option>
                                                            {ops.map((l) => (
                                                                <option key={l.id} value={l.nombre}>
                                                                    {l.nombre}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )
                                                })}
                                                {r.lectura?.ns ? (
                                                    <span className="font-mono text-[12px] text-muted-foreground">
                                                        N/S {r.lectura.ns}
                                                    </span>
                                                ) : null}
                                                {r.lectura?.bahia ? (
                                                    <Pildora texto={`bahía ${r.lectura.bahia}`} tono="info" />
                                                ) : null}
                                                {/* ⭐ MEJORA 44 (1 Oct 2026) — **la capacidad y las horas
                                                    también en la ronda.** Son los dos datos con los que se
                                                    cierra el turno y con los que se pone precio; antes la
                                                    lista solo decía N/S · bahía · salud. Salen del NÚMERO
                                                    guardado (`capacidad_gb`) formateado por la MISMA función
                                                    probada que usa la ficha: los dos lugares no pueden decir
                                                    cosas distintas del mismo disco. */}
                                                {r.lectura?.capacidad_gb !== null &&
                                                r.lectura?.capacidad_gb !== undefined ? (
                                                    <span className="font-mono text-[12px] font-semibold tabular-nums">
                                                        {capacidadTextoDesdeGb(r.lectura.capacidad_gb)}
                                                    </span>
                                                ) : null}
                                                {r.lectura?.horas_uso !== null &&
                                                r.lectura?.horas_uso !== undefined ? (
                                                    <span className="text-[12px] text-muted-foreground">
                                                        <b className="text-foreground tabular-nums">
                                                            {r.lectura.horas_uso}
                                                        </b>{' '}
                                                        h
                                                    </span>
                                                ) : null}
                                                <span className="flex-1" />
                                                {r.lectura?.salud_puntaje !== null && r.lectura?.salud_puntaje !== undefined ? (
                                                    <span className="tabular-nums text-[12.5px] text-muted-foreground">
                                                        {r.lectura.salud_puntaje}%
                                                    </span>
                                                ) : null}
                                                <Pildora texto={r.etiqueta} tono={r.tono} />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-11 w-11"
                                                    onClick={() => quitarPieza(i)}
                                                    aria-label={`Quitar la pieza ${i + 1}`}
                                                >
                                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[52px] px-5 text-[15px]"
                        onClick={atras}
                        disabled={cargando}
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                    {/* ⭐ MEJORA 25 (decisión 22.a) — DOS acciones, no una: guardar es la bitácora del
                        turno; liberar es la ENTREGA a otro puesto. Si se fusionaran, cada guardado
                        parcial sacaría mercancía del expediente sin que nadie lo haya pedido. */}
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[52px] px-5 text-[15px]"
                        onClick={guardarYLiberar}
                        disabled={cargando || partidas.length === 0 || liberables === 0}
                        title={
                            liberables === 0
                                ? 'No hay piezas aprobadas sin liberar en esta partida.'
                                : `${liberables} pieza(s) aprobadas pueden pasar ya a limpieza, sin esperar al resto.`
                        }
                    >
                        <PackageCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Liberar {liberables} a acondicionamiento
                    </Button>
                    <Button
                        type="button"
                        className="min-h-[56px] px-6 text-[16px] font-semibold sm:flex-none"
                        onClick={guardar}
                        disabled={cargando || ronda.length === 0 || partidas.length === 0}
                    >
                        <Check className="mr-1.5 h-5 w-5" aria-hidden="true" />
                        {cargando
                            ? 'Guardando…'
                            : `Guardar avance${ronda.length > 0 ? ` (${ronda.length})` : ''}`}
                    </Button>
                </DialogFooter>

                {/* ⭐ MEJORA 44 — **LA CONFIRMACIÓN DE SALIDA.** El modal nunca cierra en silencio
                    con piezas sin guardar: «← Atrás», la `×` y `Esc` desembocan todos acá (el velo,
                    además, está bloqueado). La instancia queda montada y la gobierna `open`, como
                    manda la SPEC §2.1.c: el diálogo no se auto-cierra, avisa el padre. */}
                <ConfirmarAccionDialog
                    open={salidaPendiente !== null}
                    onOpenChange={(o) => {
                        if (!o) setSalidaPendiente(null)
                    }}
                    titulo={
                        salidaPendiente === 'lista' ? '¿Volver a la lista de partidas?' : '¿Salir de la revisión?'
                    }
                    descripcion={`Se pierde: ${queSePierde()}.`}
                    detalle={salidaPendiente === 'lista' ? ayudaPierdeLista : ayudaPierdeSalir}
                    confirmLabel={salidaPendiente === 'lista' ? 'Descartar y volver' : 'Salir igual'}
                    cancelLabel="Seguir revisando"
                    variant="destructive"
                    tactil
                    successMessage="Turno descartado"
                    onConfirm={async () => {
                        const destino = salidaPendiente
                        setSalidaPendiente(null)
                        if (destino === 'lista') volverALista()
                        else cerrar()
                        return { error: null }
                    }}
                />

                {/* ⭐ MEJORA 35 · MEJORA 44 — **las dos pantallas del concentrado**: se abren al
                    pulsar Guardar y, sin completarlas, no se escribe nada (D2). Llegan
                    PRELLENADAS con los NS que el lector ya obtuvo (editables como respaldo). */}
                {capturaNs && resolverNs ? (
                    <CapturaNsTanda
                        pasa={capturaNs.pasa}
                        noPasa={capturaNs.noPasa}
                        folio={entrada?.folio ?? ''}
                        partida={partidaActual?.partida ?? null}
                        inicial={nsPrellenado}
                        onListo={(lista) => resolverNs(lista)}
                        onCancelar={() => resolverNs(null)}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
