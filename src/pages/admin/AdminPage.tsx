import { useEffect, useState, type ComponentType } from 'react'
import { Boxes, Coins, Factory, Gem, Layers, ListChecks, MapPin, Settings2, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'
import { useUser } from '@/lib/auth/store'
import { PageHeader } from '@/components/domain/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { WorkshopsTab } from './components/WorkshopsTab'
import { MaterialsTab } from './components/MaterialsTab'
import { ProductsTab } from './components/ProductsTab'
import { StagesTab } from './components/StagesTab'
import { VariablesTab } from './components/VariablesTab'
import { UsersTab } from './components/UsersTab'
import { RolesTab } from './components/RolesTab'
import { LocationsTab } from './components/LocationsTab'
import { ParametersTab } from './components/ParametersTab'
import { FinanceMastersTab } from './components/FinanceMastersTab'

interface TabDef { key: string; label: string; perm: string; icon: ComponentType<{ className?: string }>; Component: ComponentType }

const TABS: TabDef[] = [
  { key: 'talleres', label: 'Talleres', perm: 'masters.manage', icon: Factory, Component: WorkshopsTab },
  { key: 'materiales', label: 'Materiales', perm: 'masters.manage', icon: Boxes, Component: MaterialsTab },
  { key: 'productos', label: 'Productos', perm: 'masters.manage', icon: Gem, Component: ProductsTab },
  { key: 'etapas', label: 'Etapas', perm: 'masters.manage', icon: Layers, Component: StagesTab },
  { key: 'variables', label: 'Variables', perm: 'masters.manage', icon: ListChecks, Component: VariablesTab },
  { key: 'usuarios', label: 'Usuarios', perm: 'users.manage', icon: Users, Component: UsersTab },
  { key: 'roles', label: 'Roles', perm: 'roles.manage', icon: ShieldCheck, Component: RolesTab },
  { key: 'ubicaciones', label: 'Ubicaciones', perm: 'masters.manage', icon: MapPin, Component: LocationsTab },
  { key: 'parametros', label: 'Parámetros', perm: 'params.manage', icon: SlidersHorizontal, Component: ParametersTab },
  { key: 'finanzas', label: 'Pagos y categorías', perm: 'masters.manage', icon: Coins, Component: FinanceMastersTab },
]

const STORAGE = 'prestige.admin.tab'

/** P18 · Administración: maestros, usuarios, roles y parámetros sin código (RF-037/038, RN-018, CA-012). */
export default function AdminPage() {
  const user = useUser()
  const visible = TABS.filter((t) => user?.permissions.includes(t.perm))
  const initial = (() => {
    const fromHash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    let saved = ''
    try {
      saved = localStorage.getItem(STORAGE) ?? ''
    } catch {
      /* almacenamiento no disponible */
    }
    return [fromHash, saved].find((k) => visible.some((t) => t.key === k)) ?? visible[0]?.key ?? ''
  })()
  const [tab, setTab] = useState(initial)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, tab)
    } catch {
      /* ignorar */
    }
    if (tab) window.history.replaceState(window.history.state, '', `#${tab}`)
  }, [tab])

  return (
    <div>
      <PageHeader code="P18" title="Administración" description="Talleres, materiales, productos, estándares, usuarios, roles y parámetros. Todo se configura sin modificar el sistema." />
      {visible.length === 0 ? (
        <EmptyState icon={Settings2} title="Sin acceso a administración" description="Su rol no tiene permisos de administración de maestros, usuarios, roles o parámetros." />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="mb-5 min-w-max">
              {visible.map((t) => (
                <TabsTrigger key={t.key} value={t.key} data-testid={`admin-tab-${t.key}`}>
                  <t.icon className="size-3.5" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {visible.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <t.Component />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
