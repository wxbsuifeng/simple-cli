require('module-alias/register');
const { semver } = require('@sf-vue/cli-shared-utils')
const PackageManager = require('./ProjectPackageManager')
//读取 保存项目设置
const { loadOptions, saveOptions } = require('../options')

let sessionCached
const pm = new PackageManager()

module.exports = async function getVersions () {
  if (sessionCached) {
    return sessionCached
  }

  let latest
  const local = require(`@root/package.json`).version
  if (process.env.VUE_CLI_TEST || process.env.VUE_CLI_DEBUG) {
    return (sessionCached = {
      current: local,
      latest: local,
      latestMinor: local
    })
  }

  const includePrerelease = !!semver.prerelease(local)

  const { latestVersion = local, lastChecked = 0 } = loadOptions()
  const cached = latestVersion
  const daysPassed = (Date.now() - lastChecked) / (60 * 60 * 1000 * 24)

  let error
  if (daysPassed > 1) {
    try {
      latest = await getAndCacheLatestVersion(cached, includePrerelease)
    } catch (e) {
      latest = cached
      error = e
    }
  } else {
    getAndCacheLatestVersion(cached, includePrerelease).catch(() => {})
    latest = cached
  }

  if (semver.gt(local, latest) && !semver.prerelease(local)) {
    latest = local
  }

  let latestMinor = `${semver.major(latest)}.${semver.minor(latest)}.0`
  if (
    /major/.test(semver.diff(local, latest)) ||
    (semver.gte(local, latest) && semver.prerelease(local))
  ) {
    latestMinor = local
  }

  return (sessionCached = {
    current: local,
    latest,
    latestMinor,
    error
  })
}


async function getAndCacheLatestVersion (cached, includePrerelease) {
  let version = await pm.getRemoteVersion('vue-cli-version-marker', 'latest')

  if (includePrerelease) {
    const next = await pm.getRemoteVersion('vue-cli-version-marker', 'next')
    version = semver.gt(next, version) ? next : version
  }

  if (semver.valid(version) && version !== cached) {
    saveOptions({ latestVersion: version, latestVersion: Date.now() })
    return version
  }
  return cached
}