// ============================================================================
// TIPOS DE AUTENTICACIÓN — CONTRATO CON LA BD
// Espejo LITERAL del JSON de obtener_sesion_completa() (Guía 0.4, Parte 4, Bloque 5).
// Los nombres de campo son snake_case porque así los entrega la función SQL.
// Cambiar un nombre aquí rompe el runtime sin error de compilación.
// ============================================================================

// ── Modos internos del LoginForm (Parte 4) ─────────────────────────────────
export type LoginStep = 'login' | 'register' | 'loading'

// ── Estado de desarrollo del submódulo (contrato Guía 0.6 — badge Sidebar) ─
export type EstadoDesarrollo = 'disponible' | 'en_construccion' | 'planeado'

// ── Eje 3 — alcance de datos (usuarios/roles — MODELO_DATOS.md) ─────────────
export type AlcanceDatos = 'todos' | 'propios' | 'marca' | 'ruta'

// ── Rol anidado dentro de usuario ──────────────────────────────────────────
export interface Rol {
    id: string
    clave: string
    nombre: string
    nivel_jerarquico: number
}

// ── Usuario — campo a campo lo que devuelve la SQL ─────────────────────────
export interface Usuario {
    id: string
    nombre_completo: string
    email: string
    telefono: string | null
    // JSONB con DEFAULT '{"tema":"obsidiana"}' — contrato Guía 0.6 (ThemeInjector)
    preferencias: { tema: string }
    // Override del rol; si NULL, la BD usa el alcance del rol (COALESCE en la SQL)
    alcance_datos: AlcanceDatos | null
    // Requerido solo si alcance_datos = 'marca' (CHECK de la columna)
    id_marca_comercial: string | null
    es_activo: boolean
    // ⭐ ANEXIÓN 20 Ago 2026: viaja en obtener_sesion_completa() (0.4 P4 B5)
    //    para que soloDueno() (Guía 0.10) lo lea del store como tienePermiso().
    es_admin_principal: boolean
    rol: Rol
}

// ── Filas del menú (flat — el Sidebar de 0.6 agrupa con un reduce) ─────────
export interface MenuItem {
    nombre_modulo: string
    icono_modulo: string
    orden_modulo: number
    href: string
    nombre_submodulo: string
    icono_submodulo: string
    orden_submodulo: number
    estado_desarrollo: EstadoDesarrollo
}

// ── Permiso de acción (href desnormalizado para lookups O(1) en 0.7) ────────
export interface PermisoAccion {
    id_submodulo: string
    href: string
    id_accion: string
    clave_accion: string
}

// ── Respuesta completa de obtener_sesion_completa() ─────────────────────────
export interface SesionCompletaResponse {
    error: boolean
    mensaje?: string   // presente solo cuando error = true
    usuario?: Usuario
    menu?: MenuItem[]
    permisos?: PermisoAccion[]
}

// ── Respuesta de las Server Actions de login/registro ───────────────────────
// Unión discriminada: obliga a revisar success antes de tocar sesion.
export type AuthActionResponse =
    | { success: true; sesion: SesionCompletaResponse }
    | { success: true; requiereConfirmacion: true }  // registro con Confirm email ON
    | { success: false; error: string }

// ── Respuesta de cerrar sesión ───────────────────────────────────────────────
export type CerrarSesionResponse = {
    success: boolean
    error?: string
}

// ============================================================================
// GUÍA 0.11 — RESPUESTAS DE RECUPERACIÓN Y CAMBIO DE CONTRASEÑA
// Uniones discriminadas por `success`: el compilador impide leer `error` en
// una rama exitosa. Mismo patrón que AuthActionResponse (Guía 0.5).
// ============================================================================

// ── Iniciar recuperación (envío del correo con el link) ─────────────────────
// El servidor SIEMPRE responde éxito cuando la Server Action se ejecutó sin
// error de red: no confirma si el correo existía en la BD. Esa opacidad es la
// defensa contra enumeración de cuentas (probar correos para descubrir cuáles
// tienen usuario). El único caso false es un fallo real del proveedor
// (rate-limit, servicio caído, config del proyecto). Ver Guía 0.11 Parte 1 B3.
export type RecuperacionResponse =
    | { success: true }
    | { success: false; error: string }

// ── Establecer nueva contraseña (aterrizaje del link, sin login previo) ─────
// ── Cambiar contraseña en sesión (perfil, con re-verificación de la actual) ─
// Misma forma; se separan por sitio de llamada para que el diff futuro que
// diverja uno de los flujos no obligue a migrar el otro.
export type CambioPasswordResponse =
    | { success: true }
    | { success: false; error: string }
