// ═══════════════════════════════════════════════════════════════════════════════
// LECTOR DE DISCOS — el puente hacia el AGENTE del puesto  (Guía 1.6 · MEJORA 44)
// ═══════════════════════════════════════════════════════════════════════════════
// El navegador NO puede leer un disco: por seguridad no tiene acceso al hardware.
// El disco lo lee un AGENTE que corre en la MISMA PC del taller (127.0.0.1), que
// sí puede hablar con él (SMART por SAT, con permisos de administrador).
//
// Este módulo es el ÚNICO punto que conoce esa dirección:
//   la app  →  http://127.0.0.1:8788/api/discos  →  el agente
//
// ⚠ La primera vez, Chrome pide permiso («buscar y conectar con dispositivos de tu
//   red local») porque la app vive en un dominio público (Vercel) y el agente en
//   loopback. Una vez concedido, no vuelve a preguntar.
//
// ⭐ LA SALUD NO LA CALCULA ESTA APP. Viene de **HDSentinel** (su `Health`), que es
//   la fuente que decide en el taller. El agente la lee de `HDSentinel.xml`. Si un
//   disco no está ahí, el agente cae a una fórmula propia y lo declara en `fuente`.
//   Regla del negocio: **solo Health 100 pasa**; menos es devolución.
// ═══════════════════════════════════════════════════════════════════════════════

import type { LecturaEntrada } from '@/types/entradas'

/** Dirección del agente en la PC del puesto. */
export const URL_AGENTE = 'http://127.0.0.1:8788'

/**
 * ⭐ 08 Oct 2026 — **LA VERSIÓN MÍNIMA DEL AGENTE, y por qué la app la necesita.**
 *
 * Medido el 08 Oct 2026: el `.exe` del puesto se quedó **viejo** y nadie se enteró. Llevaba
 * 17 de 18 reglas de marca (una marca salía vacía y el técnico la completaba a mano, que es
 * un síntoma que se lee como «el disco es raro», no como «el agente es viejo») y el
 * `preparar-discos.ps1` en **MBR** con la fuente ya en **GPT**. Y la app **toleraba** al
 * agente viejo en silencio (`normalizarLectura` deduce lo que el agente no manda) ⇒ la
 * deriva era invisible desde los dos lados.
 *
 * Desde el agente **1.1.0** la versión viaja en `GET /api/discos` (`version`) y en
 * `/api/salud`. Acá se declara cuál es la mínima y el panel avisa. **Un agente que NO manda
 * versión es anterior a esta regla** ⇒ se considera viejo: es exactamente el caso que hay
 * que hacer visible.
 *
 * ⚠️ SI SUBÍS `VERSION` EN `spikes/smart-puesto-revision/agente.py`, subí TAMBIÉN esto — o el
 * aviso deja de aparecer y volvemos al silencio.
 */
export const VERSION_MINIMA_AGENTE = '1.2.0'

function partesDeVersion(v: string): number[] {
    return v.split('.').map((n) => {
        const x = Number.parseInt(n, 10)
        return Number.isNaN(x) ? 0 : x
    })
}

/** ¿Esta versión de agente es anterior a `VERSION_MINIMA_AGENTE`? (`null` = sí) */
export function agenteDesactualizado(version: string | null | undefined): boolean {
    if (!version) return true
    const a = partesDeVersion(version)
    const b = partesDeVersion(VERSION_MINIMA_AGENTE)
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] ?? 0
        const y = b[i] ?? 0
        if (x !== y) return x < y
    }
    return false
}

/** Cuánto esperar al agente (leer un disco tarda ~15 s: lanza CrystalDiskInfo). */
const MS_ESPERA = 60_000

export interface SaludDisco {
    /** El número que decide (0-100). Hoy sale de HDSentinel. */
    puntaje: number | null
    /** 'hdsentinel' | 'nvme' | 'formula' — de dónde salió el número. */
    fuente: string
    /** El veredicto de texto de CrystalDiskInfo (Bueno / Precaución / Malo). */
    veredicto: string
    /** ⭐ La regla del taller: `puntaje === 100`. Se guarda tal cual en `lecturas_disco`. */
    apto: boolean
    /**
     * ⭐ MEJORA 44 (30 Sep 2026) — **¿este número puede DECIDIR?**
     * El agente devuelve `true` solo si la salud salió de **HDSentinel** (el taller) o del
     * **propio disco** (NVMe). Con `fuente: 'formula'` —el respaldo de la casa, que **arranca en
     * 100**— es `false`: sin aval, la salud **no manda una devolución automática**.
     */
    apto_para_decidir: boolean
    /** Inverso de `apto_para_decidir`: la ficha lo dice y el técnico decide. */
    requiere_revision: boolean
    motivos: string[]
}

export interface DiscoLeido {
    /** NS del FIRMWARE — el que manda (el de Windows viene en ceros en USB). */
    serial: string | null
    modelo: string | null
    /** Marca sugerida a partir del MODELO (HDSentinel no da el fabricante). */
    marca: string | null
    marca_confianza: string | null
    /** Rótulo de la bahía ('1','2'…) — pista: vale si se cargó desde la bahía 1 sin huecos. */
    bahia: string | null
    firmware: string | null
    horas_uso: number | null
    encendidos: number | null
    temperatura_c: number | null
    rpm: number | null
    capacidad_texto: string | null
    interfaz: string | null
    es_nvme: boolean
    /** La dirección del disco (el LUN identifica la bahía). */
    lun: number | null
    disco_fisico: number | null
    /** El NS que reporta Windows (evidencia de que no sirve en USB). */
    serial_windows: string | null
    /** Motor que produjo la lectura (crystaldiskinfo). */
    motor: string | null
    sectores_reasignados: number | null
    sectores_pendientes: number | null
    sectores_no_corregibles: number | null
    errores_crc: number | null
    salud: SaludDisco
    /** La lectura cruda del motor (evidencia). */
    smart: unknown[]
    /**
     * ⚠️ El agente del puesto es **anterior a la regla del aval**: no manda `apto_para_decidir`.
     * En ese caso el aval se INFIERE con la misma regla (`hdsentinel`/`nvme` deciden, `formula` no)
     * para no pintar de «SIN AVAL» discos que el taller sí avala. Esta bandera existe para que la
     * app pueda decirle al técnico que reinicie el agente en vez de mentirle sobre el disco.
     */
    agente_desactualizado: boolean
}

export interface LecturaDiscos {
    /** ¿El agente respondió? `false` = no está corriendo en esa PC. */
    agente: boolean
    discos: DiscoLeido[]
    /** Discos del sistema omitidos (no son mercancía). */
    omitidos: number
    motor: string | null
    hdsentinel: { fuente: string | null; fecha: string | null } | null
    /**
     * ⭐ MEJORA 44 — **cuántos segundos tiene el archivo de HDSentinel** (`atraso_segundos`).
     * El número que decide una devolución sale de un archivo que HDSentinel reescribe cada
     * cierto tiempo: esto es lo que permite decir «esta salud es de hace 3 días» en vez de
     * mostrarla como si fuera de ahora.
     */
    hdsentinel_atraso_segundos: number | null
    /**
     * ⭐ MEJORA 45 (1 Oct 2026) — **¿la lectura quedó INCOMPLETA?**
     *
     * Medido en el puesto: la lectura fresca del dock a veces vuelve con **1 de 2** discos,
     * con el segundo perfectamente conectado. Como el `.ps1` coteja cada NS contra esa
     * lectura, el disco que el agente no alcanzó a leer caía en un `rechazo` que decía
     * «no está conectado AHORA» — **culpaba al disco cuando el que no terminó de leer fue
     * el agente**, el formateo no hacía nada y el mensaje mandaba a revisar el dock.
     *
     * El agente ahora reintenta el ciclo y declara el resultado acá. ⚠️ `true` NO significa
     * «falta un disco»: significa **«no se puede concluir nada»**. La lista NO se completa
     * nunca con el inventario de Windows: un disco sacado a propósito y uno que no se pudo
     * leer son indistinguibles por cantidad, y completar la lista haría que `diskpart`
     * limpiara el disco que esté en esa posición.
     *
     * `null` cuando el agente no lo informa (versión anterior): es DESCONOCIDO, no «completa».
     */
    lectura_incompleta: boolean | null
    /** Cuántos discos del puente USB llegaron a leerse. `null` si el agente no lo dice. */
    discos_vistos: number | null
    /** Cuántos discos tiene el puente USB (el total contra el que se mide la completitud). */
    discos_esperados: number | null
    /** Los que el puente tiene y esta lectura no vio: quién falta, para poder decirlo. */
    discos_no_leidos: { disco_fisico: number | null; nombre: string | null }[]
    /** Avisos del agente (p. ej. «usando la fórmula propia»). */
    avisos: string[]
    /**
     * ⭐ 08 Oct 2026 — la versión del agente que respondió. `null` = **no la manda** ⇒ es
     * anterior al agente 1.1.0 (ver `agenteDesactualizado`). Viaja también en la evidencia.
     */
    version_agente: string | null
    /** La fecha de esa versión (informativa). */
    version_fecha_agente: string | null
    /** `true` si el agente es anterior a `VERSION_MINIMA_AGENTE`. Lo pinta el panel. */
    agente_version_anterior: boolean
    error?: string
}

/**
 * ⭐ MEJORA 44 (1 Oct 2026, pedido del usuario) — **EL DOCK TIENE UN ORDEN FIJO: la bahía 1 va a la
 * IZQUIERDA y la 2 a la derecha.** El agente devuelve los discos en el orden en que los encuentra,
 * y ese orden **no es un contrato**: en el puesto, el técnico mete la mano en la ranura de la
 * izquierda y la ficha que tiene que leer es la de esa ranura. Si el orden baila, saca el disco
 * equivocado — y con la salud de otro.
 * Se ordena por **bahía** (no por índice de la respuesta): un solo disco cae siempre en LUN 0 →
 * bahía 1 → celda de la izquierda. Una bahía desconocida o no numérica va al final, sin romper.
 * ⚠ El rótulo de la bahía sale del LUN (calibración de arriba): con un disco **solo** en la ranura
 * derecha, el LUN es 0 y se rotula «1». El orden es fiel al rótulo; la identidad sigue siendo el NS.
 */
export function ordenarPorBahia(discos: DiscoLeido[]): DiscoLeido[] {
    const nro = (b: string | null | undefined): number => {
        if (b === null || b === undefined || b === '') return 99
        const v = Number(b)
        return Number.isFinite(v) ? v : 99
    }
    return [...discos].sort((a, b) => nro(a.bahia) - nro(b.bahia))
}

/**
 * ⭐ MEJORA 45 — **del JSON del agente a la lectura de la app**, sin red y sin `fetch`.
 *
 * Está separada de `leerDiscos` por una razón concreta: es donde viven la compatibilidad con
 * un agente VIEJO y la declaración de COMPLETITUD, que es la regla que decide si un disco
 * «no está conectado» o si «no lo alcanzamos a leer». Eso tiene que poder probarse sin
 * levantar un agente ni un navegador.
 *
 * ⚠️ Un agente anterior a la MEJORA 45 no manda `lectura_incompleta`: se deja en `null`
 * (DESCONOCIDO) y **no** en `false`. Dar por completa una lectura que nadie verificó es
 * exactamente el defecto que este campo existe para evitar.
 */
export function normalizarLectura(d: Record<string, unknown>): LecturaDiscos {
    const discos = Array.isArray(d.discos) ? (d.discos as Record<string, unknown>[]) : []
    const hds = (d.hdsentinel ?? null) as Record<string, unknown> | null
    const noLeidos = Array.isArray(d.discos_no_leidos)
        ? (d.discos_no_leidos as Record<string, unknown>[]).map((x) => ({
            disco_fisico: (x.disco_fisico as number | null) ?? null,
            nombre: (x.nombre as string | null) ?? null,
        }))
        : []
    return {
        agente: true,
        motor: (d.motor as string | null) ?? null,
        hdsentinel: hds ? { fuente: (hds.reporte as string | null) ?? null, fecha: (hds.fecha as string | null) ?? null } : null,
        hdsentinel_atraso_segundos: typeof hds?.atraso_segundos === 'number' ? (hds.atraso_segundos as number) : null,
        omitidos: Array.isArray(d.discos_omitidos) ? d.discos_omitidos.length : 0,
        avisos: Array.isArray(d.avisos_motor) ? (d.avisos_motor as string[]) : [],
        lectura_incompleta: typeof d.lectura_incompleta === 'boolean' ? d.lectura_incompleta : null,
        discos_vistos: typeof d.discos_vistos === 'number' ? d.discos_vistos : null,
        discos_esperados: typeof d.discos_esperados === 'number' ? d.discos_esperados : null,
        discos_no_leidos: noLeidos,
        version_agente: typeof d.version === 'string' ? d.version : null,
        version_fecha_agente: typeof d.version_fecha === 'string' ? d.version_fecha : null,
        agente_version_anterior: agenteDesactualizado(typeof d.version === 'string' ? d.version : null),
        discos: ordenarPorBahia(discos.map((x) => normalizar(x))),
    }
}

/**
 * Pide al agente los discos del dock.
 * **Nunca lanza y nunca bloquea la revisión**: si el agente no está, devuelve
 * `agente: false` y el wizard sigue funcionando a mano como siempre.
 */
export async function leerDiscos(opts?: { incluirSistema?: boolean }): Promise<LecturaDiscos> {
    const vacio: LecturaDiscos = {
        agente: false, discos: [], omitidos: 0, motor: null, hdsentinel: null,
        hdsentinel_atraso_segundos: null, avisos: [],
        lectura_incompleta: null, discos_vistos: null, discos_esperados: null,
        discos_no_leidos: [],
        version_agente: null, version_fecha_agente: null, agente_version_anterior: false,
    }
    const corte = new AbortController()
    const reloj = setTimeout(() => corte.abort(), MS_ESPERA)
    try {
        const url = `${URL_AGENTE}/api/discos?refrescar=1${opts?.incluirSistema ? '&incluir_sistema=1' : ''}`
        const res = await fetch(url, { signal: corte.signal, cache: 'no-store' })
        if (!res.ok) return { ...vacio, agente: true, error: `El agente respondió ${res.status}.` }
        const d = await res.json()
        return normalizarLectura(d as Record<string, unknown>)
    } catch (e) {
        // El caso más común: el agente no está corriendo en esa PC (o el permiso
        // de red local está denegado). No es un error de la app.
        const msg = e instanceof Error && e.name === 'AbortError'
            ? 'El agente tardó demasiado (¿está corriendo?).'
            : 'No encontré el lector de discos en esta PC.'
        return { ...vacio, error: msg }
    } finally {
        clearTimeout(reloj)
    }
}

/**
 * ⭐ CALIBRACIÓN DEL DOCK (medida 29–30 Sep 2026, dock Sabrent dual): la bahía rotulada «1» = LUN 0 y
 * la «2» = LUN 1. ⚠ El LUN se asigna por **orden de aparición**: vale si el dock se carga desde la
 * bahía 1 **sin huecos** (con un solo disco el LUN es siempre 0). El **NS** sigue siendo la identidad.
 */
const BAHIAS: Record<string, string> = { '0': '1', '1': '2' }

/** Rótulo de la bahía: el que manda el agente, o el derivado del LUN según la calibración. */
function rotuloBahia(x: Record<string, unknown>, u: Record<string, unknown>): string | null {
    const delAgente = (x.bahia as string | null) ?? null
    if (delAgente) return delAgente
    const lun = u.scsi_lun
    if (lun === null || lun === undefined) return null
    return BAHIAS[String(lun)] ?? `LUN ${String(lun)}`
}

/**
 * Del JSON del agente al tipo de la app.
 * **Exportada a propósito**: es donde vive la compatibilidad con un agente viejo, y esa
 * compatibilidad ya causó una vez el defecto más caro posible (pintar «SIN AVAL» discos
 * que el taller SÍ avala). Tiene test propio.
 */
export function normalizar(x: Record<string, unknown>): DiscoLeido {
    const s = (x.salud_detalle ?? {}) as Record<string, unknown>
    const u = (x.ubicacion ?? {}) as Record<string, unknown>
    const w = (x.windows ?? {}) as Record<string, unknown>
    const fuente = (s.fuente as string) ?? '—'
    const puntaje = (s.puntaje_estimado as number | null) ?? null
    /**
     * ⚠️ COMPATIBILIDAD CON UN AGENTE VIEJO — importa más de lo que parece.
     *
     * Si el puesto no reinició el agente, `apto_para_decidir` **no viene**. Y el respaldo
     * conservador (`Boolean(undefined)` = `false`) pintaría **TODOS los discos como
     * «SIN AVAL»**, incluso los que HDSentinel sí avala — el puesto entero parecería roto y
     * la regla del aval se volvería ruido en vez de excepción.
     *
     * Así que cuando el campo NO viene, se **infiere con la misma regla** en vez de asumir
     * lo peor: `hdsentinel` y `nvme` deciden, `formula` no. Es la regla, no una versión
     * relajada — y `agente_desactualizado` queda en `true` para que la app lo diga.
     */
    const traeAval = s.apto_para_decidir !== undefined && s.apto_para_decidir !== null
    const conAval = traeAval ? Boolean(s.apto_para_decidir) : (fuente === 'hdsentinel' || fuente === 'nvme')
    return {
        serial: (x.serial as string | null) ?? null,
        modelo: (x.modelo as string | null) ?? null,
        marca: (x.marca as string | null) ?? null,
        marca_confianza: confianzaMarcaValida(x.marca_confianza),
        bahia: rotuloBahia(x, u),
        firmware: (x.firmware as string | null) ?? null,
        horas_uso: (x.horas_uso as number | null) ?? null,
        encendidos: (x.encendidos as number | null) ?? null,
        temperatura_c: (x.temperatura_c as number | null) ?? null,
        rpm: (x.rpm as number | null) ?? null,
        capacidad_texto: (x.capacidad_texto as string | null) ?? null,
        interfaz: (x.interfaz as string | null) ?? null,
        es_nvme: Boolean(x.es_nvme),
        lun: (u.scsi_lun as number | null) ?? null,
        disco_fisico: (u.disco_fisico as number | null) ?? null,
        serial_windows: (w.serial_windows as string | null) ?? null,
        motor: (x.motor as string | null) ?? null,
        sectores_reasignados: (x.sectores_reasignados as number | null) ?? null,
        sectores_pendientes: (x.sectores_pendientes as number | null) ?? null,
        sectores_no_corregibles: (x.sectores_no_corregibles as number | null) ?? null,
        errores_crc: (x.errores_crc as number | null) ?? null,
        smart: (x.smart as unknown[]) ?? [],
        agente_desactualizado: !traeAval,
        salud: {
            puntaje,
            fuente,
            veredicto: (s.veredicto as string) ?? 'sin dato',
            apto: Boolean(s.apto),
            apto_para_decidir: conAval && puntaje !== null,
            requiere_revision: traeAval
                ? Boolean(s.requiere_revision)
                : !(conAval && puntaje !== null),
            motivos: (s.motivos as string[]) ?? [],
        },
    }
}

/**
 * ⭐ MEJORA 52 (07 Oct 2026) — **la confianza de la marca, normalizada en el BORDE.**
 *
 * `lecturas_disco.marca_confianza` tiene un `CHECK` que admite **solo** `alta` · `media` · `baja` ·
 * `nula`. El agente hoy manda exactamente esos 4 (`REGLAS_MARCA` de `agente.py`), pero si alguna vez
 * mandara otra cosa —un número, `high`, un espacio de más— el `INSERT` del turno **entero** fallaría
 * por violación de `CHECK`, y el técnico perdería la ronda. Se normaliza acá, una sola vez.
 * Un valor que no se reconoce **no se inventa**: queda `null` (desconocido), que es lo honesto.
 */
const CONFIANZAS_MARCA = ['alta', 'media', 'baja', 'nula'] as const

export function confianzaMarcaValida(v: unknown): string | null {
    const t = typeof v === 'string' ? v.trim().toLowerCase() : ''
    return (CONFIANZAS_MARCA as readonly string[]).includes(t) ? t : null
}

/**
 * ⭐ MEJORA 52 — **el `{ contexto }` de la evidencia**: lo que viene en la RESPUESTA del agente y
 * no en el disco. Antes se perdía entero (y con él el «esta salud es de hace 3 días»).
 */
export function contextoDeRespuesta(r: LecturaDiscos): Record<string, unknown> {
    return {
        motor: r.motor,
        hdsentinel: r.hdsentinel,
        hdsentinel_atraso_segundos: r.hdsentinel_atraso_segundos,
        lectura_incompleta: r.lectura_incompleta,
        discos_vistos: r.discos_vistos,
        discos_esperados: r.discos_esperados,
        discos_no_leidos: r.discos_no_leidos,
        omitidos: r.omitidos,
        avisos: r.avisos,
        // ⭐ 08 Oct 2026 — QUÉ VERSIÓN DEL AGENTE produjo esta lectura. Va en la evidencia:
        //   cuando dentro de tres meses un NS o una marca no cuadren, esto dice si el dato
        //   salió de un agente viejo sin tener que adivinar por el síntoma.
        version_agente: r.version_agente,
        version_fecha_agente: r.version_fecha_agente,
    }
}

/**
 * ⭐ MEJORA 52 — **las 8 mediciones que NO deciden** y por eso viven en el json y no en columna.
 * Regla del reparto: *si el sistema lo CONSULTA o lo CRUZA → columna; si solo se MUESTRA o se
 * audita → json*. (`apto_para_decidir` y `horas_uso` **no** están acá a propósito: el primero tiene
 * índice parcial y la segunda **valúa** ⇒ hay que poder filtrar/ordenar por ella.)
 */
export function medicionesDeDisco(d: DiscoLeido): Record<string, unknown> {
    return {
        encendidos: d.encendidos,
        temperatura_c: d.temperatura_c,
        salud_en_falla: false,
        salud_motivos: d.salud.motivos,
        sectores_reasignados: d.sectores_reasignados,
        sectores_pendientes: d.sectores_pendientes,
        sectores_no_corregibles: d.sectores_no_corregibles,
        errores_crc: d.errores_crc,
    }
}

/**
 * Del disco leído a la **lectura que viaja al servidor** (la evidencia de la revisión).
 * Se llama en el momento de agregar la pieza: el disco que se acaba de leer ES esa pieza.
 *
 * ⭐ MEJORA 52 — `contexto` es lo que viene de la RESPUESTA del agente (no del disco): si no se
 * pasa, la evidencia queda con `payload` + `mediciones` y `contexto: null` (nunca se inventa).
 */
export function aLectura(
    d: DiscoLeido,
    idPartidaEntrada: string,
    idMarca?: string | null,
    contexto?: Record<string, unknown> | null
): LecturaEntrada {
    return {
        ns: d.serial ?? '',
        ns_windows: d.serial_windows,
        id_partida_entrada: idPartidaEntrada,
        id_marca: idMarca ?? null,
        lun: d.lun,
        disco_fisico: d.disco_fisico,
        bahia: d.bahia,
        modelo: d.modelo,
        firmware: d.firmware,
        capacidad_gb: capacidadEnGb(d.capacidad_texto),
        rpm: d.rpm,
        interfaz: d.interfaz,
        es_nvme: d.es_nvme,
        horas_uso: d.horas_uso,
        encendidos: d.encendidos,
        temperatura_c: d.temperatura_c,
        salud_veredicto: d.salud.veredicto,
        salud_puntaje: d.salud.puntaje,
        salud_en_falla: false,
        salud_motivos: d.salud.motivos,
        apto: d.salud.apto,
        // ⭐ MEJORA 44 — el AVAL viaja con la evidencia: sin esto, una lectura hecha con la
        // fórmula propia sería indistinguible de una avalada por el taller, para siempre.
        apto_para_decidir: d.salud.apto_para_decidir,
        requiere_revision: d.salud.requiere_revision,
        sectores_reasignados: d.sectores_reasignados,
        sectores_pendientes: d.sectores_pendientes,
        sectores_no_corregibles: d.sectores_no_corregibles,
        errores_crc: d.errores_crc,
        motor: d.motor,
        smart_raw: d.smart,
        // ⭐ MEJORA 52 — lo que el agente SUGIRIÓ (antes se tiraba) y la evidencia completa.
        marca_detectada: d.marca,
        marca_confianza: confianzaMarcaValida(d.marca_confianza),
        lectura_cruda: {
            payload: d as unknown as Record<string, unknown>,
            mediciones: medicionesDeDisco(d),
            contexto: contexto ?? null,
        },
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ⭐ MEJORA 44 #2 — EL FORMATEO (destructivo, con avance en vivo)
// ─────────────────────────────────────────────────────────────────────────────
// El modal NO formatea: se lo pide al AGENTE, que lanza `preparar-discos.ps1` elevado.
// El agente va reportando y acá se lee el avance para pintarlo disco por disco.
//
// ⚠️ LO QUE ESTE MÓDULO **NO** HACE: validar. El disco del sistema, el bus USB y la
//    re-resolución del NS contra una lectura FRESCA los verifica el `.ps1` — del lado
//    del agente, con el disco a la vista. Una lista que venga de acá es una INTENCIÓN,
//    no una autorización: si un NS ya no está conectado, el script no toca ese número.

/** Un evento del formateo, tal cual lo emitió el `.ps1`. */
export interface EventoFormateo {
    evento: 'inicio' | 'paso' | 'listo' | 'fallo' | 'rechazo' | 'fin' | 'error'
    disco?: number
    ns?: string | string[]
    bahia?: string | null
    indice?: number
    total?: number
    /**
     * ⚠️ Las fases **globales** no traen `ns` (son del trabajo entero, no de un disco):
     * `'preparando'` = la re-lectura fresca del dock (8-11 s medidos; hasta 1-2 min si
     * la lectura sale incompleta y se reintenta), y `'formateando'` = **la pasada única**
     * de la MEJORA 49, en la que TODOS los discos se preparan en una sola invocación de
     * `diskpart` (medido: cada invocación costaba ~26,5 s fijos por el arranque del
     * servicio VDS, así que una por paso eran ~210 s de overhead por tanda).
     *
     * Los pasos `'limpiando' | 'particion' | 'formato' | 'letra'` son **por disco** y hoy
     * solo los emite un **agente viejo** (el que todavía corre diskpart una vez por paso):
     * el modal los sigue sabiendo pintar, para que una PC sin actualizar no se vea rota.
     */
    paso?: string
    /**
     * ⭐ MEJORA 46 — **la etiqueta que le va a quedar al disco** (`DISCO_1_tit`, `DISCO_2_tit`…).
     * Viaja en el evento `inicio` y el `.ps1` la resuelve con su CONTADOR de formateo (no con el
     * número de disco físico). Medido en vivo el 04 Oct 2026:
     * `{"evento":"inicio","ns":"ZFQ07JXX","etiqueta":"DISCO_1_tit","indice":1,"total":2}`.
     * ⚠️ No estaba declarada acá aunque el script **sí** la manda desde la MEJORA 45: sin el
     * campo, el modal no podía mostrar en el resultado **qué etiqueta quedó** — que es lo único
     * que el técnico va a ver en el Explorador.
     */
    etiqueta?: string
    texto?: string
    segundos?: number
    motivo?: string
    ok?: number
    fallaron?: number
    rechazados?: number
    codigo?: number
    simulado?: boolean
}

export interface ProgresoFormateo {
    ok: boolean
    estado: 'inactivo' | 'corriendo' | 'terminado' | 'error'
    iniciado: string | null
    discos: string[]
    eventos: EventoFormateo[]
    resumen: EventoFormateo | null
    aviso: string | null
    /** La salida cruda del script si algo se rompió (para diagnosticar). */
    salida: string
    elevado: boolean | null
    error?: string
}

export const FORMATEO_INACTIVO: ProgresoFormateo = {
    ok: true, estado: 'inactivo', iniciado: null, discos: [], eventos: [],
    resumen: null, aviso: null, salida: '', elevado: null,
}

/**
 * Arranca el formateo de los NS indicados.
 * **Nunca lanza**: devuelve `{ ok: false, error }` si el agente no está, si falta el
 * permiso o si ya hay uno corriendo (el agente responde 409 y no encola dos).
 *
 * ⚠️ El mensaje del `catch` NO puede decir siempre «no encontré el lector»: el caso más
 * probable en un puesto que no reinició el agente es que **el agente esté VIEJO y no tenga
 * esta ruta**. Un `fetch` a una URL inexistente falla igual que uno a un puerto cerrado, y
 * culpar al agente ausente manda a revisar lo que no es. Se dice lo que pasa de verdad.
 */
export async function iniciarFormateo(
    ns: string[],
    opts?: { seguro?: boolean }
): Promise<{ ok: boolean; error?: string }> {
    if (ns.length === 0) return { ok: false, error: 'No hay discos que formatear.' }
    let res: Response
    try {
        res = await fetch(`${URL_AGENTE}/api/formatear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ns, seguro: opts?.seguro === true }),
            cache: 'no-store',
        })
    } catch {
        return {
            ok: false,
            error:
                'No pude hablar con el lector de discos. O no está corriendo en esta PC, o es una versión ' +
                'anterior a la del formateo: reiniciá el agente (cerrá su ventana y volvé a abrirlo como ' +
                'administrador) y probá de nuevo.',
        }
    }
    if (res.status === 404) {
        return {
            ok: false,
            error:
                'El lector de discos de esta PC NO TIENE el formateo: es una versión anterior. Reiniciá el ' +
                'agente para que tome la versión nueva — la lectura sigue funcionando mientras tanto.',
        }
    }
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d.ok === false) {
        return { ok: false, error: d.error ?? `El agente respondió ${res.status}.` }
    }
    return { ok: true }
}

/** Lee el avance del formateo. **Nunca lanza.** */
export async function leerProgresoFormateo(): Promise<ProgresoFormateo> {
    try {
        const res = await fetch(`${URL_AGENTE}/api/formateo/progreso`, { cache: 'no-store' })
        if (!res.ok) return { ...FORMATEO_INACTIVO, ok: false, error: `El agente respondió ${res.status}.` }
        const d = (await res.json()) as ProgresoFormateo
        return {
            ...FORMATEO_INACTIVO,
            ...d,
            eventos: Array.isArray(d.eventos) ? d.eventos : [],
        }
    } catch {
        return { ...FORMATEO_INACTIVO, ok: false, error: 'No encontré el lector de discos en esta PC.' }
    }
}

/**
 * Los pasos del formateo y el cálculo de su avance **viven en `@/lib/lectura-aval`** junto
 * con la regla del aval de la salud: son la misma decisión (qué le pasó al disco y si su
 * número puede decidir) y así se prueban en un solo lugar, sin montar un componente.
 */
export { PASOS_FORMATEO, avanceDeDisco } from '@/lib/lectura-aval'

// ─────────────────────────────────────────────────────────────────────────────
//  ⭐ MEJORA 45 — EXPULSAR EL DOCK (expulsión segura del puente USB)
// ─────────────────────────────────────────────────────────────────────────────
// Para qué: el técnico tiene que sacar el disco dañado y poner el siguiente. El dock es
// UN dispositivo USB con dos discos adentro, así que **se expulsa entero** — es lo mismo
// que hace «Quitar hardware de forma segura» al lado del reloj (medido: no hay forma de
// expulsar una sola bahía).
//
// 🔴 REGLA DURA: **nunca expulsar con un formateo activo.** Expulsar el puente en medio de
//    un `diskpart clean` deja el disco a medio limpiar. El candado real vive en el AGENTE
//    (`expulsion_iniciar` devuelve 409), porque la pantalla se puede saltar; acá además se
//    deshabilita el botón para que el técnico no llegue a intentarlo.

/** El estado de la expulsión, tal cual lo reporta el agente. */
export interface EstadoExclusion {
    ok: boolean
    estado: 'inactivo' | 'corriendo' | 'terminado' | 'error'
    iniciado: string | null
    resultado: { ok: boolean; expulsados: number; detalle: string } | null
    aviso: string | null
    salida: string
    /** Solo cuando la lectura del estado falló (no es un campo del agente). */
    error?: string
}

export const EXPULSION_INACTIVA: EstadoExclusion = {
    ok: true, estado: 'inactivo', iniciado: null, resultado: null, aviso: null, salida: '',
}

/**
 * Expulsa el dock. **Nunca lanza**: devuelve `{ ok: false, error }` si el agente no está,
 * si es una versión anterior (404) o **si hay un formateo corriendo** (409 — el candado del
 * agente, que es el que manda).
 */
export async function expulsarDock(): Promise<{ ok: boolean; error?: string }> {
    let res: Response
    try {
        res = await fetch(`${URL_AGENTE}/api/expulsar`, { method: 'POST', cache: 'no-store' })
    } catch {
        return { ok: false, error: 'No pude hablar con el lector de discos. ¿Está corriendo en esta PC?' }
    }
    if (res.status === 404) {
        return {
            ok: false,
            error:
                'El lector de esta PC es una versión anterior y no sabe expulsar el dock. Reiniciá el agente ' +
                '(cerrá su ventana y volvé a abrirlo como administrador).',
        }
    }
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d.ok === false) {
        return { ok: false, error: d.error ?? `El agente respondió ${res.status}.` }
    }
    return { ok: true }
}

/** Lee el estado de la expulsión. **Nunca lanza.** */
export async function leerEstadoExclusion(): Promise<EstadoExclusion> {
    try {
        const res = await fetch(`${URL_AGENTE}/api/expulsar/estado`, { cache: 'no-store' })
        if (!res.ok) return { ...EXPULSION_INACTIVA, ok: false, error: `El agente respondió ${res.status}.` }
        const d = (await res.json()) as EstadoExclusion
        return { ...EXPULSION_INACTIVA, ...d }
    } catch {
        return { ...EXPULSION_INACTIVA, ok: false, error: 'No encontré el lector de discos en esta PC.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAPEO A LA HUELLA — de lo que dice el disco a las OPCIONES del esquema
// ─────────────────────────────────────────────────────────────────────────────
// El esquema de la categoría es un contrato: `capacidad` solo acepta sus opciones
// ('500GB','1TB','2TB'…) y `rpm` solo '5400'/'7200'. Por eso el disco NO se pega
// crudo: se mapea a la opción más cercana. Lo que no se puede saber del disco
// (tipo PC/LAP, tamaño de ranura M.2) NO se inventa: lo elige el técnico.

/** '2000.3 GB' / 2000.3 -> '2TB' (la opción del esquema más cercana, sin pasarse). */
export function capacidadOpcion(gb: number | null | undefined, opciones: string[]): string | null {
    if (!gb || opciones.length === 0) return null
    const valorDe = (o: string): number | null => {
        const m = /^([\d.]+)\s*(GB|TB)$/i.exec(o.trim())
        if (!m) return null
        const n = Number(m[1])
        return m[2].toUpperCase() === 'TB' ? n * 1000 : n
    }
    // El disco tiene 2000.3 GB «reales» (2000 GB de marketing): se compara en GB
    // decimales y se elige la opción más cercana.
    let mejor: string | null = null
    let dist = Infinity
    for (const o of opciones) {
        const v = valorDe(o)
        if (v === null) continue
        const d = Math.abs(v - gb)
        if (d < dist) { dist = d; mejor = o }
    }
    return mejor
}

/**
 * ⭐ MEJORA 52 (07 Oct 2026) — **¿ESTA PIEZA ES DE LO QUE DICE LA ENTRADA?**
 *
 * El caso que lo pidió, del dueño: *«recibe 50 discos, el revisa que sean los que dice el proveedor…
 * pueden decir que son de **1TB** pero vienen 2 de **500GB**, **por eso se revisa**»*. Y su prueba viva:
 * declaró **1TB** y el lector midió **2000.3 GB**.
 *
 * **Qué hace:** compara la capacidad que el disco **MIDIÓ** contra la que la partida **DECLARÓ**, y
 * devuelve el desvío cuando **no coinciden**. `null` = coinciden (o no se puede comparar).
 *
 * ⚠️ **Con TOLERANCIA, no por igualdad de texto.** Un disco «de 2 TB» reporta `2000.3 GB`, y uno «de
 * 1 TB» reporta `1000.2 GB`: **nunca dan el número redondo**. Comparar las cadenas («2000.3 GB» contra
 * «2TB») marcaría TODO como desvío. El 10 % de margen absorbe la diferencia comercial y **sí** caza los
 * casos reales: 1TB↔2TB es un **100 %** de desvío, y 1TB↔1.5TB un **50 %**.
 *
 * ⚠️ Esto **avisa**, no corrige: la huella ya la corrige el disco (`atributosDesdeDisco`). El aviso
 * existe para que el técnico **sepa** que la pieza no es de esa partida — y eso es lo que dispara la
 * **reclasificación** (que Recepción valida).
 */
export function desvioDeCapacidad(
    capacidadTexto: string | null | undefined,
    capacidadDeclarada: string | null | undefined,
    opciones: string[] = [],
    tolerancia = 0.1
): { medida: string; declarada: string } | null {
    const gbMedido = capacidadEnGb(capacidadTexto ?? null)
    const gbDeclarado = capacidadEnGb(capacidadDeclarada ?? null)
    if (gbMedido === null || gbDeclarado === null || gbDeclarado <= 0) return null
    if (Math.abs(gbMedido - gbDeclarado) / gbDeclarado <= tolerancia) return null
    return {
        // La etiqueta más cercana del esquema («2TB»); si no hay lista, el número tal como vino.
        medida: capacidadOpcion(gbMedido, opciones) ?? `${Math.round(gbMedido)} GB`,
        declarada: (capacidadDeclarada ?? '').trim(),
    }
}

/** 5425 -> '5400' · 7200 -> '7200' (la opción más cercana del esquema). */
export function rpmOpcion(rpm: number | null | undefined, opciones: string[]): string | null {
    if (!rpm || opciones.length === 0) return null
    let mejor: string | null = null
    let dist = Infinity
    for (const o of opciones) {
        const v = Number(o)
        if (!Number.isFinite(v)) continue
        const d = Math.abs(v - rpm)
        if (d < dist) { dist = d; mejor = o }
    }
    return mejor
}

/** 'UASP (Serial ATA)' -> 'SATA' · 'NVM Express' -> 'NVMe' */
export function interfazOpcion(interfaz: string | null | undefined, opciones: string[]): string | null {
    if (!interfaz || opciones.length === 0) return null
    const t = interfaz.toUpperCase()
    const quiere = t.includes('NVM') ? 'NVME' : t.includes('SATA') || t.includes('ATA') ? 'SATA' : null
    if (!quiere) return null
    return opciones.find((o) => o.toUpperCase().includes(quiere)) ?? null
}

export interface AtributoEsquema {
    clave: string
    etiqueta?: string
    opciones?: string[]
    en_huella?: boolean
    en_entrada?: boolean
    valor_default?: string | null
}

/**
 * Lo que el disco puede rellenar de la huella, respetando las OPCIONES del esquema.
 * Devuelve solo las claves que SÍ se pudieron deducir — lo demás lo pone el técnico.
 */
export function atributosDesdeDisco(disco: DiscoLeido, esquema: AtributoEsquema[]): Record<string, string> {
    const out: Record<string, string> = {}
    const gb = capacidadEnGb(disco.capacidad_texto)
    for (const a of esquema) {
        /**
         * ⭐ MEJORA 52 (07 Oct 2026, decisión del dueño) — **LA MEDICIÓN MANDA SOBRE LO DECLARADO.**
         *
         * Antes el guard era `if (!a.en_huella || a.en_entrada) continue`: los atributos capturados en
         * la puerta **no se tocaban** («ya se capturaron y son la base de la huella»). Eso dejaba un
         * defecto **con consecuencia en el stock**: `capacidad` es `en_entrada` en las 4 categorías ⇒
         * **el disco nunca la corregía** y un disco de **500 GB declarado como 1 TB** se registraba con
         * `capacidad=1TB` ⇒ Almacén resolvía un **SKU de 1 TB**. Silencioso e irreversible.
         *
         * El dueño lo dijo con todas las letras: *«la recepción es soft: **ligera**, no poco fiable;
         * revisar que sean los que dice el proveedor es **casi su única tarea**»*. Y la casa ya tenía
         * el criterio escrito para los `valor_default`: *«el disco sabe el dato real»*.
         *
         * ⇒ Ahora la puerta **declara la base** y la medición **la corrige**: el guard solo exige que el
         * atributo **sea identidad** (`en_huella`). Lo que el disco NO sabe (tipo, bus, tamaño…) no se
         * toca — el `switch` de abajo solo mapea lo que la lectura puede probar (`capacidad`, `rpm`,
         * `interface`); todo lo demás cae al `default: null` y lo decide el técnico.
         * ⚠️ Y `rpm`, al salir de `en_huella`, ya no entra por acá: su casa es `lecturas_disco.rpm`.
         */
        if (!a.en_huella) continue
        const opciones = a.opciones ?? []
        let v: string | null = null
        switch (a.clave) {
            case 'capacidad': v = capacidadOpcion(gb, opciones); break
            case 'rpm':       v = rpmOpcion(disco.rpm, opciones); break
            case 'interface':
            case 'interfaz':  v = interfazOpcion(disco.interfaz, opciones); break
            default:          v = null; break                            // tipo, tamaño, bus… los decide el técnico
        }
        if (v) out[a.clave] = v
    }
    return out
}

/**
 * ⭐ FIX 1 Oct 2026 — **el separador decimal NO se adivina por el idioma: se lee la forma.**
 * Medido con los dos discos del puesto: el agente manda `capacidad_texto: "2000.3 GB"` (formato
 * inglés, punto decimal) y la versión anterior borraba los puntos como si fueran de miles:
 * `"2000.3"` → `20003`, `"500.1"` → `5001`. Como `capacidadOpcion` elige la opción más cercana,
 * los DOS discos elegían la opción MAYOR del esquema (**`4000 GB`**) → el SKU de la pieza nacía
 * con la capacidad equivocada, y la evidencia (`lecturas_disco.capacidad_gb`) guardaba 10× el
 * valor real. Ni el build ni la RLS lo notan: es el dato, mal, para siempre.
 */
function capacidadEnGb(texto: string | null): number | null {
    if (!texto) return null
    const m = /([\d.,]+)\s*(GB|TB)/i.exec(texto)
    if (!m) return null
    const n = Number(aNumeroPlano(m[1]))
    if (!Number.isFinite(n)) return null
    return /TB/i.test(m[2]) ? n * 1000 : n
}

/**
 * «2000.3» · «2.000,3» · «2,000.3» · «2.000» · «500» → el mismo número en formato de máquina.
 * Reglas, en orden: ① con los DOS separadores, el **último** es el decimal (el otro es de miles);
 * ② con uno solo, es **decimal** cuando deja 1–2 dígitos detrás («2000.3») y **de miles** cuando
 * deja exactamente 3 y el grupo de la izquierda es corto («2.000» → 2000; «2000.300» → 2000.3).
 */
function aNumeroPlano(bruto: string): string {
    const ultimaComa = bruto.lastIndexOf(',')
    const ultimoPunto = bruto.lastIndexOf('.')
    if (ultimaComa >= 0 && ultimoPunto >= 0) {
        const decimal = ultimaComa > ultimoPunto ? ',' : '.'
        const miles = decimal === ',' ? '.' : ','
        return bruto.split(miles).join('').replace(decimal, '.')
    }
    const sep = ultimaComa >= 0 ? ',' : ultimoPunto >= 0 ? '.' : ''
    if (!sep) return bruto
    const partes = bruto.split(sep)
    const ultima = partes[partes.length - 1] ?? ''
    const esMiles = ultima.length === 3 && (partes[0] ?? '').length <= 3
    return esMiles ? partes.join('') : `${partes.slice(0, -1).join('')}.${ultima}`
}

/**
 * ⭐ 1 Oct 2026 — GB (2000.3) → «2 TB» · 500.1 → «500 GB». Para las pantallas que solo tienen el
 * **número** (`lecturas_disco.capacidad_gb`, la lista de la ronda) y no el texto del agente.
 * Una sola implementación: la ficha usa el texto del motor y la ronda este formato, y los dos
 * tienen que decir lo mismo del mismo disco.
 */
export function capacidadTextoDesdeGb(gb: number | null | undefined): string {
    if (gb === null || gb === undefined || !Number.isFinite(gb)) return '—'
    if (gb >= 1000) return `${Math.round(gb / 100) / 10} TB`
    return `${Math.round(gb)} GB`
}
