export const roles = [
  { id: 'farmer', label: 'Farmer / FPO', description: 'Post produce and review buyer offers.' },
  { id: 'buyer', label: 'Buyer', description: 'Discover lots and place competitive bids.' },
  { id: 'transporter', label: 'Transporter', description: 'Find delivery jobs and build trust.' },
]

export const roleNavigation = {
  FARMER: [
    ['dashboard', 'Dashboard'], ['crops', 'My Crop Lots'], ['post-crop', 'Post Crop'], ['bids', 'Buyer Bids'], ['orders', 'Orders'], ['transport', 'Transport Selection'], ['transporters', 'Transporters'], ['transactions', 'Transactions'],
  ],
  BUYER: [
    ['dashboard', 'Dashboard'], ['marketplace', 'Marketplace'], ['my-bids', 'My Bids'], ['deals', 'Won Deals'], ['orders', 'Orders'], ['delivery', 'Delivery'], ['transactions', 'Transactions'],
  ],
  TRANSPORTER: [
    ['dashboard', 'Dashboard'], ['jobs', 'Available Jobs'], ['my-bids', 'My Bids'], ['delivery', 'Active Delivery'], ['history', 'History'],
  ],
}

export const commonNavigation = [
  ['notifications', 'Notifications'], ['profile', 'Profile'], ['settings', 'Settings'],
]

export const publicNavigation = [
  ['/how-it-works', 'How It Works'], ['/marketplace', 'Marketplace'], ['/about', 'About'], ['/help', 'Help'],
]
