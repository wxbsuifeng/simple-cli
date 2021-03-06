require('module-alias/register');
const fs = require('fs')
//用 JavaScript 代码生成 HTML 页面
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
// plugin解析
const { semver, error, getPluginLink, toShortPluginId, loadModule } = require('@sf-vue/cli-shared-utils')

const isString = val => typeof val === 'string'
const isFunction = val => typeof val === 'function'
const isObject = val => val && typeof val === 'object'
const mergeArrayWithDedupe = (a, b) => Array.from([...a, ...b])
//prune 裁减; 削减; 精简; 把对象中为空的字段删除
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
      .filter(({ id }) => id !== `@vue/cli-service`)
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
    this.generator.fileMiddlewares.push(middleware)
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
      `Require global @sf-vue/cli "${range}", but was invoked by "${this.cliVersion}".`
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
      '@sf-vue/cli-service/package.json',
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

  /**
   * 配置如何提取配置文件
   *
   * @param {string} key - package.json 中 配置的key
   * @param {object} options - Options
   * @param {object} options.file - File descriptor
   * Used to search for existing file.
   * Each key is a file type (possible values: ['js', 'json', 'yaml', 'lines']).
   * The value is a list of filenames.
   * Example:
   * {
   *   js: ['.eslintrc.js'],
   *   json: ['.eslintrc.json', '.eslintrc']
   * }
   * By default, the first filename will be used to create the config file.
   */
  addConfigTransform (key, options) {
    const hasReserved = Object.keys(this.generator.reservedConfigTransforms).includes(key)
    if (
      hasReserved ||
      !options ||
      !options.file
    ) {
      if (hasReserved) {
        const { warn } = require('@sf-vue/cli-shared-utils')
        warn(`Reserved config transform '${key}'`)
      }
      return
    }

    this.generator.configTransforms[key] = new ConfigTransform(options)
  }
  
  /**
   * 扩展项目中的 package.json
   * 处理依赖的版本冲突 
   * Tool configuration fields may be extracted into standalone files before
   * files are written to disk.
   *
   * @param {object | () => object} fields - Fields to merge.
   * @param {object} [options] - Options for extending / merging fields.
   * @param {boolean} [options.prune=false] - 移出null 或 undefined 的 字段
   *    from the object after merging.
   * @param {boolean} [options.merge=true] deep-merge nested fields, note
   *    that dependency fields are always deep merged regardless of this option.
   * @param {boolean} [options.warnIncompatibleVersions=true] Output warning
   *    if two dependency version ranges don't intersect.
   */
  extendPackage (fields, options = {}) {
    const extendOptions = {
      prune: false,
      merge: true,
      warnIncompatibleVersions: true
    }

    // this condition statement is added for compatibility reason, because
    // in version 4.0.0 to 4.1.2, there's no `options` object, but a `forceNewVersion` flag
    if (typeof options === 'boolean') {
      extendOptions.warnIncompatibleVersions = !options
    } else {
      Object.assign(extendOptions, options)
    }

    const pkg = this.generator.pkg
    const toMerge = isFunction(fields) ? fields(pkg) : fields
    for (const key in toMerge) {
      const value = toMerge[key]
      const existing = pkg[key]
      if (isObject(value) && (key === 'dependencies' || key === 'devDependencies')) {
        // use special version resolution merge
        pkg[key] = mergeDeps(
          this.id,
          existing || {},
          value,
          this.generator.depSources,
          extendOptions
        )
      } else if (!extendOptions.merge || !(key in pkg)) {
        pkg[key] = value
      } else if (Array.isArray(value) && Array.isArray(existing)) {
        pkg[key] = mergeArrayWithDedupe(existing, value)
      } else if (isObject(value) && isObject(existing)) {
        pkg[key] = deepmerge(existing, value, { arrayMerge: mergeArrayWithDedupe })
      } else {
        pkg[key] = value
      }
    }

    if (extendOptions.prune) {
      pruneObject(pkg)
    }
  }


  /**
   * Render template files into the virtual files tree object.
   *
   * @param {string | object | FileMiddleware} source -
   *   Can be one of:
   *   - relative path to a directory;
   *   - Object hash of { sourceTemplate: targetFile } mappings;
   *   - a custom file middleware function.
   * @param {object} [additionalData] - additional data available to templates.
   * @param {object} [ejsOptions] - options for ejs.
   */
  render (source, additionalData = {}, ejsOptions = {}) {
    const baseDir = extractCallDir()
    if (isString(source)) {
      source = path.resolve(baseDir, source)
      this._injectFileMiddleware(async (files) => {
        const data = this._resolveData(additionalData)
        const globby = require('globby')
        const _files = await globby(['**/*'], { cwd: source })
        for (const rawPath of _files) {
          const targetPath = rawPath.split('/').map(filename => {
            // dotfiles are ignored when published to npm, therefore in templates
            // we need to use underscore instead (e.g. "_gitignore")
            if (filename.charAt(0) === '_' && filename.charAt(1) !== '_') {
              return `.${filename.slice(1)}`
            }
            if (filename.charAt(0) === '_' && filename.charAt(1) === '_') {
              return `${filename.slice(1)}`
            }
            return filename
          }).join('/')
          const sourcePath = path.resolve(source, rawPath)
          const content = renderFile(sourcePath, data, ejsOptions)
          // only set file if it's not all whitespace, or is a Buffer (binary files)
          if (Buffer.isBuffer(content) || /[^\s]/.test(content)) {
            files[targetPath] = content
          }
        }
      })
    } else if (isObject(source)) {
      this._injectFileMiddleware(files => {
        const data = this._resolveData(additionalData)
        for (const targetPath in source) {
          const sourcePath = path.resolve(baseDir, source[targetPath])
          const content = renderFile(sourcePath, data, ejsOptions)
          if (Buffer.isBuffer(content) || content.trim()) {
            files[targetPath] = content
          }
        }
      })
    } else if (isFunction(source)) {
      this._injectFileMiddleware(source)
    }
  }

  /**
   * Push a file middleware that will be applied after all normal file
   * middelwares have been applied.
   *
   * @param {FileMiddleware} cb
   */
  postProcessFiles (cb) {
    this.generator.postProcessFilesCbs.push(cb)
  }

  /**
   * Push a callback to be called when the files have been written to disk.
   *
   * @param {function} cb
   */
  onCreateComplete (cb) {
    this.afterInvoke(cb)
  }

  afterInvoke (cb) {
    this.generator.afterInvokeCbs.push(cb)
  }

  /**
   * Push a callback to be called when the files have been written to disk
   * from non invoked plugins
   *
   * @param {function} cb
   */
  afterAnyInvoke (cb) {
    this.generator.afterAnyInvokeCbs.push(cb)
  }

  /**
   * Add a message to be printed when the generator exits (after any other standard messages).
   *
   * @param {} msg String or value to print after the generation is completed
   * @param {('log'|'info'|'done'|'warn'|'error')} [type='log'] Type of message
   */
  exitLog (msg, type = 'log') {
    this.generator.exitLogs.push({ id: this.id, msg, type })
  }

  /**
   * convenience method for generating a js config file from json
   */
  genJSConfig (value) {
    return `module.exports = ${stringifyJS(value, null, 2)}`
  }

  /**
   * Turns a string expression into executable JS for JS configs.
   * @param {*} str 字符串js表达式
   */
  makeJSOnlyValue (str) {
    const fn = () => {}
    fn.__expression = str
    return fn
  }

  /**
   * Run codemod on a script file or the script part of a .vue file
   * @param {string} file the path to the file to transform
   * @param {Codemod} codemod the codemod module to run
   * @param {object} options additional options for the codemod
   */
  transformScript (file, codemod, options) {
    const normalizedPath = this._normalizePath(file)

    this._injectFileMiddleware(files => {
      if (typeof files[normalizedPath] === 'undefined') {
        error(`Cannot find file ${normalizedPath}`)
        return
      }

      files[normalizedPath] = runTransformation(
        {
          path: this.resolve(normalizedPath),
          source: files[normalizedPath]
        },
        codemod,
        options
      )
    })
  }

  /**
   * Add import statements to a file.
   * 增加import 声明
   */
  injectImports (file, imports) {
    const _imports = (
      this.generator.imports[file] ||
      (this.generator.imports[file] = new Set())
    )
    ;(Array.isArray(imports) ? imports : [imports]).forEach(imp => {
      _imports.add(imp)
    })
  }

  /**
   * Add options to the root Vue instance (detected by `new Vue`).
   */
  injectRootOptions (file, options) {
    const _options = (
      this.generator.rootOptions[file] ||
      (this.generator.rootOptions[file] = new Set())
    )
    ;(Array.isArray(options) ? options : [options]).forEach(opt => {
      _options.add(opt)
    })
  }

  /**
   * Get the entry file taking into account typescript.
   *  获取入口文件
   * @readonly
   */
  get entryFile () {
    if (this._entryFile) return this._entryFile
    return (this._entryFile = fs.existsSync(this.resolve('src/main.ts')) ? 'src/main.ts' : 'src/main.js')
  }

  /**
   * Is the plugin being invoked?
   *
   * @readonly
   */
  get invoking () {
    return this.generator.invoking
  }
}

function extractCallDir () {
  // extract api.render() callsite file location using error stack
  // 在 targetObject 上创建一个 .stack 属性，
  // 当访问时返回一个表示代码中调用 Error.captureStackTrace() 的位置的字符串
  const obj = {}
  Error.captureStackTrace(obj)
  const callSite = obj.stack.split('\n')[3]

  // the regexp for the stack when called inside a named function
  const namedStackRegExp = /\s\((.*):\d+:\d+\)$/
  // the regexp for the stack when called inside an anonymous
  const anonymousStackRegExp = /at (.*):\d+:\d+$/

  let matchResult = callSite.match(namedStackRegExp)
  if (!matchResult) {
    matchResult = callSite.match(anonymousStackRegExp)
  }

  const fileName = matchResult[1]
  return path.dirname(fileName)
}

const replaceBlockRE = /<%# REPLACE %>([^]*?)<%# END_REPLACE %>/g

function renderFile (name, data, ejsOptions) {
  if (isBinaryFileSync(name)) {
    return fs.readFileSync(name) // return buffer
  }
  const template = fs.readFileSync(name, 'utf-8')

  // custom template inheritance via yaml front matter.
  // ---
  // extend: 'source-file'
  // replace: !!js/regexp /some-regex/
  // OR
  // replace:
  //   - !!js/regexp /foo/
  //   - !!js/regexp /bar/
  // ---
  const yaml = require('yaml-front-matter')
  const parsed = yaml.loadFront(template)
  const content = parsed.__content
  let finalTemplate = content.trim() + `\n`

  if (parsed.when) {
    finalTemplate = (
      `<%_ if (${parsed.when}) { _%>` +
        finalTemplate +
      `<%_ } _%>`
    )

    // use ejs.render to test the conditional expression
    // if evaluated to falsy value, return early to avoid extra cost for extend expression
    const result = ejs.render(finalTemplate, data, ejsOptions)
    if (!result) {
      return ''
    }
  }

  if (parsed.extend) {
    const extendPath = path.isAbsolute(parsed.extend)
      ? parsed.extend
      : resolve.sync(parsed.extend, { basedir: path.dirname(name) })
    finalTemplate = fs.readFileSync(extendPath, 'utf-8')
    if (parsed.replace) {
      if (Array.isArray(parsed.replace)) {
        const replaceMatch = content.match(replaceBlockRE)
        if (replaceMatch) {
          const replaces = replaceMatch.map(m => {
            return m.replace(replaceBlockRE, '$1').trim()
          })
          parsed.replace.forEach((r, i) => {
            finalTemplate = finalTemplate.replace(r, replaces[i])
          })
        }
      } else {
        finalTemplate = finalTemplate.replace(parsed.replace, content.trim())
      }
    }
  }

  return ejs.render(finalTemplate, data, ejsOptions)
}

module.exports = GeneratorAPI