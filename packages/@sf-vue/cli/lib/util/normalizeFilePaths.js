const slash = require('slash')

//标准化文件路径 
module.exports = function normalizeFilePaths (files) {
  Object.keys(files).forEach(file => {
    const normalized = slash(file)
    if (file !== normalized) {
      files[normalized] = files[file]
      delete files[file]
    }
  })
  return files
}