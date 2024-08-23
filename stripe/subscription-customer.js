const db = require("../db"); // Import the database connection

async function createOrFindNew(identifier, customer_id) {
  let connection;
  let subscription;
  let customer;
  try {
    connection = await db.getConnection();
    const stripe = require("stripe")(process.env.STRIPE_KEY);
    // Check if customer exist on stripe then fetch that else create new
    if (identifier != null && identifier != "" && identifier != undefined) {
      subscription = await stripe.customers.retrieve(customerId);
    } else {
      subscription = await stripe.subscriptions.create({
        customer: customer_id,
        items: [
          {
            price: "price_1MowQULkdIwHu7ixraBm864M",
          },
        ],
      });
      console.log("subscription");
      console.log(subscription);
      // Stripe customer update by email
      const updateQuery = `
      UPDATE customers 
      SET stripe_key = ?
      WHERE identifier = ?
    `;
      const updateValues = [subscription.id, identifier];

      await db.query(updateQuery, updateValues);
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("subscription found in table: ", subscription);
    if (connection) {
      connection.release();
    }
    return subscription;
  }
}

async function createCustomerSubscriptions(identifier, name) {
  const getLastUnpaidQuery = `SELECT * FROM subscription WHERE identifier = ? LIMIT 1`;
  const getLastUnpaidValues = [identifier];

  let connection;
  let subscription = null;
  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(
      getLastUnpaidQuery,
      getLastUnpaidValues
    );

    if (rows.length > 0) {
      subscription = rows[0];
    } else {
      const query = `INSERT INTO subscription
(identifier, name)
VALUES (?, ?)`;

      const values = [identifier || null, name || null];

      try {
        const [insertedCustomer] = await db.query(query, values);
        // Query to fetch the inserted customer record
        const selectQuery = `SELECT * FROM subscription WHERE identifier = ? ORDER BY id DESC LIMIT 1`;
        // Fetch the inserted customer record from the database
        const [rows] = await db.query(selectQuery, [identifier]);
        subscription = rows[0];
      } catch (err) {
        console.error("Error inserting data:", err);
      }
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("subscription found in table: ", subscription);

    if (connection) {
      connection.release();
    }
    return await createOrFindNew(identifier, customer_id);
  }
}

module.exports = {
  createCustomerSubscriptions,
};
