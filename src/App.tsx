import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { hasFeature } from './utils/permissions'
import type { FeatureKey } from './types'
import AppShell from './components/layout/AppShell'
import LoginPage      from './pages/LoginPage'
import HomePage       from './pages/HomePage'
import TaskListPage   from './pages/TaskListPage'
import TaskDetailPage from './pages/TaskDetailPage'
import SubmittedPage  from './pages/SubmittedPage'
import HistoryPage    from './pages/HistoryPage'
import ReviewPage     from './pages/ReviewPage'
import DashboardPage  from './pages/DashboardPage'
import StaffPage      from './pages/StaffPage'
import TasksAdminPage from './pages/TasksAdminPage'
import AssetPage        from './pages/AssetPage'
import BranchPage       from './pages/BranchPage'
import MaintenancePage  from './pages/MaintenancePage'
import LoanPage         from './pages/LoanPage'
import GoogleReviewPage from './pages/GoogleReviewPage'
import SchedulePage     from './pages/SchedulePage'
import SettingsPage     from './pages/SettingsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  if (!state.user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireFeature({ children, feature }: { children: React.ReactNode; feature: FeatureKey }) {
  const { state } = useApp()
  if (!state.user) return <Navigate to="/login" replace />
  if (!hasFeature(state.user, feature)) {
    const fallback = state.user.role === 'staff' ? '/' : '/dashboard'
    return <Navigate to={fallback} replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { state } = useApp()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<HomePage />} />
        <Route path="tasks" element={<TaskListPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="tasks/:id/submitted" element={<SubmittedPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="review"      element={<RequireFeature feature="review"><ReviewPage /></RequireFeature>} />
        <Route path="dashboard"   element={<RequireFeature feature="dashboard"><DashboardPage /></RequireFeature>} />
        <Route path="staff"       element={<RequireFeature feature="staff"><StaffPage /></RequireFeature>} />
        <Route path="tasks-admin" element={<RequireFeature feature="tasks-admin"><TasksAdminPage /></RequireFeature>} />
        <Route path="assets"       element={<RequireFeature feature="assets"><AssetPage /></RequireFeature>} />
        <Route path="branches"     element={<RequireFeature feature="branches"><BranchPage /></RequireFeature>} />
        <Route path="maintenance"  element={<RequireFeature feature="maintenance"><MaintenancePage /></RequireFeature>} />
        <Route path="loans"        element={<RequireFeature feature="loans"><LoanPage /></RequireFeature>} />
        <Route path="schedule"     element={<RequireFeature feature="schedule"><SchedulePage /></RequireFeature>} />
        <Route path="google-review" element={<GoogleReviewPage />} />
        <Route path="settings"      element={<SettingsPage />} />
        <Route path="*" element={<Navigate to={state.user?.role === 'staff' ? '/' : '/dashboard'} replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      {/* unstable_useTransitions={false} keeps navigation synchronous (v6 behaviour).
          The v7 default wraps history state in startTransition, which defers the
          route re-render and can make navigation appear to require a page refresh. */}
      <BrowserRouter unstable_useTransitions={false}>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
