const db = require("../db"); // Import the database connection

async function isFirstSubscription(customer_id, product_id) {
  const getLastUnpaidQuery = `SELECT * FROM subscription_customers WHERE customer_id = ? AND product_id = ? LIMIT 1`;
  const getLastUnpaidValues = [customer_id, product_id];

  let connection;
  let result = null;
  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(
      getLastUnpaidQuery,
      getLastUnpaidValues
    );

    if (rows.length > 0) {
      result = rows[0];
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("result found in table: ", result);

    if (connection) {
      connection.release();
    }
    return result;
  }
}

async function getWelcomePromoCode() {
  const getLastUnpaidQuery = `SELECT * FROM promos WHERE type = ? LIMIT 1`;
  const getLastUnpaidValues = ["welcome"];

  let connection;
  let result = null;
  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(
      getLastUnpaidQuery,
      getLastUnpaidValues
    );

    if (rows.length > 0) {
      result = rows[0];
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("result found in table: ", result);

    if (connection) {
      connection.release();
    }
    return result;
  }
}

async function getPromoDiscountCode() {
  const getLastUnpaidQuery = `SELECT * FROM promos WHERE type = ? LIMIT 1`;
  const getLastUnpaidValues = ["promo"];

  let connection;
  let result = null;
  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(
      getLastUnpaidQuery,
      getLastUnpaidValues
    );

    if (rows.length > 0) {
      result = rows[0];
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("result found in table: ", result);

    if (connection) {
      connection.release();
    }
    return result;
  }
}

async function syncSubscription(session, body) {
  let connection;
  let result = null;
  try {
    connection = await db.getConnection();

    console.log("session: ", session);
    const query = `INSERT INTO subscription_customers
(customer_id, subscription_id, product_id, price_id, status, checkout_session, payment_status, pmc_id, mode, invoice_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      body.customer_id,
      session.subscription,
      body.product_id,
      body.price_id,
      session.status,
      session.id,
      session.payment_status,
      session.payment_method_configuration_details.id,
      session.mode,
      session.invoice,
    ];

    try {
      await db.query(query, values);
      // Query to fetch the inserted products record
      const selectQuery = `SELECT * FROM subscription_customers WHERE customer_id = ? AND subscription_id = ? LIMIT 1`;
      // Fetch the inserted products record from the database
      const [rows] = await db.query(selectQuery, [
        session.customer,
        session.subscription,
      ]);
      result = rows[0];
    } catch (err) {
      console.error("Error inserting data:", err);
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("result found in table: ", result);

    if (connection) {
      connection.release();
    }
    return result;
  }
}

module.exports = {
  isFirstSubscription,
  getWelcomePromoCode,
  syncSubscription,
};
