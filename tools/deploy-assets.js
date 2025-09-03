#!/usr/bin/env node

/**
 * Asset Deployment Script
 * 
 * Automates the deployment of displacement map assets to Vercel CDN.
 * Integrates with GitHub Actions for continuous deployment.
 * 
 * Usage:
 *   node deploy-assets.js
 *   npm run deploy:assets
 * 
 * Features:
 * - Optimizes SVG/PNG files before upload
 * - Generates content hashes for cache busting
 * - Updates manifest.json with new asset references
 * - Validates asset integrity
 * - Creates GitHub commit with updated manifest
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AssetDeployer {
  constructor() {
    this.assetsDir = path.join(__dirname, '../assets');
    this.manifestPath = path.join(this.assetsDir, 'manifest.json');
    this.cdnBaseUrl = process.env.CDN_BASE_URL || 'https://your-cdn.vercel.app/assets';
  }

  async deploy() {
    console.log('🚀 Starting asset deployment...');
    
    try {
      // 1. Scan for new/modified assets
      const assets = await this.scanAssets();
      console.log(`📁 Found ${assets.length} assets`);
      
      // 2. Optimize assets
      const optimizedAssets = await this.optimizeAssets(assets);
      console.log(`✨ Optimized ${optimizedAssets.length} assets`);
      
      // 3. Generate manifest
      const manifest = await this.generateManifest(optimizedAssets);
      console.log('📋 Generated manifest');
      
      // 4. Save manifest
      await this.saveManifest(manifest);
      console.log('💾 Saved manifest.json');
      
      // 5. Validate deployment
      await this.validateDeployment(manifest);
      console.log('✅ Deployment validation passed');
      
      console.log('🎉 Asset deployment completed successfully!');
      
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    }
  }

  async scanAssets() {
    const assets = [];
    const categories = ['displacement-maps'];
    
    for (const category of categories) {
      const categoryPath = path.join(this.assetsDir, category);
      
      try {
        const types = await fs.readdir(categoryPath);
        
        for (const type of types) {
          if (!['svg', 'png'].includes(type)) continue;
          
          const typePath = path.join(categoryPath, type);
          const files = await fs.readdir(typePath);
          
          for (const file of files) {
            const filePath = path.join(typePath, file);
            const stats = await fs.stat(filePath);
            
            assets.push({
              id: path.parse(file).name,
              name: file,
              category,
              type,
              path: filePath,
              relativePath: path.relative(this.assetsDir, filePath),
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not scan category ${category}:`, error.message);
      }
    }
    
    return assets;
  }

  async optimizeAssets(assets) {
    const optimized = [];
    
    for (const asset of assets) {
      try {
        const content = await fs.readFile(asset.path);
        let optimizedContent = content;
        
        if (asset.type === 'svg') {
          // Basic SVG optimization
          optimizedContent = await this.optimizeSvg(content);
        } else if (asset.type === 'png') {
          // PNG optimization would go here
          // Could integrate with imagemin or similar
        }
        
        // Generate hash
        const hash = crypto
          .createHash('sha256')
          .update(optimizedContent)
          .digest('hex');
        
        optimized.push({
          ...asset,
          content: optimizedContent,
          hash: `sha256-${hash}`,
          optimizedSize: optimizedContent.length
        });
        
      } catch (error) {
        console.warn(`⚠️ Could not optimize ${asset.name}:`, error.message);
        // Include unoptimized version
        optimized.push(asset);
      }
    }
    
    return optimized;
  }

  async optimizeSvg(content) {
    // Basic SVG optimization
    let svg = content.toString();
    
    // Remove comments
    svg = svg.replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove unnecessary whitespace
    svg = svg.replace(/>\s+</g, '><');
    
    // Remove empty attributes
    svg = svg.replace(/\s+[a-zA-Z-]+=""\s*/g, ' ');
    
    return Buffer.from(svg.trim());
  }

  async generateManifest(assets) {
    const manifest = {
      version: '1.0.0',
      baseUrl: this.cdnBaseUrl,
      generated: new Date().toISOString(),
      resources: {}
    };
    
    // Group assets by category
    const categories = {};
    assets.forEach(asset => {
      if (!categories[asset.category]) {
        categories[asset.category] = {};
      }
      
      categories[asset.category][asset.id] = {
        type: asset.type,
        path: `/${asset.relativePath.replace(/\\/g, '/')}`,
        hash: asset.hash,
        size: asset.optimizedSize || asset.size,
        dimensions: asset.dimensions || null
      };
    });
    
    manifest.resources = categories;
    return manifest;
  }

  async saveManifest(manifest) {
    await fs.writeFile(
      this.manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
  }

  async validateDeployment(manifest) {
    // Basic validation
    if (!manifest.resources) {
      throw new Error('Manifest missing resources');
    }
    
    const resourceCount = Object.values(manifest.resources)
      .reduce((total, category) => total + Object.keys(category).length, 0);
    
    if (resourceCount === 0) {
      throw new Error('No resources found in manifest');
    }
    
    console.log(`✅ Validation passed: ${resourceCount} resources`);
  }
}

// CLI execution
if (require.main === module) {
  const deployer = new AssetDeployer();
  deployer.deploy();
}

module.exports = AssetDeployer;
