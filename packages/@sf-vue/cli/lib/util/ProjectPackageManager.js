const fs = require('fs-extra')
const path = require('path')

//ini格式解析、序列化
const ini = require('ini')
const minimist = require('minimist')
const LRU = require('lru-cache')

const stripAnsi = require('strip-ansi')

const {
  chalk,
  execa,
  semver,
  request,

  resolvePkg,
  loadModule,

  hasYarn,
  hasProjectYarn,
  hasPnpm3OrLater,
  hasPnpmVersionOrLater,
  hasProjectPnpm,
  hasProjectNpm,

  isOfficialPlugin,
  resolvePluginId,

  log,
  warn,
  error
} = require('@vue/cli-shared-utils')