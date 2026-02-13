# SvelteKit

> Payments and Checkouts made dead simple with SvelteKit

## Examples

* [With SvelteKit](https://github.com/polarsource/examples/tree/main/with-sveltekit)

## Installation

```bash
npm install zod @polar-sh/sveltekit
# or yarn add / pnpm add / bun add
```

## Checkout

```typescript
// src/routes/checkout/+server.ts
import { Checkout } from "@polar-sh/sveltekit";

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl: process.env.SUCCESS_URL,
  returnUrl: "https://myapp.com",
  server: "sandbox",
  theme: "dark",
});
```

### Query Params

* products `?products=123`
* customerId (optional) `?products=123&customerId=xxx`
* customerExternalId (optional) `?products=123&customerExternalId=xxx`
* customerEmail (optional) `?products=123&customerEmail=janedoe@gmail.com`
* customerName (optional) `?products=123&customerName=Jane`
* metadata (optional) `URL-Encoded JSON string`

## Customer Portal

```typescript
// src/routes/portal/+server.ts
import { CustomerPortal } from "@polar-sh/sveltekit";

export const GET = CustomerPortal({
  server: process.env.POLAR_MODE,
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  returnUrl: "https://myapp.com",
  getCustomerId: (event) => "",
});
```

## Webhooks

```typescript
// src/routes/api/webhooks/polar/+server.ts
import { Webhooks } from "@polar-sh/sveltekit";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
  onPayload: async (payload) => {
    console.log(payload);
  },
});
```

### Payload Handlers

* `onPayload` - Catch-all handler for any incoming Webhook event
* `onCheckoutCreated` - Triggered when a checkout is created
* `onCheckoutUpdated` - Triggered when a checkout is updated
* `onOrderCreated` - Triggered when an order is created
* `onOrderPaid` - Triggered when an order is paid
* `onOrderRefunded` - Triggered when an order is refunded
* `onRefundCreated` - Triggered when a refund is created
* `onRefundUpdated` - Triggered when a refund is updated
* `onSubscriptionCreated` - Triggered when a subscription is created
* `onSubscriptionUpdated` - Triggered when a subscription is updated
* `onSubscriptionActive` - Triggered when a subscription becomes active
* `onSubscriptionCanceled` - Triggered when a subscription is canceled
* `onSubscriptionRevoked` - Triggered when a subscription is revoked
* `onSubscriptionUncanceled` - Triggered when a subscription cancellation is reversed
* `onProductCreated` - Triggered when a product is created
* `onProductUpdated` - Triggered when a product is updated
* `onOrganizationUpdated` - Triggered when an organization is updated
* `onBenefitCreated` - Triggered when a benefit is created
* `onBenefitUpdated` - Triggered when a benefit is updated
* `onBenefitGrantCreated` - Triggered when a benefit grant is created
* `onBenefitGrantUpdated` - Triggered when a benefit grant is updated
* `onBenefitGrantRevoked` - Triggered when a benefit grant is revoked
* `onCustomerCreated` - Triggered when a customer is created
* `onCustomerUpdated` - Triggered when a customer is updated
* `onCustomerDeleted` - Triggered when a customer is deleted
* `onCustomerStateChanged` - Triggered when a customer state changes
