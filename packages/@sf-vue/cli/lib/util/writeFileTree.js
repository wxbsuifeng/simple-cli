const fs = require('fs-extra')
const path = require('path')

function deleteRemovedFiles (directory, newFiles, previousFiles) {
  // 找到previousFiles中 newFiles里面没有的文件
  const filesToDelete = Object.keys(previousFiles)
    .filter(filename => !newFiles[filename])

  // 删除遍历得到的文件
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