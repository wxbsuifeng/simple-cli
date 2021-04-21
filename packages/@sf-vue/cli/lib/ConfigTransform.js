// module.exports = {
//   js: transformJS,
//   json: transformJSON,
//   yaml: transformYAML,
//   lines: transformLines
// }
const transforms = require('./util/ConfigTransforms')

// 为generator.files引入 babel字段并将文件内容写入
// file: {
//   js: ['.eslintrc.js'],
//   json: ['.eslintrc', '.eslintrc.json'],
//   yaml: ['.eslintrc.yaml', '.eslintrc.yml']
// }
// babel调用  
// file: {
//   js: ['babel.config.js']
// }
class ConfigTransform {
  constructor (options) {
    this.fileDescriptor = options.file
    // { js: ['babel.config.js'] }
  }

  transform (value, checkExisting, files, context) {
    let file
    if (checkExisting) {
      file = this.findFile(files)
    }
    if (!file) {
      file = this.getDefaultFile()
    }
    //已有调用 type: js, filename: babel.config.js
    const { type, filename } = file

    //transform.read  loadModule加载模块 ./babel.config.js
    const transform = transforms[type]

    let source
    let existing
    if (checkExisting) {
      source = files[filename]
      if (source) {
        existing = transform.read({
          source,
          filename,
          context
        })
      }
    }

    const content = transform.write({
      source,
      filename,
      context,
      value,
      existing
    })

    return {
      filename,
      content
    }
  }

  findFile (files) {
    for (const type of Object.keys(this.fileDescriptor)) {
      const descriptors = this.fileDescriptor[type]
      for (const filename of descriptors) {
        if (files[filename]) {
          return { type, filename }
        }
      }
    }
  }

  getDefaultFile () {
    const [type] = Object.keys(this.fileDescriptor)
    const [filename] = this.fileDescriptor[type]
    return { type, filename }
  }
}

module.exports = ConfigTransform
