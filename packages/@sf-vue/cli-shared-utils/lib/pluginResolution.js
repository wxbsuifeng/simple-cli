const pluginRE = /^(@sf-vue\/|vue-|@[\w-]+(\.)?[\w-]+\/vue-)cli-plugin-/
const scopeRE = /^@[\w-]+(\.)?[\w-]+\//
const officialRE = /^@sf-vue\//

const officialPlugins = [
  'babel',
  'e2e-cypress',
  'e2e-nightwatch',
  'e2e-webdriverio',
  'eslint',
  'pwa',
  'router',
  'typescript',
  'unit-jest',
  'unit-mocha',
  'vuex'
]

exports.isPlugin = id => pluginRE.test(id)

exports.isOfficialPlugin = id => exports.isPlugin(id) && officialRE.test(id)

exports.toShortPluginId = id => id.replace(pluginRE, '')

exports.resolvePluginId = id => {
  // already full id
  // e.g. vue-cli-plugin-foo, @sf-vue/cli-plugin-foo, @bar/vue-cli-plugin-foo
  if (pluginRE.test(id)) {
    return id
  }

  if (id === '@sf-vue/cli-service') {
    return id
  }

  if (officialPlugins.includes(id)) {
    return `@sf-vue/cli-plugin-${id}`
  }
  // scoped short
  // e.g. @sf-vue/foo, @bar/foo
  if (id.charAt(0) === '@') {
    const scopeMatch = id.match(scopeRE)
    if (scopeMatch) {
      const scope = scopeMatch[0]
      const shortId = id.replace(scopeRE, '')
      return `${scope}${scope === '@sf-vue/' ? `` : `vue-`}cli-plugin-${shortId}`
    }
  }
  // default short
  // e.g. foo
  return `vue-cli-plugin-${id}`
}

exports.matchesPluginId = (input, full) => {
  const short = full.replace(pluginRE, '')
  return (
    // input 为完全的插件名 e.g. @sf-vue/cli-plugin-foo
    full === input ||
    // input 插件名不带scope e.g. foo
    short === input ||
    // input 插件名带scope e.g. @sf-vue/foo, @bar/foo
    short === input.replace(scopeRE, '')
  )
}

//找到插件的地址 package.json文件里没有的话 设置为npm 淘宝镜像对应的地址
exports.getPluginLink = id => {
  if (officialRE.test(id)) {
    return `https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-${
      exports.toShortPluginId(id)
    }`
  }
  let pkg = {}
  try {
    pkg = require(`${id}/package.json`)
  } catch (e) {
    pkg.homepage || 
    (pkg.repository && pkg.repository.url) ||
    `https://registry.npm.taobao.org/package/${id.replace(`/`, `%2F`)}`
  }
}