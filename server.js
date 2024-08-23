const express = require("express");
const ejs = require("ejs");
const multer = require("multer");
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const helpers = require("./util/helpers");

// Load environment variables from .env file
require("dotenv").config();
const common = require("./common"); // Import the database connection
const customer = require("./stripe/customer"); // Import the database connection
const subscription = require("./stripe/subscription"); // Import the database connection
const item = require("./stripe/subscription-item"); // Import the database connection
const products = require("./stripe/products"); // Import the database connection
const { subscribe } = require("diagnostics_channel");

const app = express();
app.use(express.static("public"));
// Set the view engine to ejs
app.set("view engine", "ejs");
// Set the directory for the views
app.set("views", path.join(__dirname, "views"));
// Use express-ejs-layouts
app.use(expressLayouts);
// Specify the default layout
app.set("layout", "layouts/main");
// Add a helper function (you need to configure this manually within your views)
app.locals.helpers = helpers;

// checkout page
app.get("/", async function (req, res) {
  let result = await products.findAllProducts();
  res.render("pages/index", { appUrl: process.env.APP_URL, products: result });
});
app.get("/checkout", function (req, res) {
  res.render("pages/checkout", { appUrl: process.env.APP_URL });
});
app.get("/success", function (req, res) {
  res.render("pages/success", {
    appUrl: process.env.APP_URL,
  });
});
app.get("/cancel", function (req, res) {
  res.render("pages/cancel", {
    appUrl: process.env.APP_URL,
  });
});
app.get("/subscription/success", function (req, res) {
  const sessionId = req.query.session_id;
  res.render("pages/subscription/success", {
    appUrl: process.env.APP_URL,
    sessionId: sessionId,
  });
});

// cancel page
app.get("/subscription/cancel", function (req, res) {
  res.render("pages/subscription/cancel", {
    appUrl: process.env.APP_URL,
  });
});

// intent page
app.get("/intent", async function (req, res) {
  const stripe = require("stripe")(process.env.STRIPE_KEY);
  const intent = await stripe.paymentIntents.create({
    amount: 1,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
  });
  res.render("pages/intent", {
    appUrl: process.env.APP_URL,
    client_secret: intent.client_secret,
  });
});

// cancel page
app.get("/subscription/cancel", function (req, res) {
  res.render("pages/subscription/cancel", {
    appUrl: process.env.APP_URL,
  });
});
// intent page
app.get("/payment-intent", async function (req, res, next) {
  try {
    // Access the dynamic parameter
    const intentId = req.query?.intent_id;
    if (intentId == undefined) {
      res.status(400).send({ error: { message: "Intent id is undefined" } });
    }
    const stripe = require("stripe")(process.env.STRIPE_KEY);
    const intent = await stripe.paymentIntents.retrieve(intentId);
    res.render("pages/intent/payment", {
      appUrl: process.env.APP_URL,
      stripeKey: process.env.STRIPE_PUBLISHABLE_KEY,
      client_secret: intent.client_secret,
    });
  } catch (error) {
    next(error); // Pass errors to the error handler
  }
});
// https://fhs-dev-payments-ed0f47a43ff2.herokuapp.com/intent/pi_3MtwBwLkdIwHu7ix28a3tqPa
/**
 * CUSTOMER
 */

app.post("/find-customer-details", upload.none(), async (req, res) => {
  const email = req.body.email;
  const name = req.body.customer_name;

  let customer_info = await customer.findCustomerDetails(email, name);
  // Set the status code to 200
  res.statusCode = 200;
  res.end(JSON.stringify({ result: customer_info }));
});

app.post("/update-payment-method", async (req, res) => {
  const paymentMethodId = "pm_1PQmOTI0DGZ9CkPIZU97XsTH";
  const customerId = "cus_QGwGs3rvbTA7VA";
  const subscriptionId = "sub_1PQOO6I0DGZ9CkPIVJDew7Nq";

  const stripe = require("stripe")(process.env.STRIPE_KEY);
  try {
    // Attach the new Payment Method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Update the customer's default invoice settings
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update the subscription to use the new Payment Method
    await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });

    res.status(200).send({ success: true });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

/**
 * SUBSCRIPTION
 */

app.post("/create-subscription", upload.none(), async (req, res) => {
  console.log("--- subscription_info: ", req.body);
  console.log({
    customer_id: req.body.customer_id,
    product_id: req.body.product_id,
  });
  const isCustomerFirstSubscription = await subscription.isFirstSubscription(
    req.body.customer_id,
    req.body.product_id
  );
  let applyPromo = false;
  let promoCode = null;
  if (
    isCustomerFirstSubscription == null ||
    isCustomerFirstSubscription == "" ||
    !isCustomerFirstSubscription
  ) {
    let promotion = await subscription.getWelcomePromoCode();
    promoCode = promotion.code;
    applyPromo = true;
  }
  const stripe = require("stripe")(process.env.STRIPE_KEY);
  try {
    // Calculate trial_end as 30 days from today (example)
    const trialDays = 1;
    const today = new Date();
    const trialStartDate = new Date(today.setDate(today.getDate()));
    const trialStartTimestamp = Math.floor(trialStartDate.getTime() / 1000);
    const trialEndDate = new Date(today.setDate(today.getDate() + 30));
    const trialEndTimestamp = Math.floor(trialEndDate.getTime() / 1000);
    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      currency: "usd",
      line_items: [
        {
          price: req.body.price_id,
          // price: "price_1PQ89PI0DGZ9CkPIiVadWwqa", //req.body.price_id,
          quantity: 1,
        },
      ],
      // discounts: [
      //   {
      //     coupon: promoCode,
      //   },
      // ],
      customer_email: req.body.customer_email,
      // metadata: req.body.metadata,
      mode: "subscription",
      success_url: `${process.env.APP_URL}subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}subscription/cancel`,
      subscription_data: {
        billing_cycle_anchor: trialEndTimestamp,
        // trial_period_days: 1,
        // trial_settings: {
        //   end_behavior: {
        //     missing_payment_method: "cancel", // Other options: 'create_invoice', 'pause'
        //   },
        // },
      },
    });
    await subscription.syncSubscription(session, req.body);
    // Set the status code to 200
    res.statusCode = 200;
    res.end(JSON.stringify({ url: session.url }));
  } catch (error) {
    console.error("Error creating subscription: ", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/create-portal-session", async (req, res) => {
  try {
    let session_id = req.body?.session_id;
    const stripe = require("stripe")(process.env.STRIPE_KEY);

    // Check if session_id is provided
    if (!session_id || session_id == undefined) {
      session_id = req.query.session_id;
    }

    // Check if session_id is provided
    if (!session_id || session_id == undefined) {
      return res.status(400).send("Session ID is required.");
    }
    // Retrieve the Checkout session
    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

    if (!checkoutSession) {
      return res.status(404).send("Checkout session not found.");
    }

    console.log("checkoutSession: ", checkoutSession);

    // This is the URL to which the customer will be redirected when they are done
    // managing their billing with the portal.
    const returnUrl = `${process.env.APP_URL}/subscription`;

    // Create a billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: checkoutSession.customer,
      return_url: returnUrl,
    });

    res.redirect(303, portalSession.url);
  } catch (error) {
    console.error("Error creating portal session: ", error);

    // Provide detailed error information
    if (error.type === "StripeInvalidRequestError") {
      return res.status(400).send(`Stripe API error: ${error.raw.message}`);
    }

    res.status(500).send("Internal Server Error");
  }
});

app.post("/create-test-subscription", async (req, res) => {
  const stripe = require("stripe")(process.env.STRIPE_KEY);
  try {
    const session = await stripe.checkout.sessions.create({
      currency: "usd",
      line_items: [
        {
          price: "price_1POJobI0DGZ9CkPIi12HkGbS",
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.APP_URL}subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}subscription/cancel`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error("Error creating subscription: ", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get(
  "/subscription-action",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const stripe = require("stripe")(process.env.STRIPE_KEY);
    // Assuming you have a customer ID and subscription ID
    const customerId = "cus_QF3yq2zc6ydLvU";
    const subscriptionId = "sub_1POZqrI0DGZ9CkPIaghnGBbN";

    // Replace 'desired_billing_cycle_anchor' with the desired date for the billing cycle anchor
    const desiredBillingCycleAnchor = Math.floor(Date.now() / 1000); // Current timestamp
    console.log("desiredBillingCycleAnchor -- : ", desiredBillingCycleAnchor);
    // Update the subscription with the new billing cycle anchor
    stripe.subscriptions.update(
      subscriptionId,
      {
        billing_cycle_anchor: "now",
      },
      (err, subscription) => {
        if (err) {
          console.error("Error updating subscription:", err);
        } else {
          console.log("Subscription updated successfully:", subscription);
        }
      }
    );
  }
);

app.get(
  "/products",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let request1 = {
      identifier: "package_1",
      properties: {
        name: "Package 1",
        amount: "7.99",
        metadata: {
          Authorized_Constacts: 5,
          FHS_Staff_Involved: "No",
        },
      },
    };
    let request2 = {
      identifier: "package_2",
      properties: {
        name: "Package 2",
        amount: "15.99",
        metadata: {
          Authorized_Constacts: 20,
          FHS_Staff_Involved: "No",
        },
      },
    };
    let request3 = {
      identifier: "package_3",
      properties: {
        name: "Package 3",
        amount: "29.99",
        metadata: {
          Authorized_Constacts: 20,
          FHS_Staff_Involved: "Yes",
        },
      },
    };
    let result = await products.findOrCreateProducts(
      request3.identifier,
      request3.properties
    );
    // Set the status code to 200
    res.statusCode = 200;
    // res.redirect(303, session.url);
    res.end(JSON.stringify({ result }));
  }
);

app.get(
  "/products-all",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let result = await products.findAllProducts();
    // Set the status code to 200
    res.statusCode = 200;
    // res.redirect(303, session.url);
    res.end(JSON.stringify({ result: result }));
  }
);

// Parse create checkout session
app.post("/create-checkout-session", upload.none(), async (req, res) => {
  let price;
  // Retrieve email from request body
  const body = req.body;
  // Extract the email value
  const email = body.email;
  const name = body.customer_name;

  // This is your test secret API key.
  const stripe = require("stripe")(process.env.STRIPE_KEY);
  (async () => {
    let _customer = await customer.findCustomerDetails(email, name);
    // Run the function
    common
      .upsertCheckout(_customer)
      .then(() => {
        console.log("Operation completed successfully.");
      })
      .catch((err) => {
        console.error("Error:", err);
      });
    const session = await stripe.checkout.sessions.create({
      // mode: "setup",
      payment_method_types: ["card"], // e.g.,
      success_url: process.env.APP_URL + `success`,
      customer: _customer.id,
      cancel_url: process.env.APP_URL + `cancel`,
      line_items: [
        {
          price: "price_1POWFzI0DGZ9CkPIywufNp08",
          quantity: 5,
        },
      ],
      mode: "payment",
      automatic_tax: { enabled: true },
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
    });
    // Set the status code to 200
    res.statusCode = 200;
    common.upsertCheckoutSession(session);
    res.end(JSON.stringify({ url: session.url }));
  })();
});

// stripe webhooks
app.post(
  "/stripe_webhooks",
  express.json({ type: "application/json" }),
  (request, response) => {
    const event = request.body;
    // Handle the event
    switch (event.type) {
      case "customer.created":
        const customerCreated = event.data.object;
        console.log("customerCreated: ", customerCreated);
        // Then define and call a function to handle the event customer.created
        break;
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        console.log("payment intent: ", paymentIntent);
        // Then define and call a method to handle the successful payment intent.
        // handlePaymentIntentSucceeded(paymentIntent);
        break;
      case "payment_method.attached":
        const paymentMethod = event.data.object;
        console.log("payment_method.attached: ", paymentMethod);
        // Then define and call a method to handle the successful attachment of a PaymentMethod.
        // handlePaymentMethodAttached(paymentMethod);
        break;
      case "payment_intent.partially_funded":
        const paymentIntentPartiallyFunded = event.data.object;
        console.log(
          "paymentIntentPartiallyFunded: ",
          paymentIntentPartiallyFunded
        );
        // Then define and call a function to handle the event payment_intent.partially_funded
        break;
      case "payment_intent.payment_failed":
        const paymentIntentPaymentFailed = event.data.object;
        console.log("paymentIntentPaymentFailed: ", paymentIntentPaymentFailed);
        // Then define and call a function to handle the event payment_intent.payment_failed
        break;
      case "payment_intent.processing":
        const paymentIntentProcessing = event.data.object;
        console.log("paymentIntentProcessing: ", paymentIntentProcessing);
        // Then define and call a function to handle the event payment_intent.processing
        break;
      case "payment_intent.requires_action":
        const paymentIntentRequiresAction = event.data.object;
        console.log(
          "paymentIntentRequiresAction: ",
          paymentIntentRequiresAction
        );
        // Then define and call a function to handle the event payment_intent.requires_action
        break;
      case "payment_intent.succeeded":
        const paymentIntentSucceeded = event.data.object;
        console.log("paymentIntentSucceeded: ", paymentIntentSucceeded);
        // Then define and call a function to handle the event payment_intent.succeeded
        break;
      case "charge.succeeded":
        const chargeSucceeded = event.data.object;
        console.log("chargeSucceeded: ", chargeSucceeded);
        break;
      case "checkout.session.completed":
        const checkoutSucceeded = event.data.object;
        console.log("checkout.session.completed: ", checkoutSucceeded);
        common.updateCheckoutStatus(checkoutSucceeded);
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    response.json({ received: true });
  }
);

app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  (request, response) => {
    const sig = request.headers["stripe-signature"];

    let event;

    // This is your test secret API key.
    const stripe = require("stripe")(process.env.STRIPE_KEY);

    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        process.env.STRIPE_WEBHHOK_SECRET
      );
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case "customer.created":
        const customerCreated = event.data.object;
        // Then define and call a function to handle the event customer.created
        break;
      case "customer.deleted":
        const customerDeleted = event.data.object;
        // Then define and call a function to handle the event customer.deleted
        break;
      case "customer.updated":
        const customerUpdated = event.data.object;
        // Then define and call a function to handle the event customer.updated
        break;
      case "customer.discount.created":
        const customerDiscountCreated = event.data.object;
        // Then define and call a function to handle the event customer.discount.created
        break;
      case "customer.discount.deleted":
        const customerDiscountDeleted = event.data.object;
        // Then define and call a function to handle the event customer.discount.deleted
        break;
      case "customer.discount.updated":
        const customerDiscountUpdated = event.data.object;
        // Then define and call a function to handle the event customer.discount.updated
        break;
      case "customer.source.created":
        const customerSourceCreated = event.data.object;
        // Then define and call a function to handle the event customer.source.created
        break;
      case "customer.source.deleted":
        const customerSourceDeleted = event.data.object;
        // Then define and call a function to handle the event customer.source.deleted
        break;
      case "customer.source.expiring":
        const customerSourceExpiring = event.data.object;
        // Then define and call a function to handle the event customer.source.expiring
        break;
      case "customer.source.updated":
        const customerSourceUpdated = event.data.object;
        // Then define and call a function to handle the event customer.source.updated
        break;
      case "customer.subscription.created":
        const customerSubscriptionCreated = event.data.object;
        // Then define and call a function to handle the event customer.subscription.created
        break;
      case "customer.subscription.deleted":
        const customerSubscriptionDeleted = event.data.object;
        // Then define and call a function to handle the event customer.subscription.deleted
        break;
      case "customer.subscription.paused":
        const customerSubscriptionPaused = event.data.object;
        // Then define and call a function to handle the event customer.subscription.paused
        break;
      case "customer.subscription.pending_update_applied":
        const customerSubscriptionPendingUpdateApplied = event.data.object;
        // Then define and call a function to handle the event customer.subscription.pending_update_applied
        break;
      case "customer.subscription.pending_update_expired":
        const customerSubscriptionPendingUpdateExpired = event.data.object;
        // Then define and call a function to handle the event customer.subscription.pending_update_expired
        break;
      case "customer.subscription.resumed":
        const customerSubscriptionResumed = event.data.object;
        // Then define and call a function to handle the event customer.subscription.resumed
        break;
      case "customer.subscription.trial_will_end":
        const customerSubscriptionTrialWillEnd = event.data.object;
        // Then define and call a function to handle the event customer.subscription.trial_will_end
        break;
      case "customer.subscription.updated":
        const customerSubscriptionUpdated = event.data.object;
        // Then define and call a function to handle the event customer.subscription.updated
        break;
      case "customer.tax_id.created":
        const customerTaxIdCreated = event.data.object;
        // Then define and call a function to handle the event customer.tax_id.created
        break;
      case "customer.tax_id.deleted":
        const customerTaxIdDeleted = event.data.object;
        // Then define and call a function to handle the event customer.tax_id.deleted
        break;
      case "customer.tax_id.updated":
        const customerTaxIdUpdated = event.data.object;
        // Then define and call a function to handle the event customer.tax_id.updated
        break;
      case "issuing_card.created":
        const issuingCardCreated = event.data.object;
        // Then define and call a function to handle the event issuing_card.created
        break;
      case "issuing_card.updated":
        const issuingCardUpdated = event.data.object;
        // Then define and call a function to handle the event issuing_card.updated
        break;
      case "issuing_transaction.created":
        const issuingTransactionCreated = event.data.object;
        // Then define and call a function to handle the event issuing_transaction.created
        break;
      case "issuing_transaction.updated":
        const issuingTransactionUpdated = event.data.object;
        // Then define and call a function to handle the event issuing_transaction.updated
        break;
      case "payment_intent.amount_capturable_updated":
        const paymentIntentAmountCapturableUpdated = event.data.object;
        // Then define and call a function to handle the event payment_intent.amount_capturable_updated
        break;
      case "payment_intent.canceled":
        const paymentIntentCanceled = event.data.object;
        // Then define and call a function to handle the event payment_intent.canceled
        break;
      case "payment_intent.created":
        const paymentIntentCreated = event.data.object;
        // Then define and call a function to handle the event payment_intent.created
        break;
      case "payment_intent.partially_funded":
        const paymentIntentPartiallyFunded = event.data.object;
        // Then define and call a function to handle the event payment_intent.partially_funded
        break;
      case "payment_intent.payment_failed":
        const paymentIntentPaymentFailed = event.data.object;
        // Then define and call a function to handle the event payment_intent.payment_failed
        break;
      case "payment_intent.processing":
        const paymentIntentProcessing = event.data.object;
        // Then define and call a function to handle the event payment_intent.processing
        break;
      case "payment_intent.requires_action":
        const paymentIntentRequiresAction = event.data.object;
        // Then define and call a function to handle the event payment_intent.requires_action
        break;
      case "payment_intent.succeeded":
        const paymentIntentSucceeded = event.data.object;
        // Then define and call a function to handle the event payment_intent.succeeded
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "An internal error occurred",
    error: err.message,
  });
});

const port = process.env.PORT || 4242;

app.listen(port, () => console.log(`Server is running on port: ${port}`));
