// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS — LOS AVISOS Y LA MARCA DE «NUEVA» (Guía 1.6 · MEJORA 53 y 54 · 09 Oct 2026)
//
// Lo que se prueba NO es «llega el evento» (eso es Realtime): es **a quién le
// toca** y **cuándo una fila es nueva** — las dos decisiones que, si están mal,
// avisan de trabajo que no existe, dejan al operario esperando, o marcan una
// entrada que ya nadie tiene que mirar. Los dos lados están cubiertos a propósito:
// los estados que AVISAN y los que tienen que quedarse MUDOS; la fila de 23,9 h y
// la de 24,1 h.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import {
    avisosDeEntrada,
    avisosDeLiberacion,
    esNuevaPorRecencia,
    textoRecencia,
    RUTA_ETAPA,
    VENTANA_NUEVA_MS,
    type FilaEntrada,
    type FilaLiberacion,
} from '@/lib/avisos-entradas'

const ENTRADA: FilaEntrada = {
    id: 'e-1',
    folio: 'ING-0012',
    estado: 'recien_creada',
    es_sin_revision: false,
}

const etapas = (avisos: { etapa: string }[]) => avisos.map((a) => a.etapa)

describe('avisos de `entradas` — el estado decide la etapa', () => {
    it('una entrada recién creada con revisión es trabajo del TÉCNICO', () => {
        expect(etapas(avisosDeEntrada(ENTRADA, 'INSERT'))).toEqual(['revision'])
    })

    it('una entrada sin revisión SALTA al ACONDICIONADOR (camino 2)', () => {
        const fila = { ...ENTRADA, es_sin_revision: true }
        expect(etapas(avisosDeEntrada(fila, 'INSERT'))).toEqual(['acondicionamiento'])
    })

    it('la nota generada manda la mercancía a ACONDICIONAMIENTO', () => {
        expect(etapas(avisosDeEntrada({ ...ENTRADA, estado: 'ajustada' }, 'UPDATE'))).toEqual([
            'acondicionamiento',
        ])
    })

    it('el cierre de la revisión deja el trabajo en RECEPCIÓN (las dos variantes)', () => {
        expect(etapas(avisosDeEntrada({ ...ENTRADA, estado: 'revisada_sin_dev' }, 'UPDATE'))).toEqual([
            'recepcion',
        ])
        expect(etapas(avisosDeEntrada({ ...ENTRADA, estado: 'con_dev' }, 'UPDATE'))).toEqual([
            'recepcion',
        ])
    })

    it('llegar a Almacén es trabajo del ALMACENISTA', () => {
        expect(etapas(avisosDeEntrada({ ...ENTRADA, estado: 'en_almacen' }, 'UPDATE'))).toEqual([
            'almacen',
        ])
    })

    it('la divergencia despierta al ADMIN', () => {
        expect(
            etapas(avisosDeEntrada({ ...ENTRADA, estado: 'bloqueada_por_divergencia' }, 'UPDATE'))
        ).toEqual(['divergencias'])
    })

    it('`lista_para_revision` también es trabajo del técnico', () => {
        expect(etapas(avisosDeEntrada({ ...ENTRADA, estado: 'lista_para_revision' }, 'UPDATE'))).toEqual(
            ['revision']
        )
    })
})

describe('avisos de `entradas` — los estados que se quedan MUDOS (a propósito)', () => {
    it('`en_revision` no avisa: es el TÉCNICO tomando su propio trabajo', () => {
        expect(avisosDeEntrada({ ...ENTRADA, estado: 'en_revision' }, 'UPDATE')).toEqual([])
    })

    it('`en_acondicionamiento` no avisa: es el ACONDICIONADOR tomando el suyo', () => {
        expect(avisosDeEntrada({ ...ENTRADA, estado: 'en_acondicionamiento' }, 'UPDATE')).toEqual([])
    })

    it('`confirmada` no avisa: es el fin del flujo', () => {
        expect(avisosDeEntrada({ ...ENTRADA, estado: 'confirmada' }, 'UPDATE')).toEqual([])
    })

    it('⚠️ `recien_creada` en un UPDATE NO re-avisa (editar la entrada deja el estado intacto)', () => {
        expect(avisosDeEntrada(ENTRADA, 'UPDATE')).toEqual([])
    })

    it('un DELETE no avisa a nadie', () => {
        expect(avisosDeEntrada(ENTRADA, 'DELETE')).toEqual([])
    })

    it('un estado desconocido no revienta: no avisa', () => {
        expect(avisosDeEntrada({ ...ENTRADA, estado: 'inventado' }, 'UPDATE')).toEqual([])
    })
})

describe('el aviso es de la COLA, no del ACTO — la decisión, con su porqué', () => {
    /**
     * ⚠️ Se descartó filtrar por «quién lo hizo», y estas pruebas lo fijan para que
     * nadie lo reintroduzca sin leer la razón: buena parte de los cambios de estado
     * los escribe el trigger `tr_entradas_transicion` (`UPDATE entradas SET estado`),
     * que **no** toca `actualizado_por` ⇒ filtrar por esa columna callaría avisos
     * legítimos, en silencio. Y los estados «yo lo tomé» ya se excluyen POR ESTADO.
     */
    it('una entrada que trae `creado_por` avisa igual (el mapeo no mira al actor)', () => {
        const conActor = { ...ENTRADA, creado_por: 'admin-1', actualizado_por: 'admin-1' }
        expect(etapas(avisosDeEntrada(conActor, 'INSERT'))).toEqual(['revision'])
    })

    it('una tanda que trae `liberado_por` avisa igual', () => {
        const conActor = { id: 'l-9', tanda: 1, cantidad: 2, estado: 'por_limpiar', liberado_por: 'tecnico-1' }
        expect(etapas(avisosDeLiberacion(conActor, 'INSERT'))).toEqual(['acondicionamiento'])
    })

    it('el único filtro que apaga un aviso es el PERMISO (vive en el componente, no acá)', () => {
        // El mapeo devuelve el aviso aunque el actor sea el mismo usuario: quien decide
        // si se muestra es `puedeVerPagina(RUTA_ETAPA[etapa])`, en `AvisosEntradas`.
        expect(etapas(avisosDeEntrada({ ...ENTRADA, estado: 'ajustada' }, 'UPDATE'))).toEqual([
            'acondicionamiento',
        ])
    })
})

describe('avisos de `liberaciones_entrada` — la tanda, que NO mueve el estado del documento', () => {
    const TANDA: FilaLiberacion = {
        id: 'l-1',
        tanda: 3,
        cantidad: 5,
        estado: 'por_limpiar',
    }

    it('la tanda que nace `por_limpiar` es trabajo del ACONDICIONADOR', () => {
        expect(etapas(avisosDeLiberacion(TANDA, 'INSERT'))).toEqual(['acondicionamiento'])
    })

    it('la tanda entregada (`en_almacen`) es trabajo del ALMACENISTA', () => {
        expect(etapas(avisosDeLiberacion({ ...TANDA, estado: 'en_almacen' }, 'UPDATE'))).toEqual([
            'almacen',
        ])
    })

    it('⚠️ `por_limpiar` en un UPDATE no re-avisa', () => {
        expect(avisosDeLiberacion(TANDA, 'UPDATE')).toEqual([])
    })

    it('`en_limpieza` no avisa: el acondicionador ya la tomó', () => {
        expect(avisosDeLiberacion({ ...TANDA, estado: 'en_limpieza' }, 'UPDATE')).toEqual([])
    })

    it('`confirmada` no avisa: la mercancía ya entró al stock', () => {
        expect(avisosDeLiberacion({ ...TANDA, estado: 'confirmada' }, 'UPDATE')).toEqual([])
    })

    it('el detalle dice la tanda y las piezas, en singular y en plural', () => {
        expect(avisosDeLiberacion(TANDA, 'INSERT')[0].detalle).toBe('Tanda 3 · 5 piezas')
        expect(avisosDeLiberacion({ ...TANDA, cantidad: 1 }, 'INSERT')[0].detalle).toBe(
            'Tanda 3 · 1 pieza'
        )
    })
})

describe('las rutas de las etapas son las del RBAC (contrato literal)', () => {
    it('cada etapa apunta a su submódulo real', () => {
        expect(RUTA_ETAPA).toEqual({
            recepcion: '/dashboard/entradas/recepcion',
            revision: '/dashboard/entradas/revision',
            acondicionamiento: '/dashboard/entradas/acondicionamiento',
            almacen: '/dashboard/entradas/alta',
            divergencias: '/dashboard/entradas/divergencias',
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 54 — «¿ESTA FILA ES NUEVA?» (opción B · recencia de 24 h)
//
// Lo que se prueba es el BORDE, que es donde esta regla se rompe en silencio: una
// fila de 23,9 h se marca y una de 24,1 h no; y un `created_at` en el FUTURO no se
// marca (reloj desfasado o siembra) — sin esa guarda, esa fila quedaría marcada
// para siempre.
// ═══════════════════════════════════════════════════════════════════════════════

describe('esNuevaPorRecencia — la ventana de 24 h', () => {
    const AHORA = Date.parse('2026-10-10T00:00:00.000Z')
    const hace = (horas: number) => new Date(AHORA - horas * 3_600_000).toISOString()

    it('una entrada de hace 2 h es nueva', () => {
        expect(esNuevaPorRecencia(hace(2), AHORA)).toBe(true)
    })

    it('una entrada de hace 22,94 h (ING-0006, el caso real) todavía es nueva', () => {
        expect(esNuevaPorRecencia(hace(22.94), AHORA)).toBe(true)
    })

    it('el borde: 23,9 h sí y 24,1 h no', () => {
        expect(esNuevaPorRecencia(hace(23.9), AHORA)).toBe(true)
        expect(esNuevaPorRecencia(hace(24.1), AHORA)).toBe(false)
    })

    it('exactamente la ventana ENTERA todavía cuenta (el límite es inclusivo)', () => {
        expect(esNuevaPorRecencia(hace(VENTANA_NUEVA_MS / 3_600_000), AHORA)).toBe(true)
    })

    it('⚠️ una fecha FUTURA NO es nueva: es un reloj desfasado o una siembra', () => {
        expect(esNuevaPorRecencia(new Date(AHORA + 3_600_000).toISOString(), AHORA)).toBe(false)
    })

    it('sin fecha, o con basura, no se marca nada (fail-closed)', () => {
        expect(esNuevaPorRecencia(null, AHORA)).toBe(false)
        expect(esNuevaPorRecencia(undefined, AHORA)).toBe(false)
        expect(esNuevaPorRecencia('', AHORA)).toBe(false)
        expect(esNuevaPorRecencia('no-es-una-fecha', AHORA)).toBe(false)
    })

    it('una entrada vieja (el caso ING-0003, 25,04 h) ya no es nueva', () => {
        expect(esNuevaPorRecencia(hace(25.04), AHORA)).toBe(false)
    })
})

describe('textoRecencia — el title del marcador, sin decimales', () => {
    const AHORA = Date.parse('2026-10-10T00:00:00.000Z')
    const hace = (horas: number) => new Date(AHORA - horas * 3_600_000).toISOString()

    it('por debajo de la hora no dice «0 h»: dice «menos de 1 h»', () => {
        expect(textoRecencia(hace(0.03), AHORA)).toBe('menos de 1 h')
        expect(textoRecencia(hace(0.99), AHORA)).toBe('menos de 1 h')
    })

    it('de una hora en adelante, horas enteras', () => {
        expect(textoRecencia(hace(1), AHORA)).toBe('1 h')
        expect(textoRecencia(hace(22.94), AHORA)).toBe('22 h')
    })

    it('una fecha ilegible no revienta el tooltip', () => {
        expect(textoRecencia('no-es-una-fecha', AHORA)).toBe('poco')
    })
})
