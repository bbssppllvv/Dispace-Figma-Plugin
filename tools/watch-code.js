/**
 * Watch script for code.ts that automatically injects HTML after each build
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const codePath = path.join(__dirname, '../dist/code.js');
const htmlPath = path.join(__dirname, '../dist/ui/index.html');

let lastModified = 0;

function injectHtml() {
  try {
    // Check if HTML file exists
    if (!fs.existsSync(htmlPath)) {
      console.log('⏳ Waiting for HTML file...');
      return;
    }

    // Read the HTML file
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Read the code file
    let codeContent = fs.readFileSync(codePath, 'utf8');

    // Escape the HTML content for JavaScript string
    const escapedHtml = htmlContent
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/`/g, '\\`')    // Escape backticks
      .replace(/\${/g, '\\${') // Escape template literal expressions
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n');

    // Replace __html__ with the actual HTML content
    const newCodeContent = codeContent.replace(
      /__html__/g,
      '`' + escapedHtml + '`'
    );

    // Only write if content changed
    if (newCodeContent !== codeContent) {
      fs.writeFileSync(codePath, newCodeContent, 'utf8');
      console.log('✅ HTML content injected into code.js');
    }
  } catch (error) {
    console.error('❌ Error injecting HTML:', error.message);
  }
}

// Watch for changes to code.js
fs.watchFile(codePath, { interval: 500 }, (curr, prev) => {
  if (curr.mtime > prev.mtime) {
    setTimeout(injectHtml, 200); // Small delay to ensure file is fully written
  }
});

// Watch for changes to HTML file
fs.watchFile(htmlPath, { interval: 500 }, (curr, prev) => {
  if (curr.mtime > prev.mtime) {
    setTimeout(injectHtml, 200);
  }
});

// Also watch source HTML file to ensure rebuilds are triggered
const sourceHtmlPath = path.join(__dirname, '../src/ui/index.html');
fs.watchFile(sourceHtmlPath, { interval: 500 }, (curr, prev) => {
  if (curr.mtime > prev.mtime) {
    console.log('📝 Source HTML changed, waiting for vite rebuild...');
    // Wait a bit longer for vite to rebuild
    setTimeout(() => {
      setTimeout(injectHtml, 500);
    }, 1000);
  }
});

console.log('👀 Watching for changes to code.js and index.html...');
console.log('   HTML will be automatically injected after each build.');

// Initial injection
setTimeout(injectHtml, 1000);


