// ═══════════════════════════════════════════════════════════════════════════════
// DATOS DEL ACTA DE REVISIÓN — el vocabulario del papel (Guía 1.6 · MEJORA 41)
//
// ⭐ UN SOLO LUGAR PARA EL VOCABULARIO. El acta se imprime por DOS caminos que tienen que
// pintar lo mismo: la **plantilla** activa del tipo `acta_revision` (carril de plantillas,
// Guía 2.1) y el **respaldo en código** (`ActaRevisionImprimible`). Los dos reciben ESTE
// objeto — si el vocabulario viviera duplicado, el día que cambie una clave la plantilla
// imprimiría vacío y el respaldo no, y nadie sabría cuál de los dos miente.
//
// ⭐ ACÁ SE FORMATEA, NO EN LA PLANTILLA (ley L6: un solo lugar por cifra). El motor de
// plantillas PINTA: las fechas salen como `25/09/2026` y el `—` de una columna que no
// aplica a esa fila lo decide quien arma el dato, no el diseño.
//
// ⚠️ Los nombres de las claves son CONTRATO con quien escriba la plantilla: se declaran en
// la pestaña «Variables» de `/dashboard/sistema/plantillas`. El vocabulario publicado está
// en `GUIAS/23/docs/inventario-plantillas.md` §3.
// ═══════════════════════════════════════════════════════════════════════════════

import { lineasDePartidas, productoDeLinea } from '@/components/entradas/columnas-entrada'
import type { VariablesDocumento } from '@/lib/plantillas/motor'
import type { Entrada, PartidaConAvance } from '@/types/entradas'

function formatearFecha(fecha: string | null): string {
    if (!fecha) return '—'
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Una celda numérica del papel: el número, o `—` cuando esa columna no aplica a la fila. */
function celda(valor: number): string {
    return valor > 0 ? String(valor) : '—'
}

/**
 * Traduce la entrada y sus partidas al vocabulario plano que consumen la plantilla y el
 * respaldo. Las claves del membrete (`nombre_comercial`, `logo_url`, …) **no** van acá:
 * las agrega `DocumentoImprimible` desde `empresa_emisora` antes de pintar.
 */
export function construirDatosActaRevision(
    entrada: Entrada,
    partidas: PartidaConAvance[]
): VariablesDocumento {
    const lineas = lineasDePartidas(partidas)
    const totalDev = partidas.reduce((s, p) => s + Number(p.dev_cantidad ?? 0), 0)

    return {
        folio: entrada.folio,
        fecha_recepcion: formatearFecha(entrada.fecha),
        fecha_fin_revision: formatearFecha(entrada.fecha_fin_rev),
        proveedor: entrada.proveedor_nombre ?? '—',
        capturo: entrada.creador_nombre ?? '',
        piezas_total: entrada.piezas_total,
        piezas_aprobadas: entrada.piezas_aprobadas,
        total_dev: totalDev,
        // El papel dice lo que el negocio dice: «con malas» / «sin malas».
        resultado: entrada.resultado_rev === 'CON_MALAS' ? 'CON MALAS' : 'SIN MALAS',
        estado: entrada.estado,
        // ⭐ La tabla del acta es JERÁRQUICA —una fila de PARTIDA y debajo las filas de sus
        // productos—: se aplana en UNA lista con la bandera `es_partida`, que es lo único
        // que la plantilla necesita para pintar los dos estilos de fila (`{{#es_partida}}`
        // / `{{^es_partida}}`). Se usa `lineasDePartidas()`, la MISMA fuente que el
        // desglose de pantalla, para que el papel y la pantalla no puedan contradecirse.
        lineas: lineas.map((l) => ({
            es_partida: l.esPartida,
            etiqueta: l.esPartida
                ? `PARTIDA ${l.partida.partida} · ${productoDeLinea(l)}`
                : productoDeLinea(l),
            recibidas: l.recibidas,
            aprobadas: l.esPartida ? l.partida.aprobadas : l.declarada ? '—' : l.aprobadas,
            dev: l.esPartida ? celda(l.partida.dev_cantidad) : celda(l.dev),
        })),
    }
}
