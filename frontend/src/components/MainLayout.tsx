import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Database, Home, Workflow, LogOut, User as UserIcon, Users } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/lib/api/auth'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function MainLayout() {
  const { user, tokens, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleLogout = async () => {
    try {
      if (tokens?.refresh_token) {
        await authApi.logout(tokens.refresh_token)
      }
      logout()
      // Clear all cached queries on logout
      queryClient.clear()
      navigate('/login')
      toast.success('Logged out successfully')
    } catch (error) {
      // Clear auth anyway even if API call fails
      logout()
      queryClient.clear()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link to="/" className="font-bold text-xl">
                ETL Portal
              </Link>
              <div className="flex gap-4">
                <Link
                  to="/"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted"
                >
                  <Home className="w-4 h-4" />
                  Home
                </Link>
                <Link
                  to="/credentials"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted"
                >
                  <Database className="w-4 h-4" />
                  Credentials
                </Link>
                <Link
                  to="/jobs"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted"
                >
                  <Workflow className="w-4 h-4" />
                  ETL Jobs
                </Link>
                {user?.role === 'admin' && (
                  <Link
                    to="/users"
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted"
                  >
                    <Users className="w-4 h-4" />
                    Users
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar>
                      <AvatarImage src={user?.profile_picture_url} />
                      <AvatarFallback>
                        {user?.full_name?.charAt(0) || <UserIcon className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        Role: {user?.role}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
