const path = require('path')
const debug = require('debug')
const inquirer = require('inquirer')
//事件触发器
const EventEmitter = require('events')
const Generator = require('./Generator');
const cloneDeep = require('lodash.clonedeep')
//key值排序
const sortObject =require('./util/sortObject')
const getVersions = require('./util/getVersions')
const PackageManager = require('./util/ProjectPackageManager')
const { clearConsole } = require('./util/clearConsole')
const PromptModuleAPI = require('./PromptModuleAPI')
const writeFileTree = require('./util/writeFileTree')
const { formatFeatures } = require('./util/features')