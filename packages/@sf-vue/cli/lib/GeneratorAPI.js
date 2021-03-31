const fs = require('fs')
const ejs = require('ejs')
const path = require('path')
//深度合并两个或多个对象的可枚举属性
const deepmerge = require('deepmerge')
//路径解析
const resolve = require('resolve')
//是否是二进制文件
const { isBinaryFileSync } = require('isbinaryfile')
const mergeDeps = require('./util/mergeDeps')
//升级部分vue api
const { runTransformation } = require('vue-codemod')
//js对象转字符串
const stringifyJS = require('./util/stringifyJS')
const ConfigTransform = require('./ConfigTransform')
require('module-alias/register');
// plugin解析
const { semver, error, getPluginLink, toShortPluginId, loadModule } = require('@sf-ue/cli/shared/utils')

const isString = val => typeof val === 'string'
const isFunction = val => typeof val === 'function'
const isObject = val => val && typeof val === 'object'
const mergeArrayWithDedupe = (a, b) => Array.from([...a, ...b])
//prune 裁减; 削减; 精简; 把对象中为空的key删除
function pruneObject (obj) {
  if (typeof obj === 'object') {
    for (const k in obj) {
      if (!obj.hasOwnProperty(k)) {
        continue
      }

      if (obj[k] == null) {
        delete obj[k]
      } else {
        obj[k] = pruneObject(obj[k])
      }
    }
  }

  return obj
}

class GeneratorAPI {
  /**
   * @param {string} id - 插件id
   * @param {Generator} generator -引用的Generator的实例
   * @param {object} options -传递给此插件的生成器选项
   * @param {object} rootOptions -根选项（整个预设）
   */

  constructor (id, generator, options, rootOptions) {
    this.id = id
    this.generator = generator
    this.options = options
    this.rootOptions = rootOptions

    //获取插件信息 name link
    this.pluginsData = generator.plugins
      .filter(({ id }) => id !== `@sf-vue/cli-service`)
      .map(({ id }) => ({
        name: toShortPluginId(id),
        link: getPluginLink(id)
      }))

    this._entryFile = undefined
  }

  /**
   * 在渲染模板时解析数据.
   *
   * @private
   */
  _resolveData (additionalData) {
    return Object.assign({
      options: this.options,
      rootOptions: this.rootOptions,
      plugins: this.pluginsData
    }, additionalData)
  }

  /**
   * 注入一个文件处理中间件
   *
   * @private
   * @param {FileMiddleware} middleware -
   *  一个中间件函数，接收虚拟文件树对象和ejs渲染函数。可以是异步的。
   */
  _injectFileMiddleware (middleware) {
    //push进generator的 fileMiddleware数组
    this.generator.FileMiddleware.push(middleware)
  }


  /**
   * Normalize absolute path, Windows-style path
   * to the relative path used as index in this.files
   * 将绝对路径、Windows样式路径规范化为 this.files数组用作索引的相对路径
   * @param {string} p the path to normalize
   */
   _normalizePath (p) {
    if (path.isAbsolute(p)) {
      p = path.relative(this.generator.context, p)
    }
    // The `files` tree always use `/` in its index.
    // So we need to normalize the path string in case the user passes a Windows path.
    return p.replace(/\\/g, '/')
  }


  /**
   * Resolve path for a project.
   *
   * @param {string} _paths - 一系列相对路径或路径段
   * @return {string} 解析的绝对路径，基于当前项目根计算.
   */
   resolve (..._paths) {
    return path.resolve(this.generator.context, ..._paths)
  }

  get cliVersion () {
    return require('@root/package.json').version
  }

  assertCliVersion (range) {
    if(typeof range === 'number') {
      if (!Number.isInteger(range)) {
        throw new Error('Expected string or integer value.')
      }
      range = `^${range}.0.0-0`
    }
    if (typeof range !== 'string') {
      throw new Error('Expected string or integer value.')
    }

    if (semver.satisfies(this.cliVersion, range, { includePrerelease: true })) return

    throw new Error(
      `Require global @vue/cli "${range}", but was invoked by "${this.cliVersion}".`
    )
  }

  get cliServiceVersion () {
    // In generator unit tests, we don't write the actual file back to the disk.
    // So there is no cli-service module to load.
    // In that case, just return the cli version.
    if (process.env.VUE_CLI_TEST && process.env.VUE_CLI_SKIP_WRITE) {
      return this.cliVersion
    }

    const servicePkg = loadModule(
      '@vue/cli-service/package.json',
      this.generator.context
    )

    return servicePkg.version
  }

  assertCliServiceVersion (range) {
    if (typeof range === 'number') {
      if (!Number.isInteger(range)) {
        throw new Error('Expected string or integer value.')
      }
      range = `^${range}.0.0-0`
    }
    if (typeof range !== 'string') {
      throw new Error('Expected string or integer value.')
    }

    if (semver.satisfies(this.cliServiceVersion, range, { includePrerelease: true })) return

    throw new Error(
      `Require @vue/cli-service "${range}", but was loaded with "${this.cliServiceVersion}".`
    )
  }

  /**
   * Check if the project has a given plugin.
   *
   * @param {string} id - Plugin id, can omit the (@vue/|vue-|@scope/vue)-cli-plugin- prefix
   * @param {string} version - Plugin version. Defaults to ''
   * @return {boolean}
   */
   hasPlugin (id, version) {
    return this.generator.hasPlugin(id, version)
  }
}