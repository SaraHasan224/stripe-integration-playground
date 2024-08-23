const db = require("./db"); // Import the database connection

async function upsertCheckout(_customer) {
  let connection;

  try {
    connection = await db.getConnection();

    const getLastUnpaidQuery = `SELECT id FROM checkout WHERE payment_status = 'unpaid' LIMIT 1`;

    const [rows] = await connection.execute(getLastUnpaidQuery);

    if (rows.length > 0) {
      // If there is an unpaid record, update it
      const updateQuery = `
        UPDATE checkout 
        SET stripe_checkout_id = ?, customer_email = ?, stripe_customer_id = ?, currency = ?, total_amt = ?
        WHERE id = ?
      `;

      const updateValues = [
        null,
        _customer.email,
        _customer.id,
        "usd",
        0,
        rows[0].id,
      ];

      return await db.query(updateQuery, updateValues);
    } else {
      // If there is no unpaid record, create a new one
      const insertQuery = `
        INSERT INTO checkout 
        (stripe_checkout_id, customer_email, stripe_customer_id, currency, payment_status, total_amt) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const insertValues = [
        null,
        _customer.email,
        _customer.id,
        "usd",
        "unpaid",
        0,
      ];

      return await db.query(insertQuery, insertValues);
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function upsertCheckoutSession(session) {
  console.log("upsertCheckoutSession:", session);
  const getLastUnpaidQuery = `SELECT id FROM checkout WHERE payment_status = 'unpaid' LIMIT 1`;

  let connection;

  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(getLastUnpaidQuery);

    if (rows.length > 0) {
      // If there is an unpaid record, update it
      const query = `
          UPDATE checkout 
          SET stripe_checkout_id = ?, customer_email = ?, stripe_customer_id = ?, currency = ?, total_amt = ?
          WHERE id = ?
        `;

      const values = [
        session.id || "",
        session.customer_email || "sarahasan224@gmail.com",
        session.stripe_customer_id || null,
        session.currency || "usd",
        session.total_amt || 0,
        rows[0].id,
      ];

      try {
        const [results] = await connection.execute(query, values);
      } catch (err) {
        console.error("Error updating data:", err);
        throw new Error("Server error: " + err.message);
      }
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function updateCheckoutStatus(session) {
  console.log("updateCheckoutStatus:", session);
  const getLastUnpaidQuery = `SELECT * FROM checkout WHERE payment_status = 'unpaid' AND stripe_checkout_id = ? LIMIT 1`;
  const getLastUnpaidValues = [session.id];

  let connection;

  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(
      getLastUnpaidQuery,
      getLastUnpaidValues
    );

    if (rows.length > 0) {
      console.log("checkout found: ", rows);
      // If there is an unpaid record, update it
      // If there is an unpaid record, update it
      const query = `
        UPDATE checkout 
        SET payment_intent = ?, charge_id = ?, payment_status = ?
        WHERE stripe_checkout_id = ?
      `;

      const values = [
        session.payment_intent,
        null,
        session.payment_status,
        rows[0].stripe_checkout_id,
      ];

      console.log("Executing update query:", query, values);

      try {
        const [results] = await connection.execute(query, values);
      } catch (err) {
        console.error("Error updating data:", err);
        throw new Error("Server error: " + err.message);
      }
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  upsertCheckout,
  updateCheckoutStatus,
  upsertCheckoutSession,
}; // Export the pool
