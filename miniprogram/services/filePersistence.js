function saveOneFile(file) {
  return new Promise((resolve) => {
    if (!file || !file.path) {
      resolve(file)
      return
    }

    wx.saveFile({
      tempFilePath: file.path,
      success(res) {
        resolve({
          ...file,
          localPath: res.savedFilePath,
          persistence: 'saved_file'
        })
      },
      fail() {
        resolve({
          ...file,
          localPath: file.path,
          persistence: 'temp_fallback'
        })
      }
    })
  })
}

function persistFiles(files) {
  return Promise.all((files || []).map(saveOneFile))
}

module.exports = {
  persistFiles
}
