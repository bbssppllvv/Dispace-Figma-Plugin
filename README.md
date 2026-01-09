# Displace 2.0

Advanced displacement effects plugin for Figma with multi-layer support and CDN-based asset management.

## Features

- Advanced displacement effects using SVG displacement maps
- Preset library with 50+ built-in effects
- Multi-layer support with blend modes
- CDN integration for fast asset loading
- Built-in preset builder and asset management
- Pro subscription with code export

## Installation

```bash
git clone https://github.com/bbssppllvv/Dispace-Figma-Plugin.git
cd Dispace-Figma-Plugin
npm install
npm run build
```

## Usage

1. Select an image layer in Figma
2. Open the Displace 2.0 plugin
3. Choose a preset effect
4. Adjust parameters
5. Apply to your design

## Development

### Prerequisites

- Node.js 18+
- Figma desktop app

### Setup

```bash
npm install
npm run watch    # Development
npm run build    # Production
```

### Project Structure

```
src/
├── code.ts              # Plugin backend
└── ui/                  # Plugin UI
    ├── App.ts          # Main controller
    ├── engine/         # Rendering engine
    ├── services/       # API services
    ├── components/     # UI components
    └── presets/        # Effect presets

assets/                  # CDN assets
├── displacement-maps/   # SVG/PNG textures
└── manifest.json       # Asset registry

tools/                   # Development tools
├── preset-studio/       # React-based Preset Studio v2
└── deploy-assets.js
```

## Creating Presets

### Using Preset Studio v2

1. Run `npm run preset:studio:v2`
2. Open the URL provided (usually http://localhost:5173)
3. Create and tweak your effect
4. Export the preset JSON
5. Add the new preset to `assets/presets.json`
6. Commit changes to trigger CDN deployment

### JSON Format

```json
{
  "id": "custom-effect",
  "name": "Custom Effect",
  "categories": ["custom"],
  "defaultScale": 32,
  "defaultStrength": 133,
  "layers": [
    {
      "src": "resource://displacement-map",
      "tiling": "tiled",
      "scaleMode": "uniform"
    }
  ]
}
```

## Asset Management

Assets are hosted on Vercel CDN with automatic deployment via GitHub Actions.

### Configuration

```bash
# Environment variables
CDN_BASE_URL=https://your-cdn.vercel.app/assets
VERCEL_TOKEN=your_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
```

### Deployment

```bash
npm run deploy:assets    # Deploy to CDN
git push                 # Auto-deploy via GitHub Actions
```

## Build System

- UI: Vite + TypeScript + TailwindCSS
- Backend: ESBuild
- Assets: Automated optimization
- CI/CD: GitHub Actions

## License

MIT License
