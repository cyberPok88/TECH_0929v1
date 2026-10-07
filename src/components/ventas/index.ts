// ═══════════════════════════════════════════════════════════════════════════════
// VENTAS — puerta única del módulo (Guía 1.8)
// ⭐ Lo que consumen 1.9 y 2.3 se importa DE AQUÍ, no de los archivos internos:
//    así el día que una pieza se mueva, los consumidores no se enteran.
// ═══════════════════════════════════════════════════════════════════════════════

export { NotasRemisionCatalogo } from './NotasRemisionCatalogo'
export { NotaRemisionFilters, FILTROS_VENTAS_DEFAULT } from './NotaRemisionFilters'
export type { OpcionFiltro } from './NotaRemisionFilters'
export { PartidasNotaExpandidas } from './PartidasNotaExpandidas'
export { NotaRemisionModal } from './NotaRemisionModal'
export { PartidasRemisionGrid } from './PartidasRemisionGrid'
export { AsignarNSDialog } from './AsignarNSDialog'
export { AutorizacionDialog } from './AutorizacionDialog'
export type { ActoAutorizacion } from './AutorizacionDialog'
export { NotaRemisionFicha } from './NotaRemisionFicha'
export { NotaRemisionDetalleModal } from './NotaRemisionDetalleModal'
export { EstadoCuentaCliente } from './EstadoCuentaCliente'
export { CancelarNotaRemisionDialog } from './CancelarNotaRemisionDialog'
// ⚠️ El DINERO NO se re-exporta por acá: `formatearMoneda` es de la casa
//    (`@/lib/utils/formatters`, dueño Guía 0.2) y se importa de ahí — el proyecto prohíbe
//    el 11º duplicado. `formatearFecha` SÍ se queda: la de la casa corre un día en fechas
//    sin hora y lanza `RangeError` con `''` (divergencia declarada, Parte 2).
export { columnasVentas, formatearFecha } from './columnas-venta'
export { exportarVentasCsv } from './exportar-ventas-csv'
export { NotaVentaImprimible } from './imprimibles/NotaVentaImprimible'
export { construirDatosNotaVenta } from './datos-nota-venta'
