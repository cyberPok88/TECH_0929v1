// types/catalogos.ts — Catálogos y Datos Maestros (Guía 1.0)
// Filas espejo BD (snake_case) + form data + tipos del hub.

export type ClaveTabCatalogo =
  | 'impuestos' | 'unidades_medida' | 'categorias' | 'canales_venta'
  | 'marcas_comerciales' | 'tipos_cliente' | 'rutas_cobro'
  | 'listas_precios' | 'vendedores' | 'marcas_producto' | 'ubicaciones_almacen';

// --- Respuesta uniforme (convención proyecto) ---
export interface RespuestaLista<T> { data: T[]; success: true }
export interface RespuestaAccion<T = undefined> { success: boolean; data?: T; error?: string }

// --- Impuestos ---
export interface ImpuestoFila {
  id: string; clave: string; nombre: string; tipo: string;
  tasa: number; es_activo: boolean;
  created_at: string | null; updated_at: string | null;
}
export interface ImpuestoFormData { clave: string; nombre: string; tipo: string; tasaPorciento: number; es_activo: boolean }

// --- Unidades de medida ---
export interface UnidadMedidaFila {
  id: string; clave: string; nombre: string; abreviatura: string;
  clave_sat: string | null; es_activo: boolean;
  created_at: string | null; updated_at: string | null;
}
export interface UnidadMedidaFormData { clave: string; nombre: string; abreviatura: string; clave_sat?: string; es_activo: boolean }

// --- Categorías y subcategorías (jerarquía + esquema) ---
export interface CategoriaFila {
  id: string; nombre: string; descripcion: string | null; orden: number;
  id_categoria_padre: string | null; es_activo: boolean; esquema_atributos: AtributoEsquema[];
  created_at: string | null; updated_at: string | null;
}
export interface AtributoEsquema {
  clave: string; etiqueta: string;
  tipo: 'text' | 'number' | 'select'; requerido: boolean; opciones?: string[];
  /** ⭐ Huella canónica (1.6): true = el atributo forma parte de la identidad del SKU. */
  en_huella?: boolean;
  /** ⭐ Evolución V5 (20 Sep 2026): true = se captura en RECEPCIÓN (soft). Si falta, en REVISIÓN. */
  en_entrada?: boolean;
  /** ⭐ Evolución V5 (20 Sep 2026): valor automático — NO se pregunta (ej. `rpm = 7200`). */
  valor_default?: string;
  /** ⭐ 20 Sep 2026: el valor se DERIVA de otro atributo (ej. HDD `tipo` PC→3.5" · LAP→2.5").
   *  Se muestra read-only; nunca se captura. */
  derivado_de?: { clave: string; mapa: Record<string, string> };
}
export interface CategoriaFormData {
  nombre: string; descripcion?: string; orden: number;
  id_categoria_padre?: string | null; es_activo: boolean;
  esquema_atributos: AtributoEsquema[];
}

// --- Canales de venta / Marcas comerciales / Marcas producto (simples) ---
export interface CatalogoSimpleFila {
  id: string; clave: string; nombre: string; es_activo: boolean;
  created_at: string | null; updated_at: string | null;
}

// --- Marcas comerciales (extiende simple) ---
export interface MarcaComercialFila {
  id: string; clave: string; nombre_visible: string; slug: string;
  color_hex: string | null; logo_url: string | null; descripcion: string | null; es_activa: boolean;
  created_at: string | null; updated_at: string | null;
}
export interface MarcaComercialFormData {
  clave: string; nombre_visible: string; slug: string;
  color_hex?: string; descripcion?: string; es_activa: boolean;
}

// --- Marcas de producto (fabricante) ---
export interface MarcaProductoFila {
  id: string; nombre: string; es_activo: boolean; created_at: string | null; updated_at: string | null;
}
export interface MarcaProductoFormData { nombre: string; es_activo: boolean }

// --- Tipos de cliente (segmento + %) ---
export interface TipoClienteFila {
  id: string; clave: string; nombre: string; porcentaje_ajuste: number;
  descripcion: string | null; orden: number; es_activo: boolean;
  created_at: string | null; updated_at: string | null;
}
export interface TipoClienteFormData {
  clave: string; nombre: string; porcentaje_ajustePorciento: number;
  descripcion?: string; orden: number; es_activo: boolean;
}

// --- Listas de precios (+ % + default) ---
export interface ListaPrecioFila {
  id: string; clave: string; nombre: string; porcentaje_ajuste: number;
  es_lista_default: boolean; es_activo: boolean;
  created_at: string | null; updated_at: string | null;
}
export interface ListaPrecioFormData {
  clave: string; nombre: string; porcentaje_ajustePorciento: number;
  es_lista_default: boolean; es_activo: boolean;
}

// --- Rutas de cobro (+ cobrador) ---
export interface RutaCobroFila {
  id: string; clave: string; nombre: string; descripcion: string | null;
  id_cobrador_asignado: string | null; es_activo: boolean;
  created_at: string | null; updated_at: string | null;
}
export interface RutaCobroFormData {
  clave: string; nombre: string; descripcion?: string; id_cobrador_asignado?: string | null; es_activo: boolean;
}

// --- Ubicaciones del almacén (cascada 4 niveles) ---
export interface UbicacionAlmacenFila {
  id: string; rack: string; nivel: string; organizador: string; charola: string;
  descripcion: string | null; es_activo: boolean;
  created_at: string | null; updated_at: string | null;
}
export interface UbicacionAlmacenFormData {
  rack: string; nivel: string; organizador: string; charola: string;
  descripcion?: string; es_activo: boolean;
}

// --- Vendedores (derivado read-only de usuarios) ---
export interface VendedorFila {
  id: string; nombre: string; correo: string | null; es_activo: boolean;
}

// --- Filtro común del hub ---
export interface FiltrosCatalogo { busqueda: string }
