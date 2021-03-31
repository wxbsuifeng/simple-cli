#!/usr/bin/env node

// chalk 彩色console  semver 版本控制库存
require('module-alias/register');
const { chalk, semver } = require('@sf-vue/cli-shared-utils')
//node 版本
const requiredVersion = require('@root/package.json').engines.node
//测量两字符串之间的差异 最快的JS实现之一
const leven = require('leven')

//检查node 版本
function checkNodeVersion (wanted, id) {
  if(!semver.satisfies(process.version, wanted, { includePrerelease: true })) {
    console.log(chalk.red(
      'You are using Node ' + process.version + ', but this version of ' + id + 
      ' requrires Node ' + wanted + '.\nPlease upgrade your Node Version.'
    ))
    process.exit(1)
  }
}

checkNodeVersion(requiredVersion, '@sf-vue/cli')

const EOL_NODE_MAJORS = ['8.x', '9.x', '11.x', '13.x']
for(const marjor of EOL_NODE_MAJORS) {
  if(semver.satisfies(process.version, marjor)) {
    console.log(chalk.red(
      `You are using Node ${process.version}.\n` +
      `Node.js ${major} has already reached end-of-life and will not be supported in future major releases.\n` +
      `It's strongly recommended to use an active LTS version instead.`
    ))
  }
}

const fs = require('fs')
const path = require('path')
//用于转换 Windows 反斜杠路径转换为正斜杠路径 \ => /
const slash = require('slash')
//minimist是nodejs的命令行参数解析工具
const minimist = require('minimist')

//设置 vue_cli_debug环境变量
if (
  slash(process.cwd()).indexOf('/packages/test') > 0 && (
    fs.existsSync(path.resolve(process.cwd(), '../@sf-vue')) ||
    fs.existsSync(path.resolve(process.cwd(), '../../@sf-vue'))
  )
) {
  process.env.VUE_CLI_DEBUG = true;
}

const program = require('commander')
const loadCommand = require('@cli/lib/util/loadCommand')

program
  .version(`@sf-vue/cli ${require('@root/package').version}`)
  .usage('<command> [options]')
program
  .command('create <app-name>')
  .description('create a new project powered by vue-cli-service')   //
  .option('-p, --preset <presetName>', 'Skip prompts and use saved or remote preset')  //忽略提示符并使用已保存的或远程的预设选项
  .option('-d, --default', 'Skip prompts and use default preset') // 忽略提示符并使用默认预设选项
  .option('-i, --inlinePreset <json>', 'Skip prompts and use inline JSON string as preset')  //忽略提示符并使用内联的 JSON 字符串预设选项
  .option('-m, --packageManager <command>', 'Use specified npm client when installing dependencies') //在安装依赖时使用指定的 npm 客户端
  .option('-r, --registry <url>', 'Use specified npm registry when installing dependencies (only for npm)') //在安装依赖时使用指定的 npm registry
  .option('-g, --git [message]', 'Force git initialization with initial commit message') //强制 / 跳过 git 初始化，并可选的指定初始化提交信息
  .option('-n, --no-git', 'Skip git initialization') //跳过 git 初始化
  .option('-f, --force', 'Overwrite target directory if it exists') //覆写目标目录可能存在的配置
  .option('--merge', 'Merge target directory if it exists')
  .option('-c, --clone', 'Use git clone when fetching remote preset') //使用 git clone 获取远程预设选项
  .option('-x, --proxy <proxyUrl>', 'Use specified proxy when creating project') //使用指定的代理创建项目
  .option('-b, --bare', 'Scaffold project without beginner instructions') // 创建项目时省略默认组件中的新手指导信息
  .option('--skipGetStarted', 'Skip displaying "Get started" instructions') //输出使用帮助信息
  .action((name, cmd) => {
    //处理参数
    const options = cleanArgs(cmd)
    if (minimist(process.argv.slice(3))._.length > 1) {
      console.log(chalk.yellow('\n Info: You provided more than one argument. The first one will be used as the app\'s name, the rest are ignored.'))
    }
    // --git makes commander to default git to true
    if (process.argv.includes('-g') || process.argv.includes('--git')) {
      options.forceGit = true
    }
    require('../lib/create')(name, options)  //将项目名称 和 options选项传入 create函数
  })

program
  .command('info')
  .description('print debugging information about your environment')
  .action((cmd) => {
    console.log(chalk.bold('\nEnvironment Info:'))
    require('envinfo').run(
      {
        System: ['OS', 'CPU'],
        Binaries: ['Node', 'Yarn', 'npm'],
        Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
        npmPackages: '/**/{typescript,*vue*,@vue/*/}',
        npmGlobalPackages: ['@vue/cli']
      },
      {
        showNotFound: true,
        duplicates: true,
        fullTree: true
      }
    ).then(console.log)
  })

// output help information on unknown commands
program
  .arguments('<command>')
  .action((cmd) => {
    program.outputHelp()
    console.log(`  ` + chalk.red(`Unknown command ${chalk.yellow(cmd)}.`))
    console.log()
    suggestCommands(cmd)
  })

// add some useful info on help
program.on('--help', () => {
  console.log()
  console.log(`  Run ${chalk.cyan(`sf-vue <command> --help`)} for detailed usage of given command.`)
  console.log()
})

program.commands.forEach(c => c.on('--help', () => console.log()))

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

function suggestCommands (unknownCommand) {
  const availableCommands = program.commands.map(cmd => cmd._name)

  let suggestion

  availableCommands.forEach(cmd => {
    const isBestMatch = leven(cmd, unknownCommand) < leven(suggestion || '', unknownCommand)
    if (leven(cmd, unknownCommand) < 3 && isBestMatch) {
      suggestion = cmd
    }
  })

  if (suggestion) {
    console.log(`  ` + chalk.red(`Did you mean ${chalk.yellow(suggestion)}?`))
  }
}

function camelize (str) {
  return str.replace(/-(\w)/g, (_, c) => c ? c.toUpperCase() : '')
}

function cleanArgs (cmd) {
  const args = {}
  cmd.options.forEach(o => {
    const key = camelize(o.long.replace(/^--/, ''))
    // if an option is not present and Command has a method with the same name
    // it should not be copied
    if (typeof cmd[key] !== 'function' && typeof cmd[key] !== 'undefined') {
      args[key] = cmd[key]
    }
  })
  return args
}