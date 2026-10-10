import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet, redirect } from '@tanstack/react-router'
import { refreshSession } from '@/lib/api/client'
import { useAuthStore } from '@/lib/auth/store'
import { AppShell } from '@/components/layout/AppShell'
import { ROLE_HOME } from '@/components/layout/nav'
import { NotFound } from '@/pages/NotFound'

/** Restaura la sesión desde la cookie de refresco (el access token vive en memoria). */
async function ensureSession() {
  const s = useAuthStore.getState()
  if (s.accessToken && s.user) return s.user
  await refreshSession()
  useAuthStore.getState().setReady()
  return useAuthStore.getState().user
}

const rootRoute = createRootRoute({ component: () => <Outlet />, notFoundComponent: NotFound })

const lazy = (loader: () => Promise<{ default: React.ComponentType }>) => lazyRouteComponent(loader, 'default')

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: typeof s.redirect === 'string' ? s.redirect : undefined }),
  component: lazy(() => import('@/pages/auth/LoginPage')),
})
const forgotRoute = createRoute({ getParentRoute: () => rootRoute, path: '/recuperar', component: lazy(() => import('@/pages/auth/ForgotPasswordPage')) })
const resetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/restablecer',
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({ token: typeof s.token === 'string' ? s.token : '' }),
  component: lazy(() => import('@/pages/auth/ResetPasswordPage')),
})
const publicStoryRoute = createRoute({ getParentRoute: () => rootRoute, path: '/historia/$token', component: lazy(() => import('@/pages/public/PublicStoryPage')) })

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ location }) => {
    const user = await ensureSession()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: AppShell,
})

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: () => {
    const u = useAuthStore.getState().user
    throw redirect({ to: ROLE_HOME(!!u?.workshopId, u?.permissions ?? []) })
  },
})

const page = <P extends string>(path: P, loader: () => Promise<{ default: React.ComponentType }>) =>
  createRoute({ getParentRoute: () => appRoute, path, component: lazy(loader) })

/** Parámetros opcionales de búsqueda (enlaces profundos entre pantallas). */
const optional = (...keys: string[]) => (s: Record<string, unknown>) =>
  Object.fromEntries(keys.map((k) => [k, typeof s[k] === 'string' ? (s[k] as string) : undefined])) as Record<string, string | undefined>

const dispatchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/asignaciones',
  validateSearch: optional('orderId'),
  component: lazy(() => import('@/pages/dispatch/DispatchPage')),
})
const ordersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ordenes',
  validateSearch: optional('productId', 'workshopId'),
  component: lazy(() => import('@/pages/orders/OrdersListPage')),
})

const routes = [
  page('/dashboard', () => import('@/pages/dashboard/OfficeDashboardPage')),
  page('/balanza', () => import('@/pages/scale/EntryPage')),
  page('/inventario', () => import('@/pages/inventory/InventoryPage')),
  dispatchRoute,
  page('/despachos', () => import('@/pages/dispatch/DispatchListPage')),
  ordersRoute,
  page('/ordenes/nueva', () => import('@/pages/orders/OrderCreatePage')),
  page('/ordenes/$orderId', () => import('@/pages/orders/OrderDetailPage')),
  page('/ordenes/$orderId/historia', () => import('@/pages/orders/StoryPage')),
  page('/recepciones', () => import('@/pages/reception/ReceptionQueuePage')),
  page('/aprobaciones', () => import('@/pages/approvals/ApprovalsPage')),
  page('/diferencias', () => import('@/pages/approvals/DiscrepanciesPage')),
  page('/taller', () => import('@/pages/workshop/WorkshopHomePage')),
  page('/taller/entregas', () => import('@/pages/workshop/WorkshopDispatchesPage')),
  page('/taller/entregas/$dispatchId', () => import('@/pages/workshop/DispatchConfirmPage')),
  page('/taller/ordenes', () => import('@/pages/workshop/WorkshopOrdersPage')),
  page('/taller/ordenes/$orderId', () => import('@/pages/workshop/WorkshopOrderPage')),
  page('/taller/solicitudes', () => import('@/pages/workshop/WorkshopRequestsPage')),
  page('/clientes', () => import('@/pages/customers/CustomersPage')),
  page('/clientes/$customerId', () => import('@/pages/customers/CustomerDetailPage')),
  page('/operaciones/$operationId', () => import('@/pages/customers/OperationPage')),
  page('/finanzas', () => import('@/pages/finance/FinancePage')),
  page('/productividad', () => import('@/pages/analytics/ProductivityPage')),
  page('/rentabilidad', () => import('@/pages/analytics/ProfitabilityPage')),
  page('/reportes', () => import('@/pages/analytics/ReportsPage')),
  page('/alertas', () => import('@/pages/alerts/AlertsPage')),
  page('/auditoria', () => import('@/pages/audit/AuditPage')),
  page('/administracion', () => import('@/pages/admin/AdminPage')),
  page('/catalogo', () => import('@/pages/catalog/CatalogPage')),
  page('/catalogo/$productId', () => import('@/pages/catalog/CatalogDetailPage')),
  page('/perfil', () => import('@/pages/auth/ProfilePage')),
]

const routeTree = rootRoute.addChildren([loginRoute, forgotRoute, resetRoute, publicStoryRoute, appRoute.addChildren([indexRoute, ...routes])])

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
