'use client'

// ============================================================================
// PERFIL PAGE — Guía 0.11 · self-service del usuario logueado
// Client Component: consume useAuth (store) y usePageConfig (Topbar).
// Protección de sesión heredada de /dashboard/layout.tsx (Guía 0.5).
//
// Frontera dura:
//   · Datos del usuario en SOLO LECTURA (nombre, correo, rol) — el CRUD
//     administrativo vive en /dashboard/sistema/usuarios (Guía 0.9).
//   · Único campo editable: contraseña — vía <PasswordChangeModal /> (MEJORA
//     21 Ago 2026: el formulario ya no está siempre visible, se abre bajo
//     demanda con un botón y una advertencia de riesgo).
//
// La ruta NO aparece en el Sidebar (no está en public.submodulos) — el
// acceso es exclusivo desde el UserMenu del Topbar (Guía 0.11 Parte 3 B1).
// ============================================================================

import { useState } from 'react'

import { useAuth } from '@/lib/stores/auth-store'
import { usePageConfig } from '@/hooks/usePageConfig'
import { PasswordChangeModal } from '@/components/auth/PasswordChangeModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Mail, Shield, KeyRound } from 'lucide-react'

export default function PerfilPage() {
    const usuario = useAuth((s) => s.usuario)

    // MEJORA 21 Ago 2026 — el cambio de contraseña vive en un modal que se
    // abre bajo demanda; la página ya no pinta el formulario siempre visible.
    const [modalAbierto, setModalAbierto] = useState(false)

    usePageConfig({
        info: { title: 'Mi perfil', subtitle: 'Datos de tu cuenta y seguridad' },
        path: '/dashboard/perfil',
        actions: [], // Sin acciones de Toolbar — la única "acción" es el modal
    })

    if (!usuario) return null

    return (
        <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Datos de la cuenta (solo lectura) ────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Datos de tu cuenta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <DatoLinea
                        icon={<User className="h-4 w-4" />}
                        label="Nombre"
                        value={usuario.nombre_completo}
                    />
                    <DatoLinea
                        icon={<Mail className="h-4 w-4" />}
                        label="Correo electrónico"
                        value={usuario.email}
                    />
                    <DatoLinea
                        icon={<Shield className="h-4 w-4" />}
                        label="Rol asignado"
                        value={usuario.rol.nombre}
                    />
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                        Para modificar tu nombre, correo o rol, contacta al administrador
                        del sistema.
                    </p>
                </CardContent>
            </Card>

            {/* ── Cambio de contraseña (bajo demanda — MEJORA 21 Ago) ─── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cambiar contraseña</CardTitle>
                    <CardDescription>Gestiona la contraseña de tu cuenta</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        onClick={() => setModalAbierto(true)}
                        aria-label="Abrir cambio de contraseña"
                    >
                        <KeyRound className="mr-2 h-4 w-4" />
                        Cambiar contraseña
                    </Button>
                </CardContent>
            </Card>

            <PasswordChangeModal
                open={modalAbierto}
                onOpenChange={setModalAbierto}
            />
        </div>
    )
}

// ── Fila de dato en solo lectura ────────────────────────────────────────
// Componente local — no se promueve a la 0.8 porque solo esta pantalla lo
// usa. Si un CRUD futuro necesita el mismo layout, la PROMOCIÓN aplica
// (regla del proyecto, README §4).
function DatoLinea({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-hover-background text-muted-foreground">
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground truncate">
                    {value}
                </p>
            </div>
        </div>
    )
}
