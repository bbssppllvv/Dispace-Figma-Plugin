# Seat-Based Pricing

> Sell team products with assignable seats and tiered pricing

Seat-based pricing allows you to sell products where a billing manager purchases a specific number of seats and can assign them to team members. Each seat holder gets their own access to the product benefits, making it perfect for team subscriptions, perpetual licenses, and multi-user products.

> **Seat-based pricing is ideal for:**
> * Team subscriptions where one billing manager pays for multiple users
> * Perpetual team licenses with one-time payment
> * Organizational licenses with per-seat pricing
> * Products with volume-based tiering (e.g., $10/seat for 1-4 seats, $9/seat for 5+)

> **Note:** Seat-based pricing is currently in **private beta**. Feature is enabled gradually.

## How it Works

With seat-based pricing, a billing manager purchases a product (subscription or one-time) with a specific number of seats. They can then:

1. **Assign seats** to team members via email or external customer ID
2. **Manage seats** by resending invitations or revoking access
3. **Scale up** by purchasing additional seats (or a new order for one-time products)
4. **Track usage** by viewing which seats are claimed, pending, or available

Team members receive an invitation email with a claim link. Once they claim their seat, benefits are automatically granted.

### Subscriptions vs One-Time Purchases

| Feature           | Subscriptions              | One-Time Purchases       |
| ----------------- | -------------------------- | ------------------------ |
| **Payment**       | Recurring (monthly/yearly) | Single payment           |
| **Seat Duration** | Active while subscribed    | Perpetual (never expire) |
| **Adding Seats**  | Modify subscription        | Purchase new order       |
| **Billing**       | Renews automatically       | No renewals              |
| **Benefits**      | While subscription active  | Forever after claim      |

## Creating a Seat-Based Product

1. From your dashboard, navigate to Products and click **Create Product**.
2. Set your product name, description, and media as usual.
3. Under **Pricing**, select:
   * **Product type**: Subscription or One-time
   * **Billing cycle** (subscriptions only): Monthly or Yearly
   * **Pricing type**: Seat-based
4. Configure seat tiers:
   * **Min seats**: Minimum number of seats required to purchase
   * **Tiers**: For each tier, set:
     * **Max seats**: Upper limit for this tier (leave empty for unlimited)
     * **Price per seat**: Amount charged per seat in this tier (in cents)

   Example tiered pricing:
   * 1-4 seats: $10/seat per month
   * 5-9 seats: $9/seat per month
   * 10+ seats: $8/seat per month

5. Add benefits that seat holders will receive. These are only granted when a seat is claimed, not when purchased.

> Unlike standard subscriptions, seat-based products **do not grant benefits to the billing manager**. Benefits are only granted to team members who claim their assigned seats.

## Managing Seats

### Assigning Seats

Billing managers can assign seats through:

1. **Customer Portal**: Accessible via the customer portal with billing manager permissions
2. **API**: Programmatically assign seats using the Customer Seats API

To assign a seat, provide:

* **Subscription ID** (for subscriptions) or **Order ID** (for one-time purchases)
* **Email address** (creates a new customer if needed)
* **External customer ID** (optional, for syncing with your system)
* **Customer ID** (if customer already exists in Polar)
* **Metadata** (optional, up to 10 keys for custom data like role, department)

An invitation email is automatically sent to the recipient with a secure claim link (valid for 24 hours).

### Seat Statuses

* **Pending**: Seat assigned, invitation sent, awaiting claim
* **Claimed**: Seat claimed by team member, benefits granted
* **Revoked**: Seat revoked, benefits removed, can be reassigned

### Revoking Seats

Billing managers can revoke a claimed seat at any time:

1. Benefits are immediately removed from the seat holder
2. The seat becomes available for reassignment
3. The revoked seat can be assigned to a different team member

> Revoking a seat does **not** issue a refund. The billing manager continues to pay for the total number of seats in their subscription.

## Claiming Seats

When a team member receives a seat invitation:

1. They click the claim link in the email
2. A claim page displays the product details and organization info
3. They click **Claim Seat** to accept
4. Benefits are automatically granted
5. They receive a customer session token for immediate portal access

> Claim links are single-use and expire after 24 hours for security.

## Scaling Seats

### Adding Seats

**For subscriptions:**
* New seat count is applied immediately
* Prorated charges are calculated for the current billing period
* Future renewals bill at the new seat count
* If adding seats moves to a different pricing tier, the new per-seat rate applies to **all seats**

**For one-time purchases:**
* Purchase a new order with additional seats
* Each order has its own seat pool
* All seats remain perpetual across all orders

### Reducing Seats

**For subscriptions:**
1. Revoke seats until the desired count is reached
2. Update the subscription to reflect the lower seat count
3. The change takes effect at the next renewal

> You cannot reduce subscription seats below the number of currently claimed seats. Revoke seats first.

**For one-time purchases:**
* Seats cannot be reduced or refunded as they are perpetual
* Revoke unwanted seats to make them unassigned

## API Integration

### Example: Assign a Seat (Subscription)

```typescript
await polar.customerSeats.assign({
  subscription_id: "sub_123",
  email: "engineer@company.com",
  metadata: {
    department: "Engineering",
    role: "Developer"
  }
});
```

### Example: Assign a Seat (One-Time Purchase)

```typescript
await polar.customerSeats.assign({
  order_id: "order_456",
  email: "engineer@company.com",
  metadata: {
    department: "Engineering",
    role: "Developer"
  }
});
```

### Example: List Seats

```typescript
const seats = await polar.customerSeats.list({
  subscription_id: "sub_123"
});

console.log(`Available: ${seats.available_seats}/${seats.total_seats}`);
```

## Webhooks

**Subscription events:**
* `subscription.created` - When seat-based subscription is purchased
* `subscription.updated` - When seat count changes
* `subscription.canceled` - When subscription is cancelled

**Order events:**
* `order.created` - When seat-based one-time purchase is completed
* `order.updated` - When order is updated

**Seat and benefit events (both types):**
* `benefit_grant.created` - When a seat is claimed and benefits granted
* `benefit_grant.revoked` - When a seat is revoked and benefits removed

> For both subscriptions and one-time purchases, `benefit_grant.created` events are triggered per seat claim, not at purchase time.

## Limitations

* Seats must be assigned individually (no bulk import via dashboard, use API instead)
* Claim links expire after 24 hours
* Billing manager does not receive product benefits
* Maximum of 1,000 seats per subscription
* Metadata limited to 10 keys and 1KB total size per seat
