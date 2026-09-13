import { pool } from './db.js'

function numberOrNull(value) {
	if (value === '' || value === undefined || value === null) return null
	const number = Number(value)
	return Number.isFinite(number) ? number : null
}

function mapLot(row) {
	return {
		id: row.id,
		cropName: row.crop_name,
		quantityKg: row.quantity_kg,
		grade: row.grade,
		harvestDate: row.harvest_date,
		locationName: row.location_name,
		photoUrls: row.photo_urls,
		expectedPricePerKg: row.expected_price_per_kg,
		status: row.status,
		farmerName: row.farmer_name,
		createdAt: row.created_at,
	}
}

export async function createCropLot(request, response) {
	const { cropName, quantityKg, grade, harvestDate, locationName, latitude, longitude, expectedPricePerKg } = request.body
	const quantity = numberOrNull(quantityKg)

	if (!cropName?.trim() || !quantity || quantity <= 0 || !grade?.trim() || !harvestDate || !locationName?.trim()) {
		return response.status(400).json({ message: 'Crop, quantity, grade, harvest date and location are required.' })
	}

	try {
		const result = await pool.query(
			`INSERT INTO crop_lots
			 (farmer_id, crop_name, quantity_kg, grade, harvest_date, location_name, latitude, longitude, expected_price_per_kg, photo_urls)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 RETURNING id, crop_name, quantity_kg, grade, harvest_date::text AS harvest_date, location_name,
			 latitude, longitude, photo_urls, expected_price_per_kg, status, created_at`,
			[request.auth.userId, cropName.trim(), quantity, grade.trim(), harvestDate, locationName.trim(), numberOrNull(latitude), numberOrNull(longitude), numberOrNull(expectedPricePerKg), (request.files || []).map((file) => `/uploads/${file.filename}`)],
		)
		return response.status(201).json({ lot: mapLot({ ...result.rows[0], farmer_name: 'You' }) })
	} catch (error) {
		console.error(error)
		return response.status(500).json({ message: 'Could not create the crop lot.' })
	}
}

export async function listCropLots(request, response) {
	const ownLots = request.query.mine === 'true'
	const values = ownLots ? [request.auth.userId] : []
	const ownership = ownLots ? 'WHERE c.farmer_id = $1' : "WHERE c.status = 'BIDDING_OPEN'"

	try {
		const result = await pool.query(
			`SELECT c.id, c.crop_name, c.quantity_kg, c.grade, c.harvest_date::text AS harvest_date,
			 c.location_name, c.photo_urls, c.expected_price_per_kg, c.status, c.created_at,
			 u.full_name AS farmer_name
			 FROM crop_lots c
			 JOIN users u ON u.id = c.farmer_id
			 ${ownership}
			 ORDER BY c.created_at DESC`,
			values,
		)
		return response.json({ lots: result.rows.map(mapLot) })
	} catch (error) {
		console.error(error)
		return response.status(500).json({ message: 'Could not load crop lots.' })
	}
}

export async function getCropLot(request, response) {
	try {
		const lotResult = await pool.query(
			`SELECT c.id, c.crop_name, c.quantity_kg, c.grade, c.harvest_date::text AS harvest_date,
			 c.location_name, c.photo_urls, c.expected_price_per_kg, c.status, c.created_at,
			 u.full_name AS farmer_name
			 FROM crop_lots c JOIN users u ON u.id = c.farmer_id WHERE c.id = $1`,
			[request.params.id],
		)
		const lot = lotResult.rows[0]
		if (!lot) return response.status(404).json({ message: 'Crop lot not found.' })

		const bids = await pool.query(
			`SELECT b.id, b.price_per_kg, b.quantity_kg, b.status, b.created_at, u.full_name AS buyer_name
			 FROM bids b JOIN users u ON u.id = b.buyer_id
			 WHERE b.crop_lot_id = $1 ORDER BY b.price_per_kg DESC, b.created_at ASC`,
			[request.params.id],
		)
		return response.json({ lot: mapLot(lot), bids: bids.rows.map((bid) => ({ id: bid.id, pricePerKg: bid.price_per_kg, quantityKg: bid.quantity_kg, status: bid.status, buyerName: bid.buyer_name, createdAt: bid.created_at })) })
	} catch (error) {
		console.error(error)
		return response.status(500).json({ message: 'Could not load this crop lot.' })
	}
}

export async function createBid(request, response) {
	const { pricePerKg, quantityKg } = request.body
	const price = numberOrNull(pricePerKg)
	const quantity = numberOrNull(quantityKg)

	if (!price || price <= 0 || !quantity || quantity <= 0) {
		return response.status(400).json({ message: 'A valid price and quantity are required.' })
	}

	try {
		const lotResult = await pool.query("SELECT * FROM crop_lots WHERE id = $1 AND status = 'BIDDING_OPEN'", [request.params.id])
		const lot = lotResult.rows[0]
		if (!lot) return response.status(404).json({ message: 'This crop lot is no longer open for bidding.' })
		if (lot.farmer_id === request.auth.userId) return response.status(403).json({ message: 'You cannot bid on your own crop lot.' })
		if (quantity > Number(lot.quantity_kg)) return response.status(400).json({ message: 'Bid quantity cannot exceed the lot quantity.' })

		const result = await pool.query(
			`INSERT INTO bids (crop_lot_id, buyer_id, price_per_kg, quantity_kg)
			 VALUES ($1, $2, $3, $4) RETURNING id, price_per_kg, quantity_kg, status, created_at`,
			[request.params.id, request.auth.userId, price, quantity],
		)
		return response.status(201).json({ bid: result.rows[0] })
	} catch (error) {
		console.error(error)
		return response.status(500).json({ message: 'Could not place the bid.' })
	}
}

export async function acceptBid(request, response) {
	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		const lotResult = await client.query('SELECT * FROM crop_lots WHERE id = $1 FOR UPDATE', [request.params.id])
		const lot = lotResult.rows[0]
		if (!lot) {
			await client.query('ROLLBACK')
			return response.status(404).json({ message: 'Crop lot not found.' })
		}
		if (lot.farmer_id !== request.auth.userId) {
			await client.query('ROLLBACK')
			return response.status(403).json({ message: 'Only the farmer can accept a bid.' })
		}
		if (lot.status !== 'BIDDING_OPEN') {
			await client.query('ROLLBACK')
			return response.status(409).json({ message: 'This crop lot is already locked.' })
		}

		const bidResult = await client.query('SELECT * FROM bids WHERE id = $1 AND crop_lot_id = $2 AND status = $3', [request.params.bidId, request.params.id, 'ACTIVE'])
		const bid = bidResult.rows[0]
		if (!bid) {
			await client.query('ROLLBACK')
			return response.status(404).json({ message: 'Active bid not found for this crop lot.' })
		}

		await client.query("UPDATE bids SET status = CASE WHEN id = $1 THEN 'ACCEPTED'::bid_status ELSE 'REJECTED'::bid_status END WHERE crop_lot_id = $2 AND status = 'ACTIVE'", [bid.id, lot.id])
		await client.query("UPDATE crop_lots SET status = 'SOLD' WHERE id = $1", [lot.id])
		const order = await client.query(
			`INSERT INTO orders (crop_lot_id, winning_bid_id, farmer_id, buyer_id, accepted_price_per_kg, quantity_kg)
			 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status`,
			[lot.id, bid.id, lot.farmer_id, bid.buyer_id, bid.price_per_kg, bid.quantity_kg],
		)
		await client.query('COMMIT')
		return response.status(201).json({ message: 'Deal locked successfully.', order: order.rows[0] })
	} catch (error) {
		await client.query('ROLLBACK')
		console.error(error)
		return response.status(500).json({ message: 'Could not accept the bid.' })
	} finally {
		client.release()
	}
}