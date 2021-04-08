const path = require('path')
const fs = require('fs-extra')

module.exports = async function loadPresetFromDir (dir) {
  const presetPath = path.join(dir, 'preset.json')
  if (!fs.existsSync(presetPath)) {
    throw new Error('remote / local preset does not contain preset.json!')
  }
  const preset = await fs.readJSON(presetPath)

  const hasGenerator = fs.existsSync(path.join(dir, 'generator.js')) || fs.existsSync(path.join(dir, 'generator/index.js'))
  if (hasGenerator) {
    (preset.plugins || (preset.plugins = {}))[dir.replace(/[\/]$/, '')] = {
      _isPreset: true,
      prompts: true
    }
  }

  return preset
}