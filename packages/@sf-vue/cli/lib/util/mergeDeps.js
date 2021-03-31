require('module-alias/register');
const { semver, warn } = require('@sf-vue/cli-shared-utils')

//比较两个版本范围 返回更大的版本
const tryGetNewerRange = require('./tryGetNewerRange')

const extractSemver = r => r.replace(/^.+#semver:/, '')
const injectSemver = (r, v) =>
  semver.validRange(r) ? v : r.replace(/#semver:.+$/, `#semver:${v}`)

const isValidRange = range => {
  if(typeof range !== 'string') {
    return false;
  }

  const isValidSemver = !!semver.validRange(range)
  const isValidGitHub = range.match(/^[^/]+\/[^/]+/) != null
  const isValidURI = 
    range.match(
      /^(?:file|git|git\+ssh|git\+http|git\+https|git\+file|https?):/
    ) != null
  
  return isValidSemver || isValidGitHub || isValidURI
}

module.exports = function mergeDeps (
  generatorId,
  sourceDeps,
  depsToInject,
  sources,
  {
    prune,
    warnIncompatibleVersions
  }
) {
  const result = Object.assign({}, sourceDeps)

  for (const depName in depsToInject) {
    const sourceRange = sourceDeps[depName]
    const injectingRange = depsToInject[depName]

    if(sourceRange === injectingRange) continue

    if(prune && injectingRange == null) {
      delete result[depName]
      continue
    }

    if(!isValidRange(injectingRange)) {
      warn(
        `invalid version range for dependency "${depName}":\n\n` +
          `- ${injectingRange} injected by generator "${generatorId}"`
      )
      continue
    }

    const sourceGeneratorId = sources[depName]
    if(!sourceRange) {
      result[depName] = injectingRange
      sources[depName] = generatorId
    } else {
      const sourceRangeSemver = extractSemver(sourceRange)
      const injectingRangeSemver = extractSemver(injectingRange)
      const r = tryGetNewerRange(sourceRangeSemver, injectingRangeSemver)
      const didGetNewer = !!r

      // 如果无法推断出较新的版本, 使用现有版本
      result[depName] = didGetNewer ? injectSemver(injectingRange, r) : sourceRange

      // if changed, update source
      if (result[depName] === injectingRange) {
        sources[depName] = generatorId
      }

      // warn incompatible version requirements
      if (
        warnIncompatibleVersions &&
        (!semver.validRange(sourceRangeSemver) ||
          !semver.validRange(injectingRangeSemver) ||
          !semver.intersects(sourceRangeSemver, injectingRangeSemver))
      ) {
        warn(
          `conflicting versions for project dependency "${depName}":\n\n` +
            `- ${sourceRange} injected by generator "${sourceGeneratorId}"\n` +
            `- ${injectingRange} injected by generator "${generatorId}"\n\n` +
            `Using ${didGetNewer ? `newer ` : ``}version (${
              result[depName]
            }), but this may cause build errors.`
        )
      }
    }
  }
}