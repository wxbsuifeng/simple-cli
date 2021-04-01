[
  'env',
  'exit',
  'logger',
  'module',
  'pluginResolution',
  'pkg',
  'request',
  'spinner',
  'validate'
].forEach(m => {
  Object.assign(exports, require(`./lib/${m}`))
})

exports.chalk = require('chalk')
exports.execa = require('execa')
exports.semver = require('semver')

Object.defineProperty(exports, 'installedBrowsers', {
  enumerable: true,
  get () {
    return exports.getInstalledBrowsers()
  }
})