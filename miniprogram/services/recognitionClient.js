const { recognize: mockRecognize } = require('./mockRecognition')

function appConfig() {
  const app = getApp()
  return (app && app.globalData) || {}
}

function ensureCloudReady(sourceFiles) {
  const config = appConfig()
  if (!wx.cloud || !config.cloudEnvId) throw new Error('CloudBase 尚未配置')
  const missingCloudFile = (sourceFiles || []).find((file) => !file.cloudFileId)
  if (missingCloudFile) throw new Error(`原图尚未上传云端：${missingCloudFile.name || missingCloudFile.id}`)
}

async function cloudRecognize(sourceFiles) {
  ensureCloudReady(sourceFiles)
  const result = await wx.cloud.callFunction({
    name: 'recognizeShipment',
    data: {
      sourceFiles: sourceFiles.map((file) => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        mimeType: file.mimeType || null,
        cloudFileId: file.cloudFileId,
        cloudPath: file.cloudPath || null
      }))
    }
  })

  const payload = result && result.result
  if (!payload || payload.ok !== true || !payload.shipment) {
    throw new Error((payload && payload.message) || '云端 AI 识别失败')
  }
  return payload.shipment
}

async function recognize(sourceFiles) {
  const config = appConfig()
  if (config.recognitionMode === 'cloud') return cloudRecognize(sourceFiles)
  return mockRecognize(sourceFiles)
}

module.exports = {
  recognize,
  cloudRecognize
}
