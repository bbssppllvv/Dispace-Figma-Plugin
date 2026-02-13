# Webhook Events Reference

> Complete list of all Polar webhook events

Subscribe to these events when creating a webhook endpoint. Use specific events rather than subscribing to all.

## Benefit Events

| Event | Description |
|-------|-------------|
| `benefit.created` | New benefit defined |
| `benefit.updated` | Benefit configuration changed |
| `benefit_grant.created` | Benefit granted to a customer |
| `benefit_grant.cycled` | Benefit refreshed on subscription billing cycle |
| `benefit_grant.updated` | Grant details updated |
| `benefit_grant.revoked` | Benefit revoked from a customer |

## Checkout Events

| Event | Description |
|-------|-------------|
| `checkout.created` | Checkout session created |
| `checkout.updated` | Checkout session updated |

## Customer Events

| Event | Description |
|-------|-------------|
| `customer.created` | New customer created |
| `customer.updated` | Customer details updated |
| `customer.deleted` | Customer deleted |
| `customer.state_changed` | Customer state changed (subscriptions, benefits, or meters) |

## Customer Seat Events

| Event | Description |
|-------|-------------|
| `customer_seat.assigned` | Seat assigned to a team member |
| `customer_seat.claimed` | Seat claimed by invitee |
| `customer_seat.revoked` | Seat revoked |

## Order Events

| Event | Description |
|-------|-------------|
| `order.created` | New order created |
| `order.paid` | Order payment confirmed |
| `order.updated` | Order details updated |
| `order.refunded` | Order refunded |

## Organization Events

| Event | Description |
|-------|-------------|
| `organization.updated` | Organization settings changed |

## Product Events

| Event | Description |
|-------|-------------|
| `product.created` | New product created |
| `product.updated` | Product details changed |

## Refund Events

| Event | Description |
|-------|-------------|
| `refund.created` | Refund initiated |
| `refund.updated` | Refund status changed |

## Subscription Events

| Event | Description |
|-------|-------------|
| `subscription.created` | New subscription created |
| `subscription.active` | Subscription became active |
| `subscription.updated` | Subscription details changed |
| `subscription.canceled` | Subscription canceled (at period end) |
| `subscription.uncanceled` | Cancellation reversed |
| `subscription.revoked` | Subscription immediately revoked |

## Framework Handler Names

When using `@polar-sh/nextjs`, `@polar-sh/sveltekit`, or `@polar-sh/supabase`, use camelCase handler names:

```typescript
Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => { /* any event */ },
  onOrderCreated: async (payload) => {},
  onOrderPaid: async (payload) => {},
  onOrderRefunded: async (payload) => {},
  onSubscriptionCreated: async (payload) => {},
  onSubscriptionActive: async (payload) => {},
  onSubscriptionCanceled: async (payload) => {},
  onSubscriptionUncanceled: async (payload) => {},
  onSubscriptionRevoked: async (payload) => {},
  onBenefitGrantCreated: async (payload) => {},
  onBenefitGrantCycled: async (payload) => {},
  onBenefitGrantRevoked: async (payload) => {},
  onCustomerCreated: async (payload) => {},
  onCustomerUpdated: async (payload) => {},
  onCustomerDeleted: async (payload) => {},
  onCustomerStateChanged: async (payload) => {},
  onCheckoutCreated: async (payload) => {},
  onCheckoutUpdated: async (payload) => {},
  onRefundCreated: async (payload) => {},
  onRefundUpdated: async (payload) => {},
});
```
