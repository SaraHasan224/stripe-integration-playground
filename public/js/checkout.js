// Add click event listener to all divs with class "box"
document.querySelectorAll(".subscription_package").forEach(function (box) {
  box.addEventListener("click", function () {
    // Get the data-id attribute of the clicked div
    selectedDiv = this;
    const boxId = this.getAttribute("data-id");
    alert("Selected Package: " + boxId);

    selectedDiv.classList.add("selected"); // Add class to the clicked div
    selectedDiv.id = "selected_package"; // Add ID to the clicked div
  });
});

function findSubscription() {}

function submitCheckout(event) {
  let customer;
  const package = document.getElementById("selected_package");
  const productId = package.getAttribute("data-product_id");
  const priceId = package.getAttribute("data-product_price");
  const packageId = package.getAttribute("data-id");
  if (package == null) {
    alert("Select package first!!");
  }

  (async () => {
    customer = await findCustomer();
    console.log("Customer: ", customer.result);

    var formData = new FormData();
    formData.append("package_id", packageId);
    formData.append("product_id", productId);
    formData.append("price_id", priceId);
    formData.append("customer_id", customer.result.id);
    formData.append("customer_email", customer.result.email);
    formData.append("metadata", customer.result.email);

    // Submit the form with updated data
    let checkout_url = APP_URL + "create-subscription";
    fetch(checkout_url, {
      method: "POST",
      body: formData,
    })
      .then(function (response) {
        console.log("-----subscription response-----:", response);
        return response.json();
      })
      .then(function (session) {
        console.log("----subscription-----:", session);
        window.location.href = session.url;
      })
      .then(function (result) {
        console.log("----subscription error-----:", result);
        if (result?.error) {
          alert(result?.error.message);
        }
      })
      .catch(function (error) {
        console.log("----subscription catch error-----:", error);
        console.error("Error:", error);
      });
  })();

  event.preventDefault();
}

async function findCustomer() {
  var formData = new FormData();
  formData.append("email", document.getElementById("email").value);
  formData.append(
    "customer_name",
    document.getElementById("customer_name").value
  );

  // Create headers object with Content-Type
  let url = APP_URL + "find-customer-details";
  let result = fetch(url, {
    method: "POST",
    body: formData,
  })
    .then(function (response) {
      return response.json(); // Return the parsed JSON object
    })
    .then(function (customer) {
      console.log("----customer-----:", customer); // Log the customer object
      return customer;
    })
    .catch(function (error) {
      console.log("----session find customer error-----:", error);
      console.error("Error:", error);
    });
  return result;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("checkout_btn").onclick = submitCheckout;
});
