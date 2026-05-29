'use strict';

const DB_Connection = require('./db.js');

async function migrate() {
    const db = DB_Connection.getInstance();

    await db.query_executor(`
        CREATE TABLE IF NOT EXISTS patient_insights (
            id            SERIAL PRIMARY KEY,
            patient_id    UUID        NOT NULL,
            generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at    TIMESTAMPTZ NOT NULL,
            insights_json JSONB       NOT NULL
        )
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_patient_insights_patient_id
        ON patient_insights (patient_id)
    `);

    await db.query_executor(`
        CREATE INDEX IF NOT EXISTS idx_patient_insights_expires_at
        ON patient_insights (expires_at)
    `);

    console.log('✓ patient_insights table ready');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
