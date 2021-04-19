const fs = require('fs-extra')
const path = require('path')

// 在previousFiles中找到newFiles中不存在的文件， 进行删除
function deleteRemovedFiles (directory, newFiles, previousFiles) {
  const filesToDelete = Object.keys(previousFiles)
    .filter(filename => !newFiles[filename])

  return Promise.all(filesToDelete.map(filename => {
    return fs.unlink(path.join(directory, filename))
  }))
}

module.exports = async function writeFileTree (dir, files, previousFiles) {
  if (process.env.VUE_CLI_SKIP_WRITE) {
    return
  }
  if (previousFiles) {
    await deleteRemovedFiles(dir, files, previousFiles)
  }
  Object.keys(files).forEach(name => {
    const filePath = path.join(dir, name)
    fs.ensureDirSync(path.dirname(filePath))
    fs.writeFileSync(filePath, files[name])
  })
}