"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"

export function LoginPage() {
  const { login, demoLogin, signup } = useAuth()
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      if (isSignup) {
        if (!name.trim()) {
          setError("Please enter your full name.")
          setIsSubmitting(false)
          return
        }
        const result = await signup(email, password, name)
        if (result.error) {
          setError(result.error)
          setIsSubmitting(false)
        }
      } else {
        const result = await login(email, password)
        if (result.error) {
          setError(result.error)
          setIsSubmitting(false)
        }
        // If no error, auth-provider handles navigation
        // Do NOT call setIsSubmitting(false) on success — 
        // component will unmount on redirect
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl w-full">
        {/* Left side - Branding */}
        <div className="hidden lg:flex flex-col justify-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-5xl font-bold text-primary">FlowLock</h1>
              <p className="text-xl text-muted-foreground">Master Your Focus, Maximize Your Potential</p>
            </div>
            <div className="space-y-4 text-muted-foreground">
              <div className="flex gap-3">
                <div className="text-2xl">✓</div>
                <div>
                  <h3 className="font-semibold text-foreground">Real-Time Focus Tracking</h3>
                  <p className="text-sm">Monitor your study sessions with precision</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-2xl">✓</div>
                <div>
                  <h3 className="font-semibold text-foreground">Performance Analytics</h3>
                  <p className="text-sm">Visualize your progress over time</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-2xl">✓</div>
                <div>
                  <h3 className="font-semibold text-foreground">Break-Time Games</h3>
                  <p className="text-sm">Stay engaged with fun, productive breaks</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{isSignup ? "Create Account" : "Sign In"}</CardTitle>
              <CardDescription>
                {isSignup ? "Join FlowLock and start tracking your focus" : "Welcome back! Log in to continue"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                  <div>
                    <label className="text-sm font-medium">Full Name</label>
                    <Input
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1"
                    required
                    minLength={6}
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isSignup ? "Creating Account..." : "Signing In..."}
                    </>
                  ) : (
                    isSignup ? "Create Account" : "Sign In"
                  )}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or try the app</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={demoLogin}
                  disabled={isSubmitting}
                >
                  Login as Demo User
                </Button>
              </form>

              <div className="mt-6">
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignup(!isSignup)
                      setError("")
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
