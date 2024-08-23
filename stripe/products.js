const db = require("../db"); // Import the database connection

async function createProduct(identifier, result) {
  let connection;
  let product;

  try {
    connection = await db.getConnection();
    const stripe = require("stripe")(process.env.STRIPE_KEY);
    // Check if customer exist on stripe then fetch that else create new
    if (
      result.stripe_product_id != null &&
      result.stripe_product_id != "" &&
      result.stripe_product_id != undefined
    ) {
      product = await stripe.prices.retrieve(result.stripe_product_price);
    } else {
      metadata = JSON.parse(result.metadata);
      metadata.identifier = identifier;
      product = await await stripe.prices.create({
        currency: result.currency,
        unit_amount: result.amount * 100, // Amount in cents ($29.99 * 100)
        recurring: {
          interval: result.recurring_interval,
        },
        product_data: {
          name: result.product_name,
          metadata,
        },
      });

      const updateQuery = `
        UPDATE products
        SET stripe_product_id = ?, stripe_product_price = ?
        WHERE identifier = ?
      `;
      const updateValues = [product.product, product.id, identifier];
      await db.query(updateQuery, updateValues);
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("product found in table: ", product);
    if (connection) {
      connection.release();
    }
    return product;
  }
}

async function findOrCreateProducts(identifier, properties) {
  const getLastUnpaidQuery = `SELECT * FROM products WHERE identifier = ? LIMIT 1`;
  const getLastUnpaidValues = [identifier];

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
    } else {
      const query = `INSERT INTO products
(product_name, identifier, livemode, currency, amount, type, recurring_interval, metadata)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        properties.name,
        identifier || null,
        false,
        "USD",
        properties.amount,
        "recurring",
        "day",
        JSON.stringify(properties.metadata),
      ];

      try {
        await db.query(query, values);
        // Query to fetch the inserted products record
        const selectQuery = `SELECT * FROM products WHERE identifier = ? ORDER BY id DESC LIMIT 1`;
        // Fetch the inserted products record from the database
        const [rows] = await db.query(selectQuery, [identifier]);
        result = rows[0];
      } catch (err) {
        console.error("Error inserting data:", err);
      }
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("product in table: ", result);
    if (connection) {
      connection.release();
    }
    return await createProduct(identifier, result);
  }
}

async function findAllProducts() {
  let products = [];
  const getLastUnpaidQuery = `SELECT * FROM products`;
  const getLastUnpaidValues = [];

  let connection;
  let result = null;
  try {
    connection = await db.getConnection();
    const stripe = require("stripe")(process.env.STRIPE_KEY);

    const [rows] = await connection.execute(
      getLastUnpaidQuery,
      getLastUnpaidValues
    );

    rows.forEach(async (element, key) => {
      // console.log(element.stripe_product_price);
      // const price = await stripe.prices.retrieve(element.stripe_product_price);
      // console.log(price);
      products[key] = element;
    });
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("product in table: ", result);
    if (connection) {
      connection.release();
    }
    return products;
  }
}

module.exports = {
  findOrCreateProducts,
  findAllProducts,
};
