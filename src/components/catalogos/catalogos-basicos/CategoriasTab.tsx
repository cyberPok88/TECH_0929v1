'use client'

// CategoriasTab.tsx — Categorías y subcategorías (Guía 1.0 · P6, superficie custom)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Power } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable, ConfirmDialog, crearColumnaAcciones, TableSkeleton, useSeleccionTabla } from '@/components/data-table'
import type { ColumnDefExtension } from '@/types/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import type { AtributoEsquema, CategoriaFila } from '@/types/catalogos'
import type { SolicitudNueva } from './catalogos-config'
import {
  listarCategorias, crearCategoria, editarCategoria, cambiarEstadoCategoria,
} from '@/lib/actions/catalogos'
import { EsquemaAtributosEditor } from './EsquemaAtributosEditor'

type Columna = ColumnDef<CategoriaFila> & ColumnDefExtension<CategoriaFila>

interface ToggleState { id: string; activo: boolean }
interface ModalState { abierto: boolean; modo: 'crear' | 'editar'; registro?: CategoriaFila }

interface CategoriasTabProps {
  solicitudNuevo?: SolicitudNueva
}

export function CategoriasTab({ solicitudNuevo }: CategoriasTabProps) {
  const [filas, setFilas] = useState<CategoriaFila[]>([])
  const [estado, setEstado] = useState<'idle' | 'loading' | 'error'>('loading')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<ModalState>({ abierto: false, modo: 'crear' })
  const [toggle, setToggle] = useState<ToggleState | null>(null)
  const nuevoUltima = useRef(0)

  const cargar = useCallback(async () => {
    setEstado('loading')
    try {
      const res = await listarCategorias()
      if (res?.success) setFilas(res.data as CategoriaFila[])
      else setEstado('error')
    } catch { setEstado('error') } finally { setEstado('idle') }
  }, [])

  useEffect(() => {
    let activo = true
    const inicial = async () => {
      try {
        const res = await listarCategorias()
        if (!activo) return
        if (res?.success) { setFilas(res.data as CategoriaFila[]); setEstado('idle') }
        else setEstado('error')
      } catch {
        if (activo) setEstado('error')
      }
    }
    void inicial()
    return () => { activo = false }
  }, [])

  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of filas) m.set(f.id, f.nombre)
    return m
  }, [filas])

  const hijosPorPadre = useMemo(() => {
    const m = new Map<string, CategoriaFila[]>()
    for (const f of filas) {
      if (!f.id_categoria_padre) continue
      const arr = m.get(f.id_categoria_padre) ?? []
      arr.push(f)
      m.set(f.id_categoria_padre, arr)
    }
    return m
  }, [filas])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((f) => f.nombre.toLowerCase().includes(q))
  }, [filas, busqueda])

  const raices = useMemo(() => filas.filter((f) => !f.id_categoria_padre), [filas])

  const columnas = useMemo<Columna[]>(() => {
    const acciones = crearColumnaAcciones<CategoriaFila>({
      acciones: [
        { icon: Pencil, label: 'Editar', onClick: (f) => setModal({ abierto: true, modo: 'editar', registro: f }) },
        { icon: Power, label: 'Cambiar estado', onClick: (f) => setToggle({ id: f.id, activo: f.es_activo }) },
      ],
    })
    return [
      {
        accessorKey: 'nombre',
        header: 'Categoría',
        label: 'Categoría',
        render: (_v, fila: CategoriaFila) => (
          <span>{fila.id_categoria_padre ? `↳ ${fila.nombre}` : fila.nombre}</span>
        ),
      },
      {
        accessorKey: 'id_categoria_padre',
        header: 'Padre',
        label: 'Padre',
        render: (_v, fila: CategoriaFila) => (fila.id_categoria_padre ? nombrePorId.get(fila.id_categoria_padre) ?? '—' : '—'),
      },
      { accessorKey: 'orden', header: 'Orden', label: 'Orden', align: 'derecha' },
      {
        accessorKey: 'esquema_atributos',
        header: 'Atributos',
        label: 'Atributos',
        render: (v) => (Array.isArray(v) && v.length ? v.length : '—'),
      },
      { accessorKey: 'es_activo', header: 'Activo', label: 'Activo', render: (v) => (v ? 'Activo' : 'Inactivo') },
      acciones,
    ]
  }, [nombrePorId])

  const alExito = useCallback(() => {
    setModal((m) => ({ ...m, abierto: false }))
    void cargar()
  }, [cargar])

  const ejecutarToggle = useCallback(async () => {
    if (!toggle) return { error: null as string | null }
    const res = await cambiarEstadoCategoria(toggle.id, !toggle.activo)
    if (!res.success) return { error: res.error ?? 'No se pudo cambiar el estado' }
    setToggle(null)
    void cargar()
    return { error: null as string | null }
  }, [toggle, cargar])

  const { seleccion, onSeleccionChange } = useSeleccionTabla(visibles, (f) => f.id)

  // Toolbar "Nuevo" → abrir modal de crear (dirigida a esta pestaña)
  useEffect(() => {
    if (!solicitudNuevo || solicitudNuevo.tab !== 'categorias') return
    if (solicitudNuevo.seq === nuevoUltima.current) return
    nuevoUltima.current = solicitudNuevo.seq
    setModal({ abierto: true, modo: 'crear' })
  }, [solicitudNuevo])

  if (estado === 'loading' && filas.length === 0) return <TableSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input className="h-9 max-w-xs" placeholder="Buscar categoría" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <Button onClick={() => setModal({ abierto: true, modo: 'crear' })}>
          <Plus className="size-4" /> Nueva categoría
        </Button>
      </div>

      <DataTable
        columns={columnas}
        data={visibles}
        rowKey={(f) => f.id}
        estado={estado}
        emptyMessage="Sin categorías"
        onRetry={cargar}
        enableRowSelection
        rowSelection={seleccion}
        onRowSelectionChange={onSeleccionChange}
      />

      {modal.abierto && (
        <CategoriaModal
          key={`${modal.modo}-${modal.registro?.id ?? 'nuevo'}`}
          modo={modal.modo}
          registro={modal.registro}
          raices={raices}
          tieneHijos={(id) => (hijosPorPadre.get(id)?.length ?? 0) > 0}
          onClose={() => setModal((m) => ({ ...m, abierto: false }))}
          onExito={alExito}
        />
      )}

      <ConfirmDialog
        open={toggle !== null}
        onOpenChange={(v) => { if (!v) setToggle(null) }}
        titulo={toggle?.activo ? 'Desactivar categoría' : 'Activar categoría'}
        descripcion="¿Confirmas el cambio de estado de esta categoría?"
        onConfirm={ejecutarToggle}
      />
    </div>
  )
}

interface CategoriaModalProps {
  modo: 'crear' | 'editar'
  registro?: CategoriaFila
  raices: CategoriaFila[]
  tieneHijos: (id: string) => boolean
  onClose: () => void
  onExito: () => void
}

function CategoriaModal({ modo, registro, raices, tieneHijos, onClose, onExito }: CategoriaModalProps) {
  const esSub = Boolean(registro?.id_categoria_padre)
  const esHoja = modo === 'crear' || !tieneHijos(registro!.id)

  const [nombre, setNombre] = useState(registro?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(registro?.descripcion ?? '')
  const [orden, setOrden] = useState(registro?.orden ?? 0)
  const [idPadre, setIdPadre] = useState<string>(registro?.id_categoria_padre ?? '')
  const [activo, setActivo] = useState(registro?.es_activo ?? true)
  const [esquema, setEsquema] = useState<AtributoEsquema[]>(registro?.esquema_atributos ?? [])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const guardar = async () => {
    setError(null)
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setOcupado(true)
    const res = modo === 'crear'
      ? await crearCategoria({ nombre: nombre.trim(), descripcion, orden, id_categoria_padre: idPadre || null, esquema_atributos: esHoja ? esquema : [], es_activo: activo })
      : await editarCategoria(registro!.id, { nombre: nombre.trim(), descripcion, orden, id_categoria_padre: idPadre || null, esquema_atributos: esHoja ? esquema : [], es_activo: activo })
    setOcupado(false)
    if (!res.success) { setError(res.error ?? 'Error al guardar'); return }
    toast.success(modo === 'crear' ? 'Categoría creada' : 'Categoría actualizada')
    onExito()
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modo === 'crear' ? 'Nueva categoría' : 'Editar categoría'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={ocupado} />
          </div>
          <div className="grid gap-1.5">
            <Label>Descripción (opcional)</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={ocupado} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Jerarquía</Label>
              <Select value={idPadre} onValueChange={(v) => { setIdPadre(v); setEsquema([]) }} disabled={ocupado || esSub}>
                <SelectTrigger><SelectValue placeholder="Es categoría raíz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Es categoría raíz</SelectItem>
                  {raices.filter((r) => r.id !== registro?.id).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Orden</Label>
              <Input type="number" value={orden} onChange={(e) => setOrden(Number(e.target.value))} disabled={ocupado} />
            </div>
          </div>
          <label className="flex items-center justify-between rounded border p-3 text-sm">
            Activa
            <Switch checked={activo} onCheckedChange={setActivo} disabled={ocupado} />
          </label>
          {esHoja && (
            <div className="rounded border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Esquema de atributos (solo en hoja)</p>
              <EsquemaAtributosEditor value={esquema} onChange={setEsquema} />
            </div>
          )}
          {!esHoja && <p className="text-xs text-muted-foreground">Las categorías con subcategorías no llevan esquema propio (el esquema vive en las hojas).</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={ocupado}>Cancelar</Button>
          <Button onClick={guardar} disabled={ocupado}>{modo === 'crear' ? 'Crear' : 'Guardar cambios'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
