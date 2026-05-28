const DB_Connection = require('../database/db.js')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class UserModel {
    constructor(){
        this.db_connection = new DB_Connection();
    }

    mapPatientUser = (row)=> row ? {
        id: row.patient_id,
        uuid: row.patient_id,
        patient_id: row.patient_id,
        username: row.username,
        email: row.email,
        full_name: row.name,
        name: row.name,
        password: row.password,
        password_hash: row.password,
        is_active: true,
        email_verified: true,
        subscription_type: 'free',
        last_login: row.last_login,
        created_at: row.created_at,
        updated_at: row.updated_at
    } : null;

    create_users_table = async()=>{
        try {
            const query = `
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(255),
                    is_active BOOLEAN DEFAULT true,
                    email_verified BOOLEAN DEFAULT false,
                    verification_token VARCHAR(255),
                    password_reset_token VARCHAR(255),
                    password_reset_expires TIMESTAMP,
                    last_login TIMESTAMP,
                    login_attempts INTEGER DEFAULT 0,
                    locked_until TIMESTAMP,
                    refresh_token TEXT,
                    google_id VARCHAR(100) UNIQUE,
                    provider VARCHAR(50),
                    avatar_url TEXT,
                    subscription_type VARCHAR(20) NOT NULL DEFAULT 'free',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
                CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
                CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
                CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
            `;

            await this.db_connection.query_executor(query);
            console.log("User table successfully created");
            return {success: true};
        } catch (error) {
            console.log(`Error creating table: ${error.message}`);
            throw error;            
        }
    }

    createPatient = async(userData)=>{
        const { name, email, passwordHash, phone } = userData;
        const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();

        const client = await this.db_connection.pool.connect();
        try {
            await client.query('BEGIN');

            const userResult = await client.query(
                `INSERT INTO users (username, email, password_hash, full_name, role, email_verified)
                 VALUES ($1, $2, $3, $4, 'patient', true)
                 RETURNING id, username, email, full_name, role, is_active, subscription_type, created_at`,
                [username, email, passwordHash, name]
            );
            const user = userResult.rows[0];

            const patientResult = await client.query(
                `INSERT INTO patient (patient_id, name, phone, username, email, password, user_id)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
                 RETURNING patient_id`,
                [name, phone || '', username, email, passwordHash, user.id]
            );
            const patient = patientResult.rows[0];

            await client.query('COMMIT');

            return {
                id: user.id,
                patient_id: patient.patient_id,
                uuid: patient.patient_id,
                username: user.username,
                email: user.email,
                name: user.full_name,
                full_name: user.full_name,
                role: 'patient',
                is_active: user.is_active,
                subscription_type: user.subscription_type,
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.log(`Patient creation failed: ${error.message}`);
            return { success: false };
        } finally {
            client.release();
        }
    }

    createDoctor = async(userData)=>{
        const { name, email, passwordHash, phone } = userData;
        const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        const licenseNum = `LIC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const client = await this.db_connection.pool.connect();
        try {
            await client.query('BEGIN');

            const userResult = await client.query(
                `INSERT INTO users (username, email, password_hash, full_name, role, email_verified)
                 VALUES ($1, $2, $3, $4, 'doctor', true)
                 RETURNING id, username, email, full_name, role, is_active, subscription_type, created_at`,
                [username, email, passwordHash, name]
            );
            const user = userResult.rows[0];

            const doctorResult = await client.query(
                `INSERT INTO doctor (doctor_id, name, license_number, username, email, password, user_id)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
                 RETURNING doctor_id`,
                [name, licenseNum, username, email, passwordHash, user.id]
            );
            const doctor = doctorResult.rows[0];

            await client.query('COMMIT');

            return {
                id: user.id,
                doctor_id: doctor.doctor_id,
                uuid: doctor.doctor_id,
                username: user.username,
                email: user.email,
                name: user.full_name,
                full_name: user.full_name,
                role: 'doctor',
                is_active: user.is_active,
                subscription_type: user.subscription_type,
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.log(`Doctor creation failed: ${error.message}`);
            return { success: false };
        } finally {
            client.release();
        }
    }

    linkGoogleIdToUser = async(userId, googleId)=>{
        try {
            const query = `
                UPDATE users 
                SET google_id = $1,
                    provider = 'google',
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id, google_id, provider;
            `;
            const params = [googleId, userId];
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`Link google id failed: ${error.message}`);
            throw error;
        }
    }

    createUserFormGoogle = async({googleId, email, fullName, avatarUrl, emailVerified})=>{
        try {
            const passPlaceholder = 'google_auth_' + Math.random().toString(36).slice(2, 18);
            const usernameBase = email ? email.split('@')[0] : `g_${googleId.slice(0, 8)}`;

            let counter = 1;
            while(await this.getUserByUsername(usernameBase)){
                counter++;
            }

            const username = `${usernameBase}${counter}`;

            const query = `
                INSERT INTO users 
                (username, email, password_hash, full_name, google_id, provider, avatar_url, email_verified)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, username, email, full_name, is_active, email_verified, google_id, provider, avatar_url, subscription_type, created_at, updated_at;
            `;
            const params = [username, email, passPlaceholder, fullName, googleId, "google", avatarUrl, !!emailVerified];
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`Google user creation failed: ${error.message}`);
            throw error;
        }
    } 

    getUserByGoogleId = async(googleId)=>{
        try {
            const query = `
                SELECT 
                id, username, email, full_name, is_active, email_verified, subscription_type, avatar_url, created_at, updated_at 
                FROM users WHERE google_id = $1 LIMIT 1
            `;
            const result = await this.db_connection.query_executor(query, [googleId]);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`Finding user by google_id failed: ${error.message}`);
            throw error;
        }
    }

    getUserById = async(userId)=>{
        try {
            // UUID → legacy patient_id lookup
            if(UUID_RE.test(String(userId || ''))){
                const result = await this.db_connection.query_executor(
                    `SELECT u.id, u.username, u.email, u.password_hash, u.full_name AS name,
                            u.full_name, u.role, u.is_active, u.email_verified,
                            u.subscription_type, u.avatar_url, u.last_login,
                            p.patient_id, p.patient_id AS uuid
                     FROM patient p
                     JOIN users u ON u.id = p.user_id
                     WHERE p.patient_id = $1 LIMIT 1`,
                    [userId]
                );
                if (result.rows[0]) return result.rows[0];

                // Pre-migration row without user_id
                const legacy = await this.db_connection.query_executor(
                    `SELECT patient_id, name, username, email, password, last_login, created_at, updated_at
                     FROM patient WHERE patient_id = $1 LIMIT 1`,
                    [userId]
                );
                return this.mapPatientUser(legacy.rows[0]);
            }

            // Integer → users table
            const result = await this.db_connection.query_executor(
                `SELECT u.id, u.username, u.email, u.password_hash, u.full_name AS name,
                        u.full_name, u.role, u.is_active, u.email_verified,
                        u.subscription_type, u.avatar_url, u.last_login,
                        u.created_at, u.updated_at,
                        p.patient_id, p.patient_id AS uuid,
                        d.doctor_id
                 FROM users u
                 LEFT JOIN patient p ON p.user_id = u.id
                 LEFT JOIN doctor  d ON d.user_id = u.id
                 WHERE u.id = $1 LIMIT 1`,
                [userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.log(`getUserById failed: ${error.message}`);
            throw error;
        }
    }

    getUserByEmail = async(email)=>{
        try {
            const result = await this.db_connection.query_executor(
                `SELECT u.id, u.username, u.email, u.password_hash, u.full_name AS name,
                        u.full_name, u.role, u.is_active, u.email_verified,
                        u.login_attempts, u.locked_until, u.last_login,
                        u.subscription_type, u.avatar_url, u.created_at, u.updated_at,
                        p.patient_id, p.patient_id AS uuid,
                        d.doctor_id
                 FROM users u
                 LEFT JOIN patient p ON p.user_id = u.id
                 LEFT JOIN doctor  d ON d.user_id = u.id
                 WHERE u.email = $1
                 LIMIT 1`,
                [email]
            );
            return result.rows[0] || null;
        } catch (error) {
            if (error.code === '42P01') return null; // users table not yet created
            console.log(`getUserByEmail failed: ${error.message}`);
            throw error;
        }
    }

    getPatientByEmail = async(email)=>{
        try {
            // New architecture: look up via users table
            const user = await this.getUserByEmail(email);
            if (user) return user;

            // Fallback: old rows without user_id (pre-migration data)
            const result = await this.db_connection.query_executor(
                `SELECT patient_id, name, username, email, password, last_login, created_at, updated_at
                 FROM patient WHERE email = $1 AND user_id IS NULL LIMIT 1`,
                [email]
            );
            return result.rows[0] ? this.mapPatientUser(result.rows[0]) : null;
        } catch (error) {
            console.log(`getPatientByEmail failed: ${error.message}`);
            throw error;
        }
    }

    getDoctorByEmail = async(email)=>{
        try {
            // New architecture: look up via users table
            const user = await this.getUserByEmail(email);
            if (user) return user;

            // Fallback: old rows without user_id
            const result = await this.db_connection.query_executor(
                `SELECT * FROM doctor WHERE email = $1 AND user_id IS NULL LIMIT 1`,
                [email]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.log(`getDoctorByEmail failed: ${error.message}`);
            throw error;
        }
    }

    getUserByUsername = async(username)=>{
        try {
            const patientQuery = `
                SELECT patient_id, name, username, email, password, last_login, created_at, updated_at
                FROM patient
                WHERE username = $1
                LIMIT 1;
            `;
            const patientResult = await this.db_connection.query_executor(patientQuery, [username]);
            if(patientResult.rows[0]) return this.mapPatientUser(patientResult.rows[0]);

            const userQuery = `
                SELECT *
                FROM users
                WHERE username = $1
                LIMIT 1;
            `;
            try {
                const userResult = await this.db_connection.query_executor(userQuery, [username]);
                return userResult.rows[0] || null;
            } catch (error) {
                if(error.code === '42P01') return null;
                throw error;
            }
        } catch (error) {
            console.log(`Finding user by username failed: ${error.message}`);
            throw error;
        }
    }

    updateUser = async(userId, updates)=>{
        try {
            if(!updates || Object.keys(updates).length === 0){
                throw new Error("No updates were sent from frontend");
            }

            const allowed = new Set(["username", "email", "full_name", "is_active"]);
            const sets = [];
            const values = [];
            let idx = 1;

            for(const [key, value] of Object.entries(updates)){
                if(!allowed.has(key)) continue;

                sets.push(`${key} = $${idx++}`);
                values.push(value);
            }

            if(sets.length === 0){
                throw new Error("No valid value was sent");
            }

            sets.push(`updated_at = NOW()`);

            const query = `
                UPDATE users
                SET ${sets.join(', ')}
                WHERE id = $${idx}
                RETURNING id, username, email, full_name, is_active, email_verified, subscription_type, created_at, updated_at
            `;
            values.push(userId);
            
            const result = await this.db_connection.query_executor(query, values);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`User updation failed: ${error.message}`);
            return {success: false};
        }
    }

    deleteUser = async(userId)=>{
        try {
            const query = `
                DELETE FROM users
                WHERE id = $1
                RETURNING id
            `;
            const params = [userId];
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0];
        } catch (error) {
            console.log(`User deletion failed: ${error.message}`);
            return {success: false}
        }
    }

    setLastLogin = async(userId)=>{
        try {
            if(UUID_RE.test(String(userId || ''))){
                const query = `
                    UPDATE patient
                    SET last_login = NOW(),
                        updated_at = NOW()
                    WHERE patient_id = $1
                    RETURNING patient_id AS id
                `;
                const result = await this.db_connection.query_executor(query, [userId]);
                return result.rows[0];
            }

            const query = `
                UPDATE users
                SET last_login = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id
            `;
            const params = [userId];
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0];
        } catch (error) {
            console.log(`Recording last login failed: ${error.message}`);
            return {success: false}
        }
    }

    incrementLoginAttempts = async(userId)=>{
        try {
            if(UUID_RE.test(String(userId || ''))){
                return { id: userId, login_attempts: 1 };
            }

            const query = `
                UPDATE users
                SET login_attempts = login_attempts + 1,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, login_attempts
            `;
            const params = [userId];
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`login increment failed: ${error.message}`);
            return {success: false};
        }
    }

    resetLoginAttempts = async(userId)=>{
        try {
            if(UUID_RE.test(String(userId || ''))){
                return { id: userId, login_attempts: 0, locked_until: null };
            }

            const query = `
                UPDATE users
                SET login_attempts = 0,
                    locked_until = NULL,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, login_attempts, locked_until;
            `;
            const params = [userId];
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`reset login attempt: ${error.message}`);
            return {success: false};
        }
    }

    lockAccount = async(userId, untilTimestamp)=>{
        try {
            if(UUID_RE.test(String(userId || ''))){
                return { id: userId, locked_until: untilTimestamp };
            }

            const query = `
                UPDATE users
                SET locked_until = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id, locked_until;
            `;
            const params = [untilTimestamp, userId];

            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`account locking: ${error.message}`);
            return {success: false};
        }
    }

    setEmailVerified = async(userId)=>{
        try {
            const query = `
                UPDATE users
                SET email_verified = true,
                    verification_token = NULL,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, email_verified
            `;
            const params = [userId];

            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0];
        } catch (error) {
            console.log(`Email verificatin failed: ${error.message}`);
            return {success: false};
        }
    }

    setVerificationToken = async(userId, token)=>{
        try {
            const query = `
                UPDATE users
                SET verification_token = $1,
                    email_verified = false,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id, verification_token;
            `;
            const params = [token, userId];
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0];
        } catch (error) {
            console.log(`Verification token sending failed: ${error.message}`);
            return {success: false};
        }
    }

    getUserByVerificationToken = async(token)=>{
        try {
            const query = `
                SELECT * FROM users
                WHERE verification_token = $1
                LIMIT 1
            `;
            const params = [token];

            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`User verification failed: ${error.message}`);
            return {success: false};
        }
    }

    setPasswordResetToken = async(userId, token, expiresAt)=>{
        try {
            const query = `
                UPDATE users
                SET password_reset_token = $1,
                    password_reset_expires = $2,
                    updated_at = NOW()
                WHERE id = $3
                RETURNING id, password_reset_token, password_reset_expires
            `;
            const params = [token, expiresAt, userId];
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`Password token insertion failed: ${error.message}`);
            return {success: false};
        }
    }

    getUserByPasswordResetToken = async (token)=>{
        try {
            const query = `
                SELECT * FROM users
                WHERE password_reset_token = $1
                    AND password_reset_expires IS NOT NULL
                    AND password_reset_expires > NOW()
                LIMIT 1
            `;
            const params = [token];

            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`Findng user by password reset token failed: ${error.message}`);
            return {success: false};
        }
    }

    updatePassword = async(userId, newPasswordHash)=>{
        try {
            const query = `
                UPDATE users
                SET password_hash = $1,
                    password_reset_token = NULL,
                    password_reset_expires = NULL,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id
            `;
            const params = [newPasswordHash, userId]
            const result = await this.db_connection.query_executor(query, params);

            return result.rows[0] || null;
        } catch (error) {
            console.log(`Password updation failed: ${error.message}`);
            return {success: false};
        }
    }

    // token related parts

    updateRefreshToken = async(userId, refreshToken)=> {
        try {
            if(UUID_RE.test(String(userId || ''))){
                return { id: userId };
            }

            const query = `
                UPDATE users 
                SET refresh_token = $2, updated_at = NOW()
                WHERE id = $1
                `;
            const params = [userId, refreshToken];
            await this.db_connection.query_executor(query, params);
        } catch (error) {
            console.log("Updation of refresh token failed");
        }
    }

    findByRefreshToken = async(refreshToken)=> {
       try {
            const query = `
                SELECT id, username, email, full_name
                FROM users 
                WHERE refresh_token = $1 AND is_active = true
                `;

            const result = await this.db_connection.query_executor(query, [refreshToken]);
            return result.rows[0] || null;
       } catch (error) {
            console.log("finding by refresh token failed");
            throw error;
       }
    }

    clearRefreshToken = async(userId)=> {
        try {
            const query = `
                UPDATE users 
                SET refresh_token = NULL, updated_at = NOW()
                WHERE id = $1
                RETURNING id
                `;

            const result = await this.db_connection.query_executor(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.log("Clearing of refresh token failed");
            throw error;
        }
    }

    // miscellaneous utility functions
    isAccountLocked = async(userId)=>{
        try {
            const query = `
                SELECT 1
                FROM users
                WHERE id = $1
                  AND locked_until IS NOT NULL
                  AND locked_until > NOW()
                LIMIT 1;
            `;
            const result = await this.db_connection.query_executor(query, [userId]);
            return result.rowCount === 1;
        } catch (error) {
            console.log(`account lock checking failed: ${error.message}`);
            throw error;
        }
    }

    isEmailTaken = async(email)=>{
        try {
            const result = await this.db_connection.query_executor(
                `SELECT COUNT(id) as cnt FROM users WHERE email = $1;`,
                [email]
            );
            return parseInt(result.rows[0].cnt) > 0;
        } catch (error) {
            if (error.code === '42P01') return false; // users table not yet migrated
            console.log(`isEmailTaken failed: ${error.message}`);
            throw error;
        }
    }

    isUsernameTaken = async(username)=>{
        try {
            const result = await this.db_connection.query_executor(
                `SELECT COUNT(id) as cnt FROM users WHERE username = $1;`,
                [username]
            );
            return parseInt(result.rows[0].cnt) > 0;
        } catch (error) {
            if (error.code === '42P01') return false;
            console.log(`isUsernameTaken failed: ${error.message}`);
            throw error;
        }
    }

    updateSubscriptionType = async(userId, subscriptionType)=>{
        try {
            const query = `
                UPDATE users
                SET subscription_type = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id, subscription_type;
            `;
            const result = await this.db_connection.query_executor(query, [subscriptionType, userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.log(`Subscription update failed: ${error.message}`);
            return { success: false };
        }
    }

    setAvatarUrl = async(userId, avatarUrl)=>{
        try {
            const query = `
                UPDATE users
                SET avatar_url = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id, avatar_url
            `;
            const params = [avatarUrl.secure_url, userId];
            const result = await this.db_connection.query_executor(query, params);
            return result.rows[0] || null;
        } catch (error) {
            console.log(`Avatar url updation failed: ${error.message}`);
            return { success: false };
        }
    }

    // ── Family Network ────────────────────────────────────────────────────────

    static _genCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let c = 'RXF-';
        for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
        return c;
    }

    getOrCreateShareCode = async (userId) => {
        // Return existing code if present
        const existing = await this.db_connection.query_executor(
            `SELECT family_share_code FROM users WHERE id = $1 LIMIT 1`, [userId]
        );
        if (existing.rows[0]?.family_share_code) return existing.rows[0].family_share_code;

        // Generate a unique code (retry on collision)
        for (let i = 0; i < 10; i++) {
            const code = UserModel._genCode();
            try {
                const r = await this.db_connection.query_executor(
                    `UPDATE users SET family_share_code = $1 WHERE id = $2 RETURNING family_share_code`,
                    [code, userId]
                );
                if (r.rows[0]?.family_share_code) return r.rows[0].family_share_code;
            } catch (e) {
                if (e.code !== '23505') throw e; // 23505 = unique violation, retry
            }
        }
        throw new Error('Could not generate a unique share code');
    };

    regenerateShareCode = async (userId) => {
        for (let i = 0; i < 10; i++) {
            const code = UserModel._genCode();
            try {
                const r = await this.db_connection.query_executor(
                    `UPDATE users SET family_share_code = $1 WHERE id = $2 RETURNING family_share_code`,
                    [code, userId]
                );
                if (r.rows[0]?.family_share_code) return r.rows[0].family_share_code;
            } catch (e) {
                if (e.code !== '23505') throw e;
            }
        }
        throw new Error('Could not regenerate share code');
    };

    lookupByShareCode = async (code) => {
        const r = await this.db_connection.query_executor(`
            SELECT u.id, u.full_name AS name,
                   p.blood_group, p.date_of_birth, p.gender
            FROM users u
            LEFT JOIN patient p ON p.user_id = u.id
            WHERE u.family_share_code = $1
            LIMIT 1
        `, [code.trim().toUpperCase()]);
        return r.rows[0] || null;
    };

    createFamilyLink = async (requesterId, memberId, relationship) => {
        const r = await this.db_connection.query_executor(`
            INSERT INTO family_link (requester_id, member_id, relationship)
            VALUES ($1, $2, $3)
            ON CONFLICT (requester_id, member_id) DO UPDATE SET relationship = EXCLUDED.relationship
            RETURNING link_id, relationship, created_at
        `, [requesterId, memberId, relationship]);
        return r.rows[0] || null;
    };

    getFamilyLinks = async (userId) => {
        const r = await this.db_connection.query_executor(`
            SELECT
                fl.link_id,
                fl.relationship,
                fl.created_at         AS linked_at,
                u.id                  AS member_user_id,
                u.full_name           AS name,
                p.blood_group,
                p.date_of_birth,
                p.gender,
                p.weight,
                p.blood_pressure_systolic,
                p.blood_pressure_diastolic,
                (SELECT COALESCE(json_agg(kc.condition_name ORDER BY kc.created_at), '[]'::json)
                 FROM known_condition kc
                 WHERE kc.patient_id = p.patient_id AND kc.status = 'active'
                 LIMIT 4
                ) AS active_conditions,
                (SELECT COUNT(*) FROM patient_allergy pa WHERE pa.patient_id = p.patient_id
                ) AS allergy_count,
                (SELECT MAX(mr.uploaded_at) FROM medical_report mr WHERE mr.patient_id = p.patient_id
                ) AS last_report_at
            FROM family_link fl
            JOIN  users u ON u.id = fl.member_id
            LEFT JOIN patient p ON p.user_id = u.id
            WHERE fl.requester_id = $1
            ORDER BY fl.created_at DESC
        `, [userId]);
        return r.rows || [];
    };

    getFamilyMemberHealth = async (requesterId, linkId) => {
        // Verify requester owns this link, then fetch full health snapshot
        const r = await this.db_connection.query_executor(`
            SELECT
                fl.relationship,
                u.full_name           AS name,
                p.date_of_birth,
                p.gender,
                p.blood_group,
                p.height,
                p.weight,
                p.blood_pressure_systolic,
                p.blood_pressure_diastolic,
                p.bp_recorded_at,
                p.smoking_status,
                (SELECT COALESCE(json_agg(json_build_object(
                    'name', kc.condition_name,
                    'since', TO_CHAR(kc.diagnosed_at, 'YYYY'),
                    'status', kc.status
                ) ORDER BY kc.created_at), '[]'::json)
                 FROM known_condition kc WHERE kc.patient_id = p.patient_id
                ) AS conditions,
                (SELECT COALESCE(json_agg(json_build_object(
                    'name', COALESCE(d.generic_name, d.brand_name, 'Unknown'),
                    'severity', pa.severity,
                    'reaction', pa.reaction_type
                ) ORDER BY pa.created_at), '[]'::json)
                 FROM patient_allergy pa
                 LEFT JOIN drug d ON d.drug_id = pa.drug_id
                 WHERE pa.patient_id = p.patient_id
                ) AS allergies,
                (SELECT MAX(mr.uploaded_at) FROM medical_report mr WHERE mr.patient_id = p.patient_id
                ) AS last_report_at
            FROM family_link fl
            JOIN  users u ON u.id = fl.member_id
            LEFT JOIN patient p ON p.user_id = u.id
            WHERE fl.link_id = $1 AND fl.requester_id = $2
            LIMIT 1
        `, [linkId, requesterId]);
        return r.rows[0] || null;
    };

    removeFamilyLink = async (requesterId, linkId) => {
        const r = await this.db_connection.query_executor(`
            DELETE FROM family_link
            WHERE link_id = $1 AND requester_id = $2
            RETURNING link_id
        `, [linkId, requesterId]);
        return r.rows[0] || null;
    };
}

module.exports = UserModel;
