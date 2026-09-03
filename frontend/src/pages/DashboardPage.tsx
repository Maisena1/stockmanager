import { useAuth } from "../contexts/AuthContext"

export default function DashboardPage() {
  const { user } = useAuth()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-600">Bienvenido, {user?.username}</p>
    </div>
  )
}
