/**
 * Tipos base compartidos en toda la aplicacion.
 * 
 * Tipos especificos de dominio (auth, pedidos, productos, etc.)
 * se definen en archivos separados a partir de la Guia 0.4.
 */

// Tipo generico para respuestas de API y Server Actions
// T es el tipo del dato que se espera cuando la operacion es exitosa
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

// Estados de carga para cualquier operacion asincrona
// Se usa para controlar spinners, botones deshabilitados y mensajes de error
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Parametros de paginacion para listas y tablas
// total es opcional — no siempre se conoce antes de hacer la consulta
export interface PaginationParams {
  page: number
  pageSize: number
  total?: number
}
