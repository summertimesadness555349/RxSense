const bcrypt = require("bcrypt");
const DB_Connection = require("./database/db"); // your existing db.js
const db_connection = new DB_Connection();

const createUser = async (name, email, password, role) => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10); // 10 salt rounds

    const result = await db_connection.query_executor(
      `INSERT INTO PATIENT (patient_id, name, date_of_birth, gender, blood_group, age, location, contact_info, height, weight, username, email, password)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [name, '1988-03-15', 'male', 'O+', 38, '123 Main St, Mirpur, Dhaka', '+8801712345678', 170, 72, name, email, hashedPassword]
    );

    console.log("User created with hashed password");
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

createUser("Rahim Uddin", "rahim@example.com", "password123", "patient");
