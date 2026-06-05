'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DURATION_DAYS = 15;
const MAX_DURATION_DAYS = 180;
const MISSING_RX_DATE_FALLBACK_DAYS = 90;

function capDurationDays(days) {
    if (days <= 0) return 0;
    return days > MAX_DURATION_DAYS ? MAX_DURATION_DAYS : days;
}

function isBlank(value) {
    if (value == null) return true;
    const str = String(value).trim().toLowerCase();
    return !str || str === 'null' || str === 'undefined' || str === 'n/a' || str === 'na';
}

function parseDurationDays(duration) {
    if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
        return capDurationDays(Math.ceil(duration));
    }

    if (isBlank(duration)) return DEFAULT_DURATION_DAYS;

    const text = String(duration).toLowerCase();
    const patterns = [
        { regex: /(\d+(?:\.\d+)?)\s*(?:months?|month|mnths?|mths?|mos?|mo)\b/g, days: 30 },
        { regex: /(\d+(?:\.\d+)?)\s*(?:weeks?|wks?|wk)\b/g, days: 7 },
        { regex: /(\d+(?:\.\d+)?)\s*(?:days?|dys?|day|din|দিন|d)\b/g, days: 1 },
    ];

    for (const { regex, days } of patterns) {
        const matches = [...text.matchAll(regex)];
        if (matches.length) {
            const value = Number(matches[matches.length - 1][1]);
            if (Number.isFinite(value) && value >= 0) {
                return capDurationDays(Math.ceil(value * days));
            }
        }
    }

    const numbers = text.match(/\d+(?:\.\d+)?/g);
    if (numbers?.length === 1) {
        const value = Number(numbers[0]);
        if (Number.isFinite(value) && value >= 0) return capDurationDays(Math.ceil(value));
    }

    return DEFAULT_DURATION_DAYS;
}

function parsePrescriptionDate(rxDate) {
    if (rxDate instanceof Date && !Number.isNaN(rxDate.getTime())) return rxDate;

    const raw = String(rxDate || '').trim();
    if (!raw) return null;

    const isoParsed = new Date(raw);
    if (!Number.isNaN(isoParsed.getTime())) return isoParsed;

    const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

function startOfUtcDay(date) {
    const value = new Date(date);
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function fallbackPrescriptionDate(now = new Date()) {
    return new Date(startOfUtcDay(now).getTime() - MISSING_RX_DATE_FALLBACK_DAYS * DAY_MS);
}

function normalizeMedName(med = {}) {
    return med.matched_brand || med.extracted_name || med.brand_name || med.name || med.generic || 'Medication';
}

function medicationDedupeKey(med) {
    const name = normalizeMedName(med)
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    return name || null;
}

function normalizeScanMedication(scan, med, index, now = new Date()) {
    const originalRxDate = isBlank(scan.rx_date) ? null : scan.rx_date;
    const issuedAt = parsePrescriptionDate(originalRxDate) || fallbackPrescriptionDate(now);
    const issuedDay = issuedAt ? startOfUtcDay(issuedAt) : null;
    const durationDays = parseDurationDays(med.duration);
    const expiresAt = issuedDay ? new Date(issuedDay.getTime() + durationDays * DAY_MS) : null;
    const active = durationDays > 0 && expiresAt ? expiresAt.getTime() >= startOfUtcDay(now).getTime() : false;
    const itemId = `${scan.scan_id}:${index}`;
    const brandName = normalizeMedName(med);
    const genericName = med.generic || med.generic_name || med.extracted_name || brandName;

    return {
        id: itemId,
        item_id: itemId,
        scan_id: scan.scan_id,
        patient_id: scan.patient_id || null,
        patient_name_rx: scan.patient_name_rx || null,
        prescription_id: scan.scan_id,
        source: 'prescription_scan',
        drug_id: null,
        dosage: med.dosage_from_prescription || med.dosage || med.strength || null,
        strength: med.strength || null,
        frequency: isBlank(med.frequency) ? null : med.frequency,
        duration: isBlank(med.duration) ? `${DEFAULT_DURATION_DAYS} days` : med.duration,
        duration_days: durationDays,
        durationDays,
        instructions: isBlank(med.instructions) ? null : med.instructions,
        status: active ? 'active' : 'stopped',
        modification_notes: med.modification_notes || null,
        generic_name: genericName,
        brand_name: brandName,
        drug_class: med.drug_class || null,
        confidence: med.confidence || null,
        extracted_name: med.extracted_name || null,
        matched_brand: med.matched_brand || null,
        form: med.form || null,
        issued_at: issuedDay ? issuedDay.toISOString() : null,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        prescription_status: active ? 'active' : 'completed',
        doctor_name: scan.doctor_name || null,
        hospital_name: scan.hospital_name || null,
        diseases: Array.isArray(scan.diseases) ? scan.diseases : [],
        rx_date: originalRxDate,
        effective_rx_date: issuedDay ? issuedDay.toISOString().slice(0, 10) : null,
        rx_date_was_missing: !originalRxDate,
        created_at: scan.created_at,
    };
}

function normalizeScanRows(rows = [], { activeOnly = false, now = new Date() } = {}) {
    const normalized = rows.flatMap((scan) => {
        const medications = Array.isArray(scan.medications) ? scan.medications : [];
        return medications
            .map((med, index) => normalizeScanMedication(scan, med || {}, index, now))
            .filter((med) => !activeOnly || med.status === 'active');
    });

    const latestByPatientAndName = new Map();

    for (const med of normalized) {
        const nameKey = medicationDedupeKey({
            matched_brand: med.matched_brand,
            extracted_name: med.extracted_name,
            brand_name: med.brand_name,
            name: med.name,
            generic: med.generic_name,
        });
        if (!nameKey) continue;

        const patientNameKey = String(med.patient_name_rx || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
        const patientKey = med.patient_id || patientNameKey || 'unknown-patient';
        const key = `${patientKey}:${nameKey}`;
        const current = latestByPatientAndName.get(key);
        const medTime = new Date(med.issued_at || med.created_at || 0).getTime();
        const currentTime = current ? new Date(current.issued_at || current.created_at || 0).getTime() : -Infinity;

        if (!current || medTime > currentTime) {
            latestByPatientAndName.set(key, med);
        }
    }

    return Array.from(latestByPatientAndName.values()).sort(
        (a, b) => new Date(b.issued_at || b.created_at || 0) - new Date(a.issued_at || a.created_at || 0)
    );
}

module.exports = {
    DEFAULT_DURATION_DAYS,
    MAX_DURATION_DAYS,
    MISSING_RX_DATE_FALLBACK_DAYS,
    parseDurationDays,
    normalizeScanRows,
};
