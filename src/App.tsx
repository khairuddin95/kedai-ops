import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import AppShell from './components/layout/AppShell'
import LoginPage      from './pages/LoginPage'
import HomePage       from './pages/HomePage'
import TaskListPage   from './pages/TaskListPage'
import TaskDetailPage from './pages/TaskDetailPage'
import SubmittedPage  from './pages/SubmittedPage'
import HistoryPage    from './pages/HistoryPage'
import ReviewPage     from './pages/ReviewPage'
import ReportsPage    from './pages/ReportsPage'
import StaffPage      from './pages/StaffPage'
import TasksAdminPage from './pages/TasksAdminPage'
import AssetPage        from './pages/AssetPage'
import BranchPage       from './pages/BranchPage'
import MaintenancePage          from './pages/MaintenancePage'
import MaintenanceDashboardPage from './pages/MaintenanceDashboardPage'
import LoanPage                 from './pages/LoanPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  if (!state.user) return <Navigate to="/login" replace />
  return <>{children}</>
}

type Role = 'staff' | 'supervisor' | 'owner'
function RequireRole({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const { state } = useApp()
  if (!state.user) return <Navigate to="/login" replace />
  if (!roles.includes(state.user.role as Role)) {
    const fallback = state.user.role === 'staff' ? '/' : state.user.role === 'supervisor' ? '/review' : '/reports'
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
        <Route path="review"      element={<RequireRole roles={['supervisor','owner']}><ReviewPage /></RequireRole>} />
        <Route path="reports"     element={<RequireRole roles={['supervisor','owner']}><ReportsPage /></RequireRole>} />
        <Route path="staff"       element={<RequireRole roles={['owner']}><StaffPage /></RequireRole>} />
        <Route path="tasks-admin" element={<RequireRole roles={['supervisor','owner']}><TasksAdminPage /></RequireRole>} />
        <Route path="assets"       element={<RequireRole roles={['supervisor','owner']}><AssetPage /></RequireRole>} />
        <Route path="branches"     element={<RequireRole roles={['owner']}><BranchPage /></RequireRole>} />
        <Route path="maintenance"      element={<RequireRole roles={['supervisor','owner']}><MaintenancePage /></RequireRole>} />
        <Route path="maintenance-dash" element={<RequireRole roles={['supervisor','owner']}><MaintenanceDashboardPage /></RequireRole>} />
        <Route path="loans"        element={<RequireRole roles={['supervisor','owner']}><LoanPage /></RequireRole>} />
        <Route path="*" element={<Navigate to={state.user?.role === 'staff' ? '/' : state.user?.role === 'supervisor' ? '/review' : '/reports'} replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
