//dev only
require('module-alias/register');
const path = require('path')
const { linkBin } = require('./linkBin')

module.exports = function setupDevProject (targetDir) {
  return linkBin(
    require.resolve('@sf-vue/cli-service/bin/vue-cli-service'),
    path.join(targetDir, 'node_modules', '.bin', 'vue-cli-service')
  )
}