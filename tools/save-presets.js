#!/usr/bin/env node

/**
 * Quick Preset Save Script
 * 
 * Простой скрипт для быстрого сохранения presets.json из Preset Generator
 * Использование: node save-presets.js (скопирует из буфера обмена)
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function savePresets() {
  try {
    console.log('📋 Reading presets from clipboard...');
    
    // Читаем из буфера обмена (macOS)
    const clipboardContent = execSync('pbpaste', { encoding: 'utf8' });
    
    // Проверяем что это валидный JSON
    let presetData;
    try {
      presetData = JSON.parse(clipboardContent);
    } catch (error) {
      console.error('❌ Clipboard does not contain valid JSON');
      console.log('💡 Copy the JSON output from Preset Generator first');
      process.exit(1);
    }
    
    // Проверяем что это presets.json формат
    if (!presetData.presets || !Array.isArray(presetData.presets)) {
      console.error('❌ Invalid presets.json format');
      console.log('💡 Make sure you copied the complete presets.json from Preset Generator');
      process.exit(1);
    }
    
    // Сохраняем в assets/presets.json
    const presetsPath = path.join(__dirname, '../assets/presets.json');
    await fs.writeFile(presetsPath, JSON.stringify(presetData, null, 2));
    
    console.log(`✅ Saved ${presetData.presets.length} presets to assets/presets.json`);
    
    // Автоматически коммитим и пушим
    console.log('🚀 Auto-committing and deploying...');
    
    execSync('git add assets/presets.json', { cwd: path.join(__dirname, '..') });
    execSync(`git commit -m "feat: update presets via Preset Generator

- ${presetData.presets.length} presets total
- Updated: ${new Date().toLocaleString()}
- Auto-deployed to CDN"`, { cwd: path.join(__dirname, '..') });
    execSync('git push', { cwd: path.join(__dirname, '..') });
    
    console.log('🎉 Presets deployed! They will be available in plugin in ~1 minute');
    console.log('💡 Use the 🔄 button in plugin to refresh immediately');
    
  } catch (error) {
    console.error('❌ Failed to save presets:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  savePresets();
}
