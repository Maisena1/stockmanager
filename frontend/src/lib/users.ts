import { api } from "./api"

export type UserRole = "ADMIN" | "EMPLOYEE"

export interface ManagedUser {
  id: number
  username: string
  role: UserRole
  active: boolean
  phone: string | null
  notes: string | null
  createdAt: string
}

export interface CreateUserInput {
  username: string
  code: string
  role: UserRole
  phone?: string | null
  notes?: string | null
}

export interface UpdateUserInput {
  username?: string
  role?: UserRole
  active?: boolean
  phone?: string | null
  notes?: string | null
}

export function listUsers(): Promise<ManagedUser[]> {
  return api.get<ManagedUser[]>("/users")
}

export function createUser(data: CreateUserInput): Promise<ManagedUser> {
  return api.post<ManagedUser>("/users", data)
}

export function updateUser(id: number, data: UpdateUserInput): Promise<ManagedUser> {
  return api.patch<ManagedUser>(`/users/${id}`, data)
}

export function resetUserCode(id: number): Promise<{ code: string }> {
  return api.post<{ code: string }>(`/users/${id}/reset-code`)
}
