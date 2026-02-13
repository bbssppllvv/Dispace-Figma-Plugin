# Displace Plugin — Monetization Guide

> Polar.sh License Key integration

## Overview

Displace uses **Polar.sh License Keys** for monetization. The architecture is entirely client-side — no backend server, no Stripe, no Supabase. Polar's public API handles license activation and validation directly from the Figma plugin UI iframe.

### Architecture

```
PURCHASE:
  Plugin UI → figma.openExternal(checkoutLinkUrl) → Polar Checkout → payment → license key on success page

ACTIVATION:
  User copies key → enters in plugin → UI calls POST api.polar.sh/v1/customer-portal/license-keys/activate
  → receives activation_id → sends (key + activation_id) to code.ts → figma.clientStorage

VALIDATION (on every plugin open):
  code.ts → figma.clientStorage.getAsync → sends key + activation_id to UI
  → UI calls POST api.polar.sh/v1/customer-portal/license-keys/validate
  → isPro = true/false → notifyListeners()
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/ui/services/LicenseService.ts` | Core license logic (Polar API calls) |
| `src/ui/config/constants.ts` | `LICENSE.POLAR_ORGANIZATION_ID`, `LICENSE.POLAR_CHECKOUT_LINK_URL` |
| `src/code/handlers.ts` | `STORE_LICENSE_KEY`, `CLEAR_LICENSE_KEY`, `LOAD_LICENSE_KEY` handlers |
| `src/ui/managers/FigmaMessageHandler.ts` | `LICENSE_KEY_LOADED` handler |
| `src/ui/components/paywall.html` | Paywall modal with license key input |
| `src/ui/managers/ModalManager.ts` | Button handlers for checkout + activation |
| `manifest.json` | `api.polar.sh` in `networkAccess.allowedDomains` |

---

## Polar API Endpoints (Public, No Auth)

```typescript
// Activate
POST https://api.polar.sh/v1/customer-portal/license-keys/activate
Body: { key, organization_id, label }
→ Returns: { id: activationId, ... }

// Validate
POST https://api.polar.sh/v1/customer-portal/license-keys/validate
Body: { key, organization_id, activation_id }
→ Returns: { valid: true/false, ... }

// Deactivate
POST https://api.polar.sh/v1/customer-portal/license-keys/deactivate
Body: { key, organization_id, activation_id }
```

---

## Free vs Pro Features

### FREE users:
- All effects and settings (strength, scale, blur, etc.)
- Free presets
- Preview and tweak Pro presets (sliders work)
- Custom displacement maps

### PRO users:
- Everything above
- Apply Pro presets to canvas
- Export to Code (SVG)
- Full premium preset library

---

## Setup Checklist

1. Create a Polar.sh account and organization
2. Create a product: "Displace Pro — Lifetime Access" ($19, one-time)
3. Attach a License Key benefit (prefix: `DISPLACE_`, activation limit: 3)
4. Create a Checkout Link for the product
5. Update `src/ui/config/constants.ts`:
   - Set `POLAR_ORGANIZATION_ID` to your org ID
   - Set `POLAR_CHECKOUT_LINK_URL` to your checkout link URL
6. Set `DEV_MODE_ENABLED: false` for production
7. Build and publish the plugin

---

## Dev Mode

When `DEV_MODE_ENABLED: true` in constants:
- Ctrl+L (Cmd+L on Mac) toggles Free/Pro state
- "Get Pro" button simulates checkout instead of opening Polar
- No API calls are made

---

*Document updated: February 2026*
*Version: 2.0*
*Payment system: Polar.sh License Keys*
