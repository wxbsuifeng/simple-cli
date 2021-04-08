const fs =require('fs-extra')
const loadPresetFromDir = require('./loadPresetFromDir')

module.exports = async function loadRemotePreset (repository, clone) {
  const os = require('os')
  const path = require('path')
  const download = require('download-git-repo')

  const presetName = repository
    .replace(/((?:.git)?#.*)/, '')
    .split('/')
    .slice(-1)[0]
    .replace(/[:#]/g, '')

  const tmpDir = path.join(os.tmpdir(), 'vue-cli-presets', presetName)

  if (clone) {
    await fs.remove(tmpDir)
  }

  await new Promise((resolve, reject) => {
    download(repository, tmpDir, { clone }, err => {
      if (err) return reject(err)
      resolve()
    })
  })

  return await loadPresetFromDir(tmpDir)
}