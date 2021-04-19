require('module-alias/register');
//模板引擎
const ejs = require('ejs')
const debug = require('debug')
const GeneratorAPI = require('./GeneratorAPI')
const PackageManager = require('./util/ProjectPackageManager');
// 排列object的key的顺序
const sortObject = require('./util/sortObject')
//第三个参数可选， 传了对比新旧文件内容进行 删除，不传直接写入context
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

const defaultConfigTransforms = {
  babel: new ConfigTransform({
    file: {
      js: ['babel.config.js']
    }
  }),
  postcss: new ConfigTransform({
    file: {
      js: ['postcss.config.js'],
      json: ['.postcssrc.json', '.postcssrc'],
      yaml: ['.postcssrc.yaml', '.postcssrc.yml']
    }
  }),
  eslintConfig: new ConfigTransform({
    file: {
      js: ['.eslintrc.js'],
      json: ['.eslintrc', '.eslintrc.json'],
      yaml: ['.eslintrc.yaml', '.eslintrc.yml']
    }
  }),
  jest: new ConfigTransform({
    file: {
      js: ['jest.config.js']
    }
  }),
  browserslist: new ConfigTransform({
    file: {
      lines: ['.browserslistrc']
    }
  })
}

const reservedConfigTransforms = {
  vue: new ConfigTransform({
    file: {
      js: ['vue.config.js']
    }
  })
}

const ensureEOL = str => {
  if (str.charAt(str.length - 1) !== '\n') {
    return str + '\n'
  }
  return str
}

module.exports = class Generator {
  constructor (context, {
    pkg = {},
    plugins = [],
    afterInvokeCbs = [],
    afterAnyInvokeCbs = [],
    files = {},
    invoking = false
  } = {}) {
    this.context = context
    this.plugins = plugins
    this.orginalPkg = pkg
    this.pkg = Object.assign({}, pkg)
    this.pm = new PackageManager({ context })
    this.imports = {}
    this.inferRootOptions = {}
    this.passedAfterInvokeCbs = afterInvokeCbs
    this.afterInvokeCbs = []
    this.afterAnyInvokeCbs = afterAnyInvokeCbs
    this.ConfigTransform = {}
    this.defaultConfigTransforms = defaultConfigTransforms
    this.reservedConfigTransforms = reservedConfigTransforms
    this.invoking = invoking
    this.depSources = {}
    this.files = files
    this.fileMiddleWares = []
    this.postProcessFilesCbs = []
    this.exitLogs = []

    this.allPluginIds = Object.keys(this.pkg.dependencies || {})
      .concat(Object.keys(this.pkg.devDependencies || {}))
      .filter(isPlugin)
    
      const cliService = plugins.find(p => p.id === '@vue/cli-service')
      const rootOptions = cliService
        ? cliService.options
        : inferRootOptions(pkg)
      
        this.rootOptions = rootOptions
  }

  async initPlugins () {
    const { rootOptions, invoking } = this
    const pluginIds = this.plugins.map(p => p.id)

    for (const id of this.allPluginIds) {
      const api = new GeneratorAPI(id, this, {}, rootOptions)
      const pluginGenerator = loadModule(`${id}/generator`, this.context)
      if (pluginGenerator && pluginGenerator.hooks) {
        await pluginGenerator.hooks(api, {}, rootOptions, pluginIds)
      }
    }

    
    const afterAnyInvokeCbsFromPlugins = this.afterAnyInvokeCbs

    this.afterInvokeCbs = this.passedAfterInvokeCbs
    this.afterAnyInvokeCbs = []
    this.postProcessFilesCbs = []

    for (const plugin of this.plugins) {
      const { id, apply, options } = plugin
      const api = new GeneratorAPI(id, this, options, rootOptions)
      await apply(api, options, rootOptions, invoking)

      if (apply.hooks) {
        await apply.hooks(api, options, rootOptions, pluginIds)
      }

      this.afterAnyInvokeCbs = afterAnyInvokeCbsFromPlugins
    }
  }

  async generate ({
    extractConfigFiles = false,
    checkExisting = false
  } = {}) {
    await this.initPlugins()

    const initialFiles = Object.assign({}, this.files)
    this.extractConfigFiles(extractConfigFiles, checkExisting)
    await this.resolveFiles()
    this.sortPkg()
    this.files['package.json'] = JSON.stringify(this.pkg, null, 2) + '\n'
    await writeFileTree(this.context, this.files, initialFiles)
  }

  extractConfigFiles (extractAll, checkExisting) {
    const configTransforms = Object.assign({},
      defaultConfigTransforms,
      this.configTransforms,
      reservedConfigTransforms
    )
    const extract = key => {
      if (
        configTransforms[key] &&
        this.pkg[key] &&
        !this.orginalPkg[key]
      ) {
        const value = this.pkg[key]
        const configTransform = configTransforms[key]
        const res = configTransform.transform(
          value,
          checkExisting,
          this.files,
          this.context
        )
        const { content, filename } =res
        this.files[filename] = ensureEOL(content)
        delete this.pkg[key]
      }
    }

    if (extractAll) {
      for (const key in this.pkg) {
        extract(key)
      }
    } else {
      if (!process.env.VUE_CLI_TEST) {
        extract('vue')
      }

      extract('babel')
    }
  }

  sortPkg () {
    // 保证package.json key的顺序行  keys.sort()
    this.pkg.dependencies = sortObject(this.pkg.dependencies)
    this.pkg.devDependencies = sortObject(this.pkg.devDependencies)
    this.pkg.scripts = sortObject(this.pkg.scripts, [
      'serve',
      'build',
      'test:unit',
      'test:e2e',
      'lint',
      'deploy'
    ])
    this.pkg = sortObject(this.pkg, [
      'name',
      'version',
      'private',
      'description',
      'author',
      'scripts',
      'main',
      'module',
      'browser',
      'jsDelivr',
      'unpkg',
      'files',
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'vue',
      'babel',
      'eslintConfig',
      'prettier',
      'postcss',
      'browserslist',
      'jest'
    ])
    
    debug('vue:cli-pkg')(this.pkg)
  }

  async resolveFiles () {
    const files = this.files
    for (const middleware of this.fileMiddleWares) {
      //模板转成html
      await middleware(files, ejs.render)
    }

    // 所有路径中的 \ 被转化为 /
    normalizeFilePaths(files)

    // handle imports and root option injections
    Object.keys(files).forEach(file => {
      let imports = this.imports[file]
      imports = imports instanceof Set ? Array.from(imports) : imports
      if (imports && imports.length > 0) {
        files[file] = runTransformation(
          { path: file, source: files[file]},
          require('./util/codemods/injectImports'),
          { imports }
        )
      }

      let injections = this.rootOptions[files]
      injections = injections instanceof Set ? Array.from(injections) : injections
      if (injections && injections.length > 0) {
        files[file] = runTransformation(
          { path: file, source: files[file] },
          require('./util/codemods/injectOptions'),
          { injections }
        )
      }
    })

    for (const postProcess of this.postProcessFilesCbs) {
      await postProcess(files)
    }
    debug('vue:cli-files')(this.files)
  }

  hasPlugin (_id, _version) {
    return [
      ...this.plugins.map(p => p.id),
      ...this.allPluginIds
    ].some(id => {
      if (!matchesPluginId(_id, id)) {
        return false
      }

      if (!_version) {
        return true
      }

      const version = this.pm.getInstalledVersion(id)
      return semver.satisfies(version, _version)
    })
  }

  printExitLogs () {
    if (this.exitLogs.length) {
      this.exitLogs.forEach(({ id, msg, type }) => {
        const shortId = toShortPluginId(id)
        const logFn = logTypes[type]
        if (!logFn) {
          logger.error(`Invalid api.exitLog type '${type}'.`, shortId)
        } else {
          logFn(msg, msg && shortId)
        }
      })
      logger.log()
    }
  }
}
