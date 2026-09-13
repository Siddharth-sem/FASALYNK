# FASALYNK

FASALYNK is a marketplace foundation for one complete farm-to-buyer transaction:
crop lot -> buyer bids -> deal locked -> transport -> verified delivery -> settlement.

This repository is deliberately starting small. The first commit gives us a usable
frontend shell and a backend health endpoint. Features will be added around the
transaction flow instead of building disconnected screens.

## Project folders

- `frontend/` - React + Vite user interface.
- `backend/` - Node + Express API.

## Run the foundation

Open two terminals from the repository root.

```bash
cd frontend
npm install
npm run dev
```

```bash
cd backend
npm install
npm run dev
```

The frontend runs on the Vite URL shown in the terminal. The API runs at
`http://localhost:4000`. Check it with:

```bash
curl http://localhost:4000/api/health
```

## Database: what to do next

PostgreSQL is the right next dependency. Install PostgreSQL locally or create a
small hosted PostgreSQL database. PostGIS can be enabled when location search is
implemented; it is not required for this first foundation.

Create a database named `fasalynk`, copy `backend/.env.example` to `backend/.env`,
and update the password:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/fasalynk
```

Install the backend dependencies and run the schema:

```bash
cd backend
npm install
npm run db:setup
npm run dev
```

Confirm the database connection with:

```bash
curl http://localhost:4000/api/health/database
```

Never commit `backend/.env`; it contains your local database credentials.

The first schema should be relational and small:

1. `users` - login identity, role, contact and verification status.
2. `crop_lots` - farmer, crop, quantity, grade, harvest date, photos and location.
3. `bids` - crop lot, buyer, price, quantity, timestamp and status.
4. `orders` - accepted bid and the current order state.
5. `transport_requests` and `transport_bids` - optional delivery marketplace.
6. `verification_events` - pickup/delivery OTP, evidence and timestamps.
7. `settlements` - dummy payment state for the demo.

Use an order state enum such as `BIDDING_OPEN`, `DEAL_LOCKED`,
`TRANSPORT_PENDING`, `TRANSPORT_SELECTED`, `PICKUP_PENDING`, `PICKED_UP`,
`IN_TRANSIT`, `DELIVERY_PENDING`, `DELIVERED`, and `SETTLED`.

## Recommended next build order

1. Add database connection and migrations.
2. Add registration/login with the three roles.
3. Add crop lot create/list/detail endpoints and screens.
4. Add buyer bids and farmer bid acceptance.
5. Create an order from the winning bid.
6. Add transport choice and transporter bids.
7. Add pickup/delivery verification and dummy settlement.
8. Add price guidance, maps, notifications and polish afterward.

Authentication now supports registration with a unique username and login with
either username or email. If the database was created before usernames were
added, run this once from `backend/`:

```bash
set -a
source .env
set +a
psql "$DATABASE_URL" -f database/migrations/002_add_username.sql
```

New registrations must verify their email before they receive a login session.
The flow is: register -> receive a 6-digit email OTP -> verify OTP -> login
session. The verification OTP expires after 10 minutes and allows five attempts.

### Password reset email setup

The reset flow stores a hashed, single-use email OTP that expires after 10
minutes. Run the reset migration once:

```bash
psql "$DATABASE_URL" -f database/migrations/003_add_password_reset_tokens.sql
```

The active password flows use email OTPs: forgot password and change password
both require a 6-digit code before a new password can be saved. Apply the OTP
migration as well:

```bash
psql "$DATABASE_URL" -f database/migrations/004_add_email_otps.sql
psql "$DATABASE_URL" -f database/migrations/005_add_verify_email_otp.sql
```

For real reset emails, add SMTP settings to `backend/.env`:

```env
FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
MAIL_FROM="FASALYNK <no-reply@example.com>"
```

SMTP must be configured before registration, reset, or password-change OTPs can
be requested. The API returns an error instead of pretending an email was sent.
If an App Password contains spaces, quote the value in `.env`.

Do not add real payments, complex machine learning, chat or an admin panel until
the one order story works from start to finish.

## Current page structure

Public URLs now include `/`, `/how-it-works`, `/marketplace`, `/about`, and
`/help`. Authentication uses `/login`, `/register`, and `/forgot-password`.
After login, role workspaces use `/farmer/*`, `/buyer/*`, or `/transporter/*`,
with common pages at `/notifications`, `/profile`, and `/settings`.

The functional slice is crop-lot creation, marketplace browsing, crop details,
buyer bidding, farmer bid review, and deal locking. Transport selection,
delivery OTP/photos, route maps, AI pricing, real payments, and admin screens
are currently structured foundation pages and need their own API and service
integration next.

## Frontend organization

The frontend is intentionally split so each area is easy to change:

```text
frontend/src/
├── App.jsx                  # Small URL router and session entry point
├── components/
│   ├── Brand.jsx             # FASALYNK logo link
│   └── RouteHeader.jsx       # Public page navigation
├── data/
│   └── navigation.js         # Roles and sidebar links
├── lib/
│   └── api.js                # API requests and browser session helpers
└── pages/
	├── AuthPage.jsx          # Login, register, OTP and password reset
	├── PublicPages.jsx       # Home, marketplace preview and public content
	└── WorkspacePage.jsx     # Farmer, buyer and transporter workspace shell
```

Add a new public page in `pages/PublicPages.jsx`, a new reusable visual piece in
`components/`, and a new role navigation item in `data/navigation.js`. Keep API
calls inside `lib/api.js` or the page that owns the feature.

qvxc tasz ysgb frnk