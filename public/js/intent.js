const stripe = Stripe(STRIPE_KEY);
const elements = stripe.elements();
const cardElement = elements.create("card");
cardElement.mount("#card-element");

const form = document.getElementById("payment-form");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { paymentIntent, error } = await stripe.confirmCardPayment(
    clientSecret,
    {
      payment_method: {
        card: cardElement,
      },
    }
  );

  const resultElement = document.getElementById("payment-result");
  if (error) {
    resultElement.textContent = `Error: ${error.message}`;
  } else if (paymentIntent.status === "succeeded") {
    resultElement.textContent = "Payment successful! ";

    // Convert JSON data to a formatted string
    const jsonString = JSON.stringify(jsonData, null, 2);
    // Display JSON string in the div
    document.getElementById("json-display").textContent = paymentIntent;
  }
});
