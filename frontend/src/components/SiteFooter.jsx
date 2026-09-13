import logo from '../assets/logo.png'

export default function SiteFooter({ navigate }) {
  return <footer className="site-footer">
    <div className="site-footer-main">
      <div className="site-footer-brand">
        <p className="footer-brand"><img className="footer-logo" src={logo} alt="FASALYNK" /><span>FASALYNK</span></p>
        <p>One trusted workflow from crop lot to buyer delivery.</p>
      </div>
      <div className="site-footer-links">
        <div>
          <p className="footer-label">Explore</p>
          <button type="button" onClick={() => navigate('/')}>Home</button>
          <button type="button" onClick={() => navigate('/marketplace')}>Marketplace</button>
          <button type="button" onClick={() => navigate('/how-it-works')}>How it works</button>
        </div>
        <div>
          <p className="footer-label">For your role</p>
          <button type="button" onClick={() => navigate('/register')}>Create account</button>
          <button type="button" onClick={() => navigate('/login')}>Sign in</button>
          <button type="button" onClick={() => navigate('/help')}>Help center</button>
        </div>
      </div>
    </div>
    <div className="site-footer-bottom">
      <span>© {new Date().getFullYear()} FASALYNK</span>
      <span>Farm • Market • Mobility</span>
    </div>
  </footer>
}
