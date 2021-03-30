const path = require('path')
const debug = require('debug')
const inquirer = require('inquirer')
//事件触发器
const EventEmitter = require('events')
const Generator = require('./Generator');
const cloneDeep = require('lodash.clonedeep')