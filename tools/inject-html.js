/**
 * Build script to inject HTML content into __html__ variable
 * This replaces __html__ with the actual HTML file content during build
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../dist/ui/index.html');
const codePath = path.join(__dirname, '../dist/code.js');

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
codeContent = codeContent.replace(
  /__html__/g,
  '`' + escapedHtml + '`'
);

// Write the updated code file
fs.writeFileSync(codePath, codeContent, 'utf8');

console.log('✅ HTML content injected into code.js');



