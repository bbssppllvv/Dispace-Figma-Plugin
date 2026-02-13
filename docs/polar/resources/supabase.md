# Supabase

> Payments and Checkouts made dead simple with Supabase

## Examples

* [With Supabase and React Router v7](https://github.com/polarsource/examples/tree/main/with-react-router-supabase)

## Installation

```bash
npm install zod @polar-sh/supabase
# or yarn add / pnpm add / bun add
```

## Checkout

```typescript
import { Checkout } from "@polar-sh/supabase";

export const GET = Checkout({
  accessToken: POLAR_ACCESS_TOKEN,
  successUrl: POLAR_SUCCESS_URL,
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
import { CustomerPortal } from "@polar-sh/supabase";

export const GET = CustomerPortal({
  accessToken: POLAR_ACCESS_TOKEN,
  getCustomerId: (event) => "",
  returnUrl: "https://myapp.com",
  server: "sandbox",
});
```

## Webhooks

```typescript
import { Webhooks } from '@polar-sh/supabase';

export const POST = Webhooks({
  webhookSecret: POLAR_WEBHOOK_SECRET,
  onPayload: async (payload) => {
    // Handle payload
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
