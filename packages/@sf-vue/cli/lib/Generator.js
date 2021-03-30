//模板引擎
const ejs = require('ejs')
const debug = require('debug')
const GeneratorAPI = require('./GeneratorAPI')
const PackageManager = require('./util/ProjectPackageManager');
const sortObject = require('./util/sortObject')
const writeFileTree = require('./util/writeFileTree')
const inferRootOptions = require('./util/inferRootOptions')
const normalizeFilePaths = require('./util/normalizeFilePaths')