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

function fileExtension(file) {
  const name = String(file.name || '')
  const match = name.match(/\.([a-zA-Z0-9]+)$/)
  if (match) return match[1].toLowerCase()
  return file.type === 'pdf' ? 'pdf' : 'jpg'
}

function datePath() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

function cloudEnabled() {
  const app = getApp()
  return Boolean(
    wx.cloud &&
    app &&
    app.globalData &&
    app.globalData.recognitionMode === 'cloud' &&
    app.globalData.cloudEnvId
  )
}

async function uploadOriginalToCloud(file, index) {
  if (!cloudEnabled()) return file
  const localPath = file.localPath || file.path
  if (!localPath) return file

  const random = Math.random().toString(36).slice(2, 10)
  const cloudPath = `shipping-originals/${datePath()}/${Date.now()}-${index}-${random}.${fileExtension(file)}`
  const uploaded = await wx.cloud.uploadFile({
    cloudPath,
    filePath: localPath
  })

  return {
    ...file,
    cloudPath,
    cloudFileId: uploaded.fileID,
    originalStoredAt: new Date().toISOString(),
    persistence: file.persistence === 'saved_file' ? 'saved_file_and_cloud' : 'cloud_original'
  }
}

async function persistFiles(files) {
  const locallySaved = await Promise.all((files || []).map(saveOneFile))
  if (!cloudEnabled()) return locallySaved

  const uploaded = []
  for (let index = 0; index < locallySaved.length; index += 1) {
    uploaded.push(await uploadOriginalToCloud(locallySaved[index], index))
  }
  return uploaded
}

module.exports = {
  persistFiles
}
