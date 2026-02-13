# License Keys

> Software licensing with activation limits, expiration, and validation

License Keys are a benefit type in Polar. Attach them to products to automatically issue keys to customers on purchase.

## Features

- **Brandable prefixes** — e.g., `POLAR_*****`, `MYAPP_*****`
- **Activation limits** — Restrict how many devices can activate a key
- **Expiration** — Automatic key expiration after a set duration
- **Usage quotas** — Track and limit usage per key
- **Customer self-service** — Customers can deactivate their own activations

## API Endpoints

- `POST /v1/license-keys/validate` — Validate a license key
- `POST /v1/license-keys/activate` — Activate a license key instance
- `POST /v1/license-keys/deactivate` — Deactivate a license key instance
- `GET /v1/license-keys/` — List license keys
- `GET /v1/license-keys/{id}` — Get a license key
- `GET /v1/license-keys/{id}/activations/{activation_id}` — Get activation
- `PATCH /v1/license-keys/{id}` — Update a license key

**Rate limit:** 3 requests per second for unauthenticated validate/activate/deactivate endpoints.

## Validation Flow

```typescript
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN });

// Validate a license key
const result = await polar.licenseKeys.validate({
  key: "POLAR_xxxxx",
  organizationId: "org-id",
});

if (result.valid) {
  // Key is valid, check result.licenseKey for details
  console.log(result.licenseKey.activations); // current activations
  console.log(result.licenseKey.limitActivations); // max activations
  console.log(result.licenseKey.expiresAt); // expiration date
}
```

## Activation Flow

```typescript
// Activate on a device
const activation = await polar.licenseKeys.activate({
  key: "POLAR_xxxxx",
  organizationId: "org-id",
  label: "User's MacBook Pro", // optional device label
});

// Deactivate
await polar.licenseKeys.deactivate({
  key: "POLAR_xxxxx",
  organizationId: "org-id",
  activationId: activation.id,
});
```

## Customer Portal

Customers can manage their license keys through the Customer Portal:
- `GET /v1/customer-portal/license-keys/` — List their keys
- `POST /v1/customer-portal/license-keys/activate` — Activate
- `POST /v1/customer-portal/license-keys/deactivate` — Deactivate
- `POST /v1/customer-portal/license-keys/validate` — Validate
