'use strict';

const DB_Connection = require('./db.js');

async function migrate() {
    const db = DB_Connection.getInstance();

    await db.query_executor(`
        CREATE EXTENSION IF NOT EXISTS "vector"
    `);

    await db.query_executor(`
        CREATE TABLE IF NOT EXISTS patient_report_vector (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id      UUID NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
            report_id       UUID NOT NULL REFERENCES medical_report(report_id) ON DELETE CASCADE,
            report_date     DATE NOT NULL,
            report_type     VARCHAR(50),
            embedding       vector(1536) NOT NULL,
            summary_text    TEXT NOT NULL,
            is_public       BOOLEAN DEFAULT FALSE,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_prv_patient ON patient_report_vector(patient_id)
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_prv_date ON patient_report_vector(report_date)
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_prv_public ON patient_report_vector(is_public)
    `);

    await db.query_executor(`
        CREATE TABLE IF NOT EXISTS patient_predictions (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id        UUID NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
            report_id         UUID REFERENCES medical_report(report_id) ON DELETE CASCADE,
            metric_name       VARCHAR(100) NOT NULL,
            prediction_type   VARCHAR(50),
            confidence        FLOAT CHECK (confidence BETWEEN 0 AND 1),
            predicted_date    DATE,
            predicted_value   VARCHAR(50),
            reasoning         TEXT,
            comparable_patients INTEGER,
            outcomes_map      JSONB,
            trend_direction   VARCHAR(20),
            severity_level    VARCHAR(20),
            created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
            expires_at        TIMESTAMP
        )
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_pp_patient ON patient_predictions(patient_id)
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_pp_metric ON patient_predictions(metric_name)
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_pp_expires ON patient_predictions(expires_at)
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_pp_report ON patient_predictions(report_id)
    `);

    await db.query_executor(`
        CREATE TABLE IF NOT EXISTS metric_trends (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id      UUID NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
            metric_name     VARCHAR(100) NOT NULL,
            values          JSONB NOT NULL,
            trend_slope     FLOAT,
            volatility      FLOAT,
            trend_direction VARCHAR(20),
            last_computed   TIMESTAMP DEFAULT NOW()
        )
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_mt_patient ON metric_trends(patient_id)
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_mt_metric ON metric_trends(metric_name, patient_id)
    `);

    console.log('✓ patient_report_vector table ready');
    console.log('✓ patient_predictions table ready');
    console.log('✓ metric_trends table ready');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
