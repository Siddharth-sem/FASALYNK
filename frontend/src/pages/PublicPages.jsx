import { useState } from 'react'
import RouteHeader from '../components/RouteHeader.jsx'

const steps = [
  ['Post Crop Lot', 'The farmer adds crop, quantity, grade, harvest date and location.'],
  ['Buyers Bid', 'Buyers compete with price and quantity offers.'],
  ['Deal Locked', 'The farmer chooses an offer and the order is created.'],
  ['Transport Option', 'Choose self transport or invite nearby transporters.'],
  ['Pickup OTP + Photos', 'The farmer and transporter confirm pickup with evidence.'],
  ['Delivery OTP', 'The buyer confirms delivery with a second OTP.'],
  ['Settlement', 'The completed transaction moves to settlement.'],
]

const homeRoles = [
  { id: 'farmer', label: 'For farmers', title: 'Turn a harvest into a stronger offer.', description: 'Create a clear lot once, compare buyer offers in one place and choose how the produce reaches its destination.', action: 'Start selling', path: '/register' },
  { id: 'buyer', label: 'For buyers', title: 'Source with more context.', description: 'Browse fresh lots with grade, quantity, location and bidding status visible before you make an offer.', action: 'Explore marketplace', path: '/marketplace' },
  { id: 'transporter', label: 'For transporters', title: 'Make every delivery count.', description: 'See available delivery work, confirm handoffs with OTPs and build a dependable record over time.', action: 'Join the network', path: '/register' },
]

const homeLots = [
  { crop: 'Tomato', quantity: '800 kg', grade: 'A', location: 'Dehradun', price: 'INR 22/kg', bids: '6 offers', harvest: 'Harvested today' },
  { crop: 'Alphonso Mango', quantity: '450 kg', grade: 'A', location: 'Ratnagiri', price: 'INR 115/kg', bids: '4 offers', harvest: 'Harvested yesterday' },
  { crop: 'Basmati Rice', quantity: '1.2 tonnes', grade: 'Premium', location: 'Karnal', price: 'INR 84/kg', bids: '9 offers', harvest: 'Stored safely' },
]

const journeyStages = [
  { label: 'Listing', title: 'A crop lot with enough detail to act on.', description: 'Crop name, quantity, grade, harvest date, photos and location give buyers a useful starting point.', state: 'BIDDING_OPEN' },
  { label: 'Bidding', title: 'Offers stay visible while the lot is open.', description: 'Buyers propose price and quantity. Farmers can compare interest instead of negotiating in the dark.', state: 'ACTIVE OFFERS' },
  { label: 'Deal locked', title: 'The accepted bid becomes an order.', description: 'Once a farmer accepts an offer, the crop lot closes and both sides have a shared transaction record.', state: 'DEAL_LOCKED' },
  { label: 'Handoff', title: 'Movement and proof belong to the same story.', description: 'Transport choice, pickup and delivery verification are designed to follow the order from field to buyer.', state: 'VERIFICATION READY' },
  { label: 'Settlement', title: 'The journey ends with a clear outcome.', description: 'Delivery and settlement are the destination of the workflow, not an afterthought hidden outside the marketplace.', state: 'SETTLEMENT' },
]

const trustPillars = [
  ['01', 'Verified identity', 'Email OTP verification helps keep every farmer, buyer and transporter connected to a real account.'],
  ['02', 'Visible evidence', 'Pickup and delivery can be tied to OTPs, timestamps, location and photos when those features are activated.'],
  ['03', 'Shared status', 'Bidding, deal locking and order states give each side the same language for what happens next.'],
]

export function HomePage({ navigate }) {
  const [activeRole, setActiveRole] = useState('farmer')
  const [selectedLot, setSelectedLot] = useState(homeLots[0])
  const [activeStage, setActiveStage] = useState(0)
  const role = homeRoles.find((item) => item.id === activeRole)
  const stage = journeyStages[activeStage]

  return <main className="route-page"><RouteHeader navigate={navigate} onSignIn={() => navigate('/login')} /><section className="route-hero home-hero home-hero-expanded"><div className="home-hero-copy"><p className="eyebrow">Farm • Market • Mobility</p><h1>A fairer route from harvest to home.</h1><p>Farmers often lose value between harvest and the final buyer. FASALYNK brings crop listings, competitive bids, reliable transport and delivery trust into one simple flow.</p><div className="hero-actions"><button className="button button-primary" type="button" onClick={() => navigate('/register')}>Sell Your Crop</button><button className="button button-secondary" type="button" onClick={() => navigate('/marketplace')}>Buy Crops</button><button className="text-link" type="button" onClick={() => navigate('/register')}>Join as Transporter -&gt;</button></div></div><div className="home-snapshot"><div className="snapshot-top"><span className="eyebrow">Live network</span><span className="snapshot-dot">● Active</span></div><strong>184</strong><p>lots moving through FASALYNK this week</p><div className="snapshot-stats"><span><b>92%</b> verified handoffs</span><span><b>3.4 days</b> average delivery</span></div><button className="snapshot-link" type="button" onClick={() => navigate('/marketplace')}>See the marketplace <span aria-hidden="true">-&gt;</span></button></div></section><section className="public-section home-roles"><div className="section-heading"><p className="eyebrow">Built around your work</p><h2>One network, three useful starting points.</h2><p>Choose a perspective to see how the same trusted record supports each part of the trade.</p></div><div className="role-layout"><div className="role-tabs" role="tablist" aria-label="FASALYNK roles">{homeRoles.map((item) => <button className={`role-tab ${activeRole === item.id ? 'is-active' : ''}`} key={item.id} type="button" role="tab" aria-selected={activeRole === item.id} onClick={() => setActiveRole(item.id)}><span>{item.label}</span><small>{item.id === 'farmer' ? 'Post and sell produce' : item.id === 'buyer' ? 'Find and bid on lots' : 'Move orders with confidence'}</small></button>)}</div><div className="role-panel" role="tabpanel"><p className="panel-kicker">{role.label}</p><h3>{role.title}</h3><p>{role.description}</p><button className="button button-secondary" type="button" onClick={() => navigate(role.path)}>{role.action} <span aria-hidden="true">-&gt;</span></button></div></div></section><section className="public-section home-market"><div className="section-heading"><p className="eyebrow">Marketplace pulse</p><h2>See what is moving today.</h2><p>Sample lots show the information buyers and farmers need at a glance. Select one to inspect its current trade story.</p></div><div className="home-lot-layout"><div className="home-lot-list">{homeLots.map((lot) => <button className={`home-lot ${selectedLot.crop === lot.crop ? 'is-selected' : ''}`} key={lot.crop} type="button" onClick={() => setSelectedLot(lot)}><span className="crop-icon small">{lot.crop[0]}</span><span><strong>{lot.crop}</strong><small>{lot.quantity} • {lot.location}</small></span><b>{lot.price}</b></button>)}</div><article className="home-lot-detail"><div className="snapshot-top"><span className="eyebrow">Bidding open</span><span className="lot-status">{selectedLot.bids}</span></div><h3>{selectedLot.crop}</h3><p>{selectedLot.harvest}, ready for a verified handoff.</p><div className="detail-facts"><div><span>Quantity</span><strong>{selectedLot.quantity}</strong></div><div><span>Grade</span><strong>{selectedLot.grade}</strong></div><div><span>Location</span><strong>{selectedLot.location}</strong></div></div><button className="button button-primary" type="button" onClick={() => navigate('/marketplace')}>View all lots</button></article></div></section><section className="public-section home-journey"><div className="section-heading"><p className="eyebrow">Order story</p><h2>Know what happens after the click.</h2><p>The marketplace is the beginning. FASALYNK keeps the next state visible as a bid becomes a deal, a delivery and a settlement.</p></div><div className="journey-layout"><div className="journey-tabs" role="tablist" aria-label="Transaction stages">{journeyStages.map((item, index) => <button className={`journey-tab ${activeStage === index ? 'is-active' : ''}`} key={item.label} type="button" role="tab" aria-selected={activeStage === index} onClick={() => setActiveStage(index)}><span>0{index + 1}</span><strong>{item.label}</strong></button>)}</div><article className="journey-detail" role="tabpanel"><span className="journey-state">{stage.state}</span><h3>{stage.title}</h3><p>{stage.description}</p><div className="journey-progress"><span style={{ width: `${((activeStage + 1) / journeyStages.length) * 100}%` }} /></div><small>Stage {activeStage + 1} of {journeyStages.length}</small></article></div></section><section className="public-section home-trust"><div className="section-heading"><p className="eyebrow">Trust is a feature</p><h2>Useful records for moments that usually get blurry.</h2><p>FASALYNK is designed around the details that help people make decisions and resolve questions later.</p></div><div className="trust-grid">{trustPillars.map(([number, title, description]) => <article key={title}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section><section className="public-section home-next-step"><div><p className="eyebrow">Ready for the next harvest?</p><h2>Bring the first trade into one shared workflow.</h2><p>Choose your role and start with the part of FASALYNK that fits your work today.</p></div><div className="home-next-actions"><button className="button button-primary" type="button" onClick={() => navigate('/register')}>Create an account</button><button className="button button-secondary" type="button" onClick={() => navigate('/how-it-works')}>See all seven steps</button></div></section><section className="public-section"><div className="section-heading"><p className="eyebrow">How FASALYNK works</p><h2>One transaction, connected end to end.</h2><p>Farmers post. Buyers compete. Transporters move. OTPs and photos make each handoff visible.</p></div><div className="flow-cards"><div><span>01</span><h3>Farmer</h3><p>Posts a clear crop lot with grade, harvest date and location.</p></div><div><span>02</span><h3>Buyer</h3><p>Finds the lot and places a transparent offer.</p></div><div><span>03</span><h3>Logistics</h3><p>Moves the produce with verified pickup and delivery.</p></div></div></section><section className="public-section light-section"><div className="section-heading"><p className="eyebrow">Key features</p><h2>Everything needed for the first trusted trade.</h2></div><div className="feature-list"><span>Crop marketplace</span><span>Competitive bidding</span><span>Transport choice</span><span>OTP verification</span><span>Photo evidence</span><span>Clear order states</span></div></section><section className="public-section why-section"><p className="eyebrow">Why FASALYNK</p><h2>Better visibility for everyone in the journey.</h2><p>Less uncertainty for farmers. Better sourcing for buyers. More reliable work for transporters. One shared record when something needs to be verified.</p></section></main>
}

export function PublicPage({ path, navigate }) {
  if (path === '/marketplace') return <MarketplacePage navigate={navigate} />
  if (path === '/how-it-works') return <HowItWorksPage navigate={navigate} />
  if (path === '/help') return <HelpPage navigate={navigate} />
  return <AboutPage navigate={navigate} />
}

function HowItWorksPage({ navigate }) {
  return <main className="route-page"><RouteHeader navigate={navigate} onSignIn={() => navigate('/login')} /><section className="route-hero"><p className="eyebrow">The complete transaction</p><h1>Seven steps, one clear story.</h1><p>From crop lot to settlement, every handoff has a visible state.</p></section><section className="steps-list">{steps.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><div><h2>{title}</h2><p>{description}</p></div></article>)}</section></main>
}

function MarketplacePage({ navigate }) {
  return <main className="route-page"><RouteHeader navigate={navigate} onSignIn={() => navigate('/login')} /><section className="route-hero"><p className="eyebrow">Marketplace preview</p><h1>Fresh lots, clear offers.</h1><p>Visitors can explore sample crops. Actual bidding requires a buyer account.</p></section><section className="preview-grid"><PreviewLot crop="Tomato" quantity="800 kg" grade="A" location="Dehradun" price="INR 22/kg" navigate={navigate} /><PreviewLot crop="Alphonso Mango" quantity="450 kg" grade="A" location="Ratnagiri" price="INR 115/kg" navigate={navigate} /></section></main>
}

function AboutPage({ navigate }) {
  return <main className="route-page"><RouteHeader navigate={navigate} onSignIn={() => navigate('/login')} /><section className="route-hero"><p className="eyebrow">About / Why FASALYNK</p><h1>Trade should be direct, practical and trusted.</h1><p>Farmers need better access to buyers. Buyers need reliable produce. Transporters need visible work. FASALYNK connects those needs around one transaction.</p></section><section className="about-grid"><article><h2>Problem</h2><p>Disconnected selling, unclear pricing and delivery uncertainty reduce trust and value.</p></article><article><h2>Solution</h2><p>A direct crop marketplace with bidding, transport choice and a digital record of each handoff.</p></article><article><h2>Trust mechanism</h2><p>Pickup OTP, delivery OTP and photos make the crop journey easier to verify.</p></article></section></main>
}

function HelpPage({ navigate }) {
  const faqs = [['How does bidding work?', 'Buyers place price and quantity offers while a lot is open. The farmer chooses the offer that works best.'], ['How does transportation work?', 'After a deal is locked, the farmer chooses self transport or opens a request for transporter bids.'], ['How does OTP verification work?', 'A one-time code and photos confirm pickup. A second code and evidence confirm delivery.'], ['Where can I get support?', 'Use your registered email when contacting FASALYNK support so the order or account can be found quickly.']]
  return <main className="route-page"><RouteHeader navigate={navigate} onSignIn={() => navigate('/login')} /><section className="route-hero"><p className="eyebrow">Contact / Help</p><h1>Start with a clear answer.</h1><p>We keep the first transaction understandable for farmers, buyers and transporters.</p></section><section className="faq-list">{faqs.map(([question, answer]) => <article key={question}><h2>{question}</h2><p>{answer}</p></article>)}</section></main>
}

function PreviewLot({ crop, quantity, grade, location, price, navigate }) {
  return <article className="preview-lot"><span className="crop-icon">{crop[0]}</span><p className="eyebrow">Bidding open</p><h2>{crop}</h2><p>{quantity} / Grade {grade} / {location}</p><strong>Current bid: {price}</strong><button className="button button-primary" type="button" onClick={() => navigate('/login')}>Sign in to bid</button></article>
}
