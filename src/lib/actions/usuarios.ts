// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — USUARIOS (Guía 0.9)
// 'use server' en la línea 1: obligatorio, sin comentarios ni espacios antes.
// Retornan objetos tipados — NUNCA throw (Decisión 16).
//
//   Parte 1: listarUsuarios · listarRolesParaSelector
//   Parte 2: + crearUsuario
//   Parte 3 (aquí): + editarUsuario · cambiarEstadoUsuario · archivarUsuario ·
//                   + cambiarPasswordUsuario (MEJORA 21 Ago) · ⭐ cambiarRolUsuarios
//                   (ENRIQUECIMIENTO 02 Sep — bulk "Cambiar rol")
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { passwordSchema } from '@/lib/validations/password'
import { usuarioCrearSchema, usuarioEditarSchema } from '@/lib/validations/usuarios'
import type { UsuarioCrearInput, UsuarioEditarInput } from '@/lib/validations/usuarios'
import type {
    UsuarioLista,
    RolOpcion,
    FiltrosUsuario,
    RespuestaLista,
    RespuestaAccion,
} from '@/types/usuarios'

// Forma cruda del embed PostgREST: usuarios + roles(nombre) anidado.
interface FilaUsuarioCruda {
    id: string
    nombre_completo: string
    email: string
    telefono: string | null
    id_rol: string
    es_activo: boolean
    es_archivado: boolean
    // ⭐ ENRIQUECIMIENTO 02 Sep 2026 (paridad con la Parte 1 enriquecida)
    es_admin_principal: boolean
    created_at: string
    updated_at: string
    roles: { nombre: string } | null
}

// Traductor de errores de PostgreSQL a mensaje legible.
// ⭐ Decisión 9: los mensajes de tr_usuarios_proteger_columnas se propagan TAL
// CUAL (llegan como P0001 con texto en español). Solo se traduce lo que PG
// devuelve como código sin frase de negocio: correo duplicado y rol inexistente.
function traducirErrorUsuario(codigo: string | undefined, mensaje: string): string {
    if (codigo === '23505') return 'Ya existe un usuario con ese correo.'
    if (codigo === '23503') return 'El rol seleccionado no existe.'
    return mensaje
}

// ── Listar usuarios ─────────────────────────────────────────────────────────
export async function listarUsuarios(
    filtros: FiltrosUsuario
): Promise<RespuestaLista<UsuarioLista>> {
    const supabase = await createClient()

    let query = supabase
        .from('usuarios')
        .select(
            'id, nombre_completo, email, telefono, id_rol, es_activo, es_archivado, es_admin_principal, created_at, updated_at, roles(nombre)'
        )

    // ⭐ MEJORA 20 Ago 2026 — 'todos' incluye archivados. Antes caía en el
    // else y aplicaba es_archivado=false, así que "Todos" seguía ocultándolos.
    // Ahora solo 'activo'/'inactivo' excluyen archivados; 'todos' los muestra
    // (default de la pantalla: ver siempre a los usuarios, incluidos archivados).
    if (filtros.estado === 'archivados') {
        query = query.eq('es_archivado', true)
    } else if (filtros.estado === 'activo') {
        query = query.eq('es_archivado', false).eq('es_activo', true)
    } else if (filtros.estado === 'inactivo') {
        query = query.eq('es_archivado', false).eq('es_activo', false)
    }
    // 'todos' → sin filtro de estado: activos + inactivos + archivados.

    if (filtros.idRol) query = query.eq('id_rol', filtros.idRol)

    const { data, error } = await query.order('nombre_completo', { ascending: true })
    if (error) return { success: false, error: error.message }

    const filas = (data ?? []) as unknown as FilaUsuarioCruda[]
    const usuarios: UsuarioLista[] = filas.map((f) => ({
        id: f.id,
        nombre_completo: f.nombre_completo,
        email: f.email,
        telefono: f.telefono,
        id_rol: f.id_rol,
        rol_nombre: f.roles?.nombre ?? '—',
        es_activo: f.es_activo,
        es_archivado: f.es_archivado,
        es_admin_principal: f.es_admin_principal,
        created_at: f.created_at,
        updated_at: f.updated_at,
    }))

    return { success: true, data: usuarios }
}

// ── Roles para el <select> (frontera 0.10: solo lectura) ────────────────────
export async function listarRolesParaSelector(): Promise<RespuestaLista<RolOpcion>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('roles')
        .select('id, nombre')
        .order('nivel_jerarquico', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as RolOpcion[] }
}

// ── Crear usuario — DOS SISTEMAS, UNA OPERACIÓN (Decisiones 2, 3, 5 · R1) ────
export async function crearUsuario(input: UsuarioCrearInput): Promise<RespuestaAccion> {
    const parsed = usuarioCrearSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const datos = parsed.data
    const email = datos.email.trim().toLowerCase()

    const supabase = await createClient()

    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const admin = createAdminClient()
    const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
        email,
        password: datos.password,
        email_confirm: true,
        app_metadata: { alta_admin: true },
    })

    if (errorAuth || !creado?.user) {
        const msg = errorAuth?.message ?? ''
        if (msg.includes('already been registered') || msg.includes('already registered')) {
            return { success: false, error: 'Ya existe un usuario con ese correo.' }
        }
        return { success: false, error: msg || 'No se pudo crear la cuenta de acceso.' }
    }

    const uid = creado.user.id

    const { error: errorPerfil } = await supabase.from('usuarios').insert({
        id: uid,
        id_rol: datos.id_rol,
        nombre_completo: datos.nombre_completo.trim(),
        email,
        telefono: datos.telefono?.trim() || null,
        es_activo: datos.es_activo,
    })

    if (errorPerfil) {
        // ⭐ COMPENSACIÓN (Decisión 3 · R1): sin transacción entre auth y public,
        // un perfil que falla deja un auth.user huérfano que quema el correo.
        await admin.auth.admin.deleteUser(uid)
        return {
            success: false,
            error: traducirErrorUsuario(errorPerfil.code, errorPerfil.message),
        }
    }

    return { success: true }
}

// ── Editar usuario (Decisión 7 · R3: correo inmutable, no se envía) ──────────
export async function editarUsuario(
    id: string,
    input: UsuarioEditarInput
): Promise<RespuestaAccion> {
    const parsed = usuarioEditarSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const datos = parsed.data

    const supabase = await createClient()
    // El UPDATE NO incluye email: es espejo de auth.users.email (Decisión 7).
    const { error } = await supabase
        .from('usuarios')
        .update({
            nombre_completo: datos.nombre_completo.trim(),
            telefono: datos.telefono?.trim() || null,
            id_rol: datos.id_rol,
            es_activo: datos.es_activo,
        })
        .eq('id', id)

    // Si el admin se edita a sí mismo y cambia su rol o su es_activo, el trigger
    // tr_usuarios_proteger_columnas lanza su excepción; el mensaje se propaga
    // tal cual (Decisión 9). La UI ya deshabilita la fila propia — esto es la red.
    if (error) return { success: false, error: traducirErrorUsuario(error.code, error.message) }
    return { success: true }
}

// ── Activar / Desactivar (R4: reversible, no toca es_archivado) ─────────────
export async function cambiarEstadoUsuario(
    id: string,
    esActivo: boolean
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const { error } = await supabase.from('usuarios').update({ es_activo: esActivo }).eq('id', id)
    if (error) return { success: false, error: traducirErrorUsuario(error.code, error.message) }
    return { success: true }
}

// ── Archivar / Desarchivar (soft-delete · R5) ───────────────────────────────
// Archivar APAGA: es_archivado = true implica es_activo = false en el mismo
// UPDATE. Desarchivar solo levanta es_archivado; reactivar es un paso aparte.
export async function archivarUsuario(
    id: string,
    esArchivado: boolean
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const patch = esArchivado
        ? { es_archivado: true, es_activo: false }
        : { es_archivado: false }

    const { error } = await supabase.from('usuarios').update(patch).eq('id', id)
    if (error) return { success: false, error: traducirErrorUsuario(error.code, error.message) }
    return { success: true }
}

// ── Cambiar contraseña de un usuario (admin · Guía 0.9 MEJORA) ────────────
// Restablece el password en auth.users con service_role (mismo patrón de
// crearUsuario). Marca password_changed_once = true (contrato 0.11): el admin
// entrega una contraseña funcional, el "primer ingreso" ya no aplica.
export async function cambiarPasswordUsuario(
    id: string,
    nuevaPassword: string
): Promise<RespuestaAccion> {
    const parsed = passwordSchema.safeParse(nuevaPassword)
    if (!parsed.success) {
        return { success: false, error: 'La contraseña no cumple con los requisitos de seguridad.' }
    }

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    // ⭐ Defensa real (patrón del proyecto): el admin no cambia su propia
    // contraseña desde el CRUD — eso vive en /dashboard/perfil (0.11).
    if (id === sesion.user.id) {
        return { success: false, error: 'Usa "Mi perfil" para cambiar tu propia contraseña.' }
    }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(id, {
        password: nuevaPassword,
        // user_metadata (no `data`): GoTrueAdminApi omite UserAttributes.data —
        // el metadata del admin API vive en user_metadata (types.d.ts §AdminUserAttributes).
        user_metadata: { password_changed_once: true },
    })

    if (error) {
        return { success: false, error: error.message || 'No se pudo cambiar la contraseña.' }
    }
    return { success: true }
}

// ── Cambiar rol en masa (⭐ ENRIQUECIMIENTO 02 Sep 2026 · bulk "Cambiar rol") ──
// Reasigna id_rol a N usuarios seleccionados con UN UPDATE. Bajo RLS
// (usuarios_admin_update exige es_administrador) y con la misma red del
// trigger tr_usuarios_proteger_columnas: si la selección incluyera tu propia
// cuenta, el trigger lanzaría su excepción — la UI ya la excluye (cortesía).
export async function cambiarRolUsuarios(
    ids: string[],
    idRol: string
): Promise<RespuestaAccion> {
    if (ids.length === 0) return { success: false, error: 'Selecciona al menos un usuario.' }

    const supabase = await createClient()
    const { error } = await supabase
        .from('usuarios')
        .update({ id_rol: idRol })
        .in('id', ids)

    if (error) return { success: false, error: traducirErrorUsuario(error.code, error.message) }
    return { success: true }
}
