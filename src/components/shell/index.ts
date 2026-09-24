// ═══════════════════════════════════════════════════════════════════════════════
// BARREL DEL APP SHELL — Guía 0.6 · +seguridad RBAC (Guía 0.7)
//
// Punto único de importación:
//   import { Sidebar, Topbar, Toolbar, Footer } from '@/components/shell'
//
// Re-exports estáticos: el bundler los resuelve sin ejecutar módulos, así que
// el tree-shaking se mantiene. (El patrón problemático es `export *` sobre
// módulos con efectos secundarios — aquí no hay ninguno.)
//
// Cada archivo conserva su propia directiva.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Estructura ─────────────────────────────────────────────────────────────────
export { Sidebar } from './Sidebar'
export { Topbar } from './Topbar'
export { Toolbar } from './Toolbar'
export { FiltrosBar } from './FiltrosBar'   // decisión 25 (01 Sep 2026) — lo consume el layout
export { Footer } from './Footer'

// ── Tema ───────────────────────────────────────────────────────────────────────
// NOTA: ThemeInjector fue removido del barrel porque usa next/headers (Server Only)
// y contaminaba los Client Components que importaban desde '@/components/shell'.
// Debe importarse directamente desde su archivo.
export { ThemeToggler } from './ThemeToggler'

// ── Piezas reutilizables ───────────────────────────────────────────────────────
export { Avatar, obtenerIniciales } from './Avatar'
export { EstadoBadge, ESTADO_TEXTO } from './EstadoBadge'
export { PlaceholderModule } from './PlaceholderModule'

// ── Navegación ─────────────────────────────────────────────────────────────────
export { NavItem } from './nav/NavItem'
export { NavGroup } from './nav/NavGroup'

// ── Seguridad RBAC (Guía 0.7) ──────────────────────────────────────────────────
// RBACGuard: el layout lo importa DIRECTO (ver Bloque 1) — su export aquí es
// para consumo futuro fuera del dashboard. ProtectedAction: lo usan las guías
// CRUD (1.0+) para proteger una acción que no pasa por el Toolbar.
export { RBACGuard } from './RBACGuard'
export { ProtectedAction } from './ProtectedAction'
