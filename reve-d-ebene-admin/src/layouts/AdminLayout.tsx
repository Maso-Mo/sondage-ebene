import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import AdminHeader from '../components/AdminHeader'
import AdminNavigation from '../components/AdminNavigation'
import type { AdminNavigationItemId, DashboardSectionId } from '../components/AdminNavigation'
import DashboardDataProvider from '../contexts/DashboardDataProvider'
import { useAdminAuth } from '../contexts/useAdminAuth'

const pageDetails: Record<string, { title: string; eyebrow: string }> = {
  '/': { title: 'Vue d’ensemble', eyebrow: 'Tableau de bord' },
  '/results': { title: 'Résultats du sondage', eyebrow: 'Analyse quantitative' },
  '/responses': { title: 'Réponses libres', eyebrow: 'La voix des clientes' },
  '/administrators': { title: 'Administratrices', eyebrow: 'Gestion des accès' },
}

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refresh: refreshAccess } = useAdminAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<DashboardSectionId>(() => {
    const hash = window.location.hash.slice(1)
    return hash === 'results' || hash === 'responses' ? hash : 'overview'
  })
  const details = pageDetails[location.pathname] ?? pageDetails['/']

  const scrollToSection = useCallback((section: DashboardSectionId, behavior: ScrollBehavior) => {
    const element = document.getElementById(section)
    if (!element) return false

    element.scrollIntoView({ behavior, block: 'start' })
    return true
  }, [])

  const handleNavigation = useCallback((section: AdminNavigationItemId) => {
    void refreshAccess()

    if (section === 'administrators') {
      navigate('/administrators')
      return
    }

    setActiveSection(section)
    const hash = section === 'overview' ? '' : `#${section}`

    if (location.pathname !== '/') {
      navigate(`/${hash}`)
      return
    }

    window.history.replaceState(window.history.state, '', `/${hash}`)
    scrollToSection(section, 'smooth')
  }, [location.pathname, navigate, refreshAccess, scrollToSection])

  useEffect(() => {
    if (location.pathname !== '/') return

    let animationFrame = 0
    let observer: IntersectionObserver | null = null
    let initialHashHandled = false

    const connectObserver = () => {
      if (observer) return true

      const sections = (['overview', 'results', 'responses'] as DashboardSectionId[])
        .map((id) => document.getElementById(id))
        .filter((section): section is HTMLElement => Boolean(section))

      if (sections.length !== 3) return false

      const updateActiveSection = () => {
        const marker = Math.min(window.innerHeight * 0.32, 280)
        const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
        const current = atPageEnd
          ? sections[sections.length - 1]
          : sections.reduce<HTMLElement>((active, section) => (
              section.getBoundingClientRect().top <= marker ? section : active
            ), sections[0])

        setActiveSection((previous) => (
          previous === current.id ? previous : current.id as DashboardSectionId
        ))
      }

      observer = new IntersectionObserver(() => {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = window.requestAnimationFrame(updateActiveSection)
      }, {
        rootMargin: '-20% 0px -65% 0px',
        threshold: [0, 0.01, 0.5],
      })

      sections.forEach((section) => observer?.observe(section))
      animationFrame = window.requestAnimationFrame(updateActiveSection)

      if (!initialHashHandled) {
        initialHashHandled = true
        const hash = window.location.hash.slice(1)
        if (hash === 'results' || hash === 'responses') {
          window.requestAnimationFrame(() => scrollToSection(hash, 'smooth'))
        }
      }
      return true
    }

    const content = document.querySelector('.admin-content')
    const mutationObserver = new MutationObserver(() => {
      if (connectObserver()) mutationObserver.disconnect()
    })

    if (!connectObserver() && content) {
      mutationObserver.observe(content, { childList: true, subtree: true })
    }

    return () => {
      observer?.disconnect()
      mutationObserver.disconnect()
      window.cancelAnimationFrame(animationFrame)
    }
  }, [location.pathname, scrollToSection])

  useEffect(() => {
    if (location.pathname !== '/') return

    const hash = location.hash.slice(1)
    const target: DashboardSectionId = hash === 'results' || hash === 'responses' ? hash : 'overview'
    const animationFrame = window.requestAnimationFrame(() => scrollToSection(target, 'smooth'))
    return () => window.cancelAnimationFrame(animationFrame)
  }, [location.hash, location.pathname, scrollToSection])

  return (
    <div className="admin-layout">
      <AdminNavigation
        mobileOpen={mobileOpen}
        activeItem={location.pathname === '/administrators' ? 'administrators' : activeSection}
        onNavigate={handleNavigation}
        onClose={() => setMobileOpen(false)}
      />
      <div className="admin-shell">
        <img src="/floral/corner-bloom.svg" className="shell-floral shell-floral--top" alt="" aria-hidden="true" />
        <img src="/floral/floral-bouquet.svg" className="shell-floral shell-floral--bottom" alt="" aria-hidden="true" />
        <AdminHeader
          title={details.title}
          eyebrow={details.eyebrow}
          onOpenMenu={() => setMobileOpen(true)}
        />
        <div className="admin-content">
          {location.pathname === '/administrators' ? (
            <Outlet />
          ) : (
            <DashboardDataProvider>
              <Outlet />
            </DashboardDataProvider>
          )}
        </div>
      </div>
    </div>
  )
}
