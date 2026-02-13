# Customer State

> The quickest way to integrate billing in your application

Customer State allows you to query for the current state of a customer, including their active subscriptions and granted benefits, in a single API call or single webhook event.

Combined with the External ID feature, you can get up-and-running in minutes.

## The Customer State Object

The customer state object contains:

* All the data about the customer.
* The list of their **active** subscriptions.
* The list of their **granted** benefits.
* The list of their **active** meters, with their current balance.

With that single object, you have all the required information to check if you should provision access to your service or not.

**API Endpoints:**
* `GET /customers/state-external` — Get Customer State by External ID (using your own customer ID)
* `GET /customers/state` — Get Customer State by internal Polar customer ID

## The `customer.state_changed` Webhook

To be notified of the customer state changes, listen to the `customer.state_changed` webhook event. It's triggered when:

* Customer is created, updated or deleted.
* A subscription is created or updated.
* A benefit is granted or revoked.

By subscribing to this webhook event, you keep your system up-to-date and update your customer's access accordingly.
