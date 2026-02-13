# Benefits

> Automatic entitlements granted to customers on purchase

Benefits are standalone resources connected to one or many products. When a customer purchases a product, its benefits are automatically granted.

## Benefit Types

| Type | Description |
|------|-------------|
| **Credits** | Grant meter balance for usage-based billing |
| **License Keys** | Software licensing with activation limits and expiration |
| **File Downloads** | Digital file delivery (up to 10GB) |
| **GitHub Repository Access** | Automated collaborator invites to private repos |
| **Discord Invites** | Automated server invitations and role assignment |
| **Custom** | Freeform notes displayed to customers |

## API Endpoints

- `POST /v1/benefits/` — Create a benefit
- `GET /v1/benefits/` — List benefits
- `GET /v1/benefits/{id}` — Get a benefit
- `PATCH /v1/benefits/{id}` — Update a benefit
- `DELETE /v1/benefits/{id}` — Delete a benefit (revokes all grants)
- `GET /v1/benefits/{id}/grants` — List individual grants
- `POST /v1/products/{id}/benefits` — Attach/detach benefits to a product

## Benefit Grant Lifecycle

Benefits follow a grant/revoke lifecycle:

1. **Granted** — Customer purchases product → benefit is granted
2. **Cycled** — For recurring subscriptions, benefit is refreshed each billing cycle
3. **Revoked** — Subscription canceled or product refunded → benefit is revoked

**Grace period:** Configure a revocation grace period for failed subscription payments before benefits are revoked.

## Webhook Events

- `benefit.created` — New benefit defined
- `benefit.updated` — Benefit configuration changed
- `benefit_grant.created` — Benefit granted to customer
- `benefit_grant.cycled` — Benefit refreshed on billing cycle
- `benefit_grant.updated` — Grant details updated
- `benefit_grant.revoked` — Benefit revoked from customer

## Connecting Benefits to Products

Benefits exist independently and can be shared across products. Attach them via the dashboard or API:

```typescript
// Attach benefits to a product
await polar.products.updateBenefits("product-id", {
  benefits: ["benefit-id-1", "benefit-id-2"],
});
```

See [license-keys.md](license-keys.md) for license key specifics, [events-metering.md](events-metering.md) for credits/metering.
