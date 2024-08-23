const db = require("../db"); // Import the database connection

async function createOrFindCustomerOnStripe(
  email,
  customerEmail,
  customerName,
  customerId
) {
  let connection;
  let stripe_customer;
  let customer;
  try {
    connection = await db.getConnection();
    const stripe = require("stripe")(process.env.STRIPE_KEY);
    // Check if customer exist on stripe then fetch that else create new
    if (customerId != null && customerId != "" && customerId != undefined) {
      stripe_customer = await stripe.customers.retrieve(customerId);
    } else {
      stripe_customer = await stripe.customers.create({
        name: customerName,
        email: customerEmail,
        shipping: {
          name: customerName,
          address: {
            line1: "920 5th Ave",
            city: "Seattle",
            state: "WA",
            postal_code: "98104",
            country: "US",
          },
        },
      });
      console.log("stripe_customer");
      console.log(stripe_customer);
      // Stripe customer update by email
      const updateQuery = `
      UPDATE customers 
      SET stripe_customer_id = ?
      WHERE email = ?
    `;
      const updateValues = [stripe_customer.id, email];

      customer = await db.query(updateQuery, updateValues);
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("customer found in table: ", customer);
    console.log("stripe_customer found in table: ", stripe_customer);
    if (connection) {
      connection.release();
    }
    return stripe_customer;
  }
}

async function findCustomerDetails(email, name) {
  const getLastUnpaidQuery = `SELECT * FROM customers WHERE email = ? LIMIT 1`;
  const getLastUnpaidValues = [email];

  let connection;
  let customer = null;
  let customerName = null;
  let customerEmail = null;
  let customerId = null;
  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(
      getLastUnpaidQuery,
      getLastUnpaidValues
    );

    if (rows.length > 0) {
      customer = rows[0];
      customerName = rows[0].name;
      customerEmail = rows[0].email;
      customerId = rows[0].stripe_customer_id;
    } else {
      const query = `INSERT INTO customers
(email, name)
VALUES (?, ?)`;

      const values = [email || null, name || null];

      try {
        const [insertedCustomer] = await db.query(query, values);
        // Query to fetch the inserted customer record
        const selectQuery = `SELECT * FROM customers WHERE email = ? ORDER BY id DESC LIMIT 1`;
        // Fetch the inserted customer record from the database
        const [rows] = await db.query(selectQuery, [email]);
        customer = rows[0];

        customerName = customer.name;
        customerId = customer.stripe_customer_id;
        customerEmail = customer.email;
        // res.json("Data inserted successfully");
      } catch (err) {
        console.error("Error inserting data:", err);
      }
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("customer found in table: ", customer);

    if (connection) {
      connection.release();
    }
    return await createOrFindCustomerOnStripe(
      email,
      customerEmail,
      customerName,
      customerId
    );
  }
}

module.exports = {
  findCustomerDetails,
};
