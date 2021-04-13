//fs-extra fs扩展模块
require('module-alias/register');
const fs = require('fs-extra')
const path = require('path')

//命令行交互
const inquirer = require('inquirer')
const Creator = require('./Creator')
const { clearConsole } = require('./util/clearConsole')
//插件、依赖模块 的信息： injectPrompt交互， 包名 跟 link
const { getPromptModules } = require('./util/createTools')
const { chalk, error, stopSpinner, exit } = require('@sf-vue/cli-shared-utils')
const validateProjectName = require('validate-npm-package-name') //验证包名是否符合规范


async function create (projectName, options) {
  if (options.proxy) {
    //options.proxy 项目中请求的代理URL
    process.env.HTTP_PROXY = options.proxy
  }

  const cwd = options.cwd || process.cwd()  //规定的目录 或者 当前运行的目录
  const inCurrent = projectName === '.'
  const name = inCurrent ? path.relative('../', cwd) : projectName
  const targetDir = path.resolve(cwd, projectName || '.')

  //验证项目名字是否有效
  const result = validateProjectName(name)
  if (!result.validForNewPackages) {
    console.error(chalk.red(`Invalid project name: "${name}"`))
    result.errors && result.errors.forEach(err => {
      console.error(chalk.red.dim('Error: ' + err)) //dim？？
    })
    result.warnings && result.warnings.forEach(warn => {
      console.error(chalk.red.dim('Warning: ' + warn))
    })
    exit(1)
  }

  //使用inquirer进行命令行交互 —— 覆盖 合并 取消创建项目
  if (fs.existsSync(targetDir) && !options.merge) {
    if (options.force) {
      await fs.remove(targetDir)
    } else {
      await clearConsole()
      if (inCurrent) {
        const { ok } = await inquirer.prompt([
          {
            name: 'ok',
            type: 'confirm',
            message: `Generate project in current directory?`
          }
        ])
        if (!ok) {
          return
        }
      } else {
        const { action } = await inquirer.prompt([
          {
            name: 'action',
            type: 'list',
            message: `Target directory ${chalk.cyan(targetDir)} already exists. Pick an action:`,
            choices: [
              { name: 'Overwrite', value: 'overwrite' },
              { name: 'Merge', value: 'merge' },
              { name: 'Cancel', value: false }
            ]
          }
        ])
        if (!action) {
          return
        } else if (action === 'overwrite') {
          console.log(`\nRemoving ${chalk.cyan(targetDir)}...`)
          await fs.remove(targetDir)
        }
      }
    }
  }

  //getPromptModules  注入特性、注入提示、和用户选择回调
  const creator = new Creator(name, targetDir, getPromptModules())
  await creator.create(options)
}

module.exports = (...args) => {
  return create(...args).catch(err => {
    stopSpinner(false) // do not persist
    error(err)
    if (!process.env.VUE_CLI_TEST) {
      process.exit(1)
    }
  })
}
