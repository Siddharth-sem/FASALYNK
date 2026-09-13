import { useEffect, useState } from 'react'
import AuthPage from './pages/AuthPage.jsx'
import { HomePage, PublicPage } from './pages/PublicPages.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import { clearSession, readSession } from './lib/api.js'
import './App.css'

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function isAuthPath(path) {
  return ['/login', '/register', '/forgot-password'].includes(path)
}

function isWorkspacePath(path) {
  return path.startsWith('/farmer/') || path.startsWith('/buyer/') || path.startsWith('/transporter/') || path.startsWith('/admin/') || ['/notifications', '/profile', '/settings'].includes(path)
}

function PageFrame({ children, navigate }) {
  return <><div className="page-content">{children}</div><SiteFooter navigate={navigate} /></>
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [user, setUser] = useState(readSession)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function signOut() {
    clearSession()
    setUser(null)
    navigate('/')
  }

  if (isAuthPath(path)) return <PageFrame navigate={navigate}><AuthPage mode={path.slice(1)} navigate={navigate} onAuthenticated={(nextUser) => { setUser(nextUser); navigate(`/${nextUser.role.toLowerCase()}/dashboard`) }} /></PageFrame>
  if (user && isWorkspacePath(path)) return <PageFrame navigate={navigate}><WorkspacePage user={user} path={path} navigate={navigate} onSignOut={signOut} /></PageFrame>
  if (path === '/' || path === '') return <PageFrame navigate={navigate}><HomePage navigate={navigate} /></PageFrame>
  if (user && path === '/marketplace') {
    const destination = user.role === 'FARMER' ? '/farmer/crops' : user.role === 'TRANSPORTER' ? '/transporter/jobs' : '/buyer/marketplace'
    return <PageFrame navigate={navigate}><WorkspacePage user={user} path={destination} navigate={navigate} onSignOut={signOut} /></PageFrame>
  }
  if (['/how-it-works', '/marketplace', '/about', '/help'].includes(path)) return <PageFrame navigate={navigate}><PublicPage path={path} navigate={navigate} /></PageFrame>
  if (user) return <PageFrame navigate={navigate}><WorkspacePage user={user} path={`/${user.role.toLowerCase()}/dashboard`} navigate={navigate} onSignOut={signOut} /></PageFrame>
  return <PageFrame navigate={navigate}><HomePage navigate={navigate} /></PageFrame>
}
