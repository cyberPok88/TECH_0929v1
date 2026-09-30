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

/** Dirección del agente en la PC del puesto. */
export const URL_AGENTE = 'http://127.0.0.1:8788'

/** Cuánto esperar al agente (leer un disco tarda ~15 s: lanza CrystalDiskInfo). */
const MS_ESPERA = 60_000

export interface SaludDisco {
    /** El número que decide (0-100). Hoy sale de HDSentinel. */
    puntaje: number | null
    /** 'hdsentinel' | 'nvme' | 'formula' — de dónde salió el número. */
    fuente: string
    /** El veredicto de texto de CrystalDiskInfo (Bueno / Precaución / Malo). */
    veredicto: string
    /** ⭐ La regla del taller: `puntaje === 100`. */
    apto: boolean
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
    horas_uso: number | null
    encendidos: number | null
    temperatura_c: number | null
    rpm: number | null
    capacidad_texto: string | null
    interfaz: string | null
    es_nvme: boolean
    salud: SaludDisco
    /** La lectura cruda del motor (evidencia). */
    smart: unknown[]
}

export interface LecturaDiscos {
    /** ¿El agente respondió? `false` = no está corriendo en esa PC. */
    agente: boolean
    discos: DiscoLeido[]
    /** Discos del sistema omitidos (no son mercancía). */
    omitidos: number
    motor: string | null
    hdsentinel: { fuente: string | null; fecha: string | null } | null
    /** Avisos del agente (p. ej. «usando la fórmula propia»). */
    avisos: string[]
    error?: string
}

/**
 * Pide al agente los discos del dock.
 * **Nunca lanza y nunca bloquea la revisión**: si el agente no está, devuelve
 * `agente: false` y el wizard sigue funcionando a mano como siempre.
 */
export async function leerDiscos(opts?: { incluirSistema?: boolean }): Promise<LecturaDiscos> {
    const vacio: LecturaDiscos = {
        agente: false, discos: [], omitidos: 0, motor: null, hdsentinel: null, avisos: [],
    }
    const corte = new AbortController()
    const reloj = setTimeout(() => corte.abort(), MS_ESPERA)
    try {
        const url = `${URL_AGENTE}/api/discos?refrescar=1${opts?.incluirSistema ? '&incluir_sistema=1' : ''}`
        const res = await fetch(url, { signal: corte.signal, cache: 'no-store' })
        if (!res.ok) return { ...vacio, agente: true, error: `El agente respondió ${res.status}.` }
        const d = await res.json()
        return {
            agente: true,
            motor: d.motor ?? null,
            hdsentinel: d.hdsentinel ? { fuente: d.hdsentinel.reporte ?? null, fecha: d.hdsentinel.fecha ?? null } : null,
            omitidos: (d.discos_omitidos ?? []).length,
            avisos: d.avisos_motor ?? [],
            discos: (d.discos ?? []).map((x: Record<string, unknown>) => normalizar(x)),
        }
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

/** Del JSON del agente al tipo de la app. */
function normalizar(x: Record<string, unknown>): DiscoLeido {
    const s = (x.salud_detalle ?? {}) as Record<string, unknown>
    return {
        serial: (x.serial as string | null) ?? null,
        modelo: (x.modelo as string | null) ?? null,
        marca: (x.marca as string | null) ?? null,
        marca_confianza: (x.marca_confianza as string | null) ?? null,
        bahia: (x.bahia as string | null) ?? null,
        horas_uso: (x.horas_uso as number | null) ?? null,
        encendidos: (x.encendidos as number | null) ?? null,
        temperatura_c: (x.temperatura_c as number | null) ?? null,
        rpm: (x.rpm as number | null) ?? null,
        capacidad_texto: (x.capacidad_texto as string | null) ?? null,
        interfaz: (x.interfaz as string | null) ?? null,
        es_nvme: Boolean(x.es_nvme),
        smart: (x.smart as unknown[]) ?? [],
        salud: {
            puntaje: (s.puntaje_estimado as number | null) ?? null,
            fuente: (s.fuente as string) ?? '—',
            veredicto: (s.veredicto as string) ?? 'sin dato',
            apto: Boolean(s.apto),
            motivos: (s.motivos as string[]) ?? [],
        },
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
        // Los de RECEPCIÓN no se tocan (ya se capturaron y son la base de la huella).
        // ⚠ Un `valor_default` SÍ se puede corregir: el disco sabe el dato real (uno de
        // 5425 rpm no es de 7200). El default solo debe usarse si la lectura no dijo nada.
        if (!a.en_huella || a.en_entrada) continue
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

function capacidadEnGb(texto: string | null): number | null {
    if (!texto) return null
    const m = /([\d.,]+)\s*(GB|TB)/i.exec(texto)
    if (!m) return null
    const n = Number(m[1].replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(n)) return null
    return /TB/i.test(m[2]) ? n * 1000 : n
}
