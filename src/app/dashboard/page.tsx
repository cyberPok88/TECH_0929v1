'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// HOME DEL DASHBOARD — Guía 0.6 · Parte 5
//
// Reemplaza el placeholder de validación de la Guía 0.5.
//
// El corazón de esta página es el PANEL DE SESIÓN VIVA: la única pantalla donde
// se ve, sin abrir DevTools, qué decidió la BD sobre este usuario. Cambiar su
// rol cambia esos números solos — es la aserción 2 de la verificación funcional
// hecha visible.
//
// El dashboard real (métricas, gráficas) es V2 — CONTEXTO §8. Aquí solo Shell.
// ═══════════════════════════════════════════════════════════════════════════════

import { Banknote, Package, Receipt, Users } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useAuth } from '@/lib/stores/auth-store'
import { formatearFechaLarga, formatearMoneda } from '@/lib/utils/formatters'

// ⚠️ DATOS DE EJEMPLO — no hay una sola fila de negocio en la BD todavía.
// Van rotulados en pantalla a propósito: un "$182,450.00" sin rótulo se toma
// por real en la primera demostración, y esa confianza no se recupera después.
const KPI_EJEMPLO = [
    { id: 'ventas', etiqueta: 'Ventas del día', valor: formatearMoneda(182450), icon: Receipt },
    { id: 'cobrado', etiqueta: 'Cobrado en campo', valor: formatearMoneda(64300), icon: Banknote },
    { id: 'clientes', etiqueta: 'Clientes activos', valor: '54', icon: Users },
    { id: 'stock', etiqueta: 'Productos con stock bajo', valor: '12', icon: Package },
] as const

export default function DashboardPage() {
    // ⚠️ SIEMPRE antes de cualquier return condicional: React exige que el
    // orden de los hooks sea idéntico en todos los renders.
    usePageConfig({
        info: { title: 'Panel', subtitle: 'Resumen general del sistema' },
        path: '/dashboard',
    })

    const usuario = useAuth((s) => s.usuario)
    const menu = useAuth((s) => s.menu)
    const permisos = useAuth((s) => s.permisos)

    if (!usuario) return null

    // Los módulos no vienen contados por la BD: el menú llega plano y se
    // deduplica igual que hace el reduce del Sidebar.
    const totalModulos = new Set(menu.map((m) => m.nombre_modulo)).size

    return (
        <div className="animate-fade-up space-y-6">

            {/* ─── Saludo ──────────────────────────────────────────────────── */}
            <div>
                <h1 className="font-display text-2xl font-semibold text-foreground">
                    Hola, {usuario.nombre_completo}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {formatearFechaLarga(new Date())} · {usuario.rol.nombre}
                </p>
            </div>

            {/* ─── ⭐ SESIÓN VIVA — la prueba visible del RBAC ─────────────── */}
            <Card>
                <CardContent className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                        <h2 className="text-sm font-semibold text-foreground">Sesión activa</h2>
                        <span className="text-xs text-muted-foreground">
                            — todo lo de abajo lo decidió la base de datos
                        </span>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                        <div>
                            <dt className="text-xs text-muted-foreground">Rol</dt>
                            <dd className="mt-0.5 text-sm font-medium text-foreground">
                                {usuario.rol.nombre}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Nivel jerárquico</dt>
                            <dd className="mt-0.5 font-mono text-sm font-medium text-foreground">
                                {usuario.rol.nivel_jerarquico}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Alcance de datos</dt>
                            <dd className="mt-0.5 text-sm font-medium capitalize text-foreground">
                                {usuario.alcance_datos ?? 'todos'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Módulos visibles</dt>
                            <dd className="mt-0.5 font-mono text-sm font-medium text-foreground">
                                {totalModulos}
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                    / {menu.length} rutas
                                </span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Permisos de acción</dt>
                            <dd className="mt-0.5 font-mono text-sm font-medium text-foreground">
                                {permisos.length}
                            </dd>
                        </div>
                    </dl>

                    <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                        El menú lateral no está escrito en el código: proviene de estas mismas
                        rutas. Cambiar el rol de este usuario cambia lo que ve, sin recompilar.
                    </p>
                </CardContent>
            </Card>

            {/* ─── KPI de ejemplo ──────────────────────────────────────────── */}
            <div>
                <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Resumen operativo</h2>
                    {/* El rótulo es obligatorio, no decorativo. */}
                    <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
                        Datos de ejemplo
                    </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {KPI_EJEMPLO.map((kpi) => {
                        const Icon = kpi.icon
                        return (
                            <Card key={kpi.id}>
                                <CardContent className="flex items-center gap-4 p-5">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-bg text-primary">
                                        <Icon className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-xs text-muted-foreground">
                                            {kpi.etiqueta}
                                        </p>
                                        {/* font-mono: Inter trae números tabulares, pero el
                                            mono alinea mejor en tarjetas de ancho variable. */}
                                        <p className="mt-0.5 truncate font-mono text-lg font-semibold text-foreground">
                                            {kpi.valor}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                    Las métricas reales llegan con los módulos de negocio (Guías 1.0 a 2.4).
                    Esta retícula ya está lista para recibirlas.
                </p>
            </div>
        </div>
    )
}
