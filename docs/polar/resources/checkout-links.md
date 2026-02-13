# Checkout Links

> Sell your digital products with ease by sharing a checkout link to select products

Checkout links can be shared or linked on your website which automatically creates a checkout session for customers.

> Looking for a way to generate Checkout session programmatically? Checkout Links might not be the right tool for you. Instead, you should use the [Checkout API](./checkout-api.md).

## Create a Checkout Link

Checkout Links can be managed from the **Checkout Links** tabs of the Products section. Click on **New Link** to create a new one.

### Label

This is an internal name for the Checkout Link. It's only visible to you.

### Products

You can select one or **several** products. With several products, customers will be able to switch between them on the checkout page.

### Discount

You can disable discount codes, if you wish to prevent customers from using them.

You can also preset a discount: it'll be automatically applied when the customer lands on the checkout page.

### Metadata

This is an optional key-value object allowing you to store additional information which may be useful for you when handling the order. This metadata will be copied to the generated Checkout object and, if the checkout succeeds, to the resulting Order and/or Subscription.

## Using Checkout Links

You can share the Checkout Link URL on your webpage, social media, or directly to customers.

> **Important:** Checkout Links will go against our API, and redirect to short-lived Checkout session. This means that the Checkout page the user will end up on, are temporary and expires after a while if no successful purchase is made. Always use the Checkout Link URL. If you mistakenly copy the URL from a Checkout Session, the link will expire.

### Query Parameters

#### Prepopulate Fields

You can prefill the checkout fields with the following query parameters:

* `customer_email` (string) - Prefill customer email at checkout
* `customer_name` (string) - Prefill customer name at checkout
* `discount_code` (string) - Prefill discount code
* `amount` (string) - Prefill amount in case of Pay What You Want pricing
* `custom_field_data.{slug}` (string) - Prefill checkout fields data, where `{slug}` is the slug of the custom field

#### Store Attribution and Reference Metadata

The following query parameters will automatically be set on Checkout `metadata`:

* `reference_id` (string) - Your own reference ID for the checkout session
* `utm_source` (string) - UTM source of the checkout session
* `utm_medium` (string) - UTM medium of the checkout session
* `utm_campaign` (string) - UTM campaign of the checkout session
* `utm_content` (string) - UTM content of the checkout session
* `utm_term` (string) - UTM term of the checkout session
