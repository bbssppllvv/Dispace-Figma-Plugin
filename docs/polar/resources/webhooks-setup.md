# Setup Webhooks

> Get notifications asynchronously when events occur instead of having to poll for updates

Our webhook implementation follows the [Standard Webhooks](https://www.standardwebhooks.com/) specification and our SDKs offer:

* Built-in webhook signature validation for security
* Fully typed webhook payloads

In addition, our webhooks offer built-in support for **Slack** & **Discord** formatting. Making it a breeze to setup in-chat notifications for your team.

## Get Started

> **Use our sandbox environment during development** so you can easily test purchases, subscriptions, cancellations and refunds to automatically trigger webhook events without spending a dime.

### Steps

1. **Add new endpoint** - Head over to your organization settings and click on the `Add Endpoint` button to create a new webhook.

2. **Specify your endpoint URL** - Enter the URL to which the webhook events should be sent.

   > **Developing locally?** Use a tool like [ngrok](https://ngrok.com/) to tunnel webhook events to your local development environment.
   >
   > ```bash
   > ngrok http 3000
   > ```
   >
   > Just be sure to provide the URL ngrok gives you as the webhook endpoint on Polar.

3. **Choose a delivery format** - For standard, custom integrations, leave this parameter on **Raw**. This will send a payload in JSON format. If you wish to send notifications to a Discord or Slack channel, you can select the corresponding format here. Polar will then adapt the payload so properly formatted messages are sent to your channel. If you paste a Discord or Slack Webhook URL, the format will be automatically selected.

4. **Set a secret** - We cryptographically sign the requests using this secret. So you can easily verify them using our SDKs to ensure they are legitimate webhook payloads from Polar. You can set your own or generate a random one.

5. **Subscribe to events** - Finally, select all the events you want to be notified about and you're done.

[Now, it's time to integrate our endpoint to receive events ->](./webhooks-delivery.md)
