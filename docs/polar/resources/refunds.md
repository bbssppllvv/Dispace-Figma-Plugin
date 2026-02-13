# Refunds

> Processing refunds for orders

## API Endpoints

- `POST /v1/refunds/` — Create a refund
- `GET /v1/refunds/` — List refunds

## Webhook Events

- `refund.created` — Refund initiated
- `refund.updated` — Refund status changed
- `order.refunded` — Associated order marked as refunded

## Refund Types

- **Full refund** — Refund the entire order amount
- **Customer balance refund** — Refund to customer's Polar balance instead of payment method

## Behavior

When a refund is processed:
1. The refund is created and payment provider processes the return
2. `refund.created` webhook fires
3. Associated benefits are revoked (with optional grace period)
4. `order.refunded` webhook fires on the order
5. If the order was for a subscription, the subscription may be revoked

## Notes

- Refunds are processed through the original payment method by default
- Tax amounts are adjusted accordingly
- Invoice data is updated to reflect the refund
- Dispute/chargeback management is handled separately through the Polar dashboard
