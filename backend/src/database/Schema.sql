-- ============================================================
--  RxSense — PostgreSQL Schema
--  Compatible with Neon DB (serverless PostgreSQL)
--  Generated for Infinity AI Buildfest 2026 · Track 3 HealthTech
-- ============================================================

-- Extension required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  ENUM TYPES
-- ============================================================

CREATE TYPE gender_type AS ENUM (
  'male',
  'female',
  'other',
  'prefer_not_to_say'
);

CREATE TYPE severity_type AS ENUM (
  'mild',
  'moderate',
  'severe',
  'critical'
);

CREATE TYPE prescription_status AS ENUM (
  'active',
  'completed',
  'cancelled',
  'suspended'
);

CREATE TYPE report_type AS ENUM (
  'CBC',
  'lipid_panel',
  'metabolic_panel',
  'urine_analysis',
  'thyroid',
  'other'
);

CREATE TYPE metric_status AS ENUM (
  'normal',
  'low',
  'high',
  'critical_low',
  'critical_high'
);

CREATE TYPE risk_level_type AS ENUM (
  'low',
  'moderate',
  'high',
  'critical'
);
-- New ENUM types
DO $$ BEGIN
  CREATE TYPE condition_status AS ENUM ('active', 'resolved', 'managed', 'chronic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE surgery_outcome AS ENUM ('successful', 'complicated', 'failed', 'ongoing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
--  TABLE 1: HOSPITAL
--  Healthcare facility registry
-- ============================================================

CREATE TABLE hospital (
  hospital_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  location      VARCHAR(200),
  type          VARCHAR(50),          -- e.g. 'public', 'private', 'clinic', 'NGO'
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP   NOT NULL DEFAULT NOW() 
);

COMMENT ON TABLE  hospital            IS 'Healthcare facility registry';
COMMENT ON COLUMN hospital.type       IS 'Facility type: public | private | clinic | NGO';


-- ============================================================
--  TABLE 2: DOCTOR
--  Physician profiles — intentionally has NO hospital_id.
--  Affiliations are stored in the DOCTOR_HOSPITAL junction table
--  because a doctor can work at multiple hospitals (M:N).
-- ============================================================

CREATE TABLE doctor (
  doctor_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  specialty      VARCHAR(100),
  license_number VARCHAR(50)  NOT NULL UNIQUE,
  gender         VARCHAR(20),
  
  -- Auth fields
  username       VARCHAR(50)  NOT NULL UNIQUE,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password       VARCHAR(255) NOT NULL, -- To store hashed password strings
  
  -- Tracking & Metadata
  last_login     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  doctor            IS 'Physician profiles and credentials';
COMMENT ON COLUMN doctor.password   IS 'Hashed password for doctor portal access';
COMMENT ON COLUMN doctor.gender     IS 'Gender identifier (e.g., Male, Female, Non-binary)';
COMMENT ON COLUMN doctor.last_login IS 'Timestamp of the user''s most recent successful login';



-- ============================================================
--  TABLE 3: DOCTOR_HOSPITAL  (M:N junction)
--  Resolves the many-to-many between Doctor and Hospital.
--  A doctor can be a Consultant at Hospital A and a Resident
--  at Hospital B simultaneously.
-- ============================================================

CREATE TABLE doctor_hospital (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID    NOT NULL REFERENCES doctor(doctor_id)   ON DELETE CASCADE,
  hospital_id  UUID    NOT NULL REFERENCES hospital(hospital_id) ON DELETE CASCADE,
  role         VARCHAR(80),          -- e.g. 'Consultant', 'Resident', 'Visiting Surgeon'
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  start_date   DATE    NOT NULL DEFAULT CURRENT_DATE,
  end_date     DATE,                 -- NULL means currently active
  UNIQUE (doctor_id, hospital_id)   -- one affiliation record per pair
);

COMMENT ON TABLE  doctor_hospital            IS 'M:N junction: a doctor can be affiliated with multiple hospitals';
COMMENT ON COLUMN doctor_hospital.is_primary IS 'TRUE = this is the doctor''s main/home hospital';
COMMENT ON COLUMN doctor_hospital.end_date   IS 'NULL means the affiliation is currently active';


-- ============================================================
--  TABLE 4: PATIENT
--  Core patient identity & demographics
-- ============================================================

CREATE TABLE patient (
  patient_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  date_of_birth DATE,
  gender        VARCHAR(20),
  phone         VARCHAR(20),
  
  -- Clinical Metrics
  height        NUMERIC(5, 2), -- Stored in cm (e.g., 175.50)
  weight        NUMERIC(5, 2), -- Stored in kg (e.g., 72.30)
  
  -- Auth fields
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL, -- For hashed password strings
  
  -- Tracking & Metadata
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Documentation Comments
COMMENT ON TABLE  patient            IS 'Patient demographics, clinical baselines, and registry';
COMMENT ON COLUMN patient.password   IS 'Hashed password for patient portal access';
COMMENT ON COLUMN patient.height     IS 'Patient height in centimeters (cm)';
COMMENT ON COLUMN patient.weight     IS 'Patient weight in kilograms (kg)';
COMMENT ON COLUMN patient.last_login IS 'Timestamp of the patient''s most recent successful login';


-- ============================================================
--  RxSense — Add 3 new tables to existing Neon DB schema
--  Run this once against your existing database.
--  Safe to run: uses IF NOT EXISTS on all objects.
-- ============================================================





-- KNOWN_CONDITION
CREATE TABLE IF NOT EXISTS known_condition (
  condition_id    UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID             NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
  diagnosed_by    UUID             REFERENCES doctor(doctor_id),
  condition_name  VARCHAR(150)     NOT NULL,
  icd_10_code     VARCHAR(10),
  diagnosed_at    DATE,
  status          condition_status NOT NULL DEFAULT 'active',
  severity        severity_type,
  notes           TEXT,
  llm_context     TEXT,
  created_at      TIMESTAMP        NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP        NOT NULL DEFAULT NOW()
);


-- SURGICAL_HISTORY
CREATE TABLE IF NOT EXISTS surgical_history (
  surgery_id       UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID            NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
  hospital_id      UUID            REFERENCES hospital(hospital_id),
  surgeon_id       UUID            REFERENCES doctor(doctor_id),
  procedure_name   VARCHAR(200)    NOT NULL,
  icd_10_pcs       VARCHAR(10),
  performed_at     DATE,
  outcome          surgery_outcome,
  complications    TEXT,
  anaesthesia_type VARCHAR(50),
  notes            TEXT,
  created_at       TIMESTAMP       NOT NULL DEFAULT NOW()
);


--VACCINATION_RECORD
CREATE TABLE IF NOT EXISTS vaccination_record (
  vaccination_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID         NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
  administered_by UUID         REFERENCES doctor(doctor_id),
  hospital_id     UUID         REFERENCES hospital(hospital_id),
  vaccine_name    VARCHAR(150) NOT NULL,
  cvx_code        VARCHAR(10),
  dose_number     INTEGER      CHECK (dose_number > 0),
  total_doses     INTEGER      CHECK (total_doses > 0),
  administered_at DATE         NOT NULL,
  batch_number    VARCHAR(50),
  site            VARCHAR(50),
  next_due_date   DATE,
  notes           TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);


-- Indexes
CREATE INDEX IF NOT EXISTS idx_kc_patient  ON known_condition (patient_id);
CREATE INDEX IF NOT EXISTS idx_kc_status   ON known_condition (status);
CREATE INDEX IF NOT EXISTS idx_kc_icd10    ON known_condition (icd_10_code);

CREATE INDEX IF NOT EXISTS idx_sh_patient  ON surgical_history (patient_id);
CREATE INDEX IF NOT EXISTS idx_sh_hospital ON surgical_history (hospital_id);

CREATE INDEX IF NOT EXISTS idx_vr_patient  ON vaccination_record (patient_id);
CREATE INDEX IF NOT EXISTS idx_vr_due      ON vaccination_record (next_due_date)
  WHERE next_due_date IS NOT NULL;


-- ============================================================
--  TABLE 5: DRUG
--  Master drug catalog — sourced from OpenFDA + WHO ATC codes.
--  This is the reference table all prescription items point to.
-- ============================================================

CREATE TABLE drug (
  drug_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name     VARCHAR(150) NOT NULL,
  brand_name       VARCHAR(150),
  drug_class       VARCHAR(100),       -- e.g. 'NSAID', 'Beta blocker', 'Antibiotic'
  contraindications TEXT,
  openfda_id       VARCHAR(50),        -- OpenFDA NDC/RxNorm reference
  who_atc_code     VARCHAR(20),        -- WHO Anatomical Therapeutic Chemical code
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  drug               IS 'Master drug catalog — sourced from OpenFDA and WHO ATC';
COMMENT ON COLUMN drug.openfda_id    IS 'OpenFDA NDC or RxNorm identifier';
COMMENT ON COLUMN drug.who_atc_code  IS 'WHO Anatomical Therapeutic Chemical classification code';


-- ============================================================
--  TABLE 6: DRUG_INTERACTION
--  Cross-drug interaction knowledge base.
--  LLM/RAG populates and retrieves from this table.
--  The CHECK ensures a drug is never paired with itself.
--  The UNIQUE ensures no duplicate (A,B) pairs.
-- ============================================================

CREATE TABLE drug_interaction (
  interaction_id   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a_id        UUID          NOT NULL REFERENCES drug(drug_id),
  drug_b_id        UUID          NOT NULL REFERENCES drug(drug_id),
  severity         severity_type NOT NULL,
  description      TEXT,                    -- Plain-language explanation of the interaction
  llm_rag_source   VARCHAR(200),            -- Source chunk / document ID retrieved via RAG
  confidence_score FLOAT         CHECK (confidence_score BETWEEN 0 AND 1),
  created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT no_self_interaction CHECK (drug_a_id <> drug_b_id),
  UNIQUE (drug_a_id, drug_b_id)
);

COMMENT ON TABLE  drug_interaction              IS 'Cross-drug interaction pairs; populated and queried by LLM/RAG pipeline';
COMMENT ON COLUMN drug_interaction.llm_rag_source IS 'Document or chunk ID retrieved from OpenFDA/WHO vector store';
COMMENT ON COLUMN drug_interaction.confidence_score IS '0.0–1.0 confidence from LLM assessment';


-- ============================================================
--  TABLE 7: PRESCRIPTION
--  Doctor-issued prescriptions.
--  llm_interaction_checked flags whether the RAG pipeline has
--  already validated this prescription for cross-drug conflicts.
-- ============================================================

CREATE TABLE prescription (
  prescription_id        UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id             UUID                 NOT NULL REFERENCES patient(patient_id),
  doctor_id              UUID                 NOT NULL REFERENCES doctor(doctor_id),
  issued_at              TIMESTAMP            NOT NULL DEFAULT NOW(),
  status                 prescription_status  NOT NULL DEFAULT 'active',
  llm_interaction_checked BOOLEAN             NOT NULL DEFAULT FALSE,
  interaction_alert      TEXT,                -- Human-readable alert from LLM if conflict found
  created_at             TIMESTAMP            NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP            NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  prescription                        IS 'Doctor-issued prescriptions — each triggers an LLM cross-drug check on save';
COMMENT ON COLUMN prescription.llm_interaction_checked IS 'TRUE once the RAG pipeline has validated all drug pairs';
COMMENT ON COLUMN prescription.interaction_alert       IS 'LLM-generated plain-language alert; NULL if no conflict found';


-- ============================================================
--  TABLE 8: PRESCRIPTION_ITEM
--  Individual drug line-items within a prescription.
--  Cascade delete: removing a prescription removes its items.
-- ============================================================

CREATE TABLE prescription_item (
  item_id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID    NOT NULL REFERENCES prescription(prescription_id) ON DELETE CASCADE,
  drug_id         UUID    NOT NULL REFERENCES drug(drug_id),
  dosage          VARCHAR(50),         -- e.g. '500mg'
  frequency       VARCHAR(50),         -- e.g. 'twice daily'
  duration_days   INTEGER CHECK (duration_days > 0),
  instructions    TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE prescription_item IS 'Drug line-items inside a prescription; cascades on prescription delete';


-- ============================================================
--  TABLE 9: PATIENT_ALLERGY
--  Known drug allergies and adverse reactions.
--  Decoupled from prescriptions — persists across all visits.
--  UNIQUE(patient_id, drug_id) prevents duplicate allergy records.
-- ============================================================

CREATE TABLE patient_allergy (
  allergy_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID          NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
  drug_id       UUID          NOT NULL REFERENCES drug(drug_id),
  reaction_type VARCHAR(100),              -- e.g. 'Anaphylaxis', 'Rash', 'Respiratory distress'
  severity      severity_type,
  confirmed_at  TIMESTAMP,
  llm_flagged   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP     NOT NULL DEFAULT NOW(),

  UNIQUE (patient_id, drug_id)
);

COMMENT ON TABLE  patient_allergy           IS 'Persistent drug allergy record — survives across all visits and doctors';
COMMENT ON COLUMN patient_allergy.llm_flagged IS 'TRUE if LLM detected this allergy conflict during a prescription check';


-- ============================================================
--  TABLE 10: MEDICAL_REPORT
--  Uploaded lab reports (CBC, lipid panel, metabolic, etc.)
-- ============================================================

CREATE TABLE medical_report (
  report_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES patient(patient_id),
  doctor_id    UUID        REFERENCES doctor(doctor_id),   -- optional: report may be self-uploaded
  report_type  report_type NOT NULL,
  uploaded_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  storage_path VARCHAR(300)                                -- path/URL in Supabase Storage or S3
);

COMMENT ON TABLE  medical_report              IS 'Patient lab reports — each triggers LLM metric analysis on upload';
COMMENT ON COLUMN medical_report.doctor_id    IS 'Optional — NULL if patient uploaded without a doctor visit';
COMMENT ON COLUMN medical_report.storage_path IS 'File URL in object storage (Supabase Storage / S3)';


-- ============================================================
--  TABLE 11: REPORT_METRIC
--  Individual lab values from a medical report.
--  llm_flagged = TRUE when the value falls outside WHO reference
--  ranges as determined by the LLM analysis pipeline.
-- ============================================================

CREATE TABLE report_metric (
  metric_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID          NOT NULL REFERENCES medical_report(report_id) ON DELETE CASCADE,
  parameter_name  VARCHAR(100)  NOT NULL,   -- e.g. 'HbA1c', 'WBC', 'Total Cholesterol'
  value           VARCHAR(50),              -- Raw extracted value
  unit            VARCHAR(30),              -- e.g. 'mg/dL', 'g/L', '%'
  reference_range VARCHAR(50),              -- e.g. '4.0–5.6%'
  status          metric_status,
  llm_flagged     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  report_metric           IS 'Individual lab biomarker values; LLM flags anomalies vs WHO reference ranges';
COMMENT ON COLUMN report_metric.llm_flagged IS 'TRUE when LLM determines value is clinically significant or out of range';


-- ============================================================
--  TABLE 12: SYMPTOM_LOG
--  Patient self-reported symptom questionnaire sessions.
--  Each session generates one AI_RISK_ASSESSMENT.
-- ============================================================

CREATE TABLE symptom_log (
  log_id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID      NOT NULL REFERENCES patient(patient_id),
  logged_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  symptoms_data        JSONB,               -- Structured Q&A responses from the questionnaire
  body_system          VARCHAR(80),         -- e.g. 'Digestive', 'Respiratory', 'Neurological'
  family_history_notes TEXT
);

COMMENT ON TABLE  symptom_log              IS 'Symptom checker sessions — feeds the LLM risk assessment pipeline';
COMMENT ON COLUMN symptom_log.symptoms_data IS 'JSONB of Q&A pairs from the questionnaire interface';


-- ============================================================
--  TABLE 13: AI_RISK_ASSESSMENT
--  LLM-generated disease and cancer risk predictions.
--  Stores both the structured output and raw LLM response for
--  clinical explainability and audit requirements.
-- ============================================================

CREATE TABLE ai_risk_assessment (
  assessment_id      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id             UUID           NOT NULL REFERENCES symptom_log(log_id) ON DELETE CASCADE,
  risk_level         risk_level_type,
  possible_conditions JSONB,                  -- Array of { condition, probability, reasoning }
  cancer_risk_flag   BOOLEAN        NOT NULL DEFAULT FALSE,
  recommendation     TEXT,                    -- Plain-language recommendation for the patient
  model_used         VARCHAR(80),             -- e.g. 'claude-sonnet-4-6'
  confidence_score   FLOAT          CHECK (confidence_score BETWEEN 0 AND 1),
  llm_response_raw   JSONB,                  -- Full raw API response for audit trail
  created_at         TIMESTAMP      NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  ai_risk_assessment                 IS 'LLM-generated disease/cancer risk output from each symptom session';
COMMENT ON COLUMN ai_risk_assessment.possible_conditions IS 'JSONB array: [{ condition, probability, reasoning }]';
COMMENT ON COLUMN ai_risk_assessment.cancer_risk_flag    IS 'TRUE triggers an immediate "see a doctor" recommendation';
COMMENT ON COLUMN ai_risk_assessment.llm_response_raw    IS 'Raw LLM API response stored for clinical explainability';


-- ============================================================
--  TABLE 14: LLM_QUERY_LOG
--  Audit trail for every LLM call made by the system.
--  Covers: drug interaction checks, allergy alerts,
--          lab metric analysis, symptom risk assessment.
-- ============================================================

CREATE TABLE llm_query_log (
  query_id       UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID      REFERENCES patient(patient_id),  -- optional: some calls are system-level
  query_type     VARCHAR(60),    -- 'drug_interaction' | 'allergy_check' | 'lab_analysis' | 'symptom_risk'
  input_context  TEXT,           -- Prompt / context sent to the model
  output_summary TEXT,           -- Condensed version of the model's response
  model_used     VARCHAR(80),    -- e.g. 'claude-sonnet-4-6'
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  tokens_used    INTEGER   CHECK (tokens_used >= 0)
);

COMMENT ON TABLE  llm_query_log           IS 'Full audit trail of every LLM API call for cost tracking and clinical transparency';
COMMENT ON COLUMN llm_query_log.query_type IS 'drug_interaction | allergy_check | lab_analysis | symptom_risk';


-- ============================================================
--  INDEXES
--  Covering the most frequent query patterns:
--  - Patient → prescriptions / reports / logs
--  - Drug lookups for interaction checks
--  - LLM flag filters for dashboards
-- ============================================================

-- Doctor ↔ Hospital
CREATE INDEX idx_dh_doctor   ON doctor_hospital (doctor_id);
CREATE INDEX idx_dh_hospital ON doctor_hospital (hospital_id);

-- Prescription lookups
CREATE INDEX idx_rx_patient  ON prescription (patient_id);
CREATE INDEX idx_rx_doctor   ON prescription (doctor_id);
CREATE INDEX idx_rx_status   ON prescription (status);
CREATE INDEX idx_rx_unchecked ON prescription (llm_interaction_checked)
  WHERE llm_interaction_checked = FALSE;   -- fast queue for LLM checker job

-- Prescription items
CREATE INDEX idx_rxi_prescription ON prescription_item (prescription_id);
CREATE INDEX idx_rxi_drug         ON prescription_item (drug_id);

-- Drug catalog
CREATE INDEX idx_drug_generic  ON drug (generic_name);
CREATE INDEX idx_drug_openfda  ON drug (openfda_id);
CREATE INDEX idx_drug_atc      ON drug (who_atc_code);

-- Drug interactions — both directions must be fast
CREATE INDEX idx_di_drug_a    ON drug_interaction (drug_a_id);
CREATE INDEX idx_di_drug_b    ON drug_interaction (drug_b_id);
CREATE INDEX idx_di_severity  ON drug_interaction (severity);

-- Patient allergies
CREATE INDEX idx_pa_patient ON patient_allergy (patient_id);
CREATE INDEX idx_pa_drug    ON patient_allergy (drug_id);

-- Medical reports + metrics
CREATE INDEX idx_mr_patient     ON medical_report (patient_id);
CREATE INDEX idx_rm_report      ON report_metric (report_id);
CREATE INDEX idx_rm_llm_flagged ON report_metric (llm_flagged)
  WHERE llm_flagged = TRUE;

-- Symptom logs + AI assessments
CREATE INDEX idx_sl_patient    ON symptom_log (patient_id);
CREATE INDEX idx_sl_logged_at  ON symptom_log (logged_at);
CREATE INDEX idx_ara_log       ON ai_risk_assessment (log_id);
CREATE INDEX idx_ara_cancer    ON ai_risk_assessment (cancer_risk_flag)
  WHERE cancer_risk_flag = TRUE;

-- LLM audit log
CREATE INDEX idx_llm_patient ON llm_query_log (patient_id);
CREATE INDEX idx_llm_type    ON llm_query_log (query_type);
CREATE INDEX idx_llm_created ON llm_query_log (created_at);