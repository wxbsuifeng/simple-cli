//fs-extra fs扩展模块
const fs = require('fs-extra')
const path = require('path')

//命令行交互
const inquirer = require('inquirer')
const Creator = require('./Creator')

async function create (projectName, options) {
  console.log(projectName, options);
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
