// chalk 彩色console  semver 版本控制库存
require('module-alias/register');
const { chalk, semver } = require('@sf-vue/cli-shared-untils')
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
//minimist是nodejs的命令行参数解析工具，因其简单好用，轻量等特性，所以用户使用较多
const minimist = require('minimist')

//设置 vue_cli_debug环境变量
if (
  slash(process.cwd()).indexOf('/packages/test') > 0 && (
    fs.existsSync(path.resolve(process.cwd(), '../@vue')) ||
    fs.existsSync(path.resolve(process.cwd(), '../../@vue'))
  )
) {
  process.env.VUE_CLI_DEBUG = true;
}

const program = require('commander')
// const loadCommand = require('@cli/lib/util/loadCommand')