const fs =require('fs')
const cloneDeep = require('lodash.clonedeep')
//获取.vuerc文件路径  .vuerc保存预设配置
const { getRcPath } = require('./util/rcPath')
require('module-alias/register')
const { exit, error, createSchema, validate } = require('@sf-vue/cli-shared-utils')