# TypeScript SDK

> SDK for JavaScript runtimes (Node.js and Browser)

## Examples

* [With Node.js](https://github.com/polarsource/examples/tree/main/with-nodejs)

## Installation

```bash
npm install @polar-sh/sdk
# or
yarn add @polar-sh/sdk
# or
pnpm add @polar-sh/sdk
```

## Quickstart

```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.POLAR_MODE || 'sandbox' // sandbox or production
})

async function run() {
  const result = await polar.users.benefits.list({})
  for await (const page of result) {
    // Handle the page
    console.log(page)
  }
}

run()
```

> **camelCase vs. snake_case**: Our API (and docs) is designed with `snake_case`. However, our TS SDK currently converts this to camelCase to follow JS/TS convention. You should automatically see the camelCase parameters suggested in modern IDEs due to typing, but it's worth keeping in mind switching between code & docs.

## Framework Adapters

Implement Checkout & Webhook handlers in few lines of code:

* Astro
* Better Auth
* Deno
* Elysia
* Express
* Hono
* Fastify
* Next.js
* Nuxt
* Remix
* Sveltekit
* TanStack Start
