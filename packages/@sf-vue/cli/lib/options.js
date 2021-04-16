const fs =require('fs')
const cloneDeep = require('lodash.clonedeep')
//获取.vuerc文件路径  .vuerc保存预设配置
const { getRcPath } = require('./util/rcPath')
require('module-alias/register')
const { exit, error, createSchema, validate } = require('@sf-vue/cli-shared-utils')

const rcPath = exports.rcPath = getRcPath('.vuerc')

//createSchema fn => fn(requrie('@hapi/joi'))  设置preset的验证格式
const presetSchema = createSchema(joi => joi.object().keys({
  vueVersion: joi.string().only(['2', '3']),
  bare: joi.boolean(),
  useConfigFiles: joi.boolean(),
  router: joi.boolean(),
  vuex: joi.boolean(),
  cssPreprocessor: joi.string().only(['sass', 'dart-sass', 'node-sass', 'less', 'stylus']),
  plugins: joi.object().required(),
  configs: joi.object()
}))

const schema = createSchema(joi => joi.object().keys({
  latestVersion: joi.string().regex(/^\d+\.\d+\.\d+(-(alpha|beta|rc)\.\d+)?$/),
  lastChecked: joi.date().timestamp(),
  packageManager: joi.string().only(['yarn', 'npm', 'pnpm']),
  useTaobaoRegistry: joi.boolean(),
  presets: joi.object().pattern(/^/, presetSchema)
}))

exports.validatePreset = preset => validate(preset, presetSchema, msg => {
  error(`invalid preset options: ${msg}`)
})

//默认预设
exports.defaultPreset = {
  useConfigFiles: false,
  cssPreprocessor: void 0,
  plugins: {
    '@vue/cli-plugin-babel': {},
    '@vue/cli-plugin-eslint': {
      config: 'base',
      lintOn: ['save']
    }
  }
}

exports.defaults = {
  lastChecked: void 0,
  latestVersion: void 0,

  packageManager: void 0,
  useTaobaoRegistry: void 0,
  presets: {
    'default': Object.assign({ vueVersion: '2' }, exports.defaultPreset),
    '__default_vue_3__': Object.assign({ vueVersion: '3' }, exports.defaultPreset)
  }
}


let cachedOptions

//返回.vuerc中的预设
exports.loadOptions = () => {
  if (cachedOptions) {
    return cachedOptions
  }
  
  if (fs.existsSync(rcPath)) {
    try {
      cachedOptions = JSON.parse(fs.readFileSync(rcPath, 'utf-8'))
    } catch (e) {
      error(
        `Error loading saved preferences: ` +
        `~/.vuerc may be corrupted or have syntax errors. ` +
        `Please fix/delete it and re-run vue-cli in manual mode.\n` +
        `(${e.message})`
      )
      exit(1)
    }
    //检验预设文件内的格式
    validate(cachedOptions, schema, () => {
      error(
        `~/.vuerc may be outdated. ` +
        `Please delete it and re-run vue-cli in manual mode.`
      )
    })
    return cachedOptions
  } else {
    return {}
  }
}

exports.saveOptions = toSave => {
  const options = Object.assign(cloneDeep(exports.loadOptions()), toSave)
  for (const key in options) {
    //删除不在defaults中的字段
    if (!(key in exports.defaults)) {
      delete options[key]
    }
  }
  cachedOptions = options
}

//保存预设
exports.savePreset = (name, preset) => {
  const presets = cloneDeep(exports.loadOptions().presets || {})
  presets[name] = preset
  return exports.saveOptions({ presets })
}