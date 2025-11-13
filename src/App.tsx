import { Box, CircularProgress } from '@mui/material'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { GuestRoute } from './routes/GuestRoute'
import { ProtectedRoute } from './routes/ProtectedRoute'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const ProductManagementPage = lazy(() => import('./pages/ProductManagementPage'))
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'))
const ReceivingPage = lazy(() => import('./pages/ReceivingPage'))
const MarkdownsPage = lazy(() => import('./pages/MarkdownsPage'))
const ReplenishmentPage = lazy(() => import('./pages/ReplenishmentPage'))
const WastePage = lazy(() => import('./pages/WastePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const Loader = () => (
  <Box display="flex" justifyContent="center" py={4}>
    <CircularProgress />
  </Box>
)

const App = () => (
  <BrowserRouter>
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="products" element={<ProductManagementPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="receiving" element={<ReceivingPage />} />
          <Route path="markdowns" element={<MarkdownsPage />} />
          <Route path="replenishment" element={<ReplenishmentPage />} />
          <Route path="waste" element={<WastePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
)

export default App
