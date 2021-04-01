const extendJSConfig = require('./extendJSConfig')
const stringifyJS = require('./stringifyJS')
require('module-alias/register');
//加载模块
const { loadModule } = require('@sf-vue/cli-shared-utils')
const merge = require('deepmerge');
const { write } = require('fs-extra');

const mergeArrayWithDedupe = (a, b) => Array.from(new Set([...a, ...b]))
const mergeOptions = {
  arrayMerge: mergeArrayWithDedupe
}

const isObject = val => val && typeof val === 'object'

const transformJS = {
  read: ({ filename, context }) => {
    try {
      return loadModule(`./${filename}`, context, true)
    } catch (e) {
      return null
    }
  },
  write: ({ value, existing, source }) => {
    if (existing) {
      // We merge only the modified keys
      const changeData = {}
      Object.keys(value).forEach(key => {
        const originalValue = existing[key]
        const newValue = value[key]
        if(Array.isArray(originalValue) && Array.isArray(newValue)) {
          //合并两个数组 去除重复项
          changeData[key] = mergeArrayWithDedupe(originalValue, newValue)
        } else if (isObject(originalValue) && isObject (newValue)) {
          //合并对象
          changeData[key] = merge(originalValue, newValue)
        } else {
          changeData[key] = newValue
        }
      })
      return extendJSConfig(changeData, source)
    } else {
      return `module.exports = ${stringifyJS(value, null, 2)}`
    }
  }
}

const transformJSON = {
  read: ({ source }) => JSON.parse(source),
  write: ({ value, existing }) => {
    return JSON.stringify(merge(existing, value, mergeOptions), null, 2)
  }
}

const transformYAML = {
  read: ({ source }) => require('js-yaml').safeLoad(source),
  write: ({ value, existing }) => {
    return require('js-yaml').safeDump(merge(existing, value, mergeOptions), {
      skipInvalid: true
    })
  }
}

const transformLines = {
  read: ({ source }) => source.split('\n'),
  write: ({ value, existing }) => {
    if (existing) {
      value = existing.concat(value)
      // Dedupe
      value = value.filter((item, index) => value.indexOf(item) === index)
    }
    return value.join('\n')
  }
}

module.exports = {
  js: transformJS,
  json: transformJSON,
  yaml: transformYAML,
  lines: transformLines
}