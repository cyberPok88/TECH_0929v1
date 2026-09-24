// ============================================================================
// AUTH STORE — ZUSTAND HYDRATION-SAFE
// Persiste en localStorage bajo 'erp-auth-storage'.
// En componentes del árbol SSR usar SIEMPRE useAuth(selector).
// useAuthStoreBase solo en contextos post-hidratación (event handlers, actions,
// RBACGuard con su propio gate de hidratación — Guía 0.7).
//
// Creado en la Guía 0.5.
// Guía 0.6: se agrega actualizarPreferencias() — ver Parte 2, Bloque 5.
// Guía 0.6: persist con version: 1 — las sesiones pre-0.6 (forma sin
// contrato) se descartan una sola vez al migrar; AuthWrapper rehidrata.
// Guía 0.7: se agregan puedeVerPagina() y tienePermiso() — ver Parte 1, Bloque 1.
// ============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useSyncExternalStore } from 'react'
import type { Usuario, MenuItem, PermisoAccion, SesionCompletaResponse } from '@/types/auth'
import type { AccionClave } from '@/types/shell'

interface AuthState {
    isAuthenticated: boolean
    // True mientras se rehidrata — la UI del login/dashboard muestra spinner
    isLoading: boolean
    usuario: Usuario | null
    menu: MenuItem[]
    permisos: PermisoAccion[]
    setSesion: (sesion: SesionCompletaResponse) => void
    clearAuth: () => void
    setLoading: (loading: boolean) => void
    // ⭐ Guía 0.6
    actualizarPreferencias: (parciales: Partial<Usuario['preferencias']>) => void
    // ⭐ Guía 0.7 — helpers de consulta RBAC
    puedeVerPagina: (href: string) => boolean
    tienePermiso: (href: string, accion: AccionClave) => boolean
}

export const useAuthStoreBase = create<AuthState>()(
    persist(
        (set, get) => ({
            isAuthenticated: false,
            isLoading: true,
            usuario: null,
            menu: [],
            permisos: [],

            /**
             * Hidrata el store después de login, registro o rehidratación.
             * Descarta respuestas con error: true — nunca deja el estado a medias.
             * El menú se guarda FLAT (tal cual lo devuelve la SQL):
             * el Sidebar (Guía 0.6) agrupa con un reduce del lado cliente.
             */
            setSesion: (sesion) => {
                // Guarda defensiva: una sesión con error no debe tocar el estado vivo
                if (sesion.error || !sesion.usuario || !sesion.menu || !sesion.permisos) {
                    return
                }
                set({
                    isAuthenticated: true,
                    isLoading: false,
                    usuario: sesion.usuario,
                    menu: sesion.menu,
                    permisos: sesion.permisos,
                })
            },

            /**
             * Limpia el store (logout / sesión inválida).
             * isLoading queda en false para que la pantalla de login no muestre
             * un spinner bloqueante.
             */
            clearAuth: () => {
                set({
                    isAuthenticated: false,
                    isLoading: false,
                    usuario: null,
                    menu: [],
                    permisos: [],
                })
            },

            setLoading: (loading) => set({ isLoading: loading }),

            // ═══════════════════════════════════════════════════════════════════
            // ⭐ GUÍA 0.6 — actualizarPreferencias()
            //
            // La 0.5 no dejó forma de tocar las preferencias del usuario cargado.
            // Sin esto, tras cambiar de tema el store conserva el valor viejo y
            // el selector muestra marcada la paleta anterior.
            //
            // MERGE PARCIAL a propósito: `preferencias` es JSONB y va a crecer.
            // Reemplazar el objeto completo haría que guardar el tema borrara
            // cualquier clave futura.
            //
            // NO llama a la Server Action: un store es estado de cliente. Quien
            // orquesta DOM + localStorage + store + BD es el ThemeToggler.
            // ═══════════════════════════════════════════════════════════════════
            actualizarPreferencias: (parciales) =>
                set((state) => {
                    // Puede llegar antes de que la sesión se rehidrate. Sin esta
                    // guarda se crearía un usuario a medias (con preferencias,
                    // sin id ni rol) que pasaría por válido.
                    if (!state.usuario) return {}

                    return {
                        usuario: {
                            ...state.usuario,
                            preferencias: { ...state.usuario.preferencias, ...parciales },
                        },
                    }
                }),

            // ═══════════════════════════════════════════════════════════════════
            // ⭐ GUÍA 0.7 — puedeVerPagina() y tienePermiso()
            //
            // Los helpers de consulta que la 0.5 no dejó: respuestas derivadas
            // del estado YA cargado (menu[]/permisos[] vinieron de la RPC al
            // loguear o rehidratar). Cero BD, cero red, O(n) sobre arrays
            // pequeños — instantáneos.
            //
            // FALLAN CERRADO a propósito: con el estado vacío (sesión sin
            // hidratar) devuelven false. El RBACGuard (Guía 0.7 Parte 2) se
            // apoya en eso para denegar antes que permitir.
            //
            // El menú ya viene FILTRADO por la BD (permisos_navegacion), así que
            // puedeVerPagina no repite filtrado: pregunta "¿el menú que la 0.4
            // me dio contiene esta URL?". Si no está, es la URL escrita a mano.
            //
            // NO se persisten: son derivados de datos que ya están en el
            // partialize. Persistirlos no agregaría nada y los dejaría
            // desactualizados en el storage.
            // ═══════════════════════════════════════════════════════════════════
            // ⭐ FIX 28 Ago 2026 (Guía 2.1 · rutas hijas): además del match EXACTO,
            // un submódulo cubre a sus descendientes — mismo criterio que
            // esRutaActiva() del Sidebar (0.6 P4). Sin esto, las primeras rutas
            // hijas/dinámicas del proyecto (/inventario/inventario-fisico/nuevo,
            // /[id], /capturar, /ajustar y las fichas [id] de Compras) caían a
            // /sin-acceso: el guard comparaba el pathname completo contra menu[]
            // (match exacto) y las hijas no son submódulos.
            //
            // ⚠️ La raíz `/dashboard` se EXCLUYE del prefijo a propósito: está en
            // el menú de TODOS los roles (0.4 P6) y con prefijo cubriría cualquier
            // ruta — neutralizaría el guard. Solo cubre por prefijo un submódulo
            // distinto de la raíz.
            puedeVerPagina: (href) =>
                get().menu.some(
                    (m) =>
                        m.href === href ||
                        (m.href !== '/dashboard' && href.startsWith(m.href + '/'))
                ),

            tienePermiso: (href, accion) =>
                get().permisos.some(
                    (p) => p.href === href && p.clave_accion === accion
                ),
        }),
        {
            name: 'erp-auth-storage',
            storage: createJSONStorage(() => localStorage),
            // ⭐ El persist se versiona para descartar estados viejos sin
            // contrato. Las sesiones persistidas antes de la Guía 0.6 pueden
            // traer forma antigua (usuario sin nombre_completo, filas de menu
            // sin nombre_modulo) que rompe Avatar y Sidebar. Al migrar se
            // devuelve el estado vacío: el AuthWrapper rehidrata desde la BD
            // (rehidratarSesionAction) y el storage se re-escribe con
            // version: 1 — el descarte ocurre una vez.
            //
            // NO sube a 2 en la 0.7: los helpers nuevos son métodos (no datos),
            // el JSON persistido no cambia de forma — no hay migración que hacer.
            version: 1,
            migrate: (persisted, storedVersion) => {
                if (storedVersion >= 1) return persisted as AuthState
                // El merge de zustand hace {...currentState, ...migrado}: las
                // acciones del store se conservan; aquí solo se devuelve el
                // estado de datos vacío para que rehidratarSesionAction llene.
                return {
                    isAuthenticated: false,
                    isLoading: true,
                    usuario: null,
                    menu: [],
                    permisos: [],
                } as unknown as AuthState
            },
            // isLoading NO se persiste — es volátil. Persistirla en true
            // dejaría un spinner infinito al restaurar la sesión.
            partialize: (state) => ({
                isAuthenticated: state.isAuthenticated,
                usuario: state.usuario,
                menu: state.menu,
                permisos: state.permisos,
            }),
        }
    )
)

// ═══════════════════════════════════════════════════════════════════
// HOOK SSR-SAFE — usar en todos los componentes del arbol SSR.
// useSyncExternalStore retorna snapshots del servidor (getInitialState)
// en el prerender y del cliente (getState) tras la hidratacion —
// eliminando el hydration mismatch de Zustand + persist + localStorage.
// ═══════════════════════════════════════════════════════════════════
export function useAuth<T>(selector: (state: AuthState) => T): T {
    return useSyncExternalStore(
        useAuthStoreBase.subscribe,
        () => selector(useAuthStoreBase.getState()),
        () => selector(useAuthStoreBase.getInitialState())
    )
}

// Selector del menú flat — el Sidebar de 0.6 lo agrupa él mismo (reduce)
export const menuAplanado = (state: AuthState) => state.menu

// Alias — útil en pantallas que necesitan varios valores del store a la vez
export const useAuthStore = () => useAuth(state => state)
