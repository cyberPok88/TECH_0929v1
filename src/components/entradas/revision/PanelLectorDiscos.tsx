'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL LECTOR DE DISCOS — el puesto lee el disco (Guía 1.6 · MEJORA 44)
// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ Diseño aprobado (1 Oct 2026): `DOCS/design/revision/` — las **7 etapas del modal**
// (`index.html` + `01-elegir-partida` … `07-sin-lector`). El de
// `DOCS/design/entradas/02-revision/revision-lector-discos.html` (v2) fue el de la **anatomía anterior**:
// la anatomía y el flujo siguen vigentes, la capa visual es la nueva.
//
// El técnico aprieta «Leer discos» y el AGENTE de esa PC devuelve lo que el disco dice
// de sí mismo: NS del firmware, marca, modelo, horas, temperatura, bahía… y ⭐ LA SALUD.
//
// ⭐ LAS CUATRO REGLAS DEL MODAL (aprobadas 30 Sep 2026):
//   ① **Las fichas no llevan botones.** Son SOLO información. El registro es de la
//      ronda, no de la pieza (lo único que queda adentro es el RECHAZO A MANO, que sí
//      es una decisión sobre ESA pieza: un golpe o un pin torcido que el SMART no ve).
//   ② **Una sola barra de acciones debajo de TODAS las fichas**: `Formatear` al lado de
//      `Registrar`.
//   ③ **`Registrar` no se activa hasta que el formateo terminó**, y junta TODO lo leído
//      —los que pasan y el de devolución—: las horas y la salud del devuelto son
//      justamente lo que hay que registrar.
//   ④ ⭐ **LA SALUD SOLO DECIDE CON AVAL.** El número sale de tres fuentes y NO son
//      equivalentes: `hdsentinel` (el taller) y `nvme` (el propio disco) deciden;
//      `formula` —el respaldo de la casa, que **arranca en 100**— NO. Un disco sin aval
//      se pinta ámbar «SIN AVAL» y **no manda una devolución automática**.
//
// ⭐⭐ MEJORA 45 (1 Oct 2026) — LOS BOTONES DE LA TARJETA, y por qué la regla ① cambió.
//   El pedido textual del usuario: «en los discos que están al 100, a lado del botón de
//   rechazar, un botón de formatear independiente; y si los 2 discos están al 100 habilitar
//   el botón de formatear 2 discos» + «cuando se detecte uno al 99 y otro al 100: la tarjeta
//   del 99 que diga Registrar».
//   El caso que lo obliga: **un disco bueno y uno malo en el dock**. Antes el único camino
//   era «formatear todo + registrar todo», así que:
//     · el disco de devolución se formateaba igual (el `.ps1` no filtra por salud), y
//     · registrar el malo apagaba el botón para el bueno (`registrado` era una bandera global).
//   Ahora cada tarjeta tiene **sus** dos acciones —`Formatear este disco` (1 NS, solo si ESE
//   pasa) y `Registrar` (1 pieza)— y el botón grande de formatear **solo se habilita con
//   TODOS los leídos al 100**. La regla ③ se mantiene en el fondo: `Registrar` es acumular,
//   escribir es del pie (`Guardar avance`).
//   🔴 `SIN AVAL` NO se formatea: sin aval la salud no manda devolución, pero tampoco habilita
//      un borrado de particiones. Ese disco lo decide el técnico (rechazo a mano) o lo
//      resuelve el taller — formatear no es una decisión que este panel pueda tomar por él.
//
// ⚠ Si el agente no está corriendo, el panel lo dice y NO bloquea: la revisión sigue
//   a mano como siempre.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, Info, Loader2, LogOut, ScanSearch, TriangleAlert, X } from 'lucide-react'

import { ModalFormateo } from '@/components/entradas/revision/ModalFormateo'
import { textoAyuda, useAyuda } from '@/components/ui/Ayuda'
import { useAuth } from '@/lib/stores/auth-store'
import { Button } from '@/components/ui/button'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { Pildora } from '@/components/data-table'
import { cn } from '@/lib/utils'
import {
    EXPULSION_INACTIVA,
    FORMATEO_INACTIVO,
    VERSION_MINIMA_AGENTE,
    contextoDeRespuesta,
    desvioDeCapacidad,
    expulsarDock,
    iniciarFormateo,
    leerDiscos,
    leerEstadoExclusion,
    leerProgresoFormateo,
    type DiscoLeido,
    type EstadoExclusion,
    type ProgresoFormateo,
} from '@/lib/lector-discos'
import {
    errorGlobalDe,
    evaluarSalud,
    type Veredicto,
} from '@/lib/lectura-aval'

/**
 * ⭐ La regla del aval vive en `@/lib/lectura-aval` (sin React) y se re-exporta para que
 * quien consuma este panel la tenga a mano. Una sola implementación: la ficha y el
 * `registrar` no pueden discrepar.
 */
export { evaluarSalud, type Veredicto }

/**
 * ⭐ MEJORA 45 (1 Oct 2026) — **lo que el panel le cuenta al wizard.**
 * Existe por una razón concreta y dura: al salir del modal (o al «← Atrás») se pierden
 * las lecturas sin registrar Y la vista de un formateo en curso, y hasta ahora el wizard
 * **no podía verlo** — su confirmación de salida solo miraba la ronda. Con esto el
 * guardián de la salida puede preguntar por lo que de verdad se pierde, y el botón
 * `Expulsar` puede negarse con un formateo activo.
 */
export interface EstadoPanel {
    /** Hay un formateo corriendo AHORA (no «terminó»: corriendo). */
    formateando: boolean
    /** Hay una expulsión del dock en curso. */
    expulsando: boolean
    /** Discos leídos que todavía NO entraron a la ronda: se pierden si se sale. */
    sinRegistrar: number
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **la marca que muestran los discos leídos**, si es UNA.
     * Existe para que el wizard pueda cargar las **píldoras de la LÍNEA** de esa marca: el catálogo
     * de líneas es **por marca** (las de WD no aplican a Seagate) y el wizard no ve los discos.
     * `null` = sin discos, o con marcas distintas (ahí no se ofrecen líneas: se registra por tandas
     * de una misma línea, que es como el técnico trabaja).
     */
    marcaComun: string | null
}

/** Lo que el panel entrega al registrar la ronda. */
export interface ItemRonda {
    disco: DiscoLeido
    veredicto: Veredicto
    /** El motivo del RECHAZO A MANO, si el técnico lo puso. */
    motivoRechazoId?: string
    motivoRechazoNombre?: string
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **LA DECISIÓN del técnico**: esta pieza **crea su propia partida**,
     * porque la lectura dice que no es de la que se está revisando.
     *
     * Aprobado por el dueño con su condición, que es la que manda: *«si aun detectada la diferencia **no
     * se elige hacer la partida**, esto crearía **descuadre en inventario**, ya que **mentiría**»*.
     * ⇒ `false`/ausente = **no se decidió**, y el registro **se BLOQUEA**: con desvío solo hay dos
     * caminos, **crear su partida** o **rechazarla**.
     */
    reclasificar?: boolean
    /**
     * ⭐ MEJORA 52 — la metadata de la RESPUESTA del agente (motor · HDSentinel · atraso ·
     * completitud), que no vive en el disco. Viaja con el ítem para que la evidencia que se
     * guarda sea **completa** y no se pierda el «esta salud es de hace 3 días».
     */
    contexto?: Record<string, unknown> | null
}

interface PanelLectorDiscosProps {
    /** ¿La categoría de la partida se revisa con el lector? Viene de `requiere_lector`. */
    aplica: boolean
    /** Motivos de rechazo del catálogo (para el rechazo A MANO). */
    motivos?: { id: string; nombre: string }[]
    /**
     * ⭐ EL DISCO RESUELVE EL RESULTADO. Se llama UNA vez por disco al registrar, para
     * que el wizard arme la pieza (marca del catálogo + atributos de la huella + motivo).
     */
    onElegir: (disco: DiscoLeido, motivoRechazoId?: string) => void
    /**
     * ⭐ Se registraron TODOS los discos leídos en la ronda. El wizard acumula en memoria:
     * **esto NO escribe en la base** — la escritura pasa al guardar el avance (el pie).
     */
    onRegistrar: (items: ItemRonda[]) => void
    /** Cuántos discos ya están en la ronda (para el contador del botón). */
    enRonda?: number
    /** Se llama cuando el formateo termina, para que el padre refresque lo que necesite. */
    onFormateado?: () => void
    /**
     * ⭐ MEJORA 45 — el estado del panel hacia el wizard (formateo en curso y lecturas sin
     * registrar). El wizard lo usa para que la confirmación de salida no deje perder un
     * formateo ni unas lecturas en silencio. `useCallback` en el padre, por favor: entra en
     * las dependencias de un `useMemo`.
     */
    onEstado?: (estado: EstadoPanel) => void
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **de qué es la PARTIDA que se está revisando**, para poder avisar
     * cuando un disco **no es de lo que dice la entrada**. Los dos salen del esquema de la categoría y
     * de lo que se declaró en Recepción (los pasa el wizard, que sí los tiene).
     *
     * El caso del dueño: *«pueden decir que son de 1TB pero vienen 2 de 500GB, **por eso se revisa**»*.
     */
    capacidadDeclarada?: string | null
    /** Las opciones de `capacidad` del esquema — para etiquetar lo medido con el mismo idioma. */
    opcionesCapacidad?: string[]
}

/**
 * ⚠️ Umbral de frescura y la regla del aval **viven en `@/lib/lectura-aval`** (sin React):
 * es la regla que decide si una pieza se devuelve o se vende, y tiene que poder probarse
 * sin montar un componente. Acá no se reimplementa nada.
 */

const n = (v: number | null | undefined, u = '') => (v === null || v === undefined ? '—' : `${v}${u}`)

/**
 * ⭐ MEJORA 46 — cuántos sondeos fallidos SEGUIDOS hacen falta para declarar «se perdió el
 * contacto». Con el sondeo cada 700 ms son **≈3,5 s**: suficiente para no confundir un tropiezo
 * momentáneo con una caída, y corto para no dejar al técnico esperando en una pantalla muerta.
 * (Es la escotilla del D3: sin esto, «no se cierra hasta el resultado» sería una trampa si el
 * agente se muere.)
 */
const FALLOS_PARA_SIN_CONTACTO = 5

export function PanelLectorDiscos({
    aplica,
    motivos = [],
    onElegir,
    onRegistrar,
    enRonda = 0,
    onFormateado,
    onEstado,
    capacidadDeclarada = null,
    opcionesCapacidad = [],
}: PanelLectorDiscosProps) {
    const [cargando, setCargando] = useState(false)
    const [discos, setDiscos] = useState<DiscoLeido[]>([])
    const [nota, setNota] = useState<string | null>(null)
    const [leido, setLeido] = useState(false)
    const [atraso, setAtraso] = useState<number | null>(null)
    /**
     * ⭐ 08 Oct 2026 — LA VERSIÓN DEL AGENTE que respondió, y si es anterior a la mínima.
     *
     * POR QUÉ EXISTE: el `.exe` del puesto quedó viejo y **nadie se enteró** — el único
     * síntoma era una marca vacía que el técnico completaba a mano. La app toleraba al
     * agente viejo en silencio, así que la deriva era invisible desde los dos lados.
     * Esto la hace visible: es una línea de aviso, no un bloqueo.
     */
    const [versionAgente, setVersionAgente] = useState<string | null>(null)
    const [agenteViejo, setAgenteViejo] = useState(false)
    /**
     * ⭐ MEJORA 52 — la metadata de la ÚLTIMA lectura del agente (motor · HDSentinel · atraso ·
     * completitud). Vive acá porque es de la RESPUESTA, no del disco, y se adjunta a cada ítem de
     * la ronda para que la evidencia guardada sea completa.
     */
    const [contexto, setContexto] = useState<Record<string, unknown> | null>(null)
    /** clave del disco → motivo del rechazo a mano. */
    const [rechazos, setRechazos] = useState<Record<string, string>>({})
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **LA DECISIÓN del técnico sobre la pieza que no es de su partida.**
     *
     * Aprobado por el dueño con su condición, que es la que manda: *«si aun detectada la diferencia **no se
     * elige hacer la partida**, esto crearía **descuadre en inventario**, ya que **mentiría**»*.
     * ⇒ **La decisión es OBLIGATORIA**: o **crea su partida**, o se **rechaza**. No hay una tercera vía:
     * registrarla callada dejaría un SKU de 3TB dentro de una partida de 2TB.
     */
    const [reclasificar, setReclasificar] = useState<Record<string, boolean>>({})
    const [formato, setFormato] = useState<ProgresoFormateo>(FORMATEO_INACTIVO)
    /**
     * ⭐ MEJORA 46 — **¿se está viendo el modal del formateo?** Lo controla este panel (el padre
     * manda, SPEC §2.1) y es lo que le permite al modal **negarse a cerrar**: mientras el proceso
     * corre, `onOpenChange` ignora el pedido de cierre y este estado no cambia.
     */
    const [verFormateo, setVerFormateo] = useState(false)
    /**
     * ⭐ MEJORA 46 — **sondeos fallidos SEGUIDOS.** Es la escotilla del D3: si el agente muere, el
     * modal no puede secuestrar la pestaña. A los 5 seguidos (≈3,5 s) se declara «se perdió el
     * contacto» y se habilita la salida. Se resetea con el primer sondeo bueno, así que un
     * tropiezo momentáneo no deja al técnico afuera.
     */
    const [fallos, setFallos] = useState(0)

    /**
     * ⭐ MEJORA 47 (04 Oct 2026) — **las ayudas de esta pantalla**, leídas del registro.
     *
     * ⚠️ Los hooks van ACÁ, antes de cualquier `return` condicional: React exige el mismo
     *    orden de hooks en todos los renders (y este panel tiene una salida temprana).
     * ⚠️ Se llaman los tres aunque solo se use uno: un hook adentro de un ternario rompe
     *    ese orden. El ternario se hace con el **resultado**, no con la llamada.
     */
    const ayudaConsultando = useAyuda('revision.lector-consultando')
    const ayudaNoVeDiscos = useAyuda('revision.lector-no-ve-discos')
    const ayudaQueHace = useAyuda('revision.lector-que-hace')
    const ayudaExpulsarFormateo = useAyuda('revision.expulsar-con-formateo')
    const ayudaExpulsar = useAyuda('revision.expulsar-que-hace')
    /**
     * ⭐ MEJORA 52 — las preferencias de ayuda, para el `title` **del disco que se está mirando**:
     * el texto lleva los números de ESA pieza, así que no puede resolverse una sola vez arriba.
     * Es la **tercera forma** de `Ayuda` (`textoAyuda`), que existe exactamente para esto.
     */
    const ayudas = useAuth((s) => s.usuario?.preferencias?.ayudas)
    /**
     * ⭐ MEJORA 45 — **QUÉ se va a formatear y con qué confirmación.** Antes había un solo
     * `confirmarFormato: boolean` y el diálogo mandaba SIEMPRE todos los NS: desapareció el
     * caso «un disco bueno y uno malo», donde el técnico necesita formatear SOLO el bueno.
     */
    const [formatoPedido, setFormatoPedido] = useState<{ ns: string[]; claves: string[] } | null>(null)
    /**
     * ⭐ MEJORA 45 — LAS CLAVES YA REGISTRADAS, **por disco**.
     * Antes era un `registrado: boolean` global: el primer `Registrar` apagaba el botón para
     * todos, así que registrar el disco del 99 % dejaba al del 100 % sin poder registrarse.
     */
    const [registradas, setRegistradas] = useState<string[]>([])
    /** ⭐ MEJORA 45 — la expulsión segura del dock (el puente USB entero). */
    const [exclusion, setExclusion] = useState<EstadoExclusion>(EXPULSION_INACTIVA)
    const [confirmarExpulsion, setConfirmarExpulsion] = useState(false)
    const [expulsando, setExpulsando] = useState(false)
    /** Segundos transcurridos del formateo: la prueba visible de que está VIVO. */
    const [transcurrido, setTranscurrido] = useState(0)
    const reloj = useRef<number | null>(null)
    const relojExpulsion = useRef<number | null>(null)

    /**
     * ⭐ FIX 09 Oct 2026 (lo pidió el dueño en su VF) — **DEJAR LA PANTALLA LISTA PARA RELEER.**
     *
     * *«el botón expulsar dock que borre la pantalla lista para releer, o igual el botón de registrar
     * que mande releer»*. Las DOS acciones cierran un turno de lectura —expulsar apaga el puente;
     * registrar mete los discos en la ronda— y en los dos casos **las fichas que quedan en pantalla ya
     * no sirven**: son de discos que se van, o de discos que ya están en la ronda. Antes se quedaban
     * ahí y el técnico tenía que apretar `Re-leer los discos` con la pantalla llena de discos viejos,
     * que es exactamente lo que se lee como «no pasó nada».
     *
     * ⚠️ Una lectura NO es solo `discos`: si se limpiara la lista y `leido` siguiera en `true`, el
     * bloque grande de lectura **no volvería** (la pantalla quedaría vacía, sin el botón con el que se
     * relee). Y si sobrevivieran `registradas`/`rechazos`/`reclasificar` de la lectura anterior, **la
     * tanda siguiente nacería con discos ya marcados** — que es la forma silenciosa de perder una
     * pieza. Por eso se reinicia TODO lo que produce una lectura, incluidos el atraso y la versión del
     * agente (son de ESA respuesta, no del panel).
     *
     * 🔴 NO se llama con un formateo corriendo: las dos puertas que la invocan ya están inhabilitadas
     * con `formateando` (la regla dura de la MEJORA 45) y `formato` se reinicia recién cuando el disco
     * que se estaba borrando ya no está en el dock.
     */
    const limpiarLectura = useCallback(() => {
        setDiscos([])
        setLeido(false)
        setNota(null)
        setRegistradas([])
        setRechazos({})
        setReclasificar({})
        setAtraso(null)
        setContexto(null)
        setVersionAgente(null)
        setAgenteViejo(false)
        setFormato(FORMATEO_INACTIVO)
        setExclusion(EXPULSION_INACTIVA)
        setFallos(0)
        setTranscurrido(0)
    }, [])

    /**
     * ⚠️ El sondeo del progreso vive en un `useEffect` que se apaga solo. `setState`
     * DENTRO del callback del timer NO es el `set-state-in-effect` que el linter del
     * proyecto prohíbe (ese es el sincrónico en el cuerpo del efecto).
     *
     * ⭐ EL CRONÓMETRO (1 Oct 2026): la fase de preparación tarda 1-2 MINUTOS sin que llegue
     * ningún paso nuevo. Un spinner solo es indistinguible de una pantalla trabada, así que
     * además se cuenta el tiempo: un número que sube cada segundo **es** la prueba de vida.
     * 🔴 CORREGIDO el 04 Oct 2026: acá decía que `animate-pulse` «no existe en el sistema».
     *    **Es falso** — medido en el CSS compilado: Tailwind declara sus animaciones bajo
     *    `extend`, así que los defaults (`animate-spin`, `animate-pulse`) **siguen vivos**, y el
     *    sistema además tiene las propias (`trazo` · `brillo`). El comentario evitaba un token
     *    que sí existía.
     */
    useEffect(() => {
        if (formato.estado !== 'corriendo') return
        let activo = true
        const t0 = formato.iniciado ? new Date(formato.iniciado).getTime() : Date.now()
        reloj.current = window.setInterval(() => {
            void leerProgresoFormateo().then((p) => {
                if (!activo) return
                // ⭐⭐ MEJORA 46 — SI EL SONDEO FALLA, **NO SE PISA EL ESTADO**.
                //    🔴 Medido: `leerProgresoFormateo` **nunca lanza** — cuando no puede leer
                //    devuelve `{ ...FORMATEO_INACTIVO, ok: false }`, o sea con `estado: 'inactivo'`.
                //    Y ese `'inactivo'` hacía DOS cosas malas de una vez: **apagaba este sondeo**
                //    (el `if` de arriba) y dejaba el formateo huérfano — con el modal nuevo habría
                //    dicho «Listo: 0 discos formateados» con el disco a medio borrar.
                //    Ahora el fallo se CUENTA: a los 5 seguidos se declara «se perdió el contacto»
                //    y el modal habilita la salida (la escotilla del D3). ⭐ Y es RECUPERABLE: el
                //    primer sondeo bueno pone el contador en 0 y el trabajo sigue.
                if (!p.ok) {
                    setFallos((n) => n + 1)
                    setTranscurrido(Math.max(0, Math.round((Date.now() - t0) / 1000)))
                    return
                }
                setFallos(0)
                setFormato(p)
                setTranscurrido(Math.max(0, Math.round((Date.now() - t0) / 1000)))
                if (p.estado === 'terminado' || p.estado === 'error') {
                    if (reloj.current) window.clearInterval(reloj.current)
                    reloj.current = null
                    if (p.estado === 'terminado') {
                        const ok = p.resumen?.ok ?? 0
                        const fallaron = p.resumen?.fallaron ?? 0
                        if (fallaron > 0) {
                            toast.warning(`Formateo terminado: ${ok} listo(s), ${fallaron} con falla.`)
                        } else {
                            toast.success(`Formateo terminado: ${ok} disco(s) listos.`)
                        }
                    } else {
                        // ⚠️ El motivo REAL, no un texto genérico: los errores que importan
                        // («hace falta administrador») vienen en el evento, no en `aviso`.
                        toast.error(
                            errorGlobalDe(p.eventos) ?? p.aviso ?? 'El formateo no se pudo completar.'
                        )
                    }
                    onFormateado?.()
                }
            })
        }, 700)
        return () => {
            activo = false
            if (reloj.current) window.clearInterval(reloj.current)
            reloj.current = null
        }
    }, [formato.estado, formato.iniciado, onFormateado])

    /**
     * ⭐ EL CICLO DE LECTURA, en un solo lugar y contado como lo vive el técnico:
     * **limpiar → animación de lectura → resultados.**
     *
     * Existe separado de `leer` porque lo usan DOS puertas —`Leer discos` y el botón de la
     * esquina, que hasta ahora NO repetía el ciclo— y porque el modal lo necesita cuando los
     * discos ya formateados se van y entran los siguientes.
     *
     * ⚠️ Antes, re-leer dejaba `leido` en `true`: el panel grande no volvía, los discos viejos
     * seguían en pantalla y el «leyendo…» no se veía en ningún lado — el botón prometía una
     * lectura que no se mostraba. Ahora se limpia TODO primero, así el técnico ve que arrancó,
     * y los resultados aparecen cuando están.
     *
     * @param opts.formateo `true` cuando el caso de uso es «ya formateé, saco estos y pongo los
     *   siguientes»: además reinicia el avance del formateo, porque es de los discos que se van.
     * @returns La lectura, para que quien la llame pueda reaccionar (p. ej. arrancar el formateo).
     */
    const leerHacia = useCallback(async (opts?: { formateo?: boolean }) => {
        // ① LIMPIAR — lo primero, para que se vea el arranque y no queden fichas viejas.
        setDiscos([])
        setRechazos({})
        setLeido(false)
        setNota(null)
        setRegistradas([])
        setAtraso(null)
        setContexto(null)
        setVersionAgente(null)
        setAgenteViejo(false)
        if (opts?.formateo) setFormato(FORMATEO_INACTIVO)
        // ② ANIMACIÓN — el panel de lectura se pinta porque `leido` es `false` y `discos` vacío.
        setCargando(true)
        try {
            const r = await leerDiscos()
            setDiscos(r.discos)
            setAtraso(r.hdsentinel_atraso_segundos)
            // ⭐ 08 Oct 2026 — la versión: si el lector de esta PC quedó viejo, se dice.
            setVersionAgente(r.version_agente)
            setAgenteViejo(r.agente_version_anterior)
            // ⭐ MEJORA 52 — la metadata de la respuesta, para la evidencia del guardado.
            setContexto(contextoDeRespuesta(r))
            // ③ RESULTADOS — `leido` en `true` retira el panel de lectura y muestra las fichas.
            setLeido(true)
            if (!r.agente) {
                setNota(r.error ?? 'No encontré el lector de discos en esta PC.')
                return r
            }
            if (r.discos.length === 0) {
                setNota('El lector no encontró discos. Revisá que el dock esté encendido y con discos.')
                return r
            }
            if (r.avisos.length > 0) toast.warning(r.avisos[0])
            return r
        } finally {
            setCargando(false)
        }
    }, [])

    const leer = useCallback(() => void leerHacia(), [leerHacia])

    /**
     * La clave de una ficha: el NS (la identidad de la pieza) o, si el disco no dio NS, el
     * modelo con su índice. ⚠️ `useCallback` **antes** del `return null` de abajo: un hook no
     * puede quedar después de una salida temprana (React exige el mismo orden en cada render,
     * y el linter del compilador de React lo marca como error).
     */
    const clave = useCallback(
        (d: DiscoLeido, i: number) => d.serial ?? `${d.modelo ?? 'disco'}-${i}`,
        []
    )

    /**
     * ⭐ EL VEREDICTO DE UN DISCO — una sola función para toda la pantalla, porque la usan la
     * ficha, el botón de formatear y el de registrar, y no pueden discrepar.
     * El rechazo A MANO manda sobre la salud: un disco de 100 % puede estar golpeado.
     */
    const veredictoDe = useCallback(
        (d: DiscoLeido): Veredicto => {
            const i = discos.indexOf(d)
            const motivoId = rechazos[d.serial ?? (i >= 0 ? clave(d, i) : '')]
            return motivoId ? 'DEVOLUCION' : evaluarSalud(d, atraso).veredicto
        },
        [discos, rechazos, atraso, clave]
    )

    /**
     * Arma los items de la ronda para las claves indicadas (`null` = todos los leídos).
     * El rechazo A MANO manda sobre la salud: un disco de 100 % puede estar golpeado.
     */
    const itemsDe = useCallback(
        (claves: string[] | null): ItemRonda[] =>
            discos
                .map((d, i) => ({ d, k: clave(d, i) }))
                .filter(({ k }) => claves === null || claves.includes(k))
                .map(({ d, k }) => {
                    const motivoId = rechazos[k]
                    const veredicto: Veredicto = motivoId ? 'DEVOLUCION' : evaluarSalud(d, atraso).veredicto
                    return {
                        disco: d,
                        veredicto,
                        motivoRechazoId: motivoId,
                        motivoRechazoNombre: motivos.find((m) => m.id === motivoId)?.nombre,
                        contexto,
                        /* ⭐ MEJORA 52 — la decisión viaja con la pieza hasta el guardado. */
                        reclasificar: reclasificar[k] === true,
                    }
                }),
        [discos, rechazos, reclasificar, motivos, atraso, contexto, clave]
    )

    /**
     * ⭐ MEJORA 45 — **el estado del panel hacia el wizard**, en un solo lugar.
     * Manda lo que el wizard no puede ver y necesita para su guardián de salida: formateo en
     * curso, expulsión en curso y lecturas sin registrar.
     */
    const sinRegistrar = discos.filter((d, i) => !registradas.includes(clave(d, i))).length
    const formateando = formato.estado === 'corriendo'
    /**
     * ⭐ MEJORA 52 — la marca COMÚN de los discos leídos (para las píldoras de la LÍNEA).
     * Si los discos no comparten marca, `null`: no se ofrecen líneas a medias.
     */
    const marcaComun = useMemo(() => {
        const marcas = [...new Set(discos.map((d) => (d.marca ?? '').trim()).filter(Boolean))]
        return marcas.length === 1 ? marcas[0] : null
    }, [discos])
    const estadoPanel = useMemo<EstadoPanel>(
        () => ({ formateando, expulsando, sinRegistrar, marcaComun }),
        [formateando, expulsando, sinRegistrar, marcaComun]
    )
    useEffect(() => {
        onEstado?.(estadoPanel)
    }, [onEstado, estadoPanel])

    /**
     * ⭐ MEJORA 45 — LA EXPULSIÓN. La regla dura: **con un formateo activo NO se expulsa**.
     * Se niega en los dos lados (el botón deshabilitado acá y el 409 del agente), porque
     * expulsar el puente en medio de un `diskpart clean` deja el disco a medio limpiar.
     *
     * ⭐ FIX 09 Oct 2026 — **y cuando la expulsión TERMINA, la pantalla se limpia** (`limpiarLectura`):
     * los discos que se veían ya no están conectados, así que dejar sus fichas es mostrar mercancía que
     * el dock ya soltó. El panel vuelve a su estado de lectura y el técnico aprieta `Leer discos`
     * cuando enchufe el dock con los otros discos. ⚠️ **Solo con `terminado`**: si Windows la rechazó
     * (`error`), los discos SIGUEN montados y su lectura sigue siendo válida — limpiar ahí perdería la
     * evidencia de una tanda que todavía se puede registrar.
     */
    useEffect(() => {
        if (!expulsando) return
        let activo = true
        relojExpulsion.current = window.setInterval(() => {
            void leerEstadoExclusion().then((e) => {
                if (!activo) return
                setExclusion(e)
                if (e.estado === 'terminado' || e.estado === 'error') {
                    if (relojExpulsion.current) window.clearInterval(relojExpulsion.current)
                    relojExpulsion.current = null
                    setExpulsando(false)
                    if (e.estado === 'terminado') {
                        toast.success('Dock expulsado. Ya podés desconectarlo y poner los otros discos.')
                        limpiarLectura()
                    } else {
                        toast.error(e.aviso ?? 'No se pudo expulsar el dock.')
                    }
                }
            })
        }, 800)
        return () => {
            activo = false
            if (relojExpulsion.current) window.clearInterval(relojExpulsion.current)
            relojExpulsion.current = null
        }
    }, [expulsando, limpiarLectura])

    if (!aplica) return null

    /** Los discos ya formateados según el progreso reportado. */
    const formateados = new Set(
        formato.eventos
            .filter((e) => e.evento === 'listo' && e.ns)
            .map((e) => (Array.isArray(e.ns) ? e.ns[0] : e.ns))
            .filter((x): x is string => !!x)
    )
    const todosFormateados = discos.length > 0 && discos.every((d) => formateados.has(d.serial ?? ''))
    /** ⭐ MEJORA 45 — un conjunto con las claves ya registradas, para las consultas por tarjeta. */
    const enRondaYa = new Set(registradas)

    // ⭐ MEJORA 46 — la fase global y el error global se MUDARON a `ModalFormateo` junto con el
    // bloque que los pintaba: acá ya no se usan (el panel solo conserva el dato crudo `formato`).

    /**
     * ⭐ MEJORA 45 — **qué discos son formateables y cuáles todavía no se registraron.**
     *
     * 🔴 LA REGLA DEL FORMATEO, tal como la pidió el usuario (1 Oct 2026):
     *   · **un disco suelto** se formatea por su PROPIA tarjeta (`Formatear este disco`),
     *     y solo está disponible si ESE disco pasa (salud 100 con aval);
     *   · **el botón grande** (`Formatear N discos`) **solo se habilita si TODOS los leídos
     *     pasan**. Con un disco al 99 % en el dock no se habilita: el 99 % es devolución y
     *     formatearlo no se deshace. El camino para avanzar es formatear el bueno y registrar
     *     el malo — que es exactamente para lo que existe el `Registrar` de cada tarjeta.
     *
     * ⚠️ El rechazo A MANO también saca al disco de «formateable»: si el técnico ya decidió
     *    que ese disco no sirve, no se formatea ni con toda la salud del mundo.
     * ⚠️ `SIN AVAL` tampoco se formatea: sin aval la salud no manda devolución, pero tampoco
     *    habilita borrar particiones — esa decisión no la toma este panel.
     */
    const pasa = discos.filter((d) => veredictoDe(d) === 'PASA').length
    const devuelve = discos.filter((d) => veredictoDe(d) === 'DEVOLUCION').length
    const sinAval = discos.filter((d) => veredictoDe(d) === 'SIN_AVAL').length

    /**
     * ⭐ MEJORA 46 (04 Oct 2026) — **EL BOTÓN GRANDE YA NO ESPERA A QUE TODOS PASEN.**
     *
     * Pedido del usuario: *«que esté habilitado, pero con lo siguiente: si los 2 están en
     * 100 % advertencia normal; si hay 1 malo, igual formatear ambos pero advirtiendo que 1
     * no cumple con la salud — ¿formatear de todos modos?»*.
     *
     * ⇒ El botón formatea **todos los discos leídos que tengan NS** (el `.ps1` nunca filtró
     *   por salud: formatea lo que le manden). Lo que cambia entre los dos casos es la
     *   **CONFIRMACIÓN**: sin discos que no cumplan, es la advertencia de siempre; con alguno,
     *   aparece el bloque ámbar diciendo **QUIÉN** no cumple y **POR QUÉ**, y el botón dice
     *   «Formatear de todos modos».
     *
     * ⚠️ Un disco **sin NS** no entra: no se puede identificar ni formatear.
     * ⚠️ Antes el botón se apagaba si alguno no pasaba; se cambió a pedido del dueño. La
     *    protección que queda es la advertencia explícita, no el botón apagado.
     */
    const conNs = discos.filter((d) => !!d.serial)
    const noCumplen = conNs.filter((d) => veredictoDe(d) !== 'PASA')
    /** ¿Hay algo que formatear? Es la única condición del botón, además de no estar ocupado. */
    const hayQueFormatear = conNs.length > 0

    /**
     * ⭐ MEJORA 46 — **¿se perdió el contacto con el agente?** Es lo que abre la salida del modal
     * cuando el proceso muere: sin esto, la pestaña quedaría secuestrada (no hay forma de cerrar
     * un modal que se niega a cerrarse).
     */
    const sinContacto = fallos >= FALLOS_PARA_SIN_CONTACTO

    /**
     * ⭐ MEJORA 46 — **reintentar SOLO lo que no terminó.** Si el formateo se cortó, el disco que
     * ya quedó formateado **no se vuelve a tocar** (volver a limpiarlo sería trabajo al pedo y una
     * ventana de riesgo sin motivo): se reintenta con los NS que no tienen su `listo`. Si no queda
     * ninguno, se cierra el modal — no hay nada que reintentar.
     */
    const reintentarFormateo = async () => {
        const nsDe = (e: { ns?: string | string[] }) => (Array.isArray(e.ns) ? e.ns[0] : e.ns)
        const listos = new Set(formato.eventos.filter((e) => e.evento === 'listo').map(nsDe))
        const pedidos = formato.discos.length > 0 ? formato.discos : conNs.map((d) => d.serial ?? '')
        const faltan = pedidos.filter((ns): ns is string => !!ns && !listos.has(ns))
        if (faltan.length === 0) {
            setVerFormateo(false)
            return
        }
        const r = await iniciarFormateo(faltan)
        if (!r.ok) {
            toast.error(r.error ?? 'No se pudo reintentar el formateo.')
            return
        }
        setFallos(0)
        const p = await leerProgresoFormateo()
        setFormato(p.estado === 'inactivo' ? { ...p, estado: 'corriendo' } : p)
    }

    /**
     * ⭐ MEJORA 45 — registrar, **por disco o todos los que falten**.
     * El `Registrar` de una tarjeta junta SOLO esa pieza (el caso del 99 %); el grande junta
     * todas las que todavía no están en la ronda. Antes era todo o nada, y el primer
     * `Registrar` apagaba el botón para el resto.
     */
    const registrar = (claves: string[] | null) => {
        const items = itemsDe(claves)
        if (items.length === 0) {
            toast.warning('Esos discos ya están en la ronda.')
            return
        }
        /**
         * ⭐ MEJORA 52 — **EL CANDADO DE LA DECISIÓN.** Condición del dueño: *«si aun detectada la
         * diferencia no se elige hacer la partida, esto crearía **descuadre en inventario**, ya que
         * **mentiría**»*. ⇒ Un disco con desvío **no se registra** sin decidir: **crea su partida** o
         * **se rechaza**. Registrarlo callado dejaría un SKU de 3TB dentro de una partida de 2TB.
         */
        const sinDecidir = items.filter(
            (it) =>
                it.veredicto !== 'DEVOLUCION' &&
                !it.reclasificar &&
                desvioDeCapacidad(it.disco.capacidad_texto, capacidadDeclarada, opcionesCapacidad) !== null
        )
        if (sinDecidir.length > 0) {
            toast.error(
                sinDecidir.length === 1
                    ? 'Ese disco tiene capacidad DIFERENTE a lo que dice la entrada: elegí «Crear partida» o rechazalo con su motivo. No corregirlo causa descuadres al inventario.'
                    : `${sinDecidir.length} discos tienen capacidad DIFERENTE a lo que dice la entrada: elegí «Crear partida» o rechazalos con su motivo. No corregirlo causa descuadres al inventario.`
            )
            return
        }
        items.forEach((it) => onElegir(it.disco, it.motivoRechazoId))
        onRegistrar(items)
        /**
         * ⭐ FIX 09 Oct 2026 (lo pidió el dueño) — **con TODOS los discos en la ronda, la pantalla se
         * limpia y queda lista para releer.**
         *
         * ⚠️ Recién cuando **no queda ninguno sin registrar**, y la razón es el caso de la MEJORA 45
         * —un disco bueno y uno malo en el dock—: registrar el malo desde SU tarjeta no puede borrar la
         * ficha del bueno, que todavía tiene que poder entrar a la ronda. Mientras quede uno, la
         * pantalla se queda como está (es el estado que el botón de esa tarjeta necesita).
         * Con todos registrados no hay nada más que hacer con esta tanda: se sacan los discos, se
         * ponen los siguientes y se lee. Antes había que apretar `Re-leer los discos` con las fichas
         * viejas todavía en pantalla.
         */
        const enRondaAhora = new Set(registradas)
        discos.forEach((d, i) => {
            const k = clave(d, i)
            if (claves === null || claves.includes(k)) enRondaAhora.add(k)
        })
        setRegistradas([...enRondaAhora])
        const sinRegistrarAhora = discos.filter((d, i) => !enRondaAhora.has(clave(d, i))).length
        toast.success(
            sinRegistrarAhora === 0
                ? `Ronda: ${items.length} disco(s) registrados. Sacá estos discos y leé los siguientes.`
                : `Ronda: ${items.length} disco(s) registrados. Se escriben al guardar el avance.`
        )
        if (sinRegistrarAhora === 0) limpiarLectura()
    }

    return (
        <div className="space-y-3">
            {/* ── ⓪ El ÚNICO botón de captura ────────────────────────────────── */}
            {!leido || discos.length === 0 ? (
                <div
                    className={cn(
                        'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                        // ⭐ El marco cambia con el error: la caja entera dice que algo salió mal.
                        nota ? 'border-destructive/60 bg-destructive/5' : 'border-border'
                    )}
                >
                    {/* ⭐ EL ERROR VA ARRIBA DEL BOTÓN, y con presencia de alarma.
                        Antes quedaba ABAJO del botón y en ámbar suave: el técnico apretaba
                        «Leer discos», no pasaba nada, y el motivo aparecía donde ya no estaba
                        mirando. Ahora interrumpe ANTES de la acción, en rojo sólido y con título. */}
                    {nota ? (
                        <div
                            role="alert"
                            className="mb-5 flex items-center gap-3 rounded-md bg-destructive px-4 py-3.5 text-left text-destructive-foreground"
                        >
                            <TriangleAlert className="h-7 w-7 shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-[17px] font-bold leading-tight">
                                    No se encontraron discos
                                </p>
                                <p className="text-[13px] leading-snug opacity-95">{nota}</p>
                            </div>
                        </div>
                    ) : null}

                    <h3 className="text-[16px] font-semibold">
                        {cargando ? 'Leyendo los discos…' : 'Leer los discos del dock'}
                    </h3>
                    <p className="mx-auto mb-4 mt-1 max-w-[62ch] text-[12.5px] text-muted-foreground">
                        {cargando ? ayudaConsultando : nota ? ayudaNoVeDiscos : ayudaQueHace}
                    </p>
                    {/* ⚠️ NO se deshabilita con el error a la vista: el técnico puede enchufar el
                        dock, encenderlo o darle permiso al agente y reintentar. Un botón muerto
                        acá sería un callejón sin salida. Lo que cambia es la etiqueta. */}
                    <Button
                        type="button"
                        variant={nota ? 'outline' : 'default'}
                        className={cn(
                            'min-h-[56px] px-6 text-[16px] font-semibold',
                            nota && 'border-destructive/50 text-destructive hover:bg-destructive/10'
                        )}
                        onClick={() => void leer()}
                        disabled={cargando}
                        data-accion="leer-discos"
                    >
                        {cargando ? (
                            <Loader2 className="mr-1.5 h-5 w-5 animate-spin" aria-hidden="true" />
                        ) : (
                            <ScanSearch className="mr-1.5 h-5 w-5" aria-hidden="true" />
                        )}
                        {cargando ? 'Leyendo…' : discos.length > 0 ? 'Re-leer los discos' : nota ? 'Volver a intentar' : 'Leer discos'}
                    </Button>
                </div>
            ) : null}

            {/* El aviso del agente ausente sigue existiendo para el caso en que YA hay fichas
                (no se puede mostrar el bloque de arriba, que se retira al leer). */}
            {nota && discos.length > 0 ? (
                <div
                    role="alert"
                    className="flex items-center gap-3 rounded-md bg-destructive px-4 py-3 text-destructive-foreground"
                >
                    <TriangleAlert className="h-6 w-6 shrink-0" aria-hidden="true" />
                    <p className="text-[14px] font-semibold">{nota}</p>
                </div>
            ) : null}

            {/* ⚠️ EL LECTOR DE ESTA PC ES VIEJO — 08 Oct 2026.
                Antes había DOS motivos distintos para decir esto y cada uno tenía su caja:
                (a) el agente no manda `apto_para_decidir` (el aval se infiere), y ahora
                (b) el agente no manda `version` o manda una anterior a VERSION_MINIMA_AGENTE.
                Un agente viejo suele disparar los dos ⇒ dos cajas diciendo lo mismo. Es UNA
                sola caja, y el texto dice QUÉ le falta según lo que sí se sabe.
                ⚠️ Es INFORMATIVO: la lectura, el formateo y la expulsión siguen funcionando. */}
            {agenteViejo || discos.some((d) => d.agente_desactualizado) ? (
                <p className="flex items-start gap-2 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-[12.5px]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                    <span>
                        <b>El lector de discos de esta PC está en una versión anterior.</b>{' '}
                        {versionAgente
                            ? <>Informa la versión <b>{versionAgente}</b>.</>
                            : <>No informa su versión (es anterior a la {VERSION_MINIMA_AGENTE}).</>}{' '}
                        {discos.some((d) => d.agente_desactualizado)
                            ? 'Tampoco dice de dónde salió cada salud, así que la app la deduce de la fuente del número: los discos leídos por HDSentinel o por el propio disco deciden igual.'
                            : ''}{' '}
                        Lo que <b>sí</b> cambia y no se ve: puede estar usando reglas de marca viejas
                        (una marca sale vacía aunque el disco se haya leído perfecto). Actualizalo
                        compilando e instalando el lector en esa PC.
                    </span>
                </p>
            ) : null}

            {/* ── ① LAS FICHAS — solo información, sin un solo botón de registrar ── */}
            {discos.length > 0 ? (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12.5px] text-muted-foreground">
                            <b className="text-foreground">{discos.length}</b> disco(s) ·{' '}
                            <b className="text-success">{pasa} pasa(n)</b>
                            {devuelve > 0 ? (
                                <>
                                    {' · '}
                                    <b className="text-destructive">{devuelve} a devolución</b>
                                </>
                            ) : null}
                            {sinAval > 0 ? (
                                <>
                                    {' · '}
                                    <b className="text-warning">{sinAval} sin aval</b>
                                </>
                            ) : null}
                        </span>
                        <span className="flex-1" />
                        {/* ⭐ RE-LEER REPITE EL CICLO COMPLETO: limpia la pantalla, muestra la
                            animación de lectura y vuelve a pintar los resultados. Es lo que el
                            técnico hace decenas de veces por turno (saca 2 discos, pone otros 2),
                            así que no puede quedar como un refresco mudo. */}
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 gap-1.5 px-3 text-[14px]"
                            onClick={() => void leerHacia({ formateo: true })}
                            disabled={cargando || formateando}
                            title="Vacía la pantalla, vuelve a leer el dock y muestra los discos nuevos."
                            data-accion="releer-discos"
                        >
                            {cargando ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <ScanSearch className="h-4 w-4" aria-hidden="true" />
                            )}
                            {cargando ? 'Leyendo…' : 'Re-leer los discos'}
                        </Button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        {discos.map((d, i) => {
                            const k = clave(d, i)
                            const motivoId = rechazos[k]
                            const ev = evaluarSalud(d, atraso)
                            const veredicto: Veredicto = motivoId ? 'DEVOLUCION' : ev.veredicto
                            const esFormateado = formateados.has(d.serial ?? '')
                            /** ⭐ MEJORA 45 — esta tarjeta tiene su propia acción de formatear. */
                            const formateable = veredicto === 'PASA' && !formateando
                            const yaEnRonda = enRondaYa.has(k)
                            const color =
                                motivoId || ev.veredicto === 'SIN_AVAL'
                                    ? 'warning'
                                    : ev.veredicto === 'PASA'
                                      ? 'success'
                                      : 'destructive'
                            return (
                                <div
                                    key={k}
                                    className={cn(
                                        'overflow-hidden rounded-lg border bg-surface',
                                        color === 'warning' && 'border-warning/45',
                                        color === 'success' && 'border-success/45',
                                        color === 'destructive' && 'border-destructive/45'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'h-[3px]',
                                            color === 'warning' && 'bg-warning',
                                            color === 'success' && 'bg-success',
                                            color === 'destructive' && 'bg-destructive'
                                        )}
                                    />
                                    {/* La BAHÍA primero: con 2 discos es lo que el técnico
                                        necesita para sacar el correcto. El NS es la identidad. */}
                                    <div className="flex flex-wrap items-center gap-2 px-3.5 pt-2.5">
                                        <span className="rounded-md border border-info/45 bg-info/10 px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.06em] text-info">
                                            BAHÍA {d.bahia ?? '—'}
                                        </span>
                                        <span className="text-[14.5px] font-bold">{d.marca ?? 'marca ?'}</span>
                                        <span className="text-[11.5px] text-muted-foreground">
                                            {d.modelo ?? ''}
                                        </span>
                                        <span className="flex-1" />
                                        <Pildora
                                            texto={
                                                motivoId
                                                    ? 'RECHAZO A MANO'
                                                    : ev.veredicto === 'SIN_AVAL'
                                                      ? 'SIN AVAL'
                                                      : ev.veredicto === 'PASA'
                                                        ? 'PASA'
                                                        : 'NO PASA'
                                            }
                                            tono={
                                                motivoId || ev.veredicto === 'SIN_AVAL'
                                                    ? 'advertencia'
                                                    : ev.veredicto === 'PASA'
                                                      ? 'exito'
                                                      : 'peligro'
                                            }
                                        />
                                    </div>

                                    {/* La SALUD, una sola vez: es el número que decide. */}
                                    <div className="flex items-baseline gap-2.5 px-3.5 pb-2.5 pt-1">
                                        <span
                                            className={cn(
                                                'text-[30px] font-bold leading-none tabular-nums',
                                                color === 'warning' && 'text-warning',
                                                color === 'success' && 'text-success',
                                                color === 'destructive' && 'text-destructive'
                                            )}
                                        >
                                            {n(d.salud.puntaje, '%')}
                                        </span>
                                        <span className="text-[12px] text-muted-foreground">
                                            {motivoId ? 'rechazado a mano' : ev.dice}
                                        </span>
                                        <span className="flex-1" />
                                        <Pildora
                                            texto={d.salud.fuente}
                                            tono={ev.conAval ? 'neutro' : 'advertencia'}
                                        />
                                    </div>

                                    {/* ⭐ MEJORA 52 — **¿ESTE DISCO ES DE LO QUE DICE LA ENTRADA?**
                                        Va pegado a la salud, arriba y **EN ROJO**, porque es lo que el
                                        técnico tiene que ver **AL LEER** — antes de registrar, que es
                                        cuando puede decidir. Su caso: declaró 1TB y el lector midió
                                        2000.3 GB ⇒ **la pieza no es de esa partida**.

                                        ⚠️ **Se compara contra lo declarado en la PARTIDA**, nunca
                                        contra lo que se va capturando: si no, al registrar el aviso
                                        desaparecía (el estado de la ronda se sobreescribe con lo que
                                        dijo el disco). Cazado por el dueño el 07 Oct.

                                        Y dice **qué va a pasar**: la pieza se irá a la partida de su
                                        capacidad (reclasificación) y **la nota tendrá que ajustarse**.
                                        No corrige nada: la huella ya la corrige el disco. AVISA. */}
                                    {(() => {
                                        const desvio = desvioDeCapacidad(
                                            d.capacidad_texto,
                                            capacidadDeclarada,
                                            opcionesCapacidad
                                        )
                                        if (!desvio) return null
                                        return (
                                            /* ⭐ MEJORA 52 — **DOS LÍNEAS, como lo pidió el dueño**
                                               (*«si me agrada el mensaje solo que dice mucho»*):
                                               el rótulo + el botón, y la consecuencia. **El porqué
                                               completo vive en el `title` del botón** (el patrón de la
                                               casa: `Ayuda`, tercera forma — y con los números de ESA
                                               pieza). En rojo, porque es una discrepancia con el
                                               proveedor y se decide acá, al leer. */
                                            <div className="mx-3.5 mb-2.5 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-2 text-[12.5px] text-destructive">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <TriangleAlert
                                                        className="h-4 w-4 shrink-0"
                                                        aria-hidden="true"
                                                    />
                                                    <b>Capacidad DIFERENTE</b>
                                                    <button
                                                        type="button"
                                                        aria-pressed={reclasificar[k] === true}
                                                        title={textoAyuda(
                                                            'revision.capacidad-diferente',
                                                            ayudas,
                                                            {
                                                                declarada: desvio.declarada,
                                                                medida: desvio.medida,
                                                            }
                                                        )}
                                                        onClick={() =>
                                                            setReclasificar((prev) => ({
                                                                ...prev,
                                                                [k]: !prev[k],
                                                            }))
                                                        }
                                                        className={`rounded-md border px-2.5 py-1 text-[12px] font-semibold transition ${
                                                            reclasificar[k] === true
                                                                ? 'border-destructive bg-destructive text-destructive-foreground'
                                                                : 'border-destructive/60 text-destructive hover:bg-destructive/10'
                                                        }`}
                                                    >
                                                        {reclasificar[k] === true
                                                            ? '✓ Crear partida'
                                                            : 'Crear partida'}
                                                    </button>
                                                </span>
                                                <span className="mt-1 block">
                                                    ⚠️ No corregir esto causa descuadres al inventario.
                                                </span>
                                            </div>
                                        )
                                    })()}

                                    {ev.nota ? (
                                        <p
                                            className={cn(
                                                'mx-3.5 mb-2.5 flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11.5px] leading-snug',
                                                'border-warning/40 bg-warning/10'
                                            )}
                                        >
                                            <TriangleAlert
                                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning"
                                                aria-hidden="true"
                                            />
                                            <span>{ev.nota}</span>
                                        </p>
                                    ) : null}

                                    {/* El NS — la identidad de la pieza. */}
                                    <div className="flex items-center gap-2 px-3.5 pb-2">
                                        <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                                            N/S
                                        </span>
                                        <span className="font-mono text-[12.5px] font-semibold">
                                            {d.serial ?? '—'}
                                        </span>
                                        <span className="flex-1" />
                                        {esFormateado ? <Pildora texto="✓ formateado" tono="listo" /> : null}
                                    </div>

                                    {/* ⭐ Lo que VALÚA la pieza — **la CAPACIDAD y las HORAS, en su
                                        propia fila y a 22px.** Medido (1 Oct 2026): antes los seis
                                        datos pesaban igual a 12px y había que leer la línea entera para
                                        encontrar los dos que mueven el precio — que son justo los que
                                        el comprador pregunta. Ahora tienen su fila con etiqueta, y
                                        rpm · encendidos · temperatura · sectores quedan debajo, en la
                                        cola, a 12px.

                                        ⚠️ Las horas SIGUEN sin decidir: no filtran, **valúan**. El único
                                        número que decide es la salud (30px), y por eso estos dos van en
                                        tinta de primer plano y **no** en color de estado. */}
                                    <div className="border-t border-border bg-surface-2 px-3.5 py-2.5">
                                        <div className="grid grid-cols-2 gap-3">
                                            <span>
                                                <span className="block font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                                    Capacidad
                                                </span>
                                                <span className="mt-0.5 block text-[22px] font-bold leading-tight tabular-nums">
                                                    {d.capacidad_texto ?? '—'}
                                                </span>
                                            </span>
                                            <span>
                                                <span className="block font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                                    Horas de uso
                                                </span>
                                                <span className="mt-0.5 block text-[22px] font-bold leading-tight tabular-nums">
                                                    {n(d.horas_uso)}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-foreground">
                                            <span>{d.rpm ?? '—'} rpm</span>
                                            <span aria-hidden="true">·</span>
                                            <span>{n(d.encendidos)} enc.</span>
                                            <span aria-hidden="true">·</span>
                                            <span>{n(d.temperatura_c, ' °C')}</span>
                                            <span aria-hidden="true">·</span>
                                            <span>
                                                sectores dañados:{' '}
                                                <b className="text-foreground">
                                                    {(d.sectores_reasignados ?? 0) +
                                                        (d.sectores_pendientes ?? 0) +
                                                        (d.sectores_no_corregibles ?? 0)}
                                                </b>
                                            </span>
                                        </div>
                                    </div>

                                    {/* ── ⭐ MEJORA 45 · LAS ACCIONES DE ESTA TARJETA ──────
                                        Pedido del usuario (1 Oct 2026): «en los discos que están al
                                        100, a lado del botón de rechazar, un botón de formatear
                                        independiente; y si los 2 discos están al 100 habilitar el
                                        botón de formatear 2 discos» + «cuando se detecte uno al 99
                                        y otro al 100: la tarjeta del 99 que diga Registrar».

                                        Son las DOS puertas del caso «un disco bueno y uno malo»:
                                        el bueno se formatea SOLO (1 NS) y el malo se registra SOLO
                                        (1 pieza), sin que ninguno arrastre al otro. El botón grande
                                        de abajo sigue siendo la vía rápida cuando los dos sirven. */}
                                    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-3.5 py-2.5">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="min-h-11 gap-1.5 border-warning/55 bg-warning/10 px-3 text-[13.5px] font-semibold text-warning disabled:opacity-45"
                                            disabled={!formateable || yaEnRonda}
                                            title={
                                                veredicto === 'PASA'
                                                    ? 'Formatea SOLO este disco (se le borran las particiones).'
                                                    : 'Solo se formatean los discos que pasan (salud 100 con aval).'
                                            }
                                            onClick={() =>
                                                setFormatoPedido({ ns: [d.serial ?? ''].filter(Boolean), claves: [k] })
                                            }
                                            data-accion="formatear-este-disco"
                                        >
                                            {esFormateado ? (
                                                <>
                                                    <Check className="h-4 w-4" aria-hidden="true" />
                                                    Formateado
                                                </>
                                            ) : (
                                                'Formatear este disco'
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="min-h-11 gap-1.5 px-3 text-[13.5px] font-semibold"
                                            disabled={yaEnRonda || formateando}
                                            title="Junta SOLO esta pieza en la ronda (no escribe: eso pasa al guardar el avance)."
                                            onClick={() => registrar([k])}
                                            data-accion="registrar-este-disco"
                                        >
                                            {yaEnRonda ? (
                                                <>
                                                    <Check className="h-4 w-4" aria-hidden="true" />
                                                    En la ronda
                                                </>
                                            ) : (
                                                'Registrar'
                                            )}
                                        </Button>
                                        {motivoId ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="ml-auto min-h-11 px-3 text-[12.5px]"
                                                onClick={() =>
                                                    setRechazos((prev) => {
                                                        const c = { ...prev }
                                                        delete c[k]
                                                        return c
                                                    })
                                                }
                                            >
                                                <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                                Quitar rechazo
                                            </Button>
                                        ) : (
                                            <select
                                                className="ml-auto h-11 max-w-[180px] rounded-md border border-border bg-surface-raised px-2 text-[12.5px]"
                                                value=""
                                                onChange={(e) => {
                                                    if (!e.target.value) return
                                                    setRechazos((prev) => ({ ...prev, [k]: e.target.value }))
                                                }}
                                                title="Rechazar a mano (daño físico que el SMART no ve)"
                                                data-accion="rechazo-manual"
                                            >
                                                <option value="">✋ Rechazar a mano…</option>
                                                {motivos.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* ── ②③ LA BARRA DE ACCIONES — debajo de TODAS las fichas ────
                        ⭐ MEJORA 45 — acá viven los DOS botones de conjunto:
                        · `Formatear N discos`: ⭐ **MEJORA 46 (04 Oct 2026) — ya NO se apaga
                          cuando alguno no pasa.** Formatea todos los discos leídos y la
                          **confirmación avisa** quién no cumple la regla de salud y por qué.
                          Antes se apagaba con un disco al 99 %; se cambió a pedido del dueño,
                          así que **la protección es la advertencia explícita, no el botón muerto**.
                        · `Expulsar el dock`: apaga el puente USB para poder desconectarlo.
                          🔴 Deshabilitado con un formateo corriendo — la regla dura. */}
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-[56px] px-5 text-[15px] font-semibold border-warning/55 bg-warning/10 text-warning disabled:opacity-45"
                            onClick={() =>
                                setFormatoPedido({
                                    ns: conNs.map((d) => d.serial).filter((x): x is string => !!x),
                                    claves: conNs.map((d) => clave(d, discos.indexOf(d))),
                                })
                            }
                            disabled={formateando || expulsando || todosFormateados || !hayQueFormatear}
                            title={
                                noCumplen.length > 0
                                    ? `Formatea los ${conNs.length} discos leídos, incluido(s) ${noCumplen.length} que NO cumple(n) la regla de salud. Te lo advierte antes de borrar.`
                                    : 'Formatea TODOS los discos leídos (les borra las particiones).'
                            }
                            data-accion="formatear-discos"
                        >
                            {formateando ? (
                                <Loader2 className="mr-1.5 h-5 w-5 animate-spin" aria-hidden="true" />
                            ) : null}
                            {formateando
                                ? 'Formateando…'
                                : todosFormateados
                                  ? 'Ya formateado'
                                  : expulsando
                                    ? 'Expulsando el dock…'
                                    : `Formatear ${conNs.length} disco${conNs.length === 1 ? '' : 's'}`}
                        </Button>
                        <Button
                            type="button"
                            className="min-h-[56px] px-6 text-[16px] font-semibold"
                            onClick={() => registrar(null)}
                            disabled={formateando || expulsando || sinRegistrar === 0}
                            data-accion="registrar-ronda"
                        >
                            <Check className="mr-1.5 h-5 w-5" aria-hidden="true" />
                            {sinRegistrar === 0
                                ? '✓ En la ronda'
                                : `Registrar ${sinRegistrar} disco${sinRegistrar === 1 ? '' : 's'}`}
                        </Button>
                        {/* ⭐ MEJORA 45 — EXPULSAR EL DOCK. Expulsa el puente USB ENTERO (los dos
                            discos van juntos: es un solo dispositivo). Se niega con un formateo
                            activo, y también con lecturas sin registrar — expulsar ahí perdería
                            la lectura que todavía no se guardó. */}
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-[56px] gap-1.5 px-5 text-[15px] font-semibold"
                            onClick={() => setConfirmarExpulsion(true)}
                            disabled={formateando || expulsando}
                            title={
                                formateando ? ayudaExpulsarFormateo : ayudaExpulsar
                            }
                            data-accion="expulsar-dock"
                        >
                            {expulsando ? (
                                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                            ) : (
                                <LogOut className="h-5 w-5" aria-hidden="true" />
                            )}
                            {expulsando ? 'Expulsando…' : 'Expulsar el dock'}
                        </Button>
                        <span className="text-[12.5px] text-muted-foreground">
                            {formateando ? (
                                'Esperá a que termine el formateo…'
                            ) : expulsando ? (
                                'Expulsando el dock: Windows está desmontando los discos…'
                            ) : sinRegistrar === 0 ? (
                                <>
                                    <b className="text-foreground">Ya está en la ronda.</b> Sacá estos discos y
                                    poné los siguientes.
                                </>
                            ) : noCumplen.length > 0 ? (
                                <>
                                    <b className="text-warning">
                                        {noCumplen.length} de {conNs.length} no cumple(n) la salud:
                                    </b>{' '}
                                    el botón formatea <b className="text-foreground">todos igual</b> y te avisa
                                    antes de borrar. El que sí pasa también tiene su botón en la tarjeta.
                                </>
                            ) : (
                                <>
                                    <b className="text-foreground">{sinRegistrar}</b> disco(s) leídos sin
                                    registrar: entran a la ronda con `Registrar`.
                                </>
                            )}
                        </span>
                        {enRonda > 0 ? (
                            <span className="ml-auto text-[12px] text-muted-foreground">
                                en la ronda: <b className="text-foreground">{enRonda}</b>
                            </span>
                        ) : null}
                    </div>

                    {/* ⭐ MEJORA 46 — EL AVANCE SE MUDA A SU PROPIO MODAL.
                        Acá vivía el bloque «③ EL AVANCE REAL» (la fase global + una barra por
                        disco + los 4 pasos), DENTRO del modal de revisión y con la × viva: el
                        formateo se podía cerrar en medio del borrado. Ahora ese bloque vive en
                        `ModalFormateo`, que no se cierra hasta tener un resultado.
                        ⚠️ Y el ESTADO no se mudó: `formato` y el sondeo se quedan acá, porque
                        además de pintar disparan los `toast`, avisan al wizard (`onFormateado`) y
                        alimentan `formateados`/`todosFormateados`/`formateando`, que son los que
                        habilitan los botones de cada tarjeta. Ver la cabecera del modal. */}
                    <ModalFormateo
                        abierto={verFormateo}
                        discos={discos}
                        formato={formato}
                        transcurrido={transcurrido}
                        sinContacto={sinContacto}
                        onCerrar={() => setVerFormateo(false)}
                        onReintentar={() => void reintentarFormateo()}
                    />
                </>
            ) : null}

            {/* ── ④ LAS CONFIRMACIONES — el kit 0.8, no un check en el cuerpo ────
                El check se podía dejar marcado de una vez y todo lo que se formateara
                después pasaba sin volver a preguntar. Esto aparece CADA VEZ y nombra los
                discos exactos con su bahía, su NS y a dónde va cada uno.
                ⚠️ Es del kit: NO acepta children (lo verifiqué en su fuente) — la lista va
                en `descripcion` + `detalle`.
                ⭐ MEJORA 45 — el diálogo ahora formatea **lo que se le pidió**: un disco desde
                su tarjeta o todos desde el botón grande. Antes mandaba SIEMPRE todos los NS,
                así que «formatear este disco» era imposible (y con un 99 % en el dock el
                formateo se llevaba también el de devolución). */}
            {(() => {
                const pedido = formatoPedido
                const discosPedidos = pedido
                    ? discos.filter((d, i) => pedido.claves.includes(clave(d, i)))
                    : []
                const cuantos = discosPedidos.length
                /**
                 * ⭐ MEJORA 46 — QUIÉNES del pedido NO cumplen la regla de salud.
                 *
                 * El botón grande ya **no se apaga** por ellos (pedido del dueño), así que el aviso
                 * tiene que existir… pero **CORTO**. El 04 Oct 2026 el usuario pidió *«quitar todo
                 * esto del mensaje»* después de ver el diálogo con el párrafo de siempre + la lista
                 * de discos + el bloque ⚠️ + el pie: **cuatro bloques de texto para borrar dos
                 * discos**, y el disco que no cumplía aparecía **dos veces** (en la lista y en el
                 * aviso). Lo que queda: **una línea** con cuántos no cumplen y su `%`; y si
                 * **todos pasan, nada** — el título ya dice qué va a pasar.
                 * ⚠️ El `%` no se pierde: es lo que hace que el técnico mire la ficha antes de
                 * aceptar (el detalle de cada disco ya está en su ficha, a un clic).
                 */
                const noCumplenPedido = discosPedidos.filter((d) => veredictoDe(d) !== 'PASA')
                const porcentajes = noCumplenPedido.map((d) => `${d.salud.puntaje ?? '—'} %`).join(' · ')
                const aviso = noCumplenPedido.length
                    ? `⚠️ ${noCumplenPedido.length} ${noCumplenPedido.length === 1 ? 'disco no cumple' : 'discos no cumplen'} la salud (${porcentajes}). ¿Formatear igual?`
                    : ''
                return (
                    <ConfirmarAccionDialog
                        open={pedido !== null}
                        onOpenChange={(abierto) => {
                            if (!abierto) setFormatoPedido(null)
                        }}
                        titulo={`Vas a borrar ${cuantos} disco${cuantos === 1 ? '' : 's'}`}
                        // ⚠️ Vacío cuando TODOS pasan. `ConfirmarAccionDialog` renderiza siempre su
                        // `DialogDescription` (Radix la pide para accesibilidad), así que se le pasa
                        // `''` en vez de tocar el kit compartido: un `<p>` sin texto no se ve.
                        descripcion={aviso}
                        confirmLabel={noCumplenPedido.length ? 'Sí, formatear de todos modos' : 'Sí, formatear'}
                        variant="destructive"
                        tactil
                        successMessage="Formateo arrancado."
                        onConfirm={async () => {
                            const ns = (pedido?.ns ?? []).filter((x) => !!x)
                            if (ns.length === 0) return { error: 'No hay números de serie que formatear.' }
                            const r = await iniciarFormateo(ns)
                            if (!r.ok) return { error: r.error ?? 'No se pudo arrancar el formateo.' }
                            const p = await leerProgresoFormateo()
                            setFormato(p.estado === 'inactivo' ? { ...p, estado: 'corriendo' } : p)
                            // ⭐ MEJORA 46 — el proceso se ve en SU PROPIO modal: se abre acá y no
                            // se cierra hasta que haya resultado (o hasta perder el contacto). El
                            // sondeo y el guardián del cierre viven en este panel; el modal solo lo
                            // muestra y obedece (ver la cabecera de `ModalFormateo`).
                            setFallos(0)
                            setVerFormateo(true)
                            return { error: null }
                        }}
                    />
                )
            })()}

            {/* ⭐ MEJORA 45 — la confirmación de la EXPULSIÓN. Es el mismo kit y el mismo criterio.
                ⭐ MEJORA 46 (04 Oct 2026) — **el dueño pidió ACORTARLO**: *«el modal de advertencia de
                expulsar es mucho texto»*. Antes eran **dos párrafos** en `descripcion` **más** un
                `detalle`; ahora es **UNA línea** con lo que importa (que se va el dock **entero** y que
                **no borra nada**) y el «qué hacer después» se mudó al `successMessage`, que es su lugar
                (el kit lo usa como toast de éxito).
                ⚠️ Y lo que el kit no perdona: **`detalle` se pinta en ROJO** (`text-destructive`,
                `font-medium`). La frase tranquilizadora («NO se toca ningún dato: expulsar no formatea»)
                estaba justo ahí ⇒ **se leía como una amenaza**. Ahora el rojo queda **solo** para lo que
                de verdad se pierde: las lecturas sin registrar. Si no hay nada que perder, va `''`. */}
            <ConfirmarAccionDialog
                open={confirmarExpulsion}
                onOpenChange={setConfirmarExpulsion}
                titulo="Vas a expulsar el dock"
                descripcion="Se expulsa el dock entero: los dos discos se desconectan juntos. No borra nada."
                detalle={
                    sinRegistrar > 0
                        ? `⚠️ Hay ${sinRegistrar} lectura(s) sin registrar: si expulsás, se pierden. Registralas antes.`
                        : ''
                }
                confirmLabel="Sí, expulsar el dock"
                tactil
                successMessage="Dock expulsado · ya podés desconectarlo y poner los otros discos"
                onConfirm={async () => {
                    // 🔴 La regla dura, antes de mandar nada: con un formateo activo NO se expulsa.
                    if (formateando) {
                        return { error: 'Hay un formateo en curso: expulsar el dock ahora dejaría el disco a medio formatear. Esperá a que termine.' }
                    }
                    const r = await expulsarDock()
                    if (!r.ok) return { error: r.error ?? 'No se pudo expulsar el dock.' }
                    setExclusion({ ...EXPULSION_INACTIVA, estado: 'corriendo' })
                    setExpulsando(true)
                    return { error: null }
                }}
            />

            {/* ⭐ MEJORA 46 (04 Oct 2026) — ACÁ VIVÍA «Formateo en curso. Los pasos son: …».
                Se sacó porque quedó **detrás del modal del formateo**: mientras corre, el modal
                tapa el panel, así que ese renglón **no se veía nunca** — era UI muerta. Y ya no
                hace falta: el modal dice lo mismo y mejor (los 4 pasos, marcados uno por uno, con
                el que corre en curso). ⚠️ No había ningún caso alcanzable: el formateo solo corre
                desde el modal, que se abre al arrancarlo. */}

            {/* El motivo REAL de una expulsión que Windows rechazó (un archivo abierto, un
                programa que tiene el disco tomado). Sin esto el técnico ve «no se pudo» y
                no sabe qué cerrar. */}
            {exclusion.estado === 'error' && exclusion.aviso ? (
                <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{exclusion.aviso}</span>
                </p>
            ) : null}
        </div>
    )
}
