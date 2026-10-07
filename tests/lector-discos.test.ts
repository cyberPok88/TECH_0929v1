// ═══════════════════════════════════════════════════════════════════════════════
// EL PUENTE HACIA EL AGENTE — normalización y compatibilidad
// ═══════════════════════════════════════════════════════════════════════════════
// Estos tests existen por un defecto REAL medido el 1 Oct 2026 en el puesto:
//
//   El agente que estaba corriendo era ANTERIOR a la regla del aval, así que no mandaba
//   `apto_para_decidir`. El respaldo era `Boolean(undefined)` = `false` → la app pintó
//   **«SIN AVAL» un disco de salud 100 que HDSentinel SÍ avala**, con el aviso largo
//   («Este número no es de HDSentinel…») al lado de `fuente: hdsentinel`. Una contradicción
//   visible en pantalla: el texto decía que no era de HDSentinel y la píldora decía que sí.
//
// La lección: **la ausencia de un dato no es un dato.** Un campo que no llega no puede
// interpretarse como el valor más grave; cuando la regla es conocida, se infiere con ella
// y se declara que el agente está viejo.

import { describe, expect, it } from 'vitest'

import { atributosDesdeDisco, capacidadTextoDesdeGb, normalizar, normalizarLectura, ordenarPorBahia } from '@/lib/lector-discos'

/** El JSON del agente, como llega de verdad. `aval` ausente = agente viejo. */
function jsonAgente(opts: {
    fuente: string
    puntaje: number | null
    aval?: boolean
    serial?: string
}): Record<string, unknown> {
    const salud: Record<string, unknown> = {
        puntaje_estimado: opts.puntaje,
        fuente: opts.fuente,
        veredicto: 'Bueno',
        apto: opts.puntaje === 100,
        motivos: [],
    }
    // Solo se agrega si el test lo pide: así se simula el agente VIEJO (sin el campo).
    if (opts.aval !== undefined) {
        salud.apto_para_decidir = opts.aval
        salud.requiere_revision = !opts.aval
    }
    return {
        serial: opts.serial ?? 'ZFQ07JXX',
        modelo: 'ST2000VM005-2MY102',
        marca: 'Seagate',
        salud_detalle: salud,
        ubicacion: { scsi_lun: 0, disco_fisico: 1 },
        windows: { serial_windows: '000000000000' },
    }
}

describe('normalizar · agente NUEVO (manda el aval)', () => {
    it('respeta el aval TRUE de HDSentinel', () => {
        const d = normalizar(jsonAgente({ fuente: 'hdsentinel', puntaje: 100, aval: true }))
        expect(d.salud.apto_para_decidir).toBe(true)
        expect(d.salud.requiere_revision).toBe(false)
        expect(d.agente_desactualizado).toBe(false)
    })

    it('respeta el aval FALSE de la fórmula', () => {
        const d = normalizar(jsonAgente({ fuente: 'formula', puntaje: 100, aval: false }))
        expect(d.salud.apto_para_decidir).toBe(false)
        expect(d.salud.requiere_revision).toBe(true)
        expect(d.agente_desactualizado).toBe(false)
    })
})

describe('normalizar · agente VIEJO (no manda el aval) · el defecto medido', () => {
    it('⭐ HDSentinel SIN el campo NO se pinta como «sin aval» (era el bug en pantalla)', () => {
        const d = normalizar(jsonAgente({ fuente: 'hdsentinel', puntaje: 100 }))
        expect(d.salud.apto_para_decidir).toBe(true)
        expect(d.salud.requiere_revision).toBe(false)
        // Y la app puede avisar que el agente está viejo en vez de mentir sobre el disco.
        expect(d.agente_desactualizado).toBe(true)
    })

    it('⭐ la fórmula SIN el campo SÍ queda sin aval (el caso real sigue protegido)', () => {
        const d = normalizar(jsonAgente({ fuente: 'formula', puntaje: 100 }))
        expect(d.salud.apto_para_decidir).toBe(false)
        expect(d.salud.requiere_revision).toBe(true)
        expect(d.agente_desactualizado).toBe(true)
    })

    it('NVMe sin el campo se infiere con aval (es el % del propio disco)', () => {
        const d = normalizar(jsonAgente({ fuente: 'nvme', puntaje: 96 }))
        expect(d.salud.apto_para_decidir).toBe(true)
    })

    it('sin puntaje NO hay aval, aunque la fuente sea HDSentinel', () => {
        const d = normalizar(jsonAgente({ fuente: 'hdsentinel', puntaje: null }))
        expect(d.salud.apto_para_decidir).toBe(false)
        expect(d.salud.requiere_revision).toBe(true)
    })

    it('el aval se infiere de la fuente, no del puntaje: un 99 de HDSentinel decide', () => {
        const d = normalizar(jsonAgente({ fuente: 'hdsentinel', puntaje: 99 }))
        expect(d.salud.apto_para_decidir).toBe(true)
        expect(d.salud.apto).toBe(false)
    })

    it('una fuente desconocida NO obtiene aval (no se inventa procedencia)', () => {
        const d = normalizar(jsonAgente({ fuente: 'desconocida', puntaje: 100 }))
        expect(d.salud.apto_para_decidir).toBe(false)
    })
})

describe('normalizar · la calibración de bahías', () => {
    it('LUN 0 → bahía 1 y LUN 1 → bahía 2 (dock Sabrent dual)', () => {
        const a = normalizar({ ...jsonAgente({ fuente: 'hdsentinel', puntaje: 100 }), ubicacion: { scsi_lun: 0 } })
        const b = normalizar({ ...jsonAgente({ fuente: 'hdsentinel', puntaje: 100 }), ubicacion: { scsi_lun: 1 } })
        expect(a.bahia).toBe('1')
        expect(b.bahia).toBe('2')
    })

    it('el rótulo que manda el agente gana sobre el derivado del LUN', () => {
        const d = normalizar({
            ...jsonAgente({ fuente: 'hdsentinel', puntaje: 100 }),
            bahia: 'BAHÍA-A',
            ubicacion: { scsi_lun: 1 },
        })
        expect(d.bahia).toBe('BAHÍA-A')
    })

    it('un rótulo vacío NO gana: se cae al LUN (medido en el puesto, el agente manda "")', () => {
        const d = normalizar({
            ...jsonAgente({ fuente: 'hdsentinel', puntaje: 100 }),
            bahia: '',
            ubicacion: { scsi_lun: 1 },
        })
        expect(d.bahia).toBe('2')
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESIÓN CON LA RESPUESTA REAL DEL PUESTO
// ═══════════════════════════════════════════════════════════════════════════════
// Estos dos casos NO son inventados: son el `salud_detalle` textual que devolvió el agente
// del puesto el 1 Oct 2026, con el defecto en pantalla («100 % … sin salud de HDSentinel ·
// la decide el técnico», todo del mismo color ámbar). Quedan acá para que el bug no pueda
// volver: si alguien revierte el shim de compatibilidad, esto se pone rojo.

/** El `salud_detalle` REAL del agente viejo: sin `apto_para_decidir` ni `requiere_revision`. */
const SALUD_REAL_AGENTE_VIEJO_100 = {
    veredicto: 'Bueno',
    veredicto_origen: 'crystaldiskinfo',
    porcentaje_fabricante: null,
    puntaje_estimado: 100,
    apto: true,
    fuente: 'hdsentinel',
    hdsentinel: { ns: 'ZFQ07JXX', salud: 100, fuente: 'xml' },
    en_falla: false,
    motivos: [],
    atributos_criticos: [],
    apto_para_evaluar: true,
    nota: 'La salud no mide desgaste: se lee junto con las horas de uso.',
}

const SALUD_REAL_AGENTE_VIEJO_99 = {
    ...SALUD_REAL_AGENTE_VIEJO_100,
    veredicto: 'Riesgo',
    puntaje_estimado: 99,
    apto: false,
    hdsentinel: { ns: 'WD-WCC2EEZ3S7DC', salud: 99, fuente: 'xml' },
}

describe('REGRESIÓN · el 100 % del puesto que salía «sin salud de HDSentinel»', () => {
    it('⭐ el disco de 100 % de HDSentinel NO puede quedar sin aval', () => {
        const d = normalizar({
            serial: 'ZFQ07JXX',
            modelo: 'ST2000VM005-2MY102',
            marca: 'Seagate',
            salud_detalle: SALUD_REAL_AGENTE_VIEJO_100,
            ubicacion: { scsi_lun: 0, disco_fisico: 1 },
        })
        // Esto es lo que se veía mal: con el respaldo viejo daba `false` y la ficha decía
        // «sin salud de HDSentinel · la decide el técnico» con la píldora en ámbar.
        expect(d.salud.apto_para_decidir).toBe(true)
        expect(d.salud.requiere_revision).toBe(false)
        expect(d.salud.fuente).toBe('hdsentinel')
        // Y el disco se ve PASA, del color del éxito.
        expect(d.salud.puntaje).toBe(100)
        expect(d.salud.apto).toBe(true)
    })

    it('⭐ el disco de 99 % SÍ puede decidir su devolución (el taller avala el número)', () => {
        const d = normalizar({
            serial: 'WD-WCC2EEZ3S7DC',
            modelo: 'WDC WD5000AAKX-75U6AA0',
            salud_detalle: SALUD_REAL_AGENTE_VIEJO_99,
            ubicacion: { scsi_lun: 1, disco_fisico: 2 },
        })
        expect(d.salud.apto_para_decidir).toBe(true)
        expect(d.salud.apto).toBe(false)
        expect(d.agente_desactualizado).toBe(true)
    })

    it('los DOS discos del puesto dejan de ser «sin aval» a la vez', () => {
        const discos = [
            normalizar({ serial: 'A', salud_detalle: SALUD_REAL_AGENTE_VIEJO_100, ubicacion: { scsi_lun: 0 } }),
            normalizar({ serial: 'B', salud_detalle: SALUD_REAL_AGENTE_VIEJO_99, ubicacion: { scsi_lun: 1 } }),
        ]
        expect(discos.filter((d) => d.salud.apto_para_decidir === false)).toHaveLength(0)
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// LA CAPACIDAD — el número que se guarda como EVIDENCIA y elige la HUELLA (el SKU)
// ═══════════════════════════════════════════════════════════════════════════════
// Medido el 1 Oct 2026 sobre la respuesta REAL del puesto: el agente manda
// `capacidad_texto: "2000.3 GB"` —formato inglés, **punto decimal**— y el puente leía el
// punto como **separador de miles** → `20003 GB`. Dos daños, ninguno visible en pantalla:
//   ① la evidencia (`lecturas_disco.capacidad_gb`) guarda una capacidad 10× mayor;
//   ② `capacidadOpcion` elige la opción más cercana a 20003 → la MAYOR del esquema, o sea
//      **el SKU de la pieza nace con la capacidad equivocada** (y eso no se deshace).
// El separador NO se adivina por el idioma: se lee la forma del número.

/** El esquema real de HDD/SSD: las opciones son las del catálogo, no las del disco. */
const ESQUEMA_CAPACIDAD = [
    {
        clave: 'capacidad',
        etiqueta: 'Capacidad',
        opciones: ['500 GB', '1000 GB', '2000 GB', '4000 GB'],
        en_huella: true,
        en_entrada: false,
    },
]

/** El disco real del dock, con la capacidad tal como la manda el agente. */
function discoConCapacidad(capacidad_texto: string, puntaje = 100) {
    return normalizar({
        ...jsonAgente({ fuente: 'hdsentinel', puntaje }),
        capacidad_texto,
    })
}

describe('la capacidad · el punto decimal NO es separador de miles', () => {
    it('⭐ «2000.3 GB» (el Seagate real del dock) elige 2000 GB, no la opción mayor', () => {
        expect(atributosDesdeDisco(discoConCapacidad('2000.3 GB'), ESQUEMA_CAPACIDAD).capacidad).toBe('2000 GB')
    })

    it('⭐ «500.1 GB» (el WD real del dock) elige 500 GB', () => {
        expect(atributosDesdeDisco(discoConCapacidad('500.1 GB', 99), ESQUEMA_CAPACIDAD).capacidad).toBe('500 GB')
    })

    it('el formato español («2.000,3 GB») sigue leyéndose bien: el punto era de miles', () => {
        expect(atributosDesdeDisco(discoConCapacidad('2.000,3 GB'), ESQUEMA_CAPACIDAD).capacidad).toBe('2000 GB')
    })

    it('el formato inglés con miles («2,000.3 GB») también', () => {
        expect(atributosDesdeDisco(discoConCapacidad('2,000.3 GB'), ESQUEMA_CAPACIDAD).capacidad).toBe('2000 GB')
    })

    it('los TB se convierten a GB (2 TB → 2000 GB)', () => {
        expect(atributosDesdeDisco(discoConCapacidad('2 TB'), ESQUEMA_CAPACIDAD).capacidad).toBe('2000 GB')
    })

    it('un número entero sin separadores no se toca (500 GB)', () => {
        expect(atributosDesdeDisco(discoConCapacidad('500 GB'), ESQUEMA_CAPACIDAD).capacidad).toBe('500 GB')
    })
})

describe('capacidadTextoDesdeGb · lo que se muestra en la ronda', () => {
    it('2000.3 GB se muestra «2 TB» y 500.1 se muestra «500 GB»', () => {
        expect(capacidadTextoDesdeGb(2000.3)).toBe('2 TB')
        expect(capacidadTextoDesdeGb(500.1)).toBe('500 GB')
    })

    it('sin dato no inventa: guion', () => {
        expect(capacidadTextoDesdeGb(null)).toBe('—')
        expect(capacidadTextoDesdeGb(undefined)).toBe('—')
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// EL ORDEN DEL DOCK — bahía 1 a la IZQUIERDA, bahía 2 a la derecha
// ═══════════════════════════════════════════════════════════════════════════════
// El agente devuelve los discos en el orden en que los encuentra, y ese orden NO es un
// contrato: si baila, el técnico mete la mano en la ranura de la izquierda y lee la ficha
// del disco que está en la derecha — con la salud del otro. El orden se fija por bahía.

describe('ordenarPorBahia · el dock tiene un orden', () => {
    /** Un disco con su bahía, tal como sale del agente. */
    const conBahia = (bahia: string | null, serial: string) => ({
        ...normalizar({ ...jsonAgente({ fuente: 'hdsentinel', puntaje: 100 }), serial }),
        bahia,
    })

    it('⭐ si el agente manda la bahía 2 primero, el 1 queda a la izquierda', () => {
        const orden = ordenarPorBahia([conBahia('2', 'WD'), conBahia('1', 'SEAGATE')])
        expect(orden.map((d) => d.bahia)).toEqual(['1', '2'])
        expect(orden[0].serial).toBe('SEAGATE')
    })

    it('un solo disco queda primero (celda de la izquierda)', () => {
        const orden = ordenarPorBahia([conBahia('1', 'SOLO')])
        expect(orden[0].serial).toBe('SOLO')
    })

    it('una bahía desconocida no rompe el orden: va al final', () => {
        const orden = ordenarPorBahia([conBahia('BAHÍA-A', 'RARO'), conBahia('2', 'DOS'), conBahia('1', 'UNO')])
        expect(orden.map((d) => d.serial)).toEqual(['UNO', 'DOS', 'RARO'])
    })

    it('no muta el arreglo que recibe (la respuesta del agente queda intacta)', () => {
        const original = [conBahia('2', 'WD'), conBahia('1', 'SEAGATE')]
        ordenarPorBahia(original)
        expect(original.map((d) => d.serial)).toEqual(['WD', 'SEAGATE'])
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// MEJORA 45 · LA LECTURA INCOMPLETA — «no está conectado» no es una conclusión
// ═══════════════════════════════════════════════════════════════════════════════
// Medido en el puesto el 1 Oct 2026: la lectura FRESCA del dock a veces vuelve con **1 de 2**
// discos, con el segundo perfectamente conectado (la lectura normal traía los dos). El `.ps1`
// coteja cada NS contra ESA lectura, así que el disco que el agente no alcanzó a leer caía en
// un `rechazo` que decía «no está conectado AHORA» — **culpaba al disco cuando el que no
// terminó de leer fue el agente**, el formateo no hacía nada y el mensaje mandaba a revisar el
// dock. Ahora el agente reintenta el ciclo y declara la completitud.
//
// 🔴 Lo que estos tests protegen: que la app NO dé por completa una lectura que nadie
//    verificó, y que NUNCA «complete» la lista de discos por su cuenta (un disco sacado a
//    propósito y uno que no se pudo leer son indistinguibles por cantidad; completar la lista
//    haría que `diskpart` limpiara el disco que esté en esa posición).

describe('la completitud de la lectura · el defecto medido', () => {
    it('⭐ un agente VIEJO (sin el campo) deja la completitud en DESCONOCIDO, no en «completa»', () => {
        const r = normalizarLectura({
            discos: [jsonAgente({ fuente: 'hdsentinel', puntaje: 100 })],
        })
        expect(r.lectura_incompleta).toBeNull()
        expect(r.discos_vistos).toBeNull()
        expect(r.discos_esperados).toBeNull()
        expect(r.discos_no_leidos).toEqual([])
    })

    it('⭐ el agente NUEVO que dice «completa» se respeta', () => {
        const r = normalizarLectura({
            lectura_incompleta: false,
            discos_vistos: 2,
            discos_esperados: 2,
            discos: [jsonAgente({ fuente: 'hdsentinel', puntaje: 100 })],
        })
        expect(r.lectura_incompleta).toBe(false)
        expect(r.discos_vistos).toBe(2)
        expect(r.discos_esperados).toBe(2)
    })

    it('⭐ «incompleta» viaja con QUIÉN falta, para poder decirlo', () => {
        const r = normalizarLectura({
            lectura_incompleta: true,
            discos_vistos: 1,
            discos_esperados: 2,
            discos: [jsonAgente({ fuente: 'hdsentinel', puntaje: 100, serial: 'ZFQ07JXX' })],
            discos_no_leidos: [{ disco_fisico: 1, nombre: 'Sabrent Dual SATA Bridge' }],
        })
        expect(r.lectura_incompleta).toBe(true)
        expect(r.discos_vistos).toBe(1)
        expect(r.discos_esperados).toBe(2)
        expect(r.discos_no_leidos).toEqual([{ disco_fisico: 1, nombre: 'Sabrent Dual SATA Bridge' }])
    })

    it('🔴 la lectura NO se «completa» con el inventario: solo entran los discos que el agente dio', () => {
        // El agente dice 1 de 2 y el inventario de Windows muestra los dos del puente.
        const r = normalizarLectura({
            lectura_incompleta: true,
            discos_vistos: 1,
            discos_esperados: 2,
            discos: [jsonAgente({ fuente: 'hdsentinel', puntaje: 100, serial: 'ZFQ07JXX' })],
            inventario_windows: {
                fisicos: [
                    { DeviceId: 0, BusType: 'NVMe', EsSistema: true, FriendlyName: 'WDC PC SN730' },
                    { DeviceId: 1, BusType: 'USB', EsSistema: false, FriendlyName: 'Sabrent Dual SATA Bridge' },
                    { DeviceId: 2, BusType: 'USB', EsSistema: false, FriendlyName: 'Sabrent Dual SATA Bridge' },
                ],
            },
        })
        // UN solo disco, aunque Windows vea tres: el que falta NO se inventa.
        expect(r.discos).toHaveLength(1)
        expect(r.discos[0].serial).toBe('ZFQ07JXX')
        expect(r.lectura_incompleta).toBe(true)
    })
})
