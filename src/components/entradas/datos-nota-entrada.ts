// ═══════════════════════════════════════════════════════════════════════════════
// DATOS DE LA NOTA DE ENTRADA — el vocabulario del papel (Guía 1.6 · 27 Sep 2026)
//
// ⭐ UN SOLO LUGAR PARA EL VOCABULARIO. La nota de entrada se imprime por DOS caminos
// que tienen que pintar lo mismo: la **plantilla** de la BD (si hay una activa para el
// tipo `nota_entrada`) y el **respaldo en código** (`NotaEntradaImprimible`). Los dos
// reciben ESTE objeto. Si el vocabulario viviera duplicado, el día que cambie un
// nombre la plantilla imprimiría vacío y el respaldo no — y nadie sabría cuál miente.
//
// ⭐ ACÁ SE FORMATEA, NO EN LA PLANTILLA. El motor de plantillas PINTA: no calcula ni
// formatea (ley L6 — un solo lugar por cifra). Por eso los importes salen ya como
// «$1,234.00» y la fecha como «27/09/2026»: la plantilla solo los coloca en su diseño.
//
// ⚠️ Los nombres de las claves son CONTRATO con quien escriba la plantilla en
// `/dashboard/sistema/plantillas`: se declaran en la pestaña «Variables» de la
// plantilla. Renombrar una acá sin renombrarla allá deja el hueco en blanco, sin error.
// ═══════════════════════════════════════════════════════════════════════════════

import type { VariablesDocumento } from '@/lib/plantillas/motor'
import type { Entrada, PartidaEntrada } from '@/types/entradas'

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

function formatearFecha(fecha: string): string {
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Traduce la entrada y sus partidas al vocabulario plano que consumen la plantilla y
 * el respaldo. Las claves del membrete (`razon_social`, `logo_url`, …) NO van acá:
 * las agrega `DocumentoImprimible` desde `empresa_emisora` antes de pintar.
 */
export function construirDatosNotaEntrada(
    entrada: Entrada,
    partidas: PartidaEntrada[]
): VariablesDocumento {
    const total = partidas.reduce((s, p) => s + p.cantidad_original * p.costo_acordado, 0)

    return {
        folio: entrada.folio,
        fecha: formatearFecha(entrada.fecha),
        proveedor: entrada.proveedor_nombre ?? '—',
        capturo: entrada.creador_nombre ?? '',
        notas: entrada.notas ?? '',
        total: formatearMXN(total),
        // La tabla del papel: una fila por partida. `{{#partidas}}…{{/partidas}}` en la
        // plantilla; el respaldo la recorre igual.
        partidas: partidas.map((p) => ({
            partida: p.partida,
            clasificacion: p.categoria_nombre ?? '—',
            cantidad: p.cantidad_original,
            costo: formatearMXN(p.costo_acordado),
            total_linea: formatearMXN(p.cantidad_original * p.costo_acordado),
        })),
    }
}
