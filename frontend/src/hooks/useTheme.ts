import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'

export function useTheme() {
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    let effectiveTheme: 'light' | 'dark'

    if (theme === 'system') {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches
      effectiveTheme = systemPreference ? 'dark' : 'light'
    } else {
      effectiveTheme = theme
    }

    root.classList.add(effectiveTheme)
    useThemeStore.setState({ resolvedTheme: effectiveTheme })
  }, [theme])

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const effectiveTheme = mediaQuery.matches ? 'dark' : 'light'
      window.document.documentElement.classList.remove('light', 'dark')
      window.document.documentElement.classList.add(effectiveTheme)
      useThemeStore.setState({ resolvedTheme: effectiveTheme })
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return { theme, setTheme }
}
