import { useEffect, useState } from 'react'
import AppNavbar from '../components/AppNavbar.jsx'
import { commonNavigation, roleNavigation } from '../data/navigation.js'
import { apiRequest } from '../lib/api.js'

const demoTransporters = [
  { name: 'Arjun Logistics', price: 2400, distance: 18, reliability: 96, vehicle: 'Mini truck', capacity: 1500 },
  { name: 'Green Route Fleet', price: 2650, distance: 11, reliability: 91, vehicle: 'Pickup', capacity: 1000 },
  { name: 'Kisan Move Co.', price: 2300, distance: 34, reliability: 88, vehicle: 'Truck', capacity: 3000 },
]

function priceIntelligence(lot, bids) {
  const expected = Number(lot.expectedPricePerKg) || 20
  const current = bids[0] ? Number(bids[0].pricePerKg) : expected
  const demand = bids.length >= 4 ? 'High' : bids.length >= 2 ? 'Medium' : 'Building'
  const signal = current > expected * 1.05 ? 'Rising' : current < expected * .95 ? 'Softening' : 'Stable'
  const adjustment = demand === 'High' ? 1.08 : demand === 'Medium' ? 1.03 : 1
  const suggested = Math.max(expected, current) * adjustment
  return { low: Math.floor(suggested - 1), high: Math.ceil(suggested + 1), demand, signal, recommendation: demand === 'High' || signal === 'Rising' ? 'Open bidding' : 'Watch buyer interest' }
}

function freightIntelligence(transporters = demoTransporters, cargoKg = 800) {
  return transporters.map((transporter) => ({ ...transporter, score: Math.round((transporter.reliability * .45) + (Math.max(0, 100 - transporter.distance) * .2) + (Math.max(0, 100 - (transporter.price / 3000 * 100)) * .2) + (transporter.capacity >= cargoKg ? 15 : 0)) })).sort((first, second) => second.score - first.score)[0]
}

function routeIntelligence(pickup, destination, distanceKm) {
  const distance = Number.parseFloat(distanceKm) || 70
  const hours = distance / 42 + .5
  return { pickup, destination, distance: `${distance} km`, eta: `${Math.ceil(hours)}-${Math.ceil(hours + .75)} hours`, route: 'Highway-first route with fewer city stops' }
}

const copy = {
  FARMER: ['Farmer workspace', "Turn today's harvest into a clear, trusted listing."],
  BUYER: ['Buyer workspace', 'Find fresh produce and make a competitive offer.'],
  TRANSPORTER: ['Transporter workspace', 'Build reliable delivery work around your vehicle.'],
}

export default function WorkspacePage({ user, path, navigate, onSignOut }) {
  const prefix = user.role === 'FARMER' ? '/farmer/' : user.role === 'BUYER' ? '/buyer/' : '/transporter/'
  const adminPage = path.startsWith('/admin/') ? path.slice('/admin/'.length) : null
  const page = path.startsWith(prefix) ? path.slice(prefix.length) : path.slice(1) || 'dashboard'
  const [lots, setLots] = useState([])
  const [lotDetails, setLotDetails] = useState({})
  const [buyerBids, setBuyerBids] = useState([])
  const [selectedLot, setSelectedLot] = useState(null)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ cropName: '', quantityKg: '', grade: 'A', harvestDate: '', locationName: '', expectedPricePerKg: '', photos: [] })
  const [bid, setBid] = useState({ pricePerKg: '', quantityKg: '' })

  useEffect(() => {
    if (user.role === 'TRANSPORTER') return
    apiRequest(`/crop-lots${user.role === 'FARMER' ? '?mine=true' : ''}`).then(async (data) => {
      setLots(data.lots)
      if (user.role === 'FARMER' || user.role === 'BUYER') {
        const details = await Promise.all(data.lots.map((lot) => apiRequest(`/crop-lots/${lot.id}`).catch(() => null)))
        setLotDetails(Object.fromEntries(details.filter(Boolean).map((detail) => [detail.lot.id, detail])))
      }
    }).catch((error) => setMessage(error.message))
  }, [user.role])

  function selectPage(nextPage) {
    setSelectedLot(null)
    navigate(`${prefix}${nextPage}`)
  }

  async function createLot(event) {
    event.preventDefault()
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => { if (key !== 'photos') formData.append(key, value) })
      form.photos.forEach((photo) => formData.append('photos', photo))
      await apiRequest('/crop-lots', { method: 'POST', body: formData })
      setMessage('Crop lot published. Buyers can now bid.')
      setForm({ cropName: '', quantityKg: '', grade: 'A', harvestDate: '', locationName: '', expectedPricePerKg: '', photos: [] })
      selectPage('crops')
      const data = await apiRequest('/crop-lots?mine=true')
      setLots(data.lots)
    } catch (error) { setMessage(error.message) }
  }

  async function openLot(lot) {
    try {
      setSelectedLot(await apiRequest(`/crop-lots/${lot.id}`))
      setBid({ pricePerKg: '', quantityKg: lot.quantityKg })
    } catch (error) { setMessage(error.message) }
  }

  async function placeBid(event) {
    event.preventDefault()
    try {
      await apiRequest(`/crop-lots/${selectedLot.lot.id}/bids`, { method: 'POST', body: JSON.stringify(bid) })
      setMessage('Bid placed successfully.')
      openLot(selectedLot.lot)
    } catch (error) { setMessage(error.message) }
  }

  async function submitBuyerBid(lotId, values) {
    try {
      const response = await apiRequest(`/crop-lots/${lotId}/bids`, { method: 'POST', body: JSON.stringify(values) })
      const lot = lots.find((item) => item.id === lotId)
      setBuyerBids((current) => [...current.filter((item) => item.id !== response.bid.id), { id: response.bid.id, lotId, cropName: lot?.cropName || 'Crop lot', pricePerKg: values.pricePerKg, quantityKg: values.quantityKg, status: 'ACTIVE' }])
      const detail = await apiRequest(`/crop-lots/${lotId}`)
      setLotDetails((current) => ({ ...current, [lotId]: detail }))
      setMessage('Bid placed successfully.')
      return true
    } catch (error) { setMessage(error.message); return false }
  }

  async function acceptBid(bidId) {
    try {
      await apiRequest(`/crop-lots/${selectedLot.lot.id}/bids/${bidId}/accept`, { method: 'POST' })
      setMessage('Deal locked. The winning bid is now an order.')
      setSelectedLot(null)
      const data = await apiRequest('/crop-lots?mine=true')
      setLots(data.lots)
    } catch (error) { setMessage(error.message) }
  }

  async function acceptFarmerBid(lotId, bidId) {
    try {
      await apiRequest(`/crop-lots/${lotId}/bids/${bidId}/accept`, { method: 'POST' })
      setMessage('Deal locked. The winning bid is now an order.')
      const data = await apiRequest('/crop-lots?mine=true')
      setLots(data.lots)
      const details = await Promise.all(data.lots.map((lot) => apiRequest(`/crop-lots/${lot.id}`).catch(() => null)))
      setLotDetails(Object.fromEntries(details.filter(Boolean).map((detail) => [detail.lot.id, detail])))
    } catch (error) { setMessage(error.message) }
  }

  const [title, description] = copy[user.role]
  const marketplacePage = user.role !== 'TRANSPORTER' && ['marketplace', 'crops', 'post-crop', 'bids', 'crop-details'].includes(page)
  const commonPage = commonNavigation.some(([id]) => id === page)

  return <main className="workspace-shell">
    <AppNavbar navigate={navigate} user={user} onSignOut={onSignOut} />
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <p className="sidebar-label">{adminPage ? 'ADMIN CONSOLE' : `${user.role} workspace`}</p>
        <div className="sidebar-links">{(adminPage ? [['dashboard', 'Dashboard'], ['users', 'Users'], ['crops', 'Crop Lots'], ['orders', 'Orders'], ['transporters', 'Transporters'], ['disputes', 'Disputes']] : roleNavigation[user.role]).map(([id, label]) => <button className={(adminPage ? adminPage : page) === id ? 'active' : ''} type="button" key={id} onClick={() => adminPage ? navigate(`/admin/${id}`) : selectPage(id)}>{label}</button>)}</div>
        <p className="sidebar-label common-label">Common</p>
        <div className="sidebar-links">{commonNavigation.map(([id, label]) => <button className={page === id ? 'active' : ''} type="button" key={id} onClick={() => navigate(`/${id}`)}>{label}</button>)}</div>
      </aside>
      <section className="workspace-main">
        <section className="workspace-hero"><div><p className="eyebrow">{adminPage ? 'ADMIN / DEMO CONSOLE' : `${user.role} / @${user.username}`}</p><h1>{adminPage ? 'Operations console' : title}</h1><p>{adminPage ? 'Review marketplace activity, users, orders and trust signals from one operational view.' : description}</p></div>{user.role === 'FARMER' && !adminPage && <button className="button button-primary" type="button" onClick={() => selectPage('post-crop')}>+ Post New Crop</button>}</section>
        {message && <div className="workspace-message">{message}</div>}
        {adminPage ? <AdminWorkspace page={adminPage} /> : commonPage ? <CommonWorkspace page={page} user={user} /> : user.role === 'FARMER' ? <FarmerWorkspace page={page} prefix={prefix} lots={lots} lotDetails={lotDetails} form={form} setForm={setForm} createLot={createLot} acceptBid={acceptFarmerBid} navigate={navigate} /> : user.role === 'BUYER' ? <BuyerWorkspace page={page} prefix={prefix} lots={lots} lotDetails={lotDetails} buyerBids={buyerBids} submitBid={submitBuyerBid} navigate={navigate} /> : user.role === 'TRANSPORTER' ? <TransporterWorkspace page={page} prefix={prefix} navigate={navigate} /> : marketplacePage ? <Marketplace user={user} page={page} lots={lots} form={form} setForm={setForm} createLot={createLot} openLot={openLot} selectedLot={selectedLot} closeLot={() => setSelectedLot(null)} bid={bid} setBid={setBid} placeBid={placeBid} acceptBid={acceptBid} /> : <PlaceholderPage page={page} />}
      </section>
    </div>
  </main>
}

function FarmerWorkspace({ page, prefix, lots, lotDetails, form, setForm, createLot, acceptBid, navigate }) {
  const routeId = page.startsWith('crops/') && page !== 'crops/new' ? page.slice('crops/'.length) : null
  const selectedDetail = routeId ? lotDetails[routeId] : null
  const allBids = Object.values(lotDetails).flatMap((detail) => detail.bids.map((bid) => ({ ...bid, cropName: detail.lot.cropName })))
  const activeLots = lots.filter((lot) => lot.status === 'BIDDING_OPEN')
  const soldLots = lots.filter((lot) => lot.status === 'SOLD')

  if (page === 'dashboard') return <FarmerDashboard lots={lots} activeLots={activeLots} allBids={allBids} soldLots={soldLots} navigate={navigate} prefix={prefix} />
  if (page === 'crops/new' || page === 'post-crop') return <FarmerCropForm form={form} setForm={setForm} createLot={createLot} />
  if (page === 'crops') return <FarmerCropLots lots={lots} navigate={navigate} prefix={prefix} />
  if (routeId) return <><AIPriceIntelligence lot={selectedDetail?.lot || { cropName: 'Crop lot', expectedPricePerKg: 20 }} bids={selectedDetail?.bids || []} /><FarmerLotDetail detail={selectedDetail} acceptBid={acceptBid} navigate={navigate} prefix={prefix} /></>
  if (page === 'bids') return <FarmerBids bids={allBids} navigate={navigate} prefix={prefix} />
  if (page === 'orders') return <FarmerOrders navigate={navigate} prefix={prefix} />
  if (page === 'transport' || page.startsWith('orders/') && page.endsWith('/transport')) return <><SmartFreightCard transporter={freightIntelligence()} /><RouteOptimizationCard route={routeIntelligence('Dehradun', 'Haridwar', 70)} /><FarmerTransportChoice navigate={navigate} prefix={prefix} /></>
  if (page === 'transporters' || page.startsWith('orders/') && page.endsWith('/transporters')) return <FarmerTransporters navigate={navigate} prefix={prefix} />
  if (page === 'transactions') return <FarmerTransactions />
  return <PlaceholderPage page={page} />
}

function BuyerWorkspace({ page, prefix, lots, lotDetails, buyerBids, submitBid, navigate }) {
  const routeId = page.startsWith('marketplace/') ? page.slice('marketplace/'.length) : null
  const selectedDetail = routeId ? lotDetails[routeId] : null
  if (page === 'dashboard') return <BuyerDashboard lots={lots} buyerBids={buyerBids} navigate={navigate} prefix={prefix} />
  if (page === 'marketplace') return <BuyerMarketplace lots={lots} navigate={navigate} prefix={prefix} />
  if (routeId) return <BuyerLotDetail detail={selectedDetail} submitBid={submitBid} navigate={navigate} prefix={prefix} />
  if (page === 'my-bids' || page === 'bids') return <BuyerBids bids={buyerBids} lotDetails={lotDetails} navigate={navigate} prefix={prefix} />
  if (page === 'deals') return <BuyerDeals navigate={navigate} prefix={prefix} />
  if (page === 'orders') return <BuyerOrders navigate={navigate} prefix={prefix} />
  if (page === 'delivery' || page.startsWith('orders/') && page.endsWith('/delivery')) return <BuyerDelivery navigate={navigate} prefix={prefix} />
  if (page === 'transactions') return <BuyerTransactions />
  return <PlaceholderPage page={page} />
}

const adminUsers = [['Anita Sharma', 'FARMER', 'Verified', '18 crop lots'], ['Rohan Mehta', 'BUYER', 'Verified', '12 bids'], ['Kisan Move Co.', 'TRANSPORTER', 'Verified', '96% reliability'], ['Meera FPO', 'FARMER', 'Pending', '4 crop lots']]
const adminCrops = [['Tomato', 'Dehradun', '800 kg', 'BIDDING_OPEN'], ['Alphonso Mango', 'Ratnagiri', '450 kg', 'BIDDING_OPEN'], ['Basmati Rice', 'Karnal', '1.2 tonnes', 'SOLD']]
const adminOrders = [['Tomato', 'Anita Sharma → Rohan Mehta', 'TRANSPORT_PENDING', 'INR 17,600'], ['Alphonso Mango', 'Meera FPO → Rohan Mehta', 'DELIVERED', 'INR 51,750'], ['Basmati Rice', 'Anita Sharma → FreshMart', 'SETTLED', 'INR 100,800']]

function AdminWorkspace({ page }) {
  if (page === 'dashboard') return <AdminDashboard />
  if (page === 'users') return <AdminTablePage eyebrow="User management" title="Users" description="Review registered identities, roles and verification status." headers={['Name', 'Role', 'Verification', 'Activity']} rows={adminUsers} />
  if (page === 'crops') return <AdminTablePage eyebrow="Marketplace oversight" title="Crop lots" description="Monitor listing volume, bidding state and farmer supply." headers={['Crop', 'Location', 'Quantity', 'Status']} rows={adminCrops} />
  if (page === 'orders') return <AdminTablePage eyebrow="Order operations" title="Orders" description="Follow deals from locked bid through delivery and settlement." headers={['Crop', 'Participants', 'Status', 'Value']} rows={adminOrders} />
  if (page === 'transporters') return <AdminTablePage eyebrow="Trust network" title="Transporters" description="Review reliability, delivery activity and capacity signals." headers={['Transporter', 'Reliability', 'Completed', 'Vehicle']} rows={[['Arjun Logistics', '96%', '42 deliveries', 'Mini truck'], ['Green Route Fleet', '91%', '28 deliveries', 'Pickup'], ['Kisan Move Co.', '88%', '19 deliveries', 'Truck']]} />
  if (page === 'disputes') return <AdminDisputes />
  return <AdminDashboard />
}

function AdminDashboard() {
  const stats = [['Registered users', '248', 'Across all roles'], ['Open crop lots', '64', 'Currently accepting bids'], ['Active orders', '31', 'Moving through delivery'], ['Disputes to review', '3', 'Need an operator decision']]
  return <section className="admin-page"><div className="admin-page-heading"><div><p className="eyebrow">Admin dashboard</p><h2>Marketplace operations at a glance.</h2><p>Monitor supply, trust and order movement from the FASALYNK control room.</p></div><span className="admin-demo-badge">Demo console</span></div><div className="admin-stat-grid">{stats.map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div><div className="admin-dashboard-grid"><section className="admin-panel"><p className="eyebrow">System health</p><h3>Core activity</h3><div className="admin-health-list"><span><b className="health-dot is-good" />API service <strong>Operational</strong></span><span><b className="health-dot is-good" />Marketplace <strong>Receiving lots</strong></span><span><b className="health-dot is-warn" />Transport APIs <strong>Foundation ready</strong></span><span><b className="health-dot is-warn" />Settlement <strong>Dummy payment state</strong></span></div></section><section className="admin-panel"><p className="eyebrow">Needs attention</p><h3>Operator queue</h3><div className="admin-queue"><span>3 disputes awaiting review</span><span>4 accounts pending verification</span><span>7 transport bids need selection</span></div></section></div></section>
}

function AdminTablePage({ eyebrow, title, description, headers, rows }) {
  return <section className="admin-page"><div className="admin-page-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div><span className="admin-demo-badge">Demo data</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}><strong>{cellIndex === 0 ? cell : ''}</strong>{cellIndex !== 0 ? cell : ''}</td>)}</tr>)}</tbody></table></div></section>
}

function AdminDisputes() {
  return <section className="admin-page"><div className="admin-page-heading"><div><p className="eyebrow">Trust operations</p><h2>Disputes</h2><p>Review evidence and keep farmer, buyer and transporter decisions accountable.</p></div></div><div className="admin-dispute-list">{[['Pickup evidence missing', 'Order #FL-2048', 'Transporter', 'Open'], ['Quantity mismatch reported', 'Order #FL-2039', 'Buyer', 'Investigating'], ['Settlement not acknowledged', 'Order #FL-2027', 'Farmer', 'Open']].map(([title, order, reporter, status]) => <article key={order}><div><span>{status}</span><h3>{title}</h3><p>{order} • Reported by {reporter}</p></div><button className="button button-secondary" type="button">Review case</button></article>)}</div></section>
}

function CommonWorkspace({ page, user }) {
  if (page === 'notifications') return <NotificationsPage user={user} />
  if (page === 'profile') return <ProfilePage user={user} />
  return <SettingsPage user={user} />
}

function NotificationsPage({ user }) {
  const notifications = user.role === 'FARMER'
    ? [['New bid', 'A buyer placed an offer on your crop lot.', 'Review buyer bids'], ['Bid accepted', 'Accepted offers become orders ready for transport.', 'View orders'], ['Transporter selected', 'Your selected transporter will appear here.', 'Open transport'], ['Pickup verified', 'Pickup OTP and photos will be recorded here.', 'View evidence'], ['Delivery completed', 'Completed deliveries move toward settlement.', 'View transactions'], ['Payment completed', 'Settlement status will appear after delivery.', 'View transactions']]
    : user.role === 'BUYER'
      ? [['New crop lot', 'Fresh produce is available in the marketplace.', 'Browse marketplace'], ['Bid accepted', 'A farmer accepted bid will become a won deal.', 'View won deals'], ['Transporter selected', 'Your order will show the selected delivery route.', 'View orders'], ['Pickup verified', 'Pickup evidence will be available on the order.', 'View delivery'], ['Delivery completed', 'Confirm delivery to complete the purchase.', 'Open delivery'], ['Payment completed', 'Settlement status will be recorded here.', 'View transactions']]
      : [['New transport job', 'A delivery request is available in the job marketplace.', 'View jobs'], ['Bid selected', 'A farmer-selected bid becomes an active delivery.', 'View bids'], ['Pickup verified', 'Pickup OTP and photos protect the handoff.', 'Open delivery'], ['Delivery completed', 'A completed route strengthens your reliability score.', 'View history'], ['Payment completed', 'Freight settlement status will be recorded here.', 'View history']]
  return <section className="common-page"><div className="common-page-heading"><p className="eyebrow">Notifications</p><h2>Keep the transaction in view.</h2><p>Important events from your {user.role.toLowerCase()} workspace will collect here.</p></div><div className="notification-list">{notifications.map(([title, description, action], index) => <article key={title}><span className="notification-index">0{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div><span className="notification-state">{index < 2 ? 'Relevant now' : 'Coming next'}</span><button className="text-link" type="button">{action} -&gt;</button></article>)}</div></section>
}

function ProfilePage({ user }) {
  const roleLabel = user.role === 'FARMER' ? 'Farmer / FPO' : user.role === 'BUYER' ? 'Buyer' : 'Transporter'
  return <section className="common-page"><div className="common-page-heading"><p className="eyebrow">Profile</p><h2>Your FASALYNK identity.</h2><p>These details identify you across crop lots, bids, deliveries and settlement records.</p></div><div className="profile-layout"><section className="profile-card"><div className="profile-avatar">{(user.fullName || user.username || 'F')[0].toUpperCase()}</div><h3>{user.fullName || user.username}</h3><span className="profile-role">{roleLabel}</span><span className="verified-badge">{user.isVerified ? 'Verified account' : 'Verification pending'}</span></section><section className="profile-fields"><ProfileField label="Full name" value={user.fullName || 'Not provided'} /><ProfileField label="Username" value={`@${user.username || 'Not provided'}`} /><ProfileField label="Email" value={user.email || 'Not provided'} /><ProfileField label="Phone" value={user.phone || 'Not provided'} /><ProfileField label="Role" value={roleLabel} /></section></div></section>
}

function ProfileField({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function SettingsPage({ user }) {
  const [settings, setSettings] = useState({ account: true, notifications: true, language: 'English', security: true })
  function update(name, value) { setSettings({ ...settings, [name]: value }) }
  return <section className="common-page"><div className="common-page-heading"><p className="eyebrow">Settings</p><h2>Make the workspace yours.</h2><p>Control account visibility, notifications, language and security preferences for your {user.role.toLowerCase()} account.</p></div><div className="settings-list"><label className="settings-row"><span><strong>Account visibility</strong><small>Keep your role and verified identity visible in relevant transactions.</small></span><input type="checkbox" checked={settings.account} onChange={(event) => update('account', event.target.checked)} /></label><label className="settings-row"><span><strong>Notifications</strong><small>Receive updates about bids, transport, delivery and settlement.</small></span><input type="checkbox" checked={settings.notifications} onChange={(event) => update('notifications', event.target.checked)} /></label><label className="settings-row"><span><strong>Language</strong><small>Choose the language used across your workspace.</small></span><select value={settings.language} onChange={(event) => update('language', event.target.value)}><option>English</option><option>Hindi</option></select></label><label className="settings-row"><span><strong>Security alerts</strong><small>Notify you when account access or password activity changes.</small></span><input type="checkbox" checked={settings.security} onChange={(event) => update('security', event.target.checked)} /></label></div><div className="settings-note"><span>Preferences saved locally</span><p>These controls are ready to connect to account settings endpoints.</p></div></section>
}

function TransporterWorkspace({ page, prefix, navigate }) {
  const [bids, setBids] = useState([])
  const jobs = [
    { id: 'job-1', pickup: 'Dehradun', destination: 'Haridwar', crop: 'Tomato', quantity: '800 kg', distance: '70 km', vehicle: 'Mini truck', freight: 'INR 2,400' },
    { id: 'job-2', pickup: 'Karnal', destination: 'Delhi Azadpur', crop: 'Basmati Rice', quantity: '1.2 tonnes', distance: '125 km', vehicle: 'Truck', freight: 'INR 5,800' },
    { id: 'job-3', pickup: 'Ratnagiri', destination: 'Pune', crop: 'Alphonso Mango', quantity: '450 kg', distance: '195 km', vehicle: 'Pickup', freight: 'INR 6,200' },
  ]
  const routeId = page.startsWith('jobs/') ? page.slice('jobs/'.length) : page.startsWith('delivery/') ? page.slice('delivery/'.length) : null
  const job = jobs.find((item) => item.id === routeId) || jobs[0]

  function submitTransportBid(values) {
    setBids((current) => [...current.filter((item) => item.jobId !== job.id), { jobId: job.id, jobName: `${job.crop} / ${job.pickup} → ${job.destination}`, price: values.price, vehicle: values.vehicle, status: 'Pending' }])
    navigate(`${prefix}bids`)
  }

  if (page === 'dashboard') return <TransporterDashboard jobs={jobs} navigate={navigate} prefix={prefix} />
  if (page === 'jobs') return <TransporterJobs jobs={jobs} navigate={navigate} prefix={prefix} />
  if (page.startsWith('jobs/')) return <><RouteOptimizationCard route={routeIntelligence(job.pickup, job.destination, job.distance)} /><TransporterJobDetail job={job} existingBid={bids.find((item) => item.jobId === job.id)} submitBid={submitTransportBid} navigate={navigate} prefix={prefix} /></>
  if (page === 'my-bids') return <TransporterBids bids={bids} navigate={navigate} prefix={prefix} />
  if (page === 'delivery' || page.startsWith('delivery/')) return <><RouteOptimizationCard route={routeIntelligence(job.pickup, job.destination, job.distance)} /><TransporterDelivery job={job} navigate={navigate} prefix={prefix} /></>
  if (page === 'history') return <TransporterHistory />
  return <PlaceholderPage page={page} />
}

function TransporterDashboard({ jobs, navigate, prefix }) {
  const stats = [['Available jobs', jobs.length, 'Open delivery requests'], ['Active delivery', 0, 'No active delivery'], ['Completed deliveries', 0, 'History will grow here'], ['Earnings', 'INR 0', 'Dummy settlement state'], ['Reliability score', '96%', 'Based on delivery success']]
  return <section className="transporter-page"><div className="transporter-page-heading"><div><p className="eyebrow">Transporter overview</p><h2>Move produce. Build trust.</h2><p>Find the right delivery, make a clear offer and keep every handoff verifiable.</p></div><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}jobs`)}>Find available jobs</button></div><div className="transporter-stat-grid">{stats.map(([label, value, note]) => <article className="transporter-stat" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div><div className="transporter-dashboard-grid"><section className="transporter-panel"><div className="panel-heading"><div><p className="eyebrow">Open work</p><h3>Available delivery jobs</h3></div><button className="text-link" type="button" onClick={() => navigate(`${prefix}jobs`)}>View all -&gt;</button></div><div className="transporter-job-mini-list">{jobs.slice(0, 3).map((job) => <button type="button" key={job.id} onClick={() => navigate(`${prefix}jobs/${job.id}`)}><span><strong>{job.crop}</strong><small>{job.pickup} → {job.destination} • {job.quantity}</small></span><b>{job.distance}</b></button>)}</div></section><section className="transporter-panel transporter-trust-panel"><p className="eyebrow">Your trust layer</p><h3>96% reliability</h3><p>Keep pickup and delivery evidence complete to make your next bid stronger.</p><button className="button button-secondary" type="button" onClick={() => navigate(`${prefix}history`)}>View delivery history</button></section></div></section>
}

function TransporterJobs({ jobs, navigate, prefix }) {
  return <section className="transporter-page"><div className="transporter-page-heading"><div><p className="eyebrow">Available jobs</p><h2>Choose a route that fits.</h2><p>Review cargo, distance and vehicle requirements before you submit a freight bid.</p></div><span className="result-count">{jobs.length} open jobs</span></div><div className="transporter-job-grid">{jobs.map((job) => <article className="transporter-job-card" key={job.id}><div className="job-route"><span>{job.pickup}</span><b>→</b><span>{job.destination}</span></div><p className="eyebrow">Cargo request</p><h3>{job.crop}</h3><div className="job-facts"><span>Quantity<strong>{job.quantity}</strong></span><span>Distance<strong>{job.distance}</strong></span><span>Suggested freight<strong>{job.freight}</strong></span></div><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}jobs/${job.id}`)}>View job</button></article>)}</div></section>
}

function TransporterJobDetail({ job, existingBid, submitBid, navigate, prefix }) {
  const [form, setForm] = useState({ price: '', vehicle: job.vehicle })
  function submit(event) { event.preventDefault(); submitBid(form) }
  return <section className="transporter-page"><button className="back-link" type="button" onClick={() => navigate(`${prefix}jobs`)}>&lt;- Back to jobs</button><div className="transporter-page-heading"><div><p className="eyebrow">Transport job details</p><h2>{job.crop}: {job.pickup} to {job.destination}</h2><p>Review the route and vehicle fit, then submit a bid for this delivery request.</p></div><span className="job-distance">{job.distance}</span></div><div className="job-detail-layout"><section className="transporter-panel"><div className="job-map-placeholder"><span>{job.pickup}</span><b>→</b><span>{job.destination}</span></div><div className="job-detail-facts"><div><span>Pickup location</span><strong>{job.pickup}</strong></div><div><span>Destination</span><strong>{job.destination}</strong></div><div><span>Cargo</span><strong>{job.crop}</strong></div><div><span>Quantity</span><strong>{job.quantity}</strong></div><div><span>Vehicle requirement</span><strong>{job.vehicle}</strong></div><div><span>Suggested freight</span><strong>{job.freight}</strong></div></div></section><form className="transporter-bid-form" onSubmit={submit}><p className="eyebrow">Your offer</p><h3>Submit bid</h3>{existingBid ? <div className="existing-bid"><strong>Bid submitted</strong><span>{existingBid.price} • {existingBid.vehicle}</span><small>Pending farmer selection</small></div> : <><label>Freight price<input type="number" min="1" placeholder="INR" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label><label>Vehicle type<select value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })}><option>Mini truck</option><option>Pickup</option><option>Truck</option></select></label><button className="button button-primary" type="submit">Submit bid</button></>}<small>Price, reliability, distance and vehicle fit contribute to selection.</small></form></div></section>
}

function TransporterBids({ bids, navigate, prefix }) {
  return <section className="transporter-page"><div className="transporter-page-heading"><div><p className="eyebrow">My transport bids</p><h2>Keep your route offers in view.</h2><p>Pending, selected, rejected and completed delivery bids will collect here.</p></div><button className="button button-secondary" type="button" onClick={() => navigate(`${prefix}jobs`)}>Find another job</button></div><div className="bid-status-summary transporter-bid-summary"><span><b>{bids.filter((bid) => bid.status === 'Pending').length}</b>Pending</span><span><b>{bids.filter((bid) => bid.status === 'Selected').length}</b>Selected</span><span><b>{bids.filter((bid) => bid.status === 'Rejected').length}</b>Rejected</span><span><b>{bids.filter((bid) => bid.status === 'Completed').length}</b>Completed</span></div>{bids.length === 0 ? <TransporterEmpty title="No transport bids yet" text="Open an available job and submit a freight offer to get started." action="View available jobs" onClick={() => navigate(`${prefix}jobs`)} /> : <div className="farmer-table-wrap"><table className="farmer-table"><thead><tr><th>Job</th><th>Vehicle</th><th>Price</th><th>Status</th><th>Action</th></tr></thead><tbody>{bids.map((bid) => <tr key={bid.jobId}><td><strong>{bid.jobName}</strong></td><td>{bid.vehicle}</td><td>{bid.price}</td><td><span className="bid-pill">{bid.status}</span></td><td><button className="text-link" type="button" onClick={() => navigate(`${prefix}jobs/${bid.jobId}`)}>View job -&gt;</button></td></tr>)}</tbody></table></div>}</section>
}

function TransporterDelivery({ job, navigate, prefix }) {
  const [pickupOtp, setPickupOtp] = useState('')
  const [deliveryOtp, setDeliveryOtp] = useState('')
  const [pickupDone, setPickupDone] = useState(false)
  const [deliveryDone, setDeliveryDone] = useState(false)
  const [pickupPhoto, setPickupPhoto] = useState(null)
  const [deliveryPhoto, setDeliveryPhoto] = useState(null)
  return <section className="transporter-page"><button className="back-link" type="button" onClick={() => navigate(`${prefix}bids`)}>&lt;- Back to my bids</button><div className="transporter-page-heading"><div><p className="eyebrow">Active delivery</p><h2>{job.crop}: {job.pickup} to {job.destination}</h2><p>This is your digital crop passport. Complete each evidence step before moving to the next handoff.</p></div><span className="job-distance">{job.distance}</span></div><div className="delivery-passport"><div className={`passport-step ${pickupDone ? 'is-complete' : 'is-active'}`}><div className="passport-step-number">01</div><div><p className="eyebrow">Pickup</p><h3>{pickupDone ? 'Picked Up ✓' : 'Verify pickup'}</h3><p>Enter the farmer OTP and attach pickup photos before the cargo leaves {job.pickup}.</p>{!pickupDone && <div className="passport-controls"><input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" placeholder="Pickup OTP" value={pickupOtp} onChange={(event) => setPickupOtp(event.target.value)} /><label className="passport-file">{pickupPhoto ? pickupPhoto.name : 'Add pickup photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPickupPhoto(event.target.files?.[0] || null)} /></label><button className="button button-primary" type="button" disabled={pickupOtp.length !== 6 || !pickupPhoto} onClick={() => setPickupDone(true)}>Confirm pickup</button></div>}</div></div><div className={`passport-step ${pickupDone && !deliveryDone ? 'is-active' : deliveryDone ? 'is-complete' : ''}`}><div className="passport-step-number">02</div><div><p className="eyebrow">In transit</p><h3>{deliveryDone ? 'Delivered ✓' : 'In transit'}</h3><p>Keep the route status visible while the crop moves to {job.destination}.</p>{pickupDone && !deliveryDone && <div className="transit-status"><span className="status-dot" />Route active • {job.distance} planned</div>}</div></div><div className={`passport-step ${deliveryDone ? 'is-complete' : pickupDone ? 'is-active' : ''}`}><div className="passport-step-number">03</div><div><p className="eyebrow">Delivery</p><h3>{deliveryDone ? 'Delivery completed ✓' : 'Confirm delivery'}</h3><p>Enter the buyer OTP and attach delivery evidence at the final handoff.</p>{pickupDone && !deliveryDone && <div className="passport-controls"><input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" placeholder="Delivery OTP" value={deliveryOtp} onChange={(event) => setDeliveryOtp(event.target.value)} /><label className="passport-file">{deliveryPhoto ? deliveryPhoto.name : 'Add delivery photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setDeliveryPhoto(event.target.files?.[0] || null)} /></label><button className="button button-primary" type="button" disabled={deliveryOtp.length !== 6 || !deliveryPhoto} onClick={() => setDeliveryDone(true)}>Confirm delivery</button></div>}</div></div></div></section>
}

function TransporterHistory() {
  return <section className="transporter-page"><div className="transporter-page-heading"><div><p className="eyebrow">Transporter history</p><h2>A record that earns trust.</h2><p>Previous deliveries, earnings, delivery success and reliability score will build your transporter profile.</p></div></div><div className="transporter-history-grid"><article><span>Completed deliveries</span><strong>0</strong><small>No completed routes yet</small></article><article><span>Delivery success</span><strong>100%</strong><small>Starts with your first verified route</small></article><article><span>Reliability score</span><strong>96%</strong><small>Demo profile score</small></article></div><TransporterEmpty title="Your delivery history is empty" text="Complete a pickup and delivery passport to start building your record." /></section>
}

function TransporterEmpty({ title, text, action, onClick }) {
  return <div className="farmer-empty transporter-empty"><span>FASALYNK TRANSPORTER</span><h3>{title}</h3><p>{text}</p>{action && <button className="button button-primary" type="button" onClick={onClick}>{action}</button>}</div>
}

function BuyerDashboard({ lots, buyerBids, navigate, prefix }) {
  const stats = [['Available crops', lots.length, 'Open lots ready to bid'], ['Active bids', buyerBids.length, 'Offers placed this session'], ['Won deals', 0, 'Accepted bids will appear here'], ['Active deliveries', 0, 'Orders in transit'], ['Spending', 'INR 0', 'Settlement history coming next']]
  return <section className="buyer-page"><div className="buyer-page-heading"><div><p className="eyebrow">Buyer overview</p><h2>Source the next good lot.</h2><p>Find produce, compare the market and keep every accepted deal moving toward delivery.</p></div><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}marketplace`)}>Browse marketplace</button></div><div className="buyer-stat-grid">{stats.map(([label, value, note]) => <article className="buyer-stat" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div><div className="buyer-dashboard-grid"><section className="buyer-panel"><div className="panel-heading"><div><p className="eyebrow">Open supply</p><h3>Fresh crop lots</h3></div><button className="text-link" type="button" onClick={() => navigate(`${prefix}marketplace`)}>View marketplace -&gt;</button></div>{lots.length === 0 ? <BuyerEmpty title="No open crop lots" text="New farmer listings will appear here when they are ready for bids." /> : <div className="buyer-mini-list">{lots.slice(0, 4).map((lot) => <button type="button" key={lot.id} onClick={() => navigate(`${prefix}marketplace/${lot.id}`)}><span className="crop-icon small">{lot.cropName[0]}</span><span><strong>{lot.cropName}</strong><small>{lot.quantityKg} kg • {lot.locationName}</small></span><b>View</b></button>)}</div>}</section><section className="buyer-panel buyer-shortcuts"><p className="eyebrow">Buyer shortcuts</p><h3>Keep decisions moving.</h3><button className="button button-secondary" type="button" onClick={() => navigate(`${prefix}my-bids`)}>Review my bids</button><button className="button button-secondary" type="button" onClick={() => navigate(`${prefix}orders`)}>Track orders</button></section></div></section>
}

function BuyerMarketplace({ lots, navigate, prefix }) {
  const [filters, setFilters] = useState({ crop: '', location: '', grade: '', quantity: '', price: '', harvestDate: '' })
  const filteredLots = lots.filter((lot) => (!filters.crop || lot.cropName.toLowerCase().includes(filters.crop.toLowerCase())) && (!filters.location || lot.locationName.toLowerCase().includes(filters.location.toLowerCase())) && (!filters.grade || lot.grade === filters.grade) && (!filters.quantity || Number(lot.quantityKg) >= Number(filters.quantity)) && (!filters.harvestDate || lot.harvestDate <= filters.harvestDate) && (!filters.price || !lot.expectedPricePerKg || Number(lot.expectedPricePerKg) <= Number(filters.price)))
  function updateFilter(name, value) { setFilters({ ...filters, [name]: value }) }
  return <section className="buyer-page"><div className="buyer-page-heading"><div><p className="eyebrow">Crop marketplace</p><h2>Find the next good lot.</h2><p>Filter by what matters to your purchase and open a lot to inspect its full bid story.</p></div><span className="result-count">{filteredLots.length} of {lots.length} lots</span></div><div className="market-filter-bar"><label>Crop<input value={filters.crop} onChange={(event) => updateFilter('crop', event.target.value)} placeholder="e.g. tomato" /></label><label>Location<input value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} placeholder="e.g. Dehradun" /></label><label>Min quantity<input type="number" value={filters.quantity} onChange={(event) => updateFilter('quantity', event.target.value)} placeholder="kg" /></label><label>Grade<select value={filters.grade} onChange={(event) => updateFilter('grade', event.target.value)}><option value="">Any grade</option><option>A</option><option>B</option><option>C</option><option>Premium</option></select></label><label>Max price / kg<input type="number" value={filters.price} onChange={(event) => updateFilter('price', event.target.value)} placeholder="INR" /></label><label>Harvested before<input type="date" value={filters.harvestDate} onChange={(event) => updateFilter('harvestDate', event.target.value)} /></label></div>{filteredLots.length === 0 ? <BuyerEmpty title="No lots match these filters" text="Try widening the location, grade or price range." action="Clear filters" onClick={() => setFilters({ crop: '', location: '', grade: '', quantity: '', price: '', harvestDate: '' })} /> : <div className="buyer-market-grid">{filteredLots.map((lot) => <button className="buyer-market-card" type="button" key={lot.id} onClick={() => navigate(`${prefix}marketplace/${lot.id}`)}><div className="lot-card-top"><span className="crop-icon small">{lot.cropName[0]}</span><span className="lot-status">Bidding open</span></div><h3>{lot.cropName}</h3><p>{lot.quantityKg} kg • Grade {lot.grade}</p><p>{lot.locationName} • Harvest {lot.harvestDate}</p><strong>{lot.expectedPricePerKg ? `Expected INR ${lot.expectedPricePerKg}/kg` : 'Price open to offers'}</strong><span className="text-link">View crop details -&gt;</span></button>)}</div>}</section>
}

function BuyerLotDetail({ detail, submitBid, navigate, prefix }) {
  const [bid, setBid] = useState({ pricePerKg: '', quantityKg: '' })
  if (!detail) return <BuyerEmpty title="Crop lot not found" text="This lot may still be loading or is no longer open for bidding." action="Back to marketplace" onClick={() => navigate(`${prefix}marketplace`)} />
  const { lot, bids } = detail
  const currentBid = bids[0]
  async function placeBid(event) { event.preventDefault(); if (await submitBid(lot.id, bid)) setBid({ pricePerKg: '', quantityKg: '' }) }
  return <section className="buyer-page"><button className="back-link" type="button" onClick={() => navigate(`${prefix}marketplace`)}>&lt;- Back to marketplace</button><div className="buyer-detail-heading"><div><p className="eyebrow">Crop details / place bid</p><h2>{lot.cropName}</h2><p>{lot.farmerName || 'Verified farmer / FPO'} • {lot.locationName}</p></div><span className="lot-status">{lot.status === 'BIDDING_OPEN' ? 'Bidding open' : 'Deal locked'}</span></div><div className="buyer-detail-overview"><div className="detail-facts buyer-facts"><div><span>Quantity</span><strong>{lot.quantityKg} kg</strong></div><div><span>Grade</span><strong>{lot.grade}</strong></div><div><span>Harvest date</span><strong>{lot.harvestDate}</strong></div><div><span>Current bid</span><strong>{currentBid ? `INR ${currentBid.pricePerKg}/kg` : 'No bids yet'}</strong></div></div><section className="buyer-photo-panel"><p className="eyebrow">Crop photos</p>{lot.photoUrls?.length ? <div className="crop-photo-grid">{lot.photoUrls.map((url) => <img key={url} src={`http://localhost:4000${url}`} alt={`${lot.cropName} crop`} />)}</div> : <div className="photo-placeholder"><span>+</span><p>Farmer has not added photos yet.</p></div>}</section></div><div className="buyer-detail-columns"><section className="buyer-panel"><div className="panel-heading"><div><p className="eyebrow">Market activity</p><h3>Current offers</h3></div><span>{bids.length} bidders</span></div>{bids.length === 0 ? <p className="buyer-muted">No buyer offers yet. Your bid can set the starting signal.</p> : <div className="buyer-offer-list">{bids.map((item, index) => <div key={item.id}><span>#{index + 1} offer</span><strong>INR {item.pricePerKg}/kg</strong><small>{item.quantityKg} kg requested</small></div>)}</div>}</section>{lot.status === 'BIDDING_OPEN' && <form className="buyer-bid-form" onSubmit={placeBid}><p className="eyebrow">Your offer</p><h3>Place bid</h3><label>Price per kg<input type="number" min="1" value={bid.pricePerKg} onChange={(event) => setBid({ ...bid, pricePerKg: event.target.value })} required /></label><label>Quantity in kg<input type="number" min="1" max={lot.quantityKg} value={bid.quantityKg} onChange={(event) => setBid({ ...bid, quantityKg: event.target.value })} required /></label><button className="button button-primary" type="submit">Place bid</button><small>Your offer will be visible to the farmer for review.</small></form>}</div></section>
}

function BuyerBids({ bids, lotDetails, navigate, prefix }) {
  const getStatus = (bid) => { const detail = lotDetails[bid.lotId]; const current = detail?.bids?.[0]; return detail?.lot.status === 'SOLD' ? 'Won' : current && Number(current.pricePerKg) > Number(bid.pricePerKg) ? 'Outbid' : bid.status }
  return <section className="buyer-page"><div className="buyer-page-heading"><div><p className="eyebrow">My bids</p><h2>Keep your offers in view.</h2><p>Track your price against the current market and return to any lot before bidding closes.</p></div><button className="button button-secondary" type="button" onClick={() => navigate(`${prefix}marketplace`)}>Browse crops</button></div><div className="bid-status-summary"><span><b>{bids.filter((bid) => getStatus(bid) === 'ACTIVE').length}</b>Active</span><span><b>{bids.filter((bid) => getStatus(bid) === 'Outbid').length}</b>Outbid</span><span><b>{bids.filter((bid) => getStatus(bid) === 'Won').length}</b>Won</span><span><b>{bids.filter((bid) => getStatus(bid) === 'Lost').length}</b>Lost</span></div>{bids.length === 0 ? <BuyerEmpty title="You have not placed a bid yet" text="Open a crop lot, review its details and place an offer that fits your buying plan." action="Open marketplace" onClick={() => navigate(`${prefix}marketplace`)} /> : <div className="farmer-table-wrap"><table className="farmer-table buyer-bids-table"><thead><tr><th>Crop</th><th>Your bid</th><th>Current bid</th><th>Quantity</th><th>Status</th><th>Action</th></tr></thead><tbody>{bids.map((bid) => { const detail = lotDetails[bid.lotId]; const current = detail?.bids?.[0]; const status = getStatus(bid); return <tr key={bid.id}><td><strong>{bid.cropName}</strong></td><td>INR {bid.pricePerKg}/kg</td><td>{current ? `INR ${current.pricePerKg}/kg` : 'Pending'}</td><td>{bid.quantityKg} kg</td><td><span className={`bid-pill ${status === 'Outbid' ? 'is-outbid' : ''}`}>{status}</span></td><td><button className="text-link" type="button" onClick={() => navigate(`${prefix}marketplace/${bid.lotId}`)}>Open lot -&gt;</button></td></tr>})}</tbody></table></div>}</section>
}

function BuyerDeals({ navigate, prefix }) {
  return <section className="buyer-page"><div className="buyer-page-heading"><div><p className="eyebrow">Won deals</p><h2>Deals you have secured.</h2><p>Accepted bids will become orders here, ready for transport and delivery tracking.</p></div></div><BuyerEmpty title="No won deals yet" text="When a farmer accepts one of your bids, the locked deal will appear here." action="Find a crop lot" onClick={() => navigate(`${prefix}marketplace`)} /></section>
}

function BuyerOrders({ navigate, prefix }) {
  return <section className="buyer-page"><div className="buyer-page-heading"><div><p className="eyebrow">Buyer orders</p><h2>Track every purchase to delivery.</h2><p>Orders will move from deal lock through transport, pickup, transit, delivery and settlement.</p></div></div><BuyerOrderTimeline navigate={navigate} prefix={prefix} /></section>
}

function BuyerOrderTimeline({ navigate, prefix }) {
  const stages = ['Deal Locked', 'Transport', 'Pickup', 'Transit', 'Delivery', 'Settlement']
  return <div className="buyer-order-card"><div className="order-stage-line">{stages.map((stage, index) => <div className={index === 0 ? 'is-current' : ''} key={stage}><span>{index + 1}</span><strong>{stage}</strong></div>)}</div><div className="order-empty-content"><p className="eyebrow">No active orders</p><h3>Your first won deal will appear here.</h3><p>After a farmer accepts your bid, use this view to follow the shipment and confirm delivery.</p><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}marketplace`)}>Browse marketplace</button></div></div>
}

function BuyerDelivery({ navigate, prefix }) {
  const [otp, setOtp] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  return <section className="buyer-page"><button className="back-link" type="button" onClick={() => navigate(`${prefix}orders`)}>&lt;- Back to orders</button><div className="buyer-page-heading"><div><p className="eyebrow">Delivery verification</p><h2>Confirm the crop arrived.</h2><p>Review the shipment record, pickup evidence and route status before entering the delivery OTP.</p></div></div><div className="delivery-grid"><section className="buyer-panel"><p className="eyebrow">Shipment</p><h3>Order ready for delivery confirmation</h3><div className="shipment-facts"><span>Crop<strong>Awaiting order</strong></span><span>Route<strong>Pickup → Buyer</strong></span><span>Status<strong>{confirmed ? 'Delivered' : 'Delivery pending'}</strong></span></div><div className="delivery-route"><span className="is-done">Pickup verified</span><span className="is-current">In transit</span><span className={confirmed ? 'is-done' : ''}>Delivery confirmation</span></div></section><section className="buyer-bid-form delivery-form"><p className="eyebrow">Delivery OTP</p><h3>{confirmed ? 'Delivery confirmed ✓' : 'Enter the code from the handoff'}</h3>{confirmed ? <p className="buyer-muted">The delivery evidence is now recorded for this order.</p> : <><label>6-digit OTP<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="000000" /></label><button className="button button-primary" type="button" disabled={otp.length !== 6} onClick={() => setConfirmed(true)}>Confirm delivery</button><small>Live OTP verification will connect to the order API.</small></>}</section></div><section className="buyer-panel delivery-evidence"><p className="eyebrow">Evidence</p><h3>Pickup photos and delivery record</h3><div className="photo-placeholder"><span>+</span><p>Pickup photos will appear when the transporter uploads them.</p></div></section></section>
}

function BuyerTransactions() {
  return <section className="buyer-page"><div className="buyer-page-heading"><div><p className="eyebrow">Transactions</p><h2>Purchases and payment status.</h2><p>Completed purchases will show crop, farmer, quantity, final amount and dummy payment state here.</p></div></div><BuyerEmpty title="No completed purchases yet" text="A completed order will appear here after delivery and settlement." /></section>
}

function BuyerEmpty({ title, text, action, onClick }) {
  return <div className="farmer-empty buyer-empty"><span>FASALYNK BUYER</span><h3>{title}</h3><p>{text}</p>{action && <button className="button button-primary" type="button" onClick={onClick}>{action}</button>}</div>
}

function FarmerDashboard({ lots, activeLots, allBids, soldLots, navigate, prefix }) {
  const stats = [['Active crop lots', activeLots.length, 'Currently open for offers'], ['Total bids', allBids.length, 'Across your listings'], ['Active orders', 0, 'Orders appear after bid acceptance'], ['Completed transactions', soldLots.length, 'Sold lots in your workspace'], ['Earnings', 'INR 0', 'Settlement tracking coming next']]
  return <section className="farmer-page"><div className="farmer-page-heading"><div><p className="eyebrow">Farmer overview</p><h2>Good morning. Here is your harvest desk.</h2><p>Keep listings moving, compare buyer interest and follow each accepted deal toward delivery.</p></div><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}crops/new`)}>+ Post New Crop</button></div><div className="farmer-stat-grid">{stats.map(([label, value, note]) => <article className="farmer-stat" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div><div className="farmer-dashboard-grid"><section className="farmer-panel"><div className="panel-heading"><div><p className="eyebrow">Your crop lots</p><h3>Recent activity</h3></div><button className="text-link" type="button" onClick={() => navigate(`${prefix}crops`)}>View all -&gt;</button></div>{lots.length === 0 ? <EmptyFarmerState title="No crop lots yet" text="Publish your first lot to start receiving buyer offers." action="Post a crop" onClick={() => navigate(`${prefix}crops/new`)} /> : <div className="farmer-mini-list">{lots.slice(0, 4).map((lot) => <button type="button" key={lot.id} onClick={() => navigate(`${prefix}crops/${lot.id}`)}><span className="crop-icon small">{lot.cropName[0]}</span><span><strong>{lot.cropName}</strong><small>{lot.quantityKg} kg • {lot.locationName}</small></span><b>{lot.status === 'BIDDING_OPEN' ? 'Bidding' : 'Sold'}</b></button>)}</div>}</section><section className="farmer-panel notification-panel"><div className="panel-heading"><div><p className="eyebrow">Notifications</p><h3>What needs attention</h3></div><span className="notification-count">{allBids.length}</span></div>{allBids.length ? <p>You have {allBids.length} buyer offer{allBids.length === 1 ? '' : 's'} to review.</p> : <p>No new notifications. Buyer activity will appear here as your listings receive offers.</p>}<button className="button button-secondary" type="button" onClick={() => navigate(`${prefix}bids`)}>Review buyer bids</button></section></div></section>
}

function FarmerCropLots({ lots, navigate, prefix }) {
  const groups = [['All', lots], ['Active', lots.filter((lot) => lot.status === 'BIDDING_OPEN')], ['Bidding', lots.filter((lot) => lot.status === 'BIDDING_OPEN')], ['Sold', lots.filter((lot) => lot.status === 'SOLD')], ['Completed', []]]
  return <section className="farmer-page"><div className="farmer-page-heading"><div><p className="eyebrow">Crop lots</p><h2>Everything you have put to market.</h2><p>Open a lot to inspect buyer interest, compare bids and lock the strongest offer.</p></div><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}crops/new`)}>+ Post New Crop</button></div><div className="status-summary">{groups.map(([label, items]) => <span key={label}><b>{items.length}</b>{label}</span>)}</div>{lots.length === 0 ? <EmptyFarmerState title="Your crop board is empty" text="Add the crop, grade, harvest date and location buyers need to make an offer." action="Post a crop lot" onClick={() => navigate(`${prefix}crops/new`)} /> : <div className="farmer-crop-grid">{lots.map((lot) => <button className="farmer-crop-card" type="button" key={lot.id} onClick={() => navigate(`${prefix}crops/${lot.id}`)}><div className="lot-card-top"><span className="crop-icon small">{lot.cropName[0]}</span><span className={`lot-status ${lot.status === 'SOLD' ? 'is-sold' : ''}`}>{lot.status === 'BIDDING_OPEN' ? 'Bidding open' : 'Sold'}</span></div><h3>{lot.cropName}</h3><p>{lot.quantityKg} kg • Grade {lot.grade}</p><p>{lot.locationName} • Harvest {lot.harvestDate}</p><span className="text-link">Open lot -&gt;</span></button>)}</div>}</section>
}

function FarmerCropForm({ form, setForm, createLot }) {
  return <form className="lot-form farmer-crop-form" onSubmit={createLot}><div className="form-heading"><p className="eyebrow">New crop lot</p><h2>Tell buyers what is ready.</h2><p>Clear information helps buyers decide faster and gives your listing a stronger starting point.</p></div>{[['cropName', 'Crop', 'text'], ['quantityKg', 'Quantity in kg', 'number'], ['harvestDate', 'Harvest date', 'date'], ['locationName', 'Location', 'text'], ['expectedPricePerKg', 'Expected price / kg', 'number']].map(([name, label, type]) => <label key={name}>{label}{name === 'expectedPricePerKg' && <span className="optional"> optional</span>}<input name={name} type={type} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} required={!['expectedPricePerKg'].includes(name)} /></label>)}<label>Grade<select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}><option>A</option><option>B</option><option>C</option></select></label><label className="file-field">Crop photos <span>JPG, PNG or WebP, up to 5 MB each</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setForm({ ...form, photos: Array.from(event.target.files || []) })} /></label><div className="form-submit-row"><p>Photos, grade and location make the lot easier to trust.</p><button className="button button-primary" type="submit">Publish crop lot</button></div></form>
}

function AIPriceIntelligence({ lot, bids }) {
  const insight = priceIntelligence(lot, bids)
  return <section className="ai-intelligence-card"><div className="ai-card-heading"><div><p className="eyebrow">AI price intelligence</p><h3>Market signal for {lot.cropName}</h3></div><span className="ai-badge">Rule-based insight</span></div><div className="ai-insight-grid"><div><span>Suggested price</span><strong>INR {insight.low}-{insight.high}/kg</strong></div><div><span>Demand</span><strong>{insight.demand}</strong></div><div><span>Market signal</span><strong>{insight.signal}</strong></div></div><div className="ai-recommendation"><span>Recommendation</span><strong>{insight.recommendation}</strong><small>Uses expected price, current bids, bid count and crop grade. It is guidance, not a live market forecast.</small></div></section>
}

function RouteOptimizationCard({ route }) {
  return <section className="route-intelligence-card"><div className="ai-card-heading"><div><p className="eyebrow">Route optimization</p><h3>{route.pickup} → {route.destination}</h3></div><span className="ai-badge">Best route</span></div><div className="route-summary"><strong>{route.distance}</strong><span>Estimated {route.eta}</span></div><p>{route.route}. The estimate favors fewer stops to reduce handoff time and route uncertainty.</p></section>
}

function SmartFreightCard({ transporter, cargoKg = 800 }) {
  return <section className="smart-freight-card"><div className="ai-card-heading"><div><p className="eyebrow">Smart freight</p><h3>Recommended transporter</h3></div><span className="ai-badge">Score {transporter.score}</span></div><div className="smart-freight-main"><strong>{transporter.name}</strong><b>INR {transporter.price.toLocaleString('en-IN')}</b></div><div className="smart-freight-facts"><span>{transporter.distance} km away</span><span>{transporter.reliability}% reliability</span><span>{transporter.vehicle} • {transporter.capacity >= cargoKg ? 'Suitable vehicle' : 'Capacity check'}</span></div><small>Score balances price, reliability, distance and capacity for {cargoKg} kg cargo.</small></section>
}

function FarmerLotDetail({ detail, acceptBid, navigate, prefix }) {
  if (!detail) return <EmptyFarmerState title="Crop lot not found" text="This lot may still be loading or is no longer available." action="Back to crop lots" onClick={() => navigate(`${prefix}crops`)} />
  const { lot, bids } = detail
  const highestBid = bids[0]
  return <section className="farmer-page"><button className="back-link" type="button" onClick={() => navigate(`${prefix}crops`)}>&lt;- Back to crop lots</button><div className="farmer-detail-heading"><div><p className="eyebrow">Crop lot details</p><h2>{lot.cropName}</h2><p>{lot.locationName} • Harvested {lot.harvestDate}</p></div><span className={`lot-status detail-status ${lot.status === 'SOLD' ? 'is-sold' : ''}`}>{lot.status === 'BIDDING_OPEN' ? 'Bidding open' : 'DEAL LOCKED ✓'}</span></div><div className="detail-overview"><div className="detail-facts farmer-facts"><div><span>Quantity</span><strong>{lot.quantityKg} kg</strong></div><div><span>Grade</span><strong>{lot.grade}</strong></div><div><span>Highest bid</span><strong>{highestBid ? `INR ${highestBid.pricePerKg}/kg` : 'No bids yet'}</strong></div><div><span>Number of bidders</span><strong>{bids.length}</strong></div></div><div className="ai-price-card"><span>AI suggested price</span><strong>{lot.expectedPricePerKg ? `INR ${lot.expectedPricePerKg}/kg` : 'Awaiting price guidance'}</strong><small>Demo guidance uses the farmer's expected price until market intelligence is connected.</small></div></div><div className="farmer-detail-columns"><section className="farmer-panel"><div className="panel-heading"><div><p className="eyebrow">Bid history</p><h3>Buyer offers</h3></div><span>{bids.length} total</span></div>{bids.length === 0 ? <EmptyFarmerState title="No buyer bids yet" text="Your lot is live. New offers will appear here." /> : <div className="farmer-bid-list">{bids.map((bid) => <div className="farmer-bid-row" key={bid.id}><div><strong>{bid.buyerName}</strong><small>{bid.quantityKg} kg requested</small></div><b>INR {bid.pricePerKg}/kg</b><span className="bid-pill">{bid.status}</span><span>{lot.status === 'BIDDING_OPEN' && bid.status === 'ACTIVE' ? <button className="button button-primary" type="button" onClick={() => acceptBid(lot.id, bid.id)}>Accept bid</button> : 'Offer recorded'}</span></div>)}</div>}</section><section className="farmer-panel photo-panel"><p className="eyebrow">Crop photos</p>{lot.photoUrls?.length ? <div className="crop-photo-grid">{lot.photoUrls.map((url) => <img key={url} src={`http://localhost:4000${url}`} alt={`${lot.cropName} crop`} />)}</div> : <div className="photo-placeholder"><span>+</span><p>No photos uploaded for this lot.</p></div>}</section></div></section>
}

function FarmerBids({ bids, navigate, prefix }) {
  return <section className="farmer-page"><div className="farmer-page-heading"><div><p className="eyebrow">Buyer bids</p><h2>Choose the offer that works for you.</h2><p>Compare price, quantity and status before turning a bidding lot into a locked deal.</p></div><button className="button button-secondary" type="button" onClick={() => navigate(`${prefix}crops`)}>View crop lots</button></div><div className="farmer-table-wrap">{bids.length === 0 ? <EmptyFarmerState title="No offers to review" text="Active buyer offers will appear here when someone bids on your crop lots." /> : <table className="farmer-table"><thead><tr><th>Crop</th><th>Buyer</th><th>Quantity</th><th>Price</th><th>Status</th><th>Action</th></tr></thead><tbody>{bids.map((bid) => <tr key={bid.id}><td><strong>{bid.cropName}</strong></td><td>{bid.buyerName}</td><td>{bid.quantityKg} kg</td><td>INR {bid.pricePerKg}/kg</td><td><span className="bid-pill">{bid.status}</span></td><td>{bid.status === 'ACTIVE' ? <button className="text-link" type="button" onClick={() => navigate(`${prefix}crops`)}>Open lot -&gt;</button> : 'Recorded'}</td></tr>)}</tbody></table>}</div></section>
}

function FarmerOrders({ navigate, prefix }) {
  const stages = ['Deal Locked', 'Transport', 'Pickup', 'Transit', 'Delivery', 'Settlement']
  return <section className="farmer-page"><div className="farmer-page-heading"><div><p className="eyebrow">Orders</p><h2>Follow every accepted deal.</h2><p>Orders will move through transport, verification and settlement as those APIs come online.</p></div></div><div className="order-stage-card"><div className="order-stage-line">{stages.map((stage, index) => <div className={index === 0 ? 'is-current' : ''} key={stage}><span>{index + 1}</span><strong>{stage}</strong></div>)}</div><div className="order-empty-content"><p className="eyebrow">No active orders</p><h3>Your first accepted bid will start an order here.</h3><p>Once a deal is locked, choose self transport or request transporter bids from the next step.</p><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}crops`)}>Review crop lots</button></div></div></section>
}

function FarmerTransportChoice({ navigate, prefix }) {
  const [choice, setChoice] = useState('')
  return <section className="farmer-page"><button className="back-link" type="button" onClick={() => navigate(`${prefix}orders`)}>&lt;- Back to orders</button><div className="farmer-page-heading"><div><p className="eyebrow">Transport selection</p><h2>How will this crop be transported?</h2><p>Choose the path that fits this order. You can change the choice before pickup begins.</p></div></div><div className="transport-choice-grid"><button className={choice === 'self' ? 'transport-choice is-selected' : 'transport-choice'} type="button" onClick={() => setChoice('self')}><span>01</span><h3>Self Transport</h3><p>Use your own vehicle or arrange delivery directly. The order moves toward pickup without opening a transporter request.</p><strong>{choice === 'self' ? 'Selected ✓' : 'Choose self transport -&gt;'}</strong></button><button className={choice === 'marketplace' ? 'transport-choice is-selected' : 'transport-choice'} type="button" onClick={() => setChoice('marketplace')}><span>02</span><h3>Need Transport</h3><p>Open the delivery to transporter bids and compare price, distance, reliability and vehicle fit.</p><strong>{choice === 'marketplace' ? 'Selected ✓' : 'Find a transporter -&gt;'}</strong></button></div>{choice === 'marketplace' && <div className="choice-confirm"><p>Transport marketplace selected.</p><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}transporters`)}>View transporter bids</button></div>}{choice === 'self' && <div className="choice-confirm"><p>Self transport selected. Pickup preparation is next.</p><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}orders`)}>Return to order</button></div>}</section>
}

function FarmerTransporters({ navigate, prefix }) {
  const transporters = [['Arjun Logistics', 'INR 2,400', '18 km', '96%', 'Mini truck', '1.5 tonnes'], ['Green Route Fleet', 'INR 2,650', '11 km', '91%', 'Pickup', '1 tonne'], ['Kisan Move Co.', 'INR 2,300', '34 km', '88%', 'Truck', '3 tonnes']]
  return <section className="farmer-page"><button className="back-link" type="button" onClick={() => navigate(`${prefix}transport`)}>&lt;- Back to transport choice</button><div className="farmer-page-heading"><div><p className="eyebrow">Transporter selection</p><h2>Compare the delivery bids.</h2><p>Best-value scoring considers price, reliability, distance and vehicle fit. These sample rows are ready for the transport API.</p></div></div><div className="transporter-list">{transporters.map(([name, price, distance, reliability, vehicle, capacity], index) => <article className="transporter-row" key={name}><div className="transporter-rank">{index === 0 ? 'Best value' : `0${index + 1}`}</div><div><h3>{name}</h3><p>{vehicle} • {capacity}</p></div><div><span>Price</span><strong>{price}</strong></div><div><span>Distance</span><strong>{distance}</strong></div><div><span>Reliability</span><strong>{reliability}</strong></div><button className="button button-primary" type="button" onClick={() => navigate(`${prefix}orders`)}>Select transporter</button></article>)}</div></section>
}

function FarmerTransactions() {
  return <section className="farmer-page"><div className="farmer-page-heading"><div><p className="eyebrow">Transactions</p><h2>Sales and settlement history.</h2><p>Completed sales, transport costs and dummy payment states will collect here as orders reach settlement.</p></div></div><div className="farmer-table-wrap"><EmptyFarmerState title="No completed transactions yet" text="After an order is delivered and settled, the crop, buyer, final amount and payment status will appear here." /></div></section>
}

function EmptyFarmerState({ title, text, action, onClick }) {
  return <div className="farmer-empty"><span>FASALYNK FARMER</span><h3>{title}</h3><p>{text}</p>{action && <button className="button button-primary" type="button" onClick={onClick}>{action}</button>}</div>
}

function Marketplace({ user, page, lots, form, setForm, createLot, openLot, selectedLot, closeLot, bid, setBid, placeBid, acceptBid }) {
  if (page === 'post-crop') return <form className="lot-form standalone-form" onSubmit={createLot}><div className="form-heading"><p className="eyebrow">New listing</p><h2>Tell buyers what is ready.</h2></div>{[['cropName', 'Crop name', 'text'], ['quantityKg', 'Quantity in kg', 'number'], ['harvestDate', 'Harvest date', 'date'], ['locationName', 'Location', 'text'], ['expectedPricePerKg', 'Expected price / kg', 'number']].map(([name, label, type]) => <label key={name}>{label}<input name={name} type={type} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} required={name !== 'expectedPricePerKg'} /></label>)}<label>Grade<select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}><option>A</option><option>B</option><option>C</option></select></label><label className="file-field">Crop photos <span>JPG, PNG or WebP, up to 5 MB each</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setForm({ ...form, photos: Array.from(event.target.files || []) })} /></label><button className="button button-primary" type="submit">Publish crop lot</button></form>
  return <section className="marketplace-section"><div className="marketplace-heading"><div><p className="eyebrow">{user.role === 'FARMER' ? 'Your crop lots' : 'Open marketplace'}</p><h2>{user.role === 'FARMER' ? 'Crop lots and buyer interest' : 'Find the next good lot'}</h2></div><span>{lots.length} lots</span></div>{lots.length === 0 ? <p className="empty-state">No crop lots yet.</p> : <div className="lot-grid">{lots.map((lot) => <article className="lot-card" key={lot.id} onClick={() => openLot(lot)}><div className="lot-card-top"><span className="crop-icon small">{lot.cropName[0]}</span><span className="lot-status">{lot.status === 'BIDDING_OPEN' ? 'Bidding open' : 'Deal locked'}</span></div><h3>{lot.cropName}</h3><p>{lot.quantityKg} kg / Grade {lot.grade}</p><p>{lot.locationName} / {lot.harvestDate}</p><button className="text-link" type="button">View details -&gt;</button></article>)}</div>}{selectedLot && <LotDetails user={user} data={selectedLot} close={closeLot} bid={bid} setBid={setBid} placeBid={placeBid} acceptBid={acceptBid} />}</section>
}

function LotDetails({ user, data, close, bid, setBid, placeBid, acceptBid }) {
  return <div className="lot-detail-backdrop" role="presentation"><section className="lot-detail" role="dialog" aria-modal="true"><button className="auth-close" type="button" onClick={close}>×</button><p className="eyebrow">Crop lot details</p><h2>{data.lot.cropName}</h2><p className="lot-detail-sub">{data.lot.quantityKg} kg / Grade {data.lot.grade} / {data.lot.locationName}</p><h3>Buyer offers <span>{data.bids.length}</span></h3><div className="bid-list">{data.bids.map((item) => <div className="bid-row" key={item.id}><div><strong>INR {item.pricePerKg}/kg</strong><span>{item.quantityKg} kg / {item.buyerName}</span></div>{user.role === 'FARMER' && data.lot.status === 'BIDDING_OPEN' && <button className="button button-primary" type="button" onClick={() => acceptBid(item.id)}>Accept bid</button>}</div>)}</div>{user.role === 'BUYER' && data.lot.status === 'BIDDING_OPEN' && <form className="bid-form" onSubmit={placeBid}><h3>Place your offer</h3><input type="number" placeholder="Price per kg" value={bid.pricePerKg} onChange={(event) => setBid({ ...bid, pricePerKg: event.target.value })} required /><input type="number" placeholder="Quantity in kg" value={bid.quantityKg} onChange={(event) => setBid({ ...bid, quantityKg: event.target.value })} required /><button className="button button-primary" type="submit">Place bid</button></form>}</section></div>
}

function PlaceholderPage({ page }) {
  const labels = { dashboard: 'Dashboard overview', orders: 'Orders and progress', transport: 'Transport selection', transporters: 'Transporter marketplace', transactions: 'Transactions and settlement', notifications: 'Notifications', profile: 'Profile and security', settings: 'Settings', jobs: 'Available transport jobs', delivery: 'Active delivery', history: 'Transporter history', 'my-bids': 'My bids', deals: 'Won deals', bids: 'Buyer bids' }
  return <section className="page-panel"><p className="eyebrow">FASALYNK workspace</p><h2>{labels[page] || page}</h2><p>This page is separated and ready for its next API-backed feature.</p><div className="page-panel-placeholder"><span>Foundation page</span><strong>Next feature layer</strong></div></section>
}
