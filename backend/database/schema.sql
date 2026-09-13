CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('FARMER', 'BUYER', 'TRANSPORTER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crop_lot_status AS ENUM ('BIDDING_OPEN', 'SOLD', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bid_status AS ENUM ('ACTIVE', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'DEAL_LOCKED', 'TRANSPORT_PENDING', 'TRANSPORT_SELECTED',
    'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_PENDING',
    'DELIVERED', 'SETTLED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transport_status AS ENUM ('OPEN', 'SELECTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verification_type AS ENUM ('PICKUP', 'DELIVERY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password_hash TEXT,
  role user_role NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crop_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES users(id),
  crop_name VARCHAR(100) NOT NULL,
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
  grade VARCHAR(30) NOT NULL,
  harvest_date DATE NOT NULL,
  location_name VARCHAR(160) NOT NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  expected_price_per_kg NUMERIC(10, 2) CHECK (expected_price_per_kg >= 0),
  status crop_lot_status NOT NULL DEFAULT 'BIDDING_OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_lot_id UUID NOT NULL REFERENCES crop_lots(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  price_per_kg NUMERIC(10, 2) NOT NULL CHECK (price_per_kg > 0),
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
  status bid_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_lot_id UUID NOT NULL UNIQUE REFERENCES crop_lots(id),
  winning_bid_id UUID NOT NULL UNIQUE REFERENCES bids(id),
  farmer_id UUID NOT NULL REFERENCES users(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  accepted_price_per_kg NUMERIC(10, 2) NOT NULL CHECK (accepted_price_per_kg > 0),
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
  transport_required BOOLEAN NOT NULL DEFAULT FALSE,
  status order_status NOT NULL DEFAULT 'DEAL_LOCKED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  pickup_location VARCHAR(160) NOT NULL,
  delivery_location VARCHAR(160) NOT NULL,
  distance_km NUMERIC(10, 2),
  required_capacity_kg NUMERIC(12, 2) NOT NULL CHECK (required_capacity_kg > 0),
  status transport_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_request_id UUID NOT NULL REFERENCES transport_requests(id),
  transporter_id UUID NOT NULL REFERENCES users(id),
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  vehicle_type VARCHAR(80) NOT NULL,
  vehicle_capacity_kg NUMERIC(12, 2) NOT NULL CHECK (vehicle_capacity_kg > 0),
  reliability_score NUMERIC(5, 2) CHECK (reliability_score BETWEEN 0 AND 100),
  distance_to_pickup_km NUMERIC(10, 2),
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  event_type verification_type NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  verified_at TIMESTAMPTZ,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'PAYMENT_PENDING',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crop_lots_status_idx ON crop_lots(status);
CREATE INDEX IF NOT EXISTS bids_crop_lot_idx ON bids(crop_lot_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS transport_bids_request_idx ON transport_bids(transport_request_id);