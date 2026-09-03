import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { AuthProvider } from "./contexts/AuthContext"
import { Layout } from "./components/Layout"
import LoginPage from "./pages/LoginPage"
import DashboardPage from "./pages/DashboardPage"
import ArticlesPage from "./pages/ArticlesPage"
import PosPage from "./pages/PosPage"
import HistoryPage from "./pages/HistoryPage"
import ImportPage from "./pages/ImportPage"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/articles"
              element={
                <ProtectedRoute roles={["ADMIN", "EMPLOYEE"]}>
                  <ArticlesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route
              path="/import"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ImportPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
