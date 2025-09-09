#!/usr/bin/env node

/**
 * Simple dev server for Preset Studio
 * Fixes CORS issues when working with CDN resources
 */

const http = require('http');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

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

  // API endpoint для сохранения пресетов
  if (req.url === '/api/save-presets' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const presetsData = JSON.parse(body);
        const presetsPath = path.join(path.dirname(TOOLS_DIR), 'assets', 'presets.json');
        
        // Сохраняем файл
        await fs.writeFile(presetsPath, JSON.stringify(presetsData, null, 2), 'utf8');
        console.log(`✅ Saved ${presetsData.presets.length} presets to assets/presets.json`);
        
        // Автоматически коммитим и пушим
        const { execSync } = require('child_process');
        const projectRoot = path.dirname(TOOLS_DIR);
        
        execSync('git add assets/presets.json', { cwd: projectRoot });
        execSync(`git commit -m "feat: update presets via Preset Studio

- ${presetsData.presets.length} presets total
- Updated: ${new Date().toLocaleString()}
- Auto-deployed from Preset Studio"`, { cwd: projectRoot });
        execSync('git push', { cwd: projectRoot });
        
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Saved ${presetsData.presets.length} presets and deployed to GitHub/CDN`,
          presetCount: presetsData.presets.length
        }));
        
        console.log('🚀 Presets auto-deployed to GitHub → CDN');
        
      } catch (error) {
        console.error('❌ Save presets failed:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Proxy CDN requests to avoid CORS
  if (req.url.startsWith('/api/cdn/')) {
    const cdnPath = req.url.replace('/api/cdn/', '');
    const cdnUrl = `https://dispace-figma-assets.vercel.app/${cdnPath}`;
    
    console.log(`📡 Proxying: ${req.url} → ${cdnUrl}`);
    
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
  
  // Handle requests for parent directory files (like sample01.png)
  if (req.url.startsWith('../') || req.url.startsWith('/sample')) {
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
