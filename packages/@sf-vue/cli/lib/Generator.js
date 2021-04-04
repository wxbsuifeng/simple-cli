//模板引擎
require('module-alias/register');
const ejs = require('ejs')
const debug = require('debug')
const GeneratorAPI = require('./GeneratorAPI')
const PackageManager = require('./util/ProjectPackageManager');
// 排列object的key的顺序
const sortObject = require('./util/sortObject')
//找到previousFiles中 newFiles里面没有的文件 删除，并把newFiles内文件写入 dir目录
const writeFileTree = require('./util/writeFileTree')

const inferRootOptions = require('./util/inferRootOptions')
const normalizeFilePaths = require('./util/normalizeFilePaths')
const { runTransformation } = require('vue-codemod')
const {
  semver,

  isPlugin,
  toShortPluginId,
  matchesPluginId,

  loadModule,
} = require('@sf-vue/cli-shared-utils')
const ConfigTransform = require('./ConfigTransform')

const logger = require('@sf-vue/cli-shared-utils/lib/logger')
const logTypes = {
  log: logger.log,
  info: logger.info,
  done: logger.done,
  warn: logger.warn,
  error: logger.error
}