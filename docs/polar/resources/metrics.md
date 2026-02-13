# Metrics & Analytics

> Revenue, subscription, and conversion metrics

## API Endpoints

- `GET /v1/metrics/` — Get metrics about orders and subscriptions
- `GET /v1/metrics/limits` — Get interval limits for metrics

## Available Metrics

| Metric | Description |
|--------|-------------|
| Revenue | Total revenue (one-time + recurring) |
| One-time revenue | Revenue from one-time purchases |
| Recurring revenue | Revenue from subscriptions |
| MRR | Monthly Recurring Revenue |
| Orders | Number of orders |
| AOV | Average Order Value |
| Checkout conversion | Checkout completion rate |
| Churn rate | Subscription cancellation rate |
| Cost insights | Costs and margins (with events/metering) |

## Query Parameters

- Date range filtering (start/end dates)
- Period grouping (day, week, month)
- Product-level filtering
- Interval limits via `/v1/metrics/limits`

## Usage

```typescript
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN });

const metrics = await polar.metrics.get({
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  interval: "month",
});
```
