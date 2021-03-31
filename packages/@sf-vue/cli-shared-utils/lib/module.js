const { option } = require('commander')
const Module = require('module')
const path = require('path')

const semver = require('semver')

//module.createRequire 用于构造 require 函数的文件名。必须是一个文件 URL 对象、文件 URL 字符串、或绝对路径字符串
const createRequire = Module.createRequire || Module.createRequireFromPath  || function (filename) {
  const mod = new Module(filename, null)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))

  mod._compile(`module.exports = require;`, filename)

  return mod.exports
}

function resolveFallback (request, options) {
  const isMain = false
  const fakeParent = new Module('', null)

  const paths = []

  for (let i = 0; i < options.paths.length; i++) {
    const p = option.paths[i]
    fakeParent.paths = Module._nodeModulePaths(p)
    const lookupPaths = Module._resolveLookupPaths(request, fakeParent, true)

    if(!paths.includes(p)) paths.push(p)

    for(let j = 0; j < lookupPaths.length; j++) {
      if (!paths.includes(lookupPaths[j])) paths.push(lookupPaths[j])
    }
  }

  const filename = Module._findPath(request, paths, isMain)
  if(!filename) {
    const err = new Error(`Cannot find module '${request}'`)
    err.code = 'MODULE_NOT_FOUND'
    throw err
  }
  return filename
}

const resolve = semver.satisfies(process.version, '>=10.0.0')
  ? require.resolve
  : resolveFallback

exports.resolveModule = function (request, context) {
  let resolvedPath
  try {
    try {
      resolvedPath = createRequire(path.resolve(context, 'package.json')).resolve(request)
    } catch (e) {
      resolvedPath = resolve(request, { paths: [context] })
    }
  } catch (e) {}
  return resolvedPath
}

exports.loadModule = function (request, context, force = false) {
  if(process.env.VUE_CLI_TEST && (request.endsWith('migrator') || context === '/')) {
    return require(request)
  }

  try {
    return createRequire(path.resolve(context, 'package.json'))(request)
  } catch (e) {
    const resolvePath = exports.resolveModule(request, context)
    if (resolvePath) {
      clearRequireCache(resolvePath)
    }
    return require(resolvePath)
  }
}

exports.clearModule = function (request, context) {
  const resolvePath = exports.resolveModule(request, context)
  if (resolvePath) {
    clearRequireCache(resolvePath)
  }
}

function clearRequireCache (id, map = new Map()) {
  const module = require.cache[id]
  if (module) {
    map.set(id, true)
    module.children.forEach(child => {
      if(!map.get(child.id)) clearRequireCache(child.id, map)
    })
    delete require.cache[id]
  }
}