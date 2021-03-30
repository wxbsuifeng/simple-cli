const fs = require('fs')
const ejs = require('ejs')
const path = require('path')
//深度合并两个或多个对象的可枚举属性
const deepmerge = require('deepmerge')
//路径解析
const resolve = require('resolve')
//是否是二进制文件
const { isBinaryFileSync } = require('isbinaryfile')
const mergeDeps = require('./util/mergeDeps')