"use client"

import { LoginPage } from "@/components/auth/login-page"
import { useAuth } from "@/components/providers/auth-provider"

export default function LoginRoute() {
  const { demoLogin, signup } = useAuth()

  // Removed onAuthStateChange navigation and rely on middleware instead
  return <LoginPage onDemoLogin={demoLogin} onSignup={signup} />
}
