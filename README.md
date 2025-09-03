# 🌊 Displace 2.0 - Advanced Figma Displacement Plugin

A professional Figma plugin for creating sophisticated displacement effects with multi-layer support, custom presets, and CDN-based asset management.

## ✨ Features

- **🎨 Advanced Displacement Effects**: Create complex visual distortions using SVG displacement maps
- **📚 Preset Library**: Extensive collection of pre-built effects (Glass, Fabric, Geometric, Organic)
- **🔧 Multi-Layer Support**: Combine multiple displacement maps with different blend modes
- **☁️ CDN Integration**: Fast asset loading via Vercel CDN
- **🛠️ Professional Workflow**: Built-in preset builder and asset management
- **💎 Premium Features**: Pro subscription with advanced effects and code export

## 🚀 Quick Start

### Installation

1. Download the plugin from Figma Community (coming soon)
2. Or install from source:
   ```bash
   git clone https://github.com/bbssppllvv/Dispace-Figma-Plugin.git
   cd Dispace-Figma-Plugin
   npm install
   npm run build
   ```

### Usage

1. Select any image layer in Figma
2. Open the Displace 2.0 plugin
3. Choose from 50+ preset effects
4. Adjust strength, scale, and other parameters
5. Apply the effect directly to your design

## 🏗️ Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Figma desktop app

### Setup

```bash
# Clone the repository
git clone https://github.com/bbssppllvv/Dispace-Figma-Plugin.git
cd Dispace-Figma-Plugin

# Install dependencies
npm install

# Start development
npm run watch

# Build for production
npm run build
```

### Architecture

```
src/
├── code.ts              # Figma plugin backend
└── ui/                  # Plugin UI (iframe)
    ├── App.ts          # Main application controller
    ├── engine/         # Displacement rendering engine
    ├── services/       # API services (Figma, License, Resources)
    ├── components/     # UI components
    └── presets/        # Effect presets and definitions

assets/                  # CDN assets
├── displacement-maps/   # SVG/PNG displacement textures
└── manifest.json       # Asset registry

tools/                   # Development tools
├── preset-builder-pro.html  # Preset creation tool
└── deploy-assets.js    # Asset deployment script
```

## 🎛️ Creating Custom Presets

### Using the Preset Builder

1. Open `tools/preset-builder-pro.html`
2. Upload your SVG/PNG displacement maps
3. Configure layers, positioning, and effects
4. Generate TypeScript preset definition
5. Save to `src/ui/presets/definitions/`

### Manual Preset Creation

```typescript
import type { Preset } from '../types';

const customPreset: Preset = {
  id: 'my-custom-effect',
  name: 'My Custom Effect',
  category: 'Custom',
  defaultScale: 32,
  defaultStrength: 133,
  layers: [
    {
      src: 'resource://my-displacement-map',
      tiling: 'tiled',
      scaleMode: 'uniform',
      blendMode: 'overlay'
    }
  ]
};

export default customPreset;
```

## 🌐 Asset Management

Assets are hosted on Vercel CDN for optimal performance:

- **Base URL**: `https://your-cdn.vercel.app/assets`
- **Auto-deployment**: GitHub Actions automatically deploy asset changes
- **Caching**: Browser caching with hash-based cache busting
- **Fallbacks**: Local fallback textures if CDN is unavailable

## 📦 Build System

- **UI**: Vite + TypeScript + TailwindCSS
- **Backend**: ESBuild for fast compilation
- **Assets**: Automated optimization and deployment
- **CI/CD**: GitHub Actions for testing and deployment

## 🔧 Configuration

### Environment Variables

```bash
# Vercel deployment
CDN_BASE_URL=https://your-cdn.vercel.app/assets
VERCEL_TOKEN=your_vercel_token
ORG_ID=your_org_id
PROJECT_ID=your_project_id
```

### Manifest Configuration

The `assets/manifest.json` file controls asset loading:

```json
{
  "version": "1.0.0",
  "baseUrl": "https://your-cdn.vercel.app/assets",
  "resources": {
    "displacement-maps": {
      "horizontal-bands": {
        "type": "svg",
        "path": "/displacement-maps/svg/horizontal-bands.svg",
        "hash": "sha256-...",
        "size": 2048
      }
    }
  }
}
```

## 🚀 Deployment

### GitHub → Vercel Workflow

1. Push changes to GitHub
2. GitHub Actions builds and optimizes assets
3. Assets automatically deploy to Vercel CDN
4. Plugin loads resources from CDN

### Manual Deployment

```bash
# Deploy assets to CDN
npm run deploy:assets

# Build plugin for distribution
npm run build
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Figma team for the excellent Plugin API
- Community contributors and beta testers
- Open source libraries and tools used in this project

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/bbssppllvv/Dispace-Figma-Plugin/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/bbssppllvv/Dispace-Figma-Plugin/discussions)
- 📧 **Contact**: [your-email@example.com](mailto:your-email@example.com)

---

Made with ❤️ for the Figma community
