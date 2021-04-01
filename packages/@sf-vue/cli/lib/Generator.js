//模板引擎
const ejs = require('ejs')
const debug = require('debug')
const GeneratorAPI = require('./GeneratorAPI')
const PackageManager = require('./util/ProjectPackageManager');
// 排列object的key的顺序
const sortObject = require('./util/sortObject')
//找到previousFiles中 newFiles里面没有的文件 删除，并把newFiles内文件写入 dir目录
const writeFileTree = require('./util/writeFileTree')

const inferRootOptions = require('./util/inferRootOptions')
const normalizeFilePaths = require('./util/normalizeFilePaths')