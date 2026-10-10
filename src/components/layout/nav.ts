import type { ComponentType } from 'react'
import {
  AlertTriangle, BadgeCheck, BarChart3, BookOpenText, Boxes, ClipboardCheck, ClipboardList, Coins, Factory, FileBarChart,
  FileSearch, Gauge, Handshake, Home, PackageCheck, Scale, Settings, Shield, Truck, Users, Wallet, Wrench,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Visible si el usuario tiene ALGUNO de estos permisos. */
  perms: string[]
  code?: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

/** Navegación de la Oficina Madre, agrupada por proceso (sección 12). */
export const OFFICE_NAV: NavSection[] = [
  {
    title: 'Control',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Gauge, perms: ['dashboard.office'], code: 'P02' },
      { to: '/aprobaciones', label: 'Aprobaciones', icon: BadgeCheck, perms: ['orders.approve', 'discrepancies.approve', 'labor.approve', 'requests.review'] },
      { to: '/alertas', label: 'Alertas', icon: AlertTriangle, perms: ['alerts.read'], code: 'P17' },
    ],
  },
  {
    title: 'Materiales',
    items: [
      { to: '/balanza', label: 'Entrada / Balanza', icon: Scale, perms: ['inventory.entry', 'scale.weigh'], code: 'P03' },
      { to: '/inventario', label: 'Inventario global', icon: Boxes, perms: ['inventory.read'], code: 'P04' },
      { to: '/asignaciones', label: 'Asignación a taller', icon: Truck, perms: ['orders.dispatch'], code: 'P05' },
    ],
  },
  {
    title: 'Producción',
    items: [
      { to: '/ordenes', label: 'Órdenes de producción', icon: ClipboardList, perms: ['orders.read'], code: 'P06' },
      { to: '/recepciones', label: 'Recepción y calidad', icon: PackageCheck, perms: ['orders.receive', 'quality.verify'], code: 'P11' },
      { to: '/diferencias', label: 'Mermas y diferencias', icon: ClipboardCheck, perms: ['orders.reconcile', 'discrepancies.approve'] },
      { to: '/catalogo', label: 'Catálogo técnico', icon: BookOpenText, perms: ['catalog.read'], code: 'P19' },
    ],
  },
  {
    title: 'Comercial y finanzas',
    items: [
      { to: '/clientes', label: 'Clientes y abonos', icon: Handshake, perms: ['customers.read'], code: 'P13' },
      { to: '/finanzas', label: 'Caja / Finanzas', icon: Wallet, perms: ['finance.read'], code: 'P14' },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { to: '/productividad', label: 'Productividad talleres', icon: Factory, perms: ['reports.read'], code: 'P15' },
      { to: '/rentabilidad', label: 'Rentabilidad', icon: Coins, perms: ['reports.financial'], code: 'P16' },
      { to: '/reportes', label: 'Reportes', icon: FileBarChart, perms: ['reports.read'] },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/administracion', label: 'Administración', icon: Settings, perms: ['masters.manage', 'users.manage', 'roles.manage', 'params.manage'], code: 'P18' },
      { to: '/auditoria', label: 'Auditoría', icon: Shield, perms: ['audit.read'] },
    ],
  },
]

/** Portal de taller: flujo mínimo de pasos (RNF-001). */
export const WORKSHOP_NAV: NavSection[] = [
  {
    title: 'Mi taller',
    items: [
      { to: '/taller', label: 'Inicio', icon: Home, perms: ['workshop.portal'], code: 'P07' },
      { to: '/taller/entregas', label: 'Entregas por confirmar', icon: Truck, perms: ['workshop.portal'], code: 'P08' },
      { to: '/taller/ordenes', label: 'Mis órdenes', icon: Wrench, perms: ['workshop.portal'], code: 'P09' },
      { to: '/taller/solicitudes', label: 'Solicitudes de material', icon: FileSearch, perms: ['workshop.portal'] },
      { to: '/alertas', label: 'Alertas', icon: AlertTriangle, perms: ['alerts.read'] },
    ],
  },
]

export const ROLE_HOME = (workshop: boolean, perms: string[]) =>
  workshop ? '/taller' : perms.includes('dashboard.office') ? '/dashboard' : perms.includes('orders.read') ? '/ordenes' : '/perfil'

export { BarChart3, Users }
