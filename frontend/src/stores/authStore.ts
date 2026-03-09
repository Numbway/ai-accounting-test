import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  username: string
  display_name?: string
  email?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  
  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      
      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true
      }),
      
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false
      })
    }),
    {
      name: 'auth-storage'
    }
  )
)
