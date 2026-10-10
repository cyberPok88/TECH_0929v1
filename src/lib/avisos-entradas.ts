// ═══════════════════════════════════════════════════════════════════════════════
// AVISOS DE ENTRADAS — Guía 1.6 · MEJORA 53 (09 Oct 2026)
//
// ⭐ LA DECISIÓN DE «A QUIÉN LE TOCA», sin React y sin Supabase: una función pura
// por cada tabla publicada. Vive separada del componente por la misma razón que
// `lector-discos.ts` y `lectura-aval.ts`: es la parte que se puede probar sin
// montar un navegador ni abrir una conexión.
//
// ── EL PROBLEMA QUE RESUELVE (reportado por el dueño, 09 Oct 2026) ─────────────
// *«cuando se genera una entrada, el usuario que tiene su vista de revisión
// técnica no se entera de que hay una revisión hasta que recarga la página»*.
//
// ⚠️ EL MAPEO NO ES «toda fila que cambió». Es «toda fila que dejó TRABAJO NUEVO
//    en una etapa», y por eso hay estados que a propósito NO avisan:
//      · `en_revision` · `en_acondicionamiento` · `en_limpieza` — los escribe el
//        PROPIO operario al TOMAR el trabajo: avisarle sería devolverle su clic.
//      · `confirmada` — es el fin del flujo, no hay nada que hacer.
//
// ⚠️ Y HAY DOS CASOS QUE AVISAN **SOLO AL NACER**: `recien_creada` y
//    `por_limpiar`. Sin eso, un UPDATE que no cambia la etapa —`editarEntrada`
//    escribe `actualizado_por` y deja `recien_creada` intacta— volvería a avisar
//    de una entrada que el técnico ya vio.
//
// ⚠️ DOS TABLAS Y NO UNA, y no es simetría: la **liberación parcial NO mueve
//    `entradas.estado`** (regla viva: *«la entrada sigue en `en_revision`; lo que
//    sale es mercancía»*) ⇒ el acondicionador **no se enteraría** de una tanda
//    nueva mirando solo el documento.
//
// ⚠️ Y NO SE MIRA QUIÉN LO HIZO, a propósito: el aviso es de la **COLA**, no del
//    **ACTO**. Callar el aviso de quien causó el cambio es la tentación obvia, y se
//    descartó por dos razones:
//      ① **Sería frágil.** Buena parte de los cambios de estado los escribe el
//         trigger `tr_entradas_transicion` (`UPDATE entradas SET estado = …`), que
//         **no** toca `actualizado_por` ⇒ la columna conserva el valor VIEJO y el
//         filtro callaría un aviso legítimo, **en silencio**.
//      ② **Sería redundante.** Los estados que significan «yo lo tomé» ya están
//         excluidos POR ESTADO (`en_revision` · `en_acondicionamiento` ·
//         `en_limpieza` · `confirmada`).
//    Lo que queda es trabajo REAL de una cola: si el Administrador —el único rol con
//    las cinco etapas— genera una entrada, enterarse de que espera revisión es
//    información, no ruido. Y quien no puede abrir la etapa no lo ve siquiera: el
//    aviso se filtra por permiso **antes** de mostrarse.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Las etapas del flujo de Entradas que RECIBEN trabajo.
 * ⚠️ Es la misma lista que el RBAC: el href de `RUTA_ETAPA` es **literal** el que
 *    la 0.4 sembró en `permisos_navegacion`, porque con él se decide quién ve el
 *    aviso (el filtro de permisos es lo que evita avisarle a quien no puede ver).
 */
export type EtapaEntradas =
    | 'recepcion'
    | 'revision'
    | 'acondicionamiento'
    | 'almacen'
    | 'divergencias'

/** La ruta de cada etapa — el MISMO href con el que la app consulta el RBAC. */
export const RUTA_ETAPA: Record<EtapaEntradas, string> = {
    recepcion: '/dashboard/entradas/recepcion',
    revision: '/dashboard/entradas/revision',
    acondicionamiento: '/dashboard/entradas/acondicionamiento',
    almacen: '/dashboard/entradas/alta',
    divergencias: '/dashboard/entradas/divergencias',
}

/** El rótulo de la etapa, para el aviso y para la acción del toast. */
export const ETIQUETA_ETAPA: Record<EtapaEntradas, string> = {
    recepcion: 'Recepción',
    revision: 'Revisión',
    acondicionamiento: 'Acondicionamiento',
    almacen: 'Almacén',
    divergencias: 'Divergencias',
}

/** El tipo de evento que Realtime entrega (`postgres_changes`). */
export type EventoCambio = 'INSERT' | 'UPDATE' | 'DELETE'

/** Un aviso listo para pintar. */
export interface AvisoEntrada {
    etapa: EtapaEntradas
    /** Sella el toast (`id` de sonner): el mismo evento dos veces NO duplica el aviso. */
    clave: string
    titulo: string
    detalle: string
}

/** La fila de `entradas` que Realtime entrega (solo lo que se lee). */
export interface FilaEntrada {
    id: string
    folio?: string | null
    estado?: string | null
    es_sin_revision?: boolean | null
}

/** La fila de `liberaciones_entrada` que Realtime entrega. */
export interface FilaLiberacion {
    id: string
    tanda?: number | null
    cantidad?: number | null
    estado?: string | null
}

/** «5 piezas» · «1 pieza» — el detalle de una tanda. */
function textoCantidad(cantidad: number | null | undefined): string {
    const n = Number(cantidad ?? 0)
    return n === 1 ? '1 pieza' : `${n} piezas`
}

/** El detalle de una tanda: «Tanda 3 · 5 piezas». */
function textoTanda(tanda: number | null | undefined, cantidad: number | null | undefined): string {
    return `Tanda ${Number(tanda ?? 0)} · ${textoCantidad(cantidad)}`
}

/**
 * ¿El evento dejó trabajo nuevo, y en qué etapa(s)?
 *
 * `entradas.estado` en el momento del evento. Los estados que NO se listan son
 * decisiones escritas arriba (arriba del archivo, con su porqué).
 */
function etapasDeEstado(
    estado: string,
    sinRevision: boolean
): EtapaEntradas[] {
    switch (estado) {
        // El documento acaba de nacer. Los DOS caminos del flujo:
        //   · con revisión    → el técnico
        //   · sin revisión    → salta la revisión y cae en Acondicionamiento
        //     (`AcondicionamientoCatalogo.Acondicionable` lo confirma: es el
        //      «camino 2», un `recien_creada` + `es_sin_revision`)
        case 'recien_creada':
            return sinRevision ? ['acondicionamiento'] : ['revision']

        // Recepción la dejó lista (hoy sin escritor, pero es un estado VIVO del
        // CHECK de la tabla): sigue siendo trabajo del técnico.
        case 'lista_para_revision':
            return ['revision']

        // La revisión cerró (lo escribe `fn_cerrar_revision`): quien espera es
        // Recepción, que tiene que cerrar el ciclo documental.
        case 'revisada_sin_dev':
        case 'con_dev':
            return ['recepcion']

        // Nota generada: la mercancía va a limpieza.
        case 'ajustada':
            return ['acondicionamiento']

        // Llegó al puesto de Almacén (lo escribe el acondicionador al terminar).
        case 'en_almacen':
            return ['almacen']

        // El admin tiene que decidir antes de que el flujo siga.
        case 'bloqueada_por_divergencia':
            return ['divergencias']

        // ⚠️ Deliberadamente mudos — está explicado arriba, no es un olvido:
        //   · en_revision          → lo escribió el técnico al TOMAR
        //   · en_acondicionamiento → lo escribió el acondicionador al TOMAR
        //   · confirmada           → fin del flujo
        default:
            return []
    }
}

/** ¿Este estado solo avisa cuando la fila NACE? (evita el re-aviso por edición) */
function esSoloAlNacer(estado: string): boolean {
    return estado === 'recien_creada'
}

/**
 * Los avisos que produce un evento de `entradas`.
 *
 * @param fila   La fila NUEVA del evento.
 * @param evento INSERT / UPDATE / DELETE.
 */
export function avisosDeEntrada(fila: FilaEntrada, evento: EventoCambio): AvisoEntrada[] {
    if (evento === 'DELETE') return []
    const estado = fila.estado ?? ''
    if (estado === '') return []
    if (evento === 'UPDATE' && esSoloAlNacer(estado)) return []

    const folio = fila.folio ?? 'la entrada'
    const TITULO: Partial<Record<string, string>> = {
        recien_creada: 'Entrada nueva por revisar',
        lista_para_revision: 'Entrada lista para revisar',
        revisada_sin_dev: 'Revisión cerrada, por cerrar en Recepción',
        con_dev: 'Revisión cerrada con devolución, por cerrar en Recepción',
        ajustada: 'Entrada lista para acondicionar',
        en_almacen: 'Entrada lista para el alta a inventario',
        bloqueada_por_divergencia: 'Entrada bloqueada por una divergencia',
    }

    return etapasDeEstado(estado, fila.es_sin_revision === true).map((etapa) => ({
        etapa,
        clave: `entrada-${fila.id}-${estado}`,
        titulo:
            estado === 'recien_creada' && fila.es_sin_revision === true
                ? 'Entrada nueva sin revisión, para acondicionar'
                : TITULO[estado] ?? 'Hay trabajo nuevo en Entradas',
        detalle: folio,
    }))
}

/**
 * Los avisos que produce un evento de `liberaciones_entrada`.
 *
 * El camino de la tanda es `por_limpiar → en_limpieza → en_almacen → confirmada`:
 * avisa al **nacer** (`por_limpiar`, trabajo del acondicionador) y al **entregarse**
 * (`en_almacen`, trabajo del almacenista). `en_limpieza` y `confirmada` son actos
 * del propio operario.
 */
export function avisosDeLiberacion(fila: FilaLiberacion, evento: EventoCambio): AvisoEntrada[] {
    if (evento === 'DELETE') return []
    const estado = fila.estado ?? ''

    // A la tanda se le avisa al NACER: un UPDATE sobre una `por_limpiar` que no
    // cambia de etapa (p. ej. tocar `notas`) no es trabajo nuevo.
    if (estado === 'por_limpiar' && evento !== 'INSERT') return []

    const etapa: EtapaEntradas | null =
        estado === 'por_limpiar' ? 'acondicionamiento' : estado === 'en_almacen' ? 'almacen' : null
    if (etapa === null) return []

    return [
        {
            etapa,
            clave: `tanda-${fila.id}-${estado}`,
            titulo:
                etapa === 'acondicionamiento'
                    ? 'Tanda nueva por acondicionar'
                    : 'Tanda entregada para el alta a inventario',
            detalle: textoTanda(fila.tanda, fila.cantidad),
        },
    ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 54 (09 Oct 2026) — «¿ESTA FILA ES NUEVA?»
// Mockup aprobado: `DOCS/design/entradas/02-revision/nuevas-en-la-cola.html`
//
// El pedido del dueño, verbatim: *«me gustaría que esas nuevas entradas puedan
// distinguirse de las demás? un icono o algo que se mueva que esas son nuevas»*.
//
// La marca tiene **dos razones** de existir, y se aprobaron como **UNA sola
// pieza** (opción **A+B**):
//   · **B — recencia** (las funciones de abajo): la entrada se capturó dentro de
//     la ventana ⇒ **sobrevive a la recarga y al cambio de turno**, y no necesita
//     BD porque `created_at` **ya viaja** en el listado.
//   · **A — llegó en vivo**: la fila entró por Realtime en esta sesión ⇒ además
//     **pulsa**. Eso vive en el store (`avisos-entradas-store`), porque es un
//     hecho de la SESIÓN y no de la fila.
// ⚠️ No son dos dibujos: es un marcador con dos razones para estar ahí.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * La ventana de «nueva» por recencia: **24 h corridas** — decisión del dueño
 * (09 Oct 2026) entre las 3 ventanas que planteó el mockup.
 *
 * ⚠️ Acá se miden **horas corridas** contra `created_at`, mientras la píldora de
 * al lado mide **días de calendario** sobre `entradas.fecha`: son **dos relojes**
 * distintos y conviven a propósito — esto es una decisión de **operación**
 * (cubre el turno del puesto), no una etiqueta de antigüedad. El mockup lo anotó
 * como el riesgo de esta opción, y es real: con 24 h, una entrada de ayer a las
 * 18:00 todavía se marca hoy a las 17:00 aunque el técnico ya la haya tomado.
 */
export const VENTANA_NUEVA_MS = 24 * 60 * 60 * 1000

/**
 * ¿Esta fila es «nueva» por recencia? (opción **B** del mockup)
 *
 * @param createdAt `entradas.created_at` en ISO — viaja al cliente: ver el
 *                  `select` de `listarEntradas` (`lib/actions/entradas.ts`) y el
 *                  tipo `Entrada` (`types/entradas.ts`).
 * @param ahora     Inyectable, para poder probarlo sin congelar el reloj.
 */
export function esNuevaPorRecencia(
    createdAt: string | null | undefined,
    ahora: number = Date.now()
): boolean {
    if (!createdAt) return false
    const t = Date.parse(createdAt)
    if (Number.isNaN(t)) return false
    const edad = ahora - t
    // ⚠️ Una fecha FUTURA no es «nueva», es un reloj desfasado (o una siembra).
    // Sin esta guarda, un `created_at` por delante marcaría la fila para siempre.
    return edad >= 0 && edad <= VENTANA_NUEVA_MS
}

/**
 * La antigüedad en horas, para el `title` del marcador: «menos de 1 h» · «22 h».
 *
 * ⚠️ **Sin decimales a propósito:** el mockup escribía «0,03 h» porque estaba
 * mostrando el dato crudo; en un tooltip, «hace menos de 1 h» se lee y «hace
 * 0,03 h» se tiene que interpretar.
 */
export function textoRecencia(createdAt: string, ahora: number = Date.now()): string {
    const t = Date.parse(createdAt)
    if (Number.isNaN(t)) return 'poco'
    const horas = Math.floor(Math.max(0, ahora - t) / 3_600_000)
    return horas < 1 ? 'menos de 1 h' : `${horas} h`
}
