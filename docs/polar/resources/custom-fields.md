# Custom Fields

> Learn how to add custom input fields to your checkout with Polar

By default, the Checkout form will only ask basic information from the customer. But you might need more! Examples:

* A checkbox asking the customer to accept your terms
* An opt-in newsletter consent
* A select menu to ask where they heard from you

With Polar, you can easily add such fields to your checkout using **Custom Fields**.

## Create Custom Fields

Custom Fields are managed at an organization's level. To create them, go to **Settings** and **Custom Fields**. You'll see the list of all the available fields on your organization.

Click on **New Custom Field** to create a new one.

### Type

The type of the field is the most important thing to select. It determines what type of input will be displayed to the customer during checkout. The type can't be changed after the field is created.

We support five types of fields:

#### Text

Simple text field to input textual data. By default renders a simple input field but you can render a **textarea** by toggling the option under `Form input options`. Supports minimum and maximum length validation. Stored as a string.

#### Number

Number input field. Supports minimum and maximum validation. Stored as a number.

#### Date

Date input field. Supports minimum and maximum validation. Stored as a string using the ISO 8601 format.

#### Checkbox

Checkbox field. Stored as a boolean (`true` or `false`).

#### Select

Select field with a predefined set of options. Each option is a pair of `Value` and `Label`, the first one being the value stored underneath and the latter the one shown to the customer.

### Slug and Name

* **Slug**: The key used to store the data inside objects related to the checkout (Orders, Subscriptions). Must be unique across your organization. Can be changed afterwards.
* **Name**: Displayed to you to recognize the field across your dashboard. By default, also the label shown to the customer (unless customized).

### Form Input Options

Customize how the field is displayed to the customer:

* **Label**: Displayed above the field
* **Help text**: Displayed below the field
* **Placeholder**: Displayed inside the field when there is no value

The label and help text support basic Markdown syntax (bold, italic, links).

## Add Custom Field to Checkout

Custom Fields are enabled on Checkout specifically on each **product**. While creating or updating a product, you can select the custom fields to include in the checkout for this product.

Note that you can make the field `Required`.

> If you make a **checkbox** field **required**, customers will have to check the box before submitting the checkout. Very useful for terms acceptance!

## Read Data

Custom fields are automatically displayed as a column in your `Sales` page, both on Orders and Subscriptions.

This data is also available from the Orders and Subscriptions API, under the `custom_field_data` property:

```json
{
  "custom_field_value": {
    "terms": true,
    "source": "social_media"
  }
}
```
