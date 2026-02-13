# Sandbox Environment

> A separate environment, isolated from your production data

To test Polar or work on your integration without worrying about actual money processing, use the [sandbox environment](https://sandbox.polar.sh/start).

It's a dedicated server, completely isolated from the production instance.

> **Why a dedicated environment instead of a test mode?** Since Polar deals with money and needs to keep track of all movements for Merchant of Record service, live data is isolated from test data. You can create unlimited accounts and organizations for testing.

## Get Started

Access the sandbox at [sandbox.polar.sh](https://sandbox.polar.sh/start) or click `Go to sandbox` from the organization switcher.

Create a dedicated user account and organization there.

### Testing Payments

Use Stripe's test card numbers for test payments. The easiest one for a successful payment:

```
4242 4242 4242 4242
```

Use any future expiration date and random CVC.

## API and SDK

Switch the base URL from `https://api.polar.sh` to `https://sandbox-api.polar.sh`. You'll need a separate access token created in the sandbox environment.

**TypeScript:**

```ts
const polar = new Polar({
  server: 'sandbox',
  accessToken: process.env['POLAR_ACCESS_TOKEN'] ?? '',
});
```

**Python:**

```python
s = Polar(
    server="sandbox",
    access_token="<YOUR_BEARER_TOKEN_HERE>",
)
```

**Go:**

```go
s := polargo.New(
    polargo.WithServer("sandbox"),
    polargo.WithSecurity(os.Getenv("POLAR_ACCESS_TOKEN")),
)
```

**PHP:**

```php
$sdk = Polar\Polar::builder()
    ->setServer('sandbox')
    ->setSecurity('<YOUR_BEARER_TOKEN_HERE>')
    ->build();
```

## Limitations

* Subscriptions created in sandbox are automatically canceled **90 days after their creation**.
