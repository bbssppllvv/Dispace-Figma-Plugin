#!/usr/bin/env node

// Simple dev server for Preset Studio (v2.1)
/**
 * Simple dev server for Preset Studio
 * Fixes CORS issues when working with CDN resources
 */

const http = require('http');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const AssetDeployer = require('./deploy-assets');

const PORT = 3001;
const TOOLS_DIR = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const reqUrlPath = req.url.split('?')[0]; // Remove query string for all API checks

  // API endpoint for saving presets
  if (reqUrlPath === '/api/save-presets' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const presetsData = JSON.parse(body);
        const presetsPath = path.join(path.dirname(TOOLS_DIR), 'assets', 'presets.json');
        
        // Save file
        await fs.writeFile(presetsPath, JSON.stringify(presetsData, null, 2), 'utf8');
        console.log(`✅ Saved ${presetsData.presets.length} presets to assets/presets.json`);
        
        // Automatically commit and push (optional, don't fail if git fails)
        try {
          const { execSync } = require('child_process');
          const projectRoot = path.dirname(TOOLS_DIR);
          
          execSync('git add assets/presets.json', { cwd: projectRoot });
          execSync(`git commit -m "feat: update presets via Preset Studio

- ${presetsData.presets.length} presets total
- Updated: ${new Date().toLocaleString()}
- Auto-deployed from Preset Studio"`, { cwd: projectRoot });
          execSync('git push', { cwd: projectRoot });
          console.log('🚀 Presets auto-deployed to GitHub → CDN');
        } catch (gitError) {
          console.warn('⚠️ Git auto-deploy failed (but file was saved locally):', gitError.message);
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Saved ${presetsData.presets.length} presets locally`,
          presetCount: presetsData.presets.length
        }));
        
      } catch (error) {
        console.error('❌ Save presets failed:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // API endpoint for uploading assets
  if (reqUrlPath === '/api/upload-asset' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!data.name || !data.content) {
          throw new Error('Missing name or content');
        }

        // Decode base64 content
        // Data URL format: data:image/svg+xml;base64,PHN2Zy...
        const matches = data.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid content format');
        }
        
        const fileContent = Buffer.from(matches[2], 'base64');
        const fileName = data.name;
        const assetsDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'displacement-maps', 'svg');
        const filePath = path.join(assetsDir, fileName);
        
        // Save file
        await fs.writeFile(filePath, fileContent);
        console.log(`✅ Saved asset: ${fileName}`);
        
        // Run deployment script to update manifest and optimize
        const deployer = new AssetDeployer();
        await deployer.deploy();
        
        // Git operations (optional, don't fail if git fails)
        try {
          const { execSync } = require('child_process');
          const projectRoot = path.dirname(TOOLS_DIR);
          
          execSync('git add assets/', { cwd: projectRoot });
          execSync(`git commit -m "feat: add asset ${fileName} via Preset Studio"`, { cwd: projectRoot });
          execSync('git push', { cwd: projectRoot });
          console.log(`🚀 Asset ${fileName} auto-deployed to GitHub`);
        } catch (gitError) {
          console.warn('⚠️ Git auto-deploy failed (but file was saved locally):', gitError.message);
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Uploaded ${fileName} locally`,
          asset: { name: fileName }
        }));
        
      } catch (error) {
        console.error('❌ Upload failed:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // API endpoint for deleting assets
  if (reqUrlPath === '/api/delete-asset' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!data.filename) {
          throw new Error('Missing filename');
        }

        const fileName = data.filename;
        const assetsDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'displacement-maps', 'svg');
        const filePath = path.join(assetsDir, fileName);
        
        // Check if exists before deleting
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
            console.log(`✅ Deleted asset: ${fileName}`);
        } catch (e) {
            console.log(`⚠️ File not found or already deleted: ${fileName}`);
        }
        
        // Run deployment script to update manifest
        const deployer = new AssetDeployer();
        await deployer.deploy();
        
        // Git operations (optional, don't fail if git fails)
        try {
          const { execSync } = require('child_process');
          const projectRoot = path.dirname(TOOLS_DIR);
          
          execSync('git add assets/', { cwd: projectRoot });
          execSync(`git commit -m "feat: delete asset ${fileName} via Preset Studio"`, { cwd: projectRoot });
          execSync('git push', { cwd: projectRoot });
          console.log(`🚀 Asset ${fileName} deletion auto-deployed to GitHub`);
        } catch (gitError) {
          console.warn('⚠️ Git auto-deploy failed (but file was deleted locally):', gitError.message);
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Deleted ${fileName} locally`
        }));
        
      } catch (error) {
        console.error('❌ Delete failed:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // API endpoint for uploading sample images
  if (reqUrlPath === '/api/upload-sample' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!data.name || !data.content) {
          throw new Error('Missing name or content');
        }

        const matches = data.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid content format');
        }
        
        const fileContent = Buffer.from(matches[2], 'base64');
        const fileName = data.name;
        const samplesDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'samples');
        const filePath = path.join(samplesDir, fileName);
        
        // Ensure directory exists
        if (!fsSync.existsSync(samplesDir)) {
          await fs.mkdir(samplesDir, { recursive: true });
        }
        
        await fs.writeFile(filePath, fileContent);
        console.log(`✅ Saved sample image: ${fileName}`);
        
        // Git operations (optional, don't fail if git fails)
        try {
          const { execSync } = require('child_process');
          const projectRoot = path.dirname(TOOLS_DIR);
          
          execSync('git add assets/samples/', { cwd: projectRoot });
          execSync(`git commit -m "feat: add sample image ${fileName} via Preset Studio"`, { cwd: projectRoot });
          execSync('git push', { cwd: projectRoot });
          console.log(`🚀 Sample ${fileName} auto-deployed to GitHub`);
        } catch (gitError) {
          console.warn('⚠️ Git auto-deploy failed (but file was saved locally):', gitError.message);
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Uploaded ${fileName} locally`,
          asset: { name: fileName }
        }));
        
      } catch (error) {
        console.error('❌ Upload failed:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // API endpoint for deleting sample images
  if (reqUrlPath === '/api/delete-sample' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!data.filename) {
          throw new Error('Missing filename');
        }

        const fileName = data.filename;
        const samplesDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'samples');
        const filePath = path.join(samplesDir, fileName);
        
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
            console.log(`✅ Deleted sample image: ${fileName}`);
        } catch (e) {
            console.log(`⚠️ File not found or already deleted: ${fileName}`);
        }
        
        // Git operations (optional, don't fail if git fails)
        try {
          const { execSync } = require('child_process');
          const projectRoot = path.dirname(TOOLS_DIR);
          
          execSync('git add assets/samples/', { cwd: projectRoot });
          execSync(`git commit -m "feat: delete sample image ${fileName} via Preset Studio"`, { cwd: projectRoot });
          execSync('git push', { cwd: projectRoot });
          console.log(`🚀 Sample ${fileName} deletion auto-deployed to GitHub`);
        } catch (gitError) {
          console.warn('⚠️ Git auto-deploy failed (but file was deleted locally):', gitError.message);
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Deleted ${fileName} locally`
        }));
        
      } catch (error) {
        console.error('❌ Delete failed:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // API endpoint for uploading tooltip images
  if (reqUrlPath === '/api/upload-tooltip' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!data.id || !data.content) {
          throw new Error('Missing tooltip id or content');
        }

        const matches = data.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid content format');
        }
        
        const fileContent = Buffer.from(matches[2], 'base64');
        const ext = matches[1].split('/')[1] || 'png';
        const fileName = `${data.id}.${ext}`;
        const tooltipDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'tooltip-images');
        const filePath = path.join(tooltipDir, fileName);
        
        // Ensure directory exists
        if (!fsSync.existsSync(tooltipDir)) {
          await fs.mkdir(tooltipDir, { recursive: true });
        }
        
        // Remove old images for this id if they have different extensions
        const files = await fs.readdir(tooltipDir);
        for (const file of files) {
          if (file.startsWith(`${data.id}.`)) {
            await fs.unlink(path.join(tooltipDir, file));
          }
        }
        
        await fs.writeFile(filePath, fileContent);
        console.log(`✅ Saved tooltip image: ${fileName}`);
        
        // Git operations
        try {
          const { execSync } = require('child_process');
          const projectRoot = path.dirname(TOOLS_DIR);
          execSync('git add assets/tooltip-images/', { cwd: projectRoot });
          execSync(`git commit -m "feat: add tooltip image ${fileName} via Preset Studio"`, { cwd: projectRoot });
          execSync('git push', { cwd: projectRoot });
        } catch (e) {}
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          url: `/api/tooltip/${fileName}`
        }));
        
      } catch (error) {
        console.error('❌ Tooltip upload failed:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // API endpoint for deleting tooltip images
  if (reqUrlPath === '/api/delete-tooltip' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!data.id) throw new Error('Missing id');

        const tooltipDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'tooltip-images');
        if (fsSync.existsSync(tooltipDir)) {
          const files = await fs.readdir(tooltipDir);
          for (const file of files) {
            if (file.startsWith(`${data.id}.`)) {
              await fs.unlink(path.join(tooltipDir, file));
              console.log(`✅ Deleted tooltip image for: ${data.id}`);
            }
          }
        }
        
        // Git operations
        try {
          const { execSync } = require('child_process');
          const projectRoot = path.dirname(TOOLS_DIR);
          execSync('git add assets/tooltip-images/', { cwd: projectRoot });
          execSync(`git commit -m "feat: delete tooltip image for ${data.id}"`, { cwd: projectRoot });
          execSync('git push', { cwd: projectRoot });
        } catch (e) {}

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // API endpoint for serving individual tooltip files
  if (reqUrlPath.startsWith('/api/tooltip/')) {
    try {
      const fileName = decodeURIComponent(reqUrlPath.replace('/api/tooltip/', ''));
      const tooltipDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'tooltip-images');
      const filePath = path.join(tooltipDir, fileName);
      
      if (!filePath.startsWith(tooltipDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      const ext = path.extname(fileName).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      const content = await fs.readFile(filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.writeHead(200);
      res.end(content);
    } catch (error) {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // API endpoint for listing local sample images
  if (reqUrlPath === '/api/local-samples') {
    try {
      const samplesDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'samples');
      if (!fsSync.existsSync(samplesDir)) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }
      const files = await fs.readdir(samplesDir);
      
      const samples = [];
      for (const file of files) {
        if (/\.(svg|png|jpe?g)$/i.test(file)) {
          const stats = await fs.stat(path.join(samplesDir, file));
          samples.push({
            name: file,
            size: stats.size,
          });
        }
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(samples));
      console.log(`📁 Local samples: ${samples.length} files`);
    } catch (error) {
      console.error('❌ Local samples error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API endpoint for serving individual sample files
  if (reqUrlPath.startsWith('/api/sample/')) {
    try {
      const fileName = decodeURIComponent(reqUrlPath.replace('/api/sample/', ''));
      const samplesDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'samples');
      const filePath = path.join(samplesDir, fileName);
      
      if (!filePath.startsWith(samplesDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      const ext = path.extname(fileName).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      const content = await fs.readFile(filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.writeHead(200);
      res.end(content);
    } catch (error) {
      console.error('❌ Sample serve error:', error);
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // API endpoint for listing local assets (no GitHub rate limits)
  if (reqUrlPath === '/api/local-assets') {
    try {
      const assetsDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'displacement-maps', 'svg');
      const files = await fs.readdir(assetsDir);
      
      const assets = [];
      for (const file of files) {
        if (/\.(svg|png|jpe?g)$/i.test(file)) {
          const stats = await fs.stat(path.join(assetsDir, file));
          assets.push({
            name: file,
            size: stats.size,
          });
        }
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(assets));
      console.log(`📁 Local assets: ${assets.length} files`);
    } catch (error) {
      console.error('❌ Local assets error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API endpoint for loading presets from local file (no CDN dependency)
  if (reqUrlPath === '/api/local-presets') {
    try {
      const presetsPath = path.join(path.dirname(TOOLS_DIR), 'assets', 'presets.json');
      const data = await fs.readFile(presetsPath, 'utf8');
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(data);
      console.log(`📋 Local presets loaded`);
    } catch (error) {
      console.error('❌ Local presets error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API endpoint for serving individual asset files
  if (reqUrlPath.startsWith('/api/asset/')) {
    try {
      const fileName = decodeURIComponent(reqUrlPath.replace('/api/asset/', ''));
      const assetsDir = path.join(path.dirname(TOOLS_DIR), 'assets', 'displacement-maps', 'svg');
      const filePath = path.join(assetsDir, fileName);
      
      // Security: ensure we're not escaping the assets directory
      if (!filePath.startsWith(assetsDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      const ext = path.extname(fileName).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      const content = await fs.readFile(filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.writeHead(200);
      res.end(content);
    } catch (error) {
      console.error('❌ Asset serve error:', error);
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // Proxy GitHub API requests to avoid CORS (for file listing)
  if (reqUrlPath.startsWith('/api/github/')) {
    const githubPath = reqUrlPath.replace('/api/github/', '');
    // Use GitHub Contents API for directory listing
    const githubUrl = `https://api.github.com/repos/bbssppllvv/Dispace-Figma-Plugin/contents/${githubPath}`;
    
    console.log(`📡 GitHub API Proxy: ${req.url} → ${githubUrl}`);
    
    try {
      const https = require('https');
      const options = {
        hostname: 'api.github.com',
        path: `/repos/bbssppllvv/Dispace-Figma-Plugin/contents/${githubPath}`,
        headers: {
          'User-Agent': 'Preset-Studio',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      const githubReq = https.request(options, (githubRes) => {
        console.log(`📡 GitHub API response: ${githubRes.statusCode} for ${githubPath}`);
        
        // Set JSON content type and CORS
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        res.writeHead(githubRes.statusCode);
        githubRes.pipe(res);
      });
      
      githubReq.on('error', (error) => {
        console.error('❌ GitHub API proxy error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'GitHub request failed' }));
      });
      
      githubReq.end();
      return;
    } catch (error) {
      console.error('❌ GitHub API proxy setup error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'GitHub proxy error' }));
      return;
    }
  }

  // Proxy CDN requests to avoid CORS
  if (reqUrlPath.startsWith('/api/cdn/')) {
    const cdnPath = reqUrlPath.replace('/api/cdn/', '');
    const cdnUrl = `https://dispace-figma-assets.vercel.app/${cdnPath}`;
    
    console.log(`📡 CDN Proxy: ${req.url} → ${cdnUrl}`);
    
    try {
      const https = require('https');
      const cdnReq = https.request(cdnUrl, (cdnRes) => {
        console.log(`📡 CDN response: ${cdnRes.statusCode} for ${cdnPath}`);
        
        // Copy headers
        Object.entries(cdnRes.headers).forEach(([key, value]) => {
          if (key.toLowerCase() !== 'access-control-allow-origin') {
            res.setHeader(key, value);
          }
        });
        
        res.writeHead(cdnRes.statusCode);
        cdnRes.pipe(res);
      });
      
      cdnReq.on('error', (error) => {
        console.error('❌ CDN proxy error:', error);
        res.writeHead(500);
        res.end('CDN request failed');
      });
      
      cdnReq.end();
      return;
    } catch (error) {
      console.error('❌ Proxy setup error:', error);
      res.writeHead(500);
      res.end('Proxy error');
      return;
    }
  }

  let filePath = path.join(TOOLS_DIR, req.url === '/' ? 'preset-studio.html' : req.url);
  
  // Handle requests for assets and samples
  if (req.url.startsWith('/samples/') || req.url.startsWith('/displacement-maps/')) {
    filePath = path.join(path.dirname(TOOLS_DIR), 'assets', decodeURIComponent(req.url));
  } else if (req.url.startsWith('/api/sample/')) {
    const fileName = decodeURIComponent(req.url.replace('/api/sample/', ''));
    filePath = path.join(path.dirname(TOOLS_DIR), 'assets', 'samples', fileName);
  } else if (req.url.startsWith('../') || req.url.startsWith('/sample')) {
    const fileName = req.url.replace('../', '').replace('/', '');
    filePath = path.join(path.dirname(TOOLS_DIR), fileName);
  }

  fsSync.readFile(filePath, (err, data) => {
    if (err) {
      console.log(`404: ${filePath} (${req.url})`);
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', mimeType);
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Preset Studio dev server running at: http://localhost:${PORT}`);
  console.log('💡 This fixes CORS issues with CDN resources');
  
  // Auto-open browser
  const open = require('child_process').exec;
  open(`open http://localhost:${PORT}`, (error) => {
    if (error) {
      console.log('Please open: http://localhost:3001');
    }
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down dev server...');
  server.close(() => {
    process.exit(0);
  });
});
