'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SIN ACCESO — Guía 0.7 · Página sumidero del RBAC
//
// El único destino al que el RBACGuard navega (router.replace) y la única
// ruta exenta de su filtro (RUTAS_PUBLICAS, Bloque 1 de esta parte).
//
// Vive DENTRO del layout del dashboard a propósito (Decisión 15): el Shell
// completo sigue visible — Sidebar, Topbar, Toolbar — porque el sistema
// funciona; lo que se negó es el permiso de ESTE usuario sobre ESTA sección.
// Un rechazo a pantalla completa se leería como "el sistema se cayó".
//
// Sin guard, obvio: no puede consultarse a sí misma — sería un bucle. Si un
// usuario con permiso la visita a mano, verá este escrito y nada se rompe.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { House, LogOut, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { usePageConfig } from '@/hooks/usePageConfig'
import { cerrarSesionAction } from '@/lib/actions/auth'
import { useAuth, useAuthStoreBase } from '@/lib/stores/auth-store'

export default function SinAccesoPage() {
    // ⚠️ SIEMPRE antes de cualquier return condicional: React exige que el
    // orden de los hooks sea idéntico en todos los renders.
    usePageConfig({
        info: { title: 'Sin acceso', subtitle: 'Permiso denegado' },
        path: '/dashboard/sin-acceso',
    })

    const router = useRouter()
    const usuario = useAuth((s) => s.usuario)

    const [saliendo, setSaliendo] = useState(false)

    // El patrón de salida lo copia literal del Topbar (0.6): la acción borra
    // la cookie PRIMERO; limpiar el store antes dejaría /login montándose con
    // el store aún autenticado y AuthWrapper rebotaría al dashboard.
    const salir = async () => {
        setSaliendo(true)
        const resultado = await cerrarSesionAction()

        if (!resultado.success) {
            toast.error(resultado.error ?? 'No se pudo cerrar la sesión')
            setSaliendo(false)
            return
        }

        useAuthStoreBase.getState().clearAuth()
        router.push('/login')
    }

    if (!usuario) return null

    return (
        <div className="animate-fade-up flex min-h-full flex-col items-center justify-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-destructive-bg text-destructive">
                <ShieldAlert className="h-7 w-7" aria-hidden="true" />
            </span>

            <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
                Sin acceso
            </h1>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Tu rol <span className="font-medium text-foreground">{usuario.rol.nombre}</span>{' '}
                no puede ver esta sección. Si necesitas entrar, pide al administrador
                que ajuste tus permisos.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                    <House aria-hidden="true" />
                    Volver al inicio
                </Button>
                <Button variant="destructive" onClick={salir} disabled={saliendo}>
                    <LogOut aria-hidden="true" />
                    Cerrar sesión
                </Button>
            </div>
        </div>
    )
}
