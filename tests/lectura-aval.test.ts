// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA DEL AVAL DE LA SALUD — Guía 1.6 · MEJORA 44 (30 Sep 2026)
// ═══════════════════════════════════════════════════════════════════════════════
// Estos tests existen porque la regla que cubren **decide si una pieza se devuelve o se
// vende**. Un bug acá no rompe el build: pone un disco dañado en el anaquel (falso
// aprobado) o manda al proveedor una devolución que no puede justificar.
//
// El caso que los motivó, medido: la fórmula propia del agente **arranca en 100** y resta
// por daño. Si HDSentinel no tiene el disco en su reporte, la fórmula dice «100 %, pasa»
// POR DEFECTO. Y se veía idéntico a un 100 % avalado por el taller.

import { describe, expect, it } from 'vitest'

import {
    PASOS_FORMATEO,
    SEGUNDOS_VIEJO,
    avanceDeDisco,
    errorGlobalDe,
    evaluarSalud,
    faseGlobalDe,
    nsEnCurso,
    pasoDeDisco,
} from '@/lib/lectura-aval'
import type { DiscoLeido, EventoFormateo } from '@/lib/lector-discos'

/** Un disco leído, con lo mínimo que mira la regla. */
function disco(opts: {
    puntaje: number | null
    fuente: string
    aptoParaDecidir?: boolean
    serial?: string
    bahia?: string
}): DiscoLeido {
    return {
        serial: opts.serial ?? 'ZFQ07JXX',
        modelo: 'ST2000VM005',
        marca: 'Seagate',
        marca_confianza: 'alta',
        bahia: opts.bahia ?? '1',
        firmware: 'CV11',
        horas_uso: 3,
        encendidos: 24,
        temperatura_c: 32,
        rpm: 5425,
        capacidad_texto: '2000.3 GB',
        interfaz: 'UASP (Serial ATA)',
        es_nvme: false,
        lun: 0,
        disco_fisico: 1,
        serial_windows: '000000000000',
        motor: 'crystaldiskinfo',
        sectores_reasignados: 0,
        sectores_pendientes: 0,
        sectores_no_corregibles: 0,
        errores_crc: 0,
        smart: [],
        // En estos tests el agente siempre es el NUEVO (manda el aval explícito); el caso del
        // agente viejo —donde el aval se infiere— tiene su propio archivo: `lector-discos.test.ts`.
        agente_desactualizado: false,
        salud: {
            puntaje: opts.puntaje,
            fuente: opts.fuente,
            veredicto: 'Bueno',
            // ⭐ El respaldo del agente viejo: si el campo no llega, NO puede decidir.
            apto_para_decidir: opts.aptoParaDecidir ?? opts.fuente !== 'formula',
            requiere_revision: !(opts.aptoParaDecidir ?? opts.fuente !== 'formula'),
            apto: opts.puntaje === 100,
            motivos: [],
        },
    }
}

describe('la salud solo decide con aval', () => {
    it('HDSentinel con 100 → PASA', () => {
        const r = evaluarSalud(disco({ puntaje: 100, fuente: 'hdsentinel' }), 30)
        expect(r.veredicto).toBe('PASA')
        expect(r.conAval).toBe(true)
        expect(r.nota).toBeNull()
    })

    it('HDSentinel con 99 → DEVOLUCION (el taller avala el número)', () => {
        const r = evaluarSalud(disco({ puntaje: 99, fuente: 'hdsentinel' }), 30)
        expect(r.veredicto).toBe('DEVOLUCION')
        expect(r.conAval).toBe(true)
    })

    it('NVMe con 96 → DEVOLUCION (es el % que informa el propio disco)', () => {
        const r = evaluarSalud(disco({ puntaje: 96, fuente: 'nvme' }), 30)
        expect(r.veredicto).toBe('DEVOLUCION')
        expect(r.conAval).toBe(true)
    })

    it('⭐ fórmula con 100 → SIN AVAL (el falso aprobado: arranca en 100 por defecto)', () => {
        const r = evaluarSalud(disco({ puntaje: 100, fuente: 'formula' }), 30)
        expect(r.veredicto).toBe('SIN_AVAL')
        expect(r.conAval).toBe(false)
        expect(r.nota).toContain('arranca en 100')
        expect(r.nota).toContain('formula')
    })

    it('⭐ fórmula con 70 → SIN AVAL (no manda una devolución que el taller no avala)', () => {
        const r = evaluarSalud(disco({ puntaje: 70, fuente: 'formula' }), 30)
        expect(r.veredicto).toBe('SIN_AVAL')
        expect(r.conAval).toBe(false)
    })

    it('sin número de salud → SIN AVAL', () => {
        const r = evaluarSalud(disco({ puntaje: null, fuente: 'formula' }), 30)
        expect(r.veredicto).toBe('SIN_AVAL')
        expect(r.conAval).toBe(false)
    })

    it('⭐ agente VIEJO (no manda apto_para_decidir) → SIN AVAL, nunca decide por accidente', () => {
        // El respaldo conservador: si el campo no llega, se pide que el técnico mire.
        const d = disco({ puntaje: 100, fuente: 'hdsentinel' })
        // @ts-expect-error se simula el JSON de un agente que todavía no conoce el campo
        delete d.salud.apto_para_decidir
        const r = evaluarSalud(d, 30)
        expect(r.veredicto).toBe('SIN_AVAL')
        expect(r.conAval).toBe(false)
    })
})

describe('la antigüedad del archivo de HDSentinel', () => {
    it('un archivo de hace 30 s no genera aviso', () => {
        const r = evaluarSalud(disco({ puntaje: 100, fuente: 'hdsentinel' }), 30)
        expect(r.fresco).toBe(true)
        expect(r.nota).toBeNull()
    })

    it('un archivo de 3 días avisa, pero el número SIGUE decidiendo', () => {
        const tresDias = 3 * 24 * 60 * 60
        const r = evaluarSalud(disco({ puntaje: 99, fuente: 'hdsentinel' }), tresDias)
        expect(r.fresco).toBe(false)
        expect(r.conAval).toBe(true)
        expect(r.veredicto).toBe('DEVOLUCION')
        expect(r.nota).toContain('3 día(s)')
    })

    it('sin dato de antigüedad se asume fresco (no se inventa un aviso)', () => {
        const r = evaluarSalud(disco({ puntaje: 100, fuente: 'hdsentinel' }), null)
        expect(r.fresco).toBe(true)
        expect(r.nota).toBeNull()
    })

    it('el umbral es 24 h exactas: un segundo menos está fresco', () => {
        const justo = evaluarSalud(disco({ puntaje: 100, fuente: 'hdsentinel' }), SEGUNDOS_VIEJO - 1)
        const pasado = evaluarSalud(disco({ puntaje: 100, fuente: 'hdsentinel' }), SEGUNDOS_VIEJO)
        expect(justo.fresco).toBe(true)
        expect(pasado.fresco).toBe(false)
    })
})

describe('el avance del formateo por disco', () => {
    const eventos: EventoFormateo[] = [
        { evento: 'inicio', ns: 'A', disco: 1 },
        { evento: 'paso', ns: 'A', paso: 'limpiando', texto: 'limpiando (clean)…' },
        { evento: 'paso', ns: 'A', paso: 'particion', texto: 'creando la partición…' },
        { evento: 'inicio', ns: 'B', disco: 2 },
    ]

    it('un disco sin eventos está en cola', () => {
        const r = avanceDeDisco(eventos, 'C')
        expect(r.pct).toBe(0)
        expect(r.texto).toBe('en cola…')
        expect(r.fin).toBe(false)
    })

    it('el paso manda el porcentaje y el texto', () => {
        const r = avanceDeDisco(eventos, 'A')
        expect(r.pct).toBe(Math.round((2 / PASOS_FORMATEO.length) * 100))
        expect(r.texto).toBe('creando la partición…')
    })

    it('«listo» gana sobre los pasos anteriores y queda en 100', () => {
        const r = avanceDeDisco([...eventos, { evento: 'listo', ns: 'A', segundos: 11 }], 'A')
        expect(r.pct).toBe(100)
        expect(r.fin).toBe(true)
        expect(r.texto).toBe('listo (11 s)')
    })

    it('un fallo queda marcado aunque antes haya avanzado', () => {
        const r = avanceDeDisco([...eventos, { evento: 'fallo', ns: 'A', paso: 'formato', motivo: 'acceso denegado' }], 'A')
        expect(r.fallo).toBe(true)
        expect(r.fin).toBe(false)
        expect(r.texto).toContain('acceso denegado')
    })

    it('un rechazo del script se ve como «no se tocó», no como un éxito', () => {
        const r = avanceDeDisco([{ evento: 'rechazo', ns: 'D', motivo: 'no está en el bus USB' }], 'D')
        expect(r.fallo).toBe(true)
        expect(r.fin).toBe(false)
        expect(r.texto).toContain('no está en el bus USB')
    })

    it('los eventos de un disco no afectan a otro', () => {
        const a = avanceDeDisco([...eventos, { evento: 'listo', ns: 'A', segundos: 9 }], 'A')
        const b = avanceDeDisco([...eventos, { evento: 'listo', ns: 'A', segundos: 9 }], 'B')
        expect(a.fin).toBe(true)
        expect(b.fin).toBe(false)
        // B ya recibió su `inicio`, así que NO está «en cola»: arrancó y todavía no tiene paso.
        // (Antes el `inicio` se ignoraba y B decía «en cola» con el disco ya trabajando.)
        expect(b.texto).toBe('empezando…')
    })

    it('un disco sin ningún evento SÍ está en cola', () => {
        const c = avanceDeDisco(eventos, 'C')
        expect(c.texto).toBe('en cola…')
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// EL PASO Y EL DISCO EN CURSO — lo que dibuja el MODAL del formateo (MEJORA 46)
// ═══════════════════════════════════════════════════════════════════════════════
// El modal necesita dos cosas que `avanceDeDisco` no da: **el ÍNDICE del paso** (para elegir la
// forma de la fase: círculo → triángulo → cuadrado → rombo) y **qué disco corre ahora** (para
// ponerlo en grande). Las dos salen de los MISMOS eventos, así que no pueden contradecir a la
// barra: si la forma dice «formato» y la barra marcara «limpiando», sería el mismo defecto que
// esta sesión estuvo matando.

describe('el paso del disco, para la forma del modal', () => {
    const eventos: EventoFormateo[] = [
        { evento: 'inicio', ns: 'A', disco: 1 },
        { evento: 'paso', ns: 'A', paso: 'limpiando' },
        { evento: 'paso', ns: 'A', paso: 'particion' },
        { evento: 'paso', ns: 'A', paso: 'formato' },
    ]

    it('⭐ el ÚLTIMO paso manda (el defecto medido: se quedaba clavado en el primero)', () => {
        // El panel hacía `return` en el PRIMER `paso` del disco ⇒ `clavePaso` quedaba en 0 y el
        // indicador marcaba «limpiando» durante TODA la corrida, aunque el disco ya estuviera
        // formateando. Acá el disco está en `formato` (índice 2).
        expect(pasoDeDisco(eventos, 'A')).toBe(2)
    })

    it('el índice apunta al paso correcto de `PASOS_FORMATEO`', () => {
        expect(PASOS_FORMATEO[pasoDeDisco(eventos, 'A')].clave).toBe('formato')
    })

    it('un disco sin pasos devuelve -1 (todavía no hay forma que dibujar)', () => {
        expect(pasoDeDisco([{ evento: 'inicio', ns: 'B' }], 'B')).toBe(-1)
    })

    it('los pasos de otro disco no se le pegan', () => {
        expect(pasoDeDisco(eventos, 'Z')).toBe(-1)
    })

    it('el «listo» no borra el paso: sigue siendo el último que corrió', () => {
        expect(pasoDeDisco([...eventos, { evento: 'listo', ns: 'A', segundos: 9 }], 'A')).toBe(2)
    })
})

describe('qué disco se está formateando ahora', () => {
    it('sin eventos no hay disco en curso', () => {
        expect(nsEnCurso([])).toBeNull()
    })

    it('⭐ el `inicio` abre el disco y su `listo` lo cierra', () => {
        const conUno: EventoFormateo[] = [
            { evento: 'inicio', ns: 'A' },
            { evento: 'paso', ns: 'A', paso: 'limpiando' },
        ]
        expect(nsEnCurso(conUno)).toBe('A')
        expect(nsEnCurso([...conUno, { evento: 'listo', ns: 'A', segundos: 54 }])).toBeNull()
    })

    it('⭐ con dos discos, el segundo pasa a ser el que corre', () => {
        const dos: EventoFormateo[] = [
            { evento: 'inicio', ns: 'A' },
            { evento: 'paso', ns: 'A', paso: 'limpiando' },
            { evento: 'listo', ns: 'A', segundos: 54 },
            { evento: 'inicio', ns: 'B' },
        ]
        expect(nsEnCurso(dos)).toBe('B')
    })

    it('un `fallo` también cierra el disco (no queda «corriendo» para siempre)', () => {
        const fallo: EventoFormateo[] = [
            { evento: 'inicio', ns: 'A' },
            { evento: 'fallo', ns: 'A', paso: 'formato', motivo: 'acceso denegado' },
        ]
        expect(nsEnCurso(fallo)).toBeNull()
    })

    it('⚠️ la fase GLOBAL no es de ningún disco (no trae `ns`)', () => {
        const global: EventoFormateo[] = [
            { evento: 'paso', paso: 'preparando', motivo: 'Leyendo el estado del dock…' },
        ]
        expect(nsEnCurso(global)).toBeNull()
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// LAS FASES GLOBALES — el defecto que dejaba la pantalla «en cola» 1-2 minutos
// ═══════════════════════════════════════════════════════════════════════════════
// El `.ps1` hace una LECTURA FRESCA del dock antes de tocar nada, y tarda 1-2 MINUTOS.
// Ese evento es GLOBAL (no lleva `ns`). Como `avanceDeDisco` filtra por `ns`, se descartaba
// en silencio: la barra quedaba en 0 % con «en cola» durante dos minutos y el técnico creía
// que estaba trabado. Medido en vivo el 1 Oct 2026.

describe('la fase global que explica la espera larga', () => {
    const preparando: EventoFormateo = {
        evento: 'paso',
        paso: 'preparando',
        motivo: 'Leyendo el estado del dock… puede tardar 1-2 minutos. NO vuelvas a apretar.',
    }

    it('⭐ el evento «preparando» se reconoce como fase global', () => {
        const f = faseGlobalDe([preparando])
        expect(f).not.toBeNull()
        expect(f?.texto).toContain('Leyendo el estado del dock')
        expect(f?.detalle).toContain('1-2 minutos')
    })

    it('⭐ el evento global NO se le atribuye a ningún disco', () => {
        const av = avanceDeDisco([preparando], 'ZFQ07JXX')
        // Antes esto era el bug: el disco quedaba mudo mientras el trabajo SÍ avanzaba.
        expect(av.pct).toBe(0)
        expect(av.texto).toBe('en cola…')
    })

    it('un paso POR DISCO no cuenta como fase global', () => {
        const f = faseGlobalDe([{ evento: 'paso', paso: 'limpiando', ns: 'A', texto: 'limpiando (clean)…' }])
        expect(f).toBeNull()
    })

    it('un paso de disco no apaga ni cambia la fase global ya vista', () => {
        const f = faseGlobalDe([
            preparando,
            { evento: 'paso', paso: 'limpiando', ns: 'A', texto: 'limpiando (clean)…' },
        ])
        expect(f?.clave).toBe('preparando')
    })

    it('sin eventos no hay fase', () => {
        expect(faseGlobalDe([])).toBeNull()
    })
})

describe('el rechazo del .ps1 llega con el ns como ARREGLO', () => {
    // Medido: el `.ps1` recibe `-Ns` como lista y PowerShell serializa el arreglo.
    //   {"ns":["NS-DE-PRUEBA"],"evento":"rechazo","motivo":"no está conectado AHORA"}
    const rechazo = {
        evento: 'rechazo',
        ns: ['ZFQ07JXX'],
        motivo: 'no está conectado AHORA (lectura fresca del agente)',
    } as unknown as EventoFormateo

    it('⭐ el rechazo SÍ se pinta en el disco al que se refiere', () => {
        const av = avanceDeDisco([rechazo], 'ZFQ07JXX')
        // Sin contemplar el arreglo, este disco quedaba «en cola» y el técnico no sabía
        // que se había dejado sin tocar.
        expect(av.fallo).toBe(true)
        expect(av.texto).toContain('no está conectado AHORA')
    })

    it('el rechazo no se le pega a un disco que no es', () => {
        const av = avanceDeDisco([rechazo], 'OTRO-NS')
        expect(av.fallo).toBe(false)
        expect(av.texto).toBe('en cola…')
    })
})

describe('el error global manda sobre el aviso', () => {
    it('devuelve el motivo del último evento de error', () => {
        const motivo = errorGlobalDe([
            { evento: 'error', motivo: 'hace falta administrador' },
            { evento: 'fin', ok: 0 },
        ])
        expect(motivo).toBe('hace falta administrador')
    })

    it('sin evento de error no hay error global', () => {
        expect(errorGlobalDe([{ evento: 'fin', ok: 2 }])).toBeNull()
    })
})
