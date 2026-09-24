// ═══════════════════════════════════════════════════════════════════════════════
// BARREL form — API pública de la familia (Guía 0.8 · Parte 7)
// Los CRUDs importan SOLO desde aquí (convención 0.6: components/shell/index.ts)
//
// PROMOCIÓN 23 Ago 2026 (1ª) — segundo consumidor activó el gate (≥2):
//   · 1.0 Proveedores (rediseño single-page sidebar aprobado)
//   · 1.1 Productos (mapa cerrado 23 Ago 2026, D8)
//   · 1.2 Clientes (PR5 — activó la 2ª promoción)
//
// PROMOCIÓN 23 Ago 2026 (2ª) — DecisionFiscal sube desde
// catalogos/proveedor-form/ por el 2º consumidor real (1.2 Clientes, PR5):
// checkbox maestro dumb + píldoras F CFDI 4.0; la divergencia del C.P.
// fiscal del cliente se resuelve en el CRUD, fuera del componente.
//
// PROMOCIÓN 24 Ago 2026 (3ª) — CatalogoModalBase sube (PR7 · Mapa Catálogos
// D11): esqueleto del modal mini de catálogo (Dialog + RHF/zod + botones +
// error inline) que la Guía 1.3 consumirá en sus pestañas nuevas; los 3
// modales de la 1.2 quedan como duplicados a migrar cuando la 1.3 los consuma.
//
// Quedan locales los específicos del dominio de proveedor (ProveedorFormSidebar,
// campos/*) — su vocabulario no aplica a todos los CRUDs.
// ═══════════════════════════════════════════════════════════════════════════════

// ⚠️ FIX 02 Sep 2026 (implementación): SelectorOCPendiente (PROMOCIÓN #49) se
// difiere a la implementación de la Guía 2.0 — consume listarOrdenesCompraPendientes
// (@/lib/actions/compras · B3.3) y OrdenCompraPendiente (@/types/compras), contratos
// de la 2.0 que no existen en este repo. Cuando la 2.0 los cree, se agregan aquí
// las dos líneas de export del bloque original (ver CONEXIONES_PENDIENTES).

export { CatalogoModalBase } from './modales/CatalogoModalBase'
export { DecisionFiscal } from './DecisionFiscal'
export { SeccionForm } from './SeccionForm'
export { SelloFiscal } from './SelloFiscal'

// PROMOCIÓN 03 Sep 2026 (4ª) — DomicilioFields sube a la 0.8 por el 2º consumidor real:
// la pidió la Guía 1.1 Proveedores y la consumirá además la 1.3 Clientes (paridad literal
// de captura de domicilio — MODELO_DATOS §7.1/§7.2). Bloque dumb RHF-native: 5 campos
// espejo de columnas (direccion · colonia · ciudad · estado · codigo_postal), validación
// zod del consumidor, sello FISCAL sobre el C.P. cuando `cpFiscal`.
export { DomicilioFields } from './DomicilioFields'
export type { CampoDomicilio, DomicilioFormData } from './DomicilioFields'

// NACE 28 Ago 2026 (5ª) — SelectorUbicacionCascada al nacer (≥2 consumidores
// garantizados: 1.1 Productos modal + 2.2 Entradas modal de alta). Jerarquía
// rack → nivel → organizador → charola. AGNÓSTICO: recibe `ubicaciones` como
// prop, NO consulta BD.
export { SelectorUbicacionCascada } from './selectores/SelectorUbicacionCascada'
export type { UbicacionAlmacen } from './selectores/SelectorUbicacionCascada'

// ⭐ PROMOCIÓN 05 Sep 2026 (6ª) — SelectorProveedor sube a la 0.8 por el 2º consumidor
// garantizado: la pidió la **Guía 1.4 Compras** (alta/edición del encabezado + filtro del
// listado) y la consumirá además la **1.6 Entradas** (recepción — liga la compra / la crea
// al vuelo). Selector buscable de proveedores ACTIVOS; el contrato de dominio se importa
// del módulo dueño 1.1 (`listarProveedoresActivos` · `ProveedorOpcion` de
// `@/lib/actions/proveedores` y `@/types/proveedores`) — espejo del SelectorOCPendiente
// (Bloque 6 · la 0.8 sí aloja selectores de dominio cuyo contrato importa de su dueño).
export { SelectorProveedor } from './selectores/SelectorProveedor'

// ⭐ PROMOCIÓN 17 Sep 2026 (7ª) — SelectorProducto sube a la 0.8 por el 2º consumidor
// garantizado: la pidió la **Guía 1.5 Inventario** (salida manual + renglones del
// conteo) y la consumirá además la **1.6 Entradas** (partidas de la entrada). Selector
// buscable de productos ACTIVOS; el contrato de dominio se importa del módulo dueño
// 1.2 (`listarProductosActivos` — actions/productos · `ProductoOpcion` — types/productos).
// (La 1.4 mantiene su copia local `listarProductosParaPartida` como duplicado anotado.)
export { SelectorProducto } from './selectores/SelectorProducto'
