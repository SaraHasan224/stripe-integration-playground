const query = `INSERT INTO checkout 
    (stripe_checkout_id, customer_email, stripe_customer_id, currency, payment_status, total_amt) 
    VALUES (?, ?, ?, ?, ?, ?)`;

const values = [
  session.id ||
    "cs_test_a1qine78RReHCMa1eUS06fLZKNu2skGkHVc9uwejJYVmllCkCUc2fBe0op",
  session.customer_email || null,
  null,
  session.currency || "usd",
  session.payment_status || "unpaid",
  0,
];

try {
  const [results] = await db.query(query, values);
  // res.json("Data inserted successfully");
} catch (err) {
  console.error("Error inserting data:", err);
  res.status(500).send("Server error: " + err.message);
}
