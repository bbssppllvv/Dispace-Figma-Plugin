# Events & Metering

> Usage-based billing with event tracking and meters

Events and Meters enable usage-based billing. Ingest events from your application, define meters to aggregate them, and bill customers based on usage.

## Concepts

- **Events** — Individual usage records (API calls, compute time, messages sent, etc.)
- **Meters** — Aggregation rules that sum/count events into billable quantities
- **Customer Meters** — Per-customer meter balances

## Event Features

- **Hierarchical tracking** — Parent-child event relationships for complex workflows
- **Event spans** — Track start/end of operations
- **Cost tracking** — Sub-cent precision cost attribution per event
- **Batch ingestion** — Send multiple events in one API call
- **Customer attribution** — Link events to customers
- **Member attribution** — Link events to B2B team members
- **Custom types** — Event types with display names
- **Metadata filtering** — Search and filter events by metadata fields

## API Endpoints

### Events

- `POST /v1/events/ingest` — Ingest batch of events
- `GET /v1/events/` — List events
- `GET /v1/events/{id}` — Get an event

### Meters

- `POST /v1/meters/` — Create a meter
- `GET /v1/meters/` — List meters
- `GET /v1/meters/{id}` — Get a meter
- `PATCH /v1/meters/{id}` — Update a meter
- `GET /v1/meters/{id}/quantities` — Get meter quantities over time (supports timezone parameter)

### Customer Meters

- `GET /v1/customer-meters/` — List customer meters
- `GET /v1/customer-meters/{id}` — Get a customer meter

## Ingesting Events

```typescript
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN });

// Ingest a batch of events
await polar.events.ingest({
  events: [
    {
      name: "api_call",
      externalCustomerId: "user_123",
      metadata: {
        endpoint: "/v1/generate",
        tokens: 1500,
        model: "gpt-4",
      },
    },
    {
      name: "api_call",
      externalCustomerId: "user_456",
      metadata: {
        endpoint: "/v1/embed",
        tokens: 200,
      },
    },
  ],
});
```

## Benefits as Credits

The "Credits" benefit type grants customers a meter balance. When attached to a product, purchasing that product adds credits to the customer's meter. Combine with metering to implement usage-based billing with prepaid credits.
