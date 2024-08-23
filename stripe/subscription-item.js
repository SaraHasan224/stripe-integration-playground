const db = require("../db"); // Import the database connection

async function getItemInfo(identifier) {
  const getLastUnpaidQuery = `SELECT * FROM products WHERE stripe_product_id = ? LIMIT 1`;
  const getLastUnpaidValues = [identifier];

  let connection;
  let item = null;
  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(
      getLastUnpaidQuery,
      getLastUnpaidValues
    );

    if (rows.length > 0) {
      item = rows[0];
    }
  } catch (err) {
    console.error("Database connection error:", err);
    throw new Error("Database connection error: " + err.message);
  } finally {
    console.log("item info found in table: ", subscription);

    if (connection) {
      connection.release();
    }
    return item;
  }
}

module.exports = {
  getItemInfo,
};
