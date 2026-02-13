# API Reference

> Complete list of Polar API endpoints

**Base URLs:**
- Production: `https://api.polar.sh/v1`
- Sandbox: `https://sandbox-api.polar.sh/v1`

**Rate Limits:**
- 300 requests per minute per organization/customer
- 3 requests per second for unauthenticated license key endpoints

**Pagination:** All list endpoints support `page` (starts at 1) and `limit` (default 10, max 100). Response includes `pagination.total_count` and `pagination.max_page`.

**Scopes:** Most endpoints require OAuth scopes in the format `{resource}:read` or `{resource}:write`. Resources: benefits, checkout_links, checkouts, customers, orders, subscriptions, products, files, events, meters, license_keys, webhooks, metrics.

---

## Benefits

- `POST /v1/benefits/` — Create a benefit
- `GET /v1/benefits/` — List benefits
- `GET /v1/benefits/{id}` — Get a benefit
- `PATCH /v1/benefits/{id}` — Update a benefit
- `DELETE /v1/benefits/{id}` — Delete a benefit (revokes all grants)
- `GET /v1/benefits/{id}/grants` — List individual grants for a benefit

## Checkout Links

- `POST /v1/checkout-links/` — Create a shareable checkout link
- `GET /v1/checkout-links/` — List checkout links
- `GET /v1/checkout-links/{id}` — Get a checkout link
- `PATCH /v1/checkout-links/{id}` — Update a checkout link
- `DELETE /v1/checkout-links/{id}` — Delete a checkout link

## Checkouts

- `POST /v1/checkouts/` — Create a checkout session
- `GET /v1/checkouts/` — List checkout sessions
- `GET /v1/checkouts/{id}` — Get a checkout session
- `PATCH /v1/checkouts/{id}` — Update a checkout session
- `GET /v1/checkouts/client/{client_secret}` — Get checkout by client secret
- `PATCH /v1/checkouts/client/{client_secret}` — Update checkout by client secret
- `POST /v1/checkouts/client/{client_secret}/confirm` — Confirm checkout by client secret

## Custom Fields

- `POST /v1/custom-fields/` — Create a custom field
- `GET /v1/custom-fields/` — List custom fields
- `GET /v1/custom-fields/{id}` — Get a custom field
- `PATCH /v1/custom-fields/{id}` — Update a custom field
- `DELETE /v1/custom-fields/{id}` — Delete a custom field

## Customers

- `POST /v1/customers/` — Create a customer
- `GET /v1/customers/` — List customers
- `GET /v1/customers/{id}` — Get a customer by ID
- `GET /v1/customers/external/{external_id}` — Get by external ID
- `PATCH /v1/customers/{id}` — Update a customer
- `PATCH /v1/customers/external/{external_id}` — Update by external ID
- `DELETE /v1/customers/{id}` — Delete a customer (with optional anonymization)
- `DELETE /v1/customers/external/{external_id}` — Delete by external ID
- `GET /v1/customers/{id}/state` — Get customer state (subscriptions & benefits)
- `GET /v1/customers/external/{external_id}/state` — Get state by external ID

## Customer Meters

- `GET /v1/customer-meters/` — List customer meters
- `GET /v1/customer-meters/{id}` — Get a customer meter

## Customer Seats

- `POST /v1/customer-seats` — Assign a seat
- `GET /v1/customer-seats` — List seats
- `POST /v1/customer-seats/claim` — Claim a seat
- `GET /v1/customer-seats/claim/{invitation_token}` — Get claim info
- `POST /v1/customer-seats/{seat_id}/resend` — Resend invitation
- `DELETE /v1/customer-seats/{seat_id}` — Revoke a seat

## Customer Sessions

- `POST /v1/customer-sessions/` — Create a customer session for portal access

## Discounts

- `POST /v1/discounts/` — Create a discount
- `GET /v1/discounts/` — List discounts
- `GET /v1/discounts/{id}` — Get a discount
- `PATCH /v1/discounts/{id}` — Update a discount
- `DELETE /v1/discounts/{id}` — Delete a discount

## Events & Metering

- `POST /v1/events/ingest` — Ingest batch of events
- `GET /v1/events/` — List events
- `GET /v1/events/{id}` — Get an event
- `POST /v1/meters/` — Create a meter
- `GET /v1/meters/` — List meters
- `GET /v1/meters/{id}` — Get a meter
- `PATCH /v1/meters/{id}` — Update a meter
- `GET /v1/meters/{id}/quantities` — Get meter quantities over time

## Files

- `POST /v1/files/` — Create a file
- `POST /v1/files/{id}/uploaded` — Complete file upload
- `GET /v1/files/` — List files
- `PATCH /v1/files/{id}` — Update a file
- `DELETE /v1/files/{id}` — Delete a file

## License Keys

- `POST /v1/license-keys/activate` — Activate a license key instance
- `POST /v1/license-keys/deactivate` — Deactivate a license key instance
- `POST /v1/license-keys/validate` — Validate a license key
- `GET /v1/license-keys/` — List license keys
- `GET /v1/license-keys/{id}` — Get a license key
- `GET /v1/license-keys/{id}/activations/{activation_id}` — Get activation
- `PATCH /v1/license-keys/{id}` — Update a license key

## Metrics

- `GET /v1/metrics/` — Get metrics about orders and subscriptions
- `GET /v1/metrics/limits` — Get interval limits for metrics

## Orders

- `GET /v1/orders/` — List orders
- `GET /v1/orders/{id}` — Get an order
- `PATCH /v1/orders/{id}` — Update an order
- `GET /v1/orders/{id}/invoice` — Get order invoice data
- `POST /v1/orders/{id}/invoice` — Generate order invoice

## Organizations

- `POST /v1/organizations/` — Create an organization
- `GET /v1/organizations/` — List organizations
- `GET /v1/organizations/{id}` — Get an organization
- `PATCH /v1/organizations/{id}` — Update an organization

## Products

- `POST /v1/products/` — Create a product
- `GET /v1/products/` — List products
- `GET /v1/products/{id}` — Get a product
- `PATCH /v1/products/{id}` — Update a product
- `POST /v1/products/{id}/benefits` — Update product benefits

## Refunds

- `POST /v1/refunds/` — Create a refund
- `GET /v1/refunds/` — List refunds

## Subscriptions

- `POST /v1/subscriptions/` — Create subscription (free products only)
- `GET /v1/subscriptions/` — List subscriptions
- `GET /v1/subscriptions/{id}` — Get a subscription
- `PATCH /v1/subscriptions/{id}` — Update a subscription
- `DELETE /v1/subscriptions/{id}` — Revoke a subscription

## Webhooks

- `POST /v1/webhooks/endpoints` — Create webhook endpoint
- `GET /v1/webhooks/endpoints` — List webhook endpoints
- `GET /v1/webhooks/endpoints/{id}` — Get webhook endpoint
- `PATCH /v1/webhooks/endpoints/{id}` — Update webhook endpoint
- `DELETE /v1/webhooks/endpoints/{id}` — Delete webhook endpoint

## OAuth2

- `GET /v1/oauth2/authorize` — Authorization endpoint
- `POST /v1/oauth2/token` — Request access token
- `POST /v1/oauth2/revoke` — Revoke token
- `POST /v1/oauth2/introspect` — Introspect token
- `GET /v1/oauth2/userinfo` — Get user info

## Customer Portal API

Customer-facing endpoints. Authenticate with Customer Access Token from `POST /v1/customer-sessions/`.

- `GET /v1/customer-portal/customers/me` — Get authenticated customer
- `GET /v1/customer-portal/organizations/{slug}` — Get organization by slug
- `GET /v1/customer-portal/downloadables/` — List downloadables
- `GET /v1/customer-portal/downloadables/{token}` — Get downloadable
- `GET /v1/customer-portal/license-keys/` — List license keys
- `GET /v1/customer-portal/license-keys/{id}` — Get license key
- `POST /v1/customer-portal/license-keys/activate` — Activate license key
- `POST /v1/customer-portal/license-keys/deactivate` — Deactivate license key
- `POST /v1/customer-portal/license-keys/validate` — Validate license key
- `GET /v1/customer-portal/orders/` — List orders
- `GET /v1/customer-portal/orders/{id}` — Get order
- `PATCH /v1/customer-portal/orders/{id}` — Update order
- `GET /v1/customer-portal/orders/{id}/invoice` — Get invoice
- `POST /v1/customer-portal/orders/{id}/invoice` — Generate invoice
- `GET /v1/customer-portal/seats` — List seats
- `POST /v1/customer-portal/seats` — Assign seat
- `GET /v1/customer-portal/seats/subscriptions` — List claimed subscriptions
- `POST /v1/customer-portal/seats/{seat_id}/resend` — Resend invitation
- `DELETE /v1/customer-portal/seats/{seat_id}` — Revoke seat
- `GET /v1/customer-portal/subscriptions/` — List subscriptions
- `GET /v1/customer-portal/subscriptions/{id}` — Get subscription
- `PATCH /v1/customer-portal/subscriptions/{id}` — Update subscription
- `DELETE /v1/customer-portal/subscriptions/{id}` — Cancel subscription
