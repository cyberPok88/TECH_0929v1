'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RBAC GUARD — Guía 0.7 · Componente de seguridad
//
// La capa 4 de la defensa (diagrama de 5 capas de la Parte 0):
//   1. proxy.ts    — Edge, sobre peticiones HTTP. No ve la navegación SPA.
//   2. layout.tsx  — servidor: solo entra sesión válida (Guía 0.6).
//   3. AuthWrapper — cliente: hidrata el store y cubre el logout multipestaña.
//   4. ESTE GUARD  — cliente, POR URL, contra el menu[] que inyectó la BD (0.4).
//   5. RLS         — la BD como último juez en cada query (Guía 0.4).
//
// Por qué NO en proxy.ts (Decisión 6): el Edge no ve los clicks de la SPA ni
// tiene los permisos — viven en el store del cliente (vinieron por la RPC al
// loguear). Este componente sí ve el 100% de las navegaciones.
//
// Pregunta única: ¿la URL actual está en el menú que la BD le dio a este
// usuario? El menú llega filtrado (permisos_navegacion), así que "no está"
// solo puede significar URL escrita a mano o rol sin permiso. Ambas se tratan
// igual: navegar al sumidero.
//
// ⭐ GUÍA 0.8 — cambio de SOLO DATOS (sin lógica):
//   RUTAS_PUBLICAS agrega '/dashboard/pruebas' — la página de prueba de los
//   componentes de la 0.8 (mapa §9.2: "Demo funcional en página de prueba").
//   No está en menu[] (no se crea BD) y puedeVerPagina falla cerrado, así que
//   necesita la exención. NO se toca nada más de este archivo.
// ⭐ GUÍA 0.11 — misma exención para '/dashboard/perfil' (self-service):
//   la ruta NO se siembra en public.submodulos (Decisión D8 — cambiar la propia
//   contraseña es derecho universal, no algo que un rol pueda quitar). No está
//   en menu[] → puedeVerPagina falla cerrado → necesita la exención. Mismo
//   patrón de datos que la 0.8, sin tocar la lógica del guard.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuthStoreBase } from '@/lib/stores/auth-store'

// Única exención de la defensa: la página del rechazo no puede consultarse a
// sí misma. Un rol sin acceso a una sección llega aquí y ve el escrito de
// denegación — el mismo mundo que el guard quiere enseñar.
// ⭐ 0.8: + '/dashboard/pruebas' (demo de componentes, sin BD, fuera del menú).
// ⭐ 0.11: + '/dashboard/perfil' (self-service de contraseña, sin BD, fuera del menú).
// ⭐ 2.1 (28 Ago 2026): + '/dashboard/inventario/kardex' — ruta DINÁMICA sin
//   submódulo (D1 del mapa · se llega desde la ficha del producto y por URL).
//   No está en menu[] → puedeVerPagina falla cerrado → necesita la exención.
//   El DATO sigue protegido: obtenerKardexProducto() pasa por RLS
//   (tiene_permiso_accion('ver' en existencias/movimientos/kardex)).
export const RUTAS_PUBLICAS = [
    '/dashboard/sin-acceso',
    '/dashboard/pruebas',
    '/dashboard/perfil',
    '/dashboard/inventario/kardex',
] as const

// Suscripción vacía: un booleano de hidratación no cambia — solo se inicia.
// useSyncExternalStore la exige por firma; nunca emite eventos.
const subscribe = () => () => {}
// Snapshot del CLIENTE: siempre true. Es la fuente tras la hidratación.
const getClientSnapshot = () => true
// Snapshot del SERVIDOR: false. El prerender no evalúa permisos ni pinta.
const getServerSnapshot = () => false

export function RBACGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    // ⭐ HIDRATACIÓN (Decisión 7): useSyncExternalStore, NO useState + useEffect.
    // El prerender lee getServerSnapshot (false) y el cliente, tras hidratar,
    // lee getClientSnapshot (true). Es un booleano constante, sin snapshots
    // obsoletas — el riesgo de la V6 aplicaba a datos de sesión, no a esto.
    // Ningún setState en efecto: la regla react-hooks/set-state-in-effect
    // (activada por eslint-config-next) prohíbe el patrón de la V6.
    const isClient = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

    // Selector reactivo: re-evalúa cuando menu[] cambia (setSesion, clearAuth,
    // rehidratación al volver de otra pestaña). Falla cerrado por diseño
    // (Parte 1): con el store vacío devuelve false — por eso el render exige
    // además isClient antes de decidir.
    const puedeVer = useAuthStoreBase((s) => s.puedeVerPagina(pathname))

    // UN SOLO efecto (Decisión 8), guardado por isClient: evalúa la ruta y, si
    // es URL escrita a mano sin permiso, encola el salto. No pinta contenido
    // ni actualiza estado — navega nada más. El anti-parpadeo vive en el
    // render de abajo (Decisión 9): mientras no haya veredicto, nada se pinta.
    useEffect(() => {
        if (!isClient) return

        // ⭐ 2.1 (28 Ago 2026): prefix-aware — '/dashboard/inventario/kardex'
        // es exención y sus URLs dinámicas llevan /{id_producto} después.
        const esPublica = RUTAS_PUBLICAS.some(
            (r) => pathname === r || pathname.startsWith(r + '/')
        )

        if (!esPublica && !puedeVer) {
            // replace, no push: el rechazo no debe quedar en el historial.
            // "Atrás" no devuelve al usuario a la página que se le negó.
            router.replace('/dashboard/sin-acceso')
        }
    }, [isClient, pathname, puedeVer, router])

    // SSR-safe: en el prerender isClient es false y el <main> queda vacío
    // hasta que el cliente verifica. Nunca se envía HTML prohibido al server.
    if (!isClient) return null

    // ⭐ 2.1 (28 Ago 2026): prefix-aware — ver nota en el useEffect.
    const esPublica = RUTAS_PUBLICAS.some(
        (r) => pathname === r || pathname.startsWith(r + '/')
    )

    if (!esPublica && !puedeVer) {
        // El salto ya quedó encolado por el efecto; aquí solo se evita pintar
        // el contenido prohibido durante el frame de espera. La evaluación se
        // repite en el render, sin estado intermedio: nada prohibido se pinta
        // nunca, ni un frame (Decisión 9).
        return null
    }

    return <>{children}</>
}
