'use strict';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

function apiKey() {
    const k = process.env.GOOGLE_MAPS_API_KEY;
    if (!k) throw new Error('GOOGLE_MAPS_API_KEY not set in environment');
    return k;
}

// Haversine distance in km
function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchPhone(placeId, key) {
    try {
        const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=formatted_phone_number&key=${key}`;
        const res  = await fetch(url);
        const data = await res.json();
        return data.result?.formatted_phone_number || null;
    } catch {
        return null;
    }
}

const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function claudeKey() {
    return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
}

class PlacesController {

    // POST /api/places/infer-specialty  { condition: "পেট ব্যথা" }
    inferSpecialty = async (req, res) => {
        try {
            const { condition } = req.body || {};
            if (!condition?.trim()) return res.json({ success: true, specialty: null, keyword: '' });

            const prompt = `Given this health condition or symptom: "${condition}"
Return a JSON object with the most relevant medical specialist for a doctor search.
Format (raw JSON only, no markdown):
{"specialty":"gastroenterologist","keyword":"gastroenterologist"}

Rules:
- specialty: English lowercase specialist title (gastroenterologist, cardiologist, neurologist, etc.)
- keyword: Google Places search keyword (same as specialty usually)
- For emergency symptoms (chest pain, stroke, breathing difficulty) → {"specialty":"emergency medicine","keyword":"emergency hospital"}
- If unclear or general → {"specialty":null,"keyword":""}`;

            const r = await fetch(CLAUDE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey(), 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 80, messages: [{ role: 'user', content: prompt }] }),
            });
            const data = await r.json();
            const raw  = (data.content || []).find(b => b.type === 'text')?.text || '{}';
            const m    = raw.match(/\{[^}]+\}/);
            const result = m ? JSON.parse(m[0]) : { specialty: null, keyword: '' };

            return res.json({ success: true, specialty: result.specialty || null, keyword: result.keyword || '' });
        } catch (err) {
            console.error('[Places] inferSpecialty:', err.message);
            return res.json({ success: true, specialty: null, keyword: '' }); // fail silently
        }
    };

    // GET /api/places/nearby?lat=&lng=&type=hospital&keyword=&radius=5000
    nearbySearch = async (req, res) => {
        try {
            const key = apiKey();
            const { lat, lng, type = 'hospital', keyword = '', radius = 5000 } = req.query;

            if (!lat || !lng) return res.status(400).json({ success: false, error: 'lat and lng are required' });

            const params = new URLSearchParams({ location: `${lat},${lng}`, radius: String(radius), key });
            if (type?.trim())    params.append('type',    type.trim());
            if (keyword?.trim()) params.append('keyword', keyword.trim());

            const apiRes = await fetch(`${PLACES_BASE}/nearbysearch/json?${params}`);
            const data   = await apiRes.json();

            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                console.error('[Places] API error:', data.status, data.error_message);
                return res.status(502).json({ success: false, error: data.error_message || data.status });
            }

            const top     = (data.results || []).slice(0, 6);
            const phones  = await Promise.all(top.map(p => fetchPhone(p.place_id, key)));

            const places = top.map((p, i) => ({
                id:          p.place_id,
                name:        p.name,
                address:     p.vicinity || '',
                rating:      p.rating        ?? null,
                totalRatings: p.user_ratings_total ?? 0,
                isOpen:      p.opening_hours?.open_now ?? null,
                lat:         p.geometry.location.lat,
                lng:         p.geometry.location.lng,
                distanceKm:  parseFloat(distanceKm(parseFloat(lat), parseFloat(lng), p.geometry.location.lat, p.geometry.location.lng).toFixed(1)),
                phone:       phones[i],
                mapsUrl:     `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
            }));

            // Sort by distance
            places.sort((a, b) => a.distanceKm - b.distanceKm);

            return res.json({ success: true, places });
        } catch (err) {
            console.error('[Places] nearbySearch error:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    // GET /api/places/geocode?address=
    geocode = async (req, res) => {
        try {
            const key     = apiKey();
            const { address } = req.query;
            if (!address?.trim()) return res.status(400).json({ success: false, error: 'address is required' });

            const params = new URLSearchParams({ address, region: 'BD', key });
            const apiRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
            const data   = await apiRes.json();

            if (!data.results?.length) return res.json({ success: false, error: 'Address not found' });

            const { lat, lng } = data.results[0].geometry.location;
            return res.json({ success: true, lat, lng, label: data.results[0].formatted_address });
        } catch (err) {
            console.error('[Places] geocode error:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };
}

module.exports = PlacesController;
