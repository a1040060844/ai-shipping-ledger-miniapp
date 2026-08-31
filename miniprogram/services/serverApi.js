const { API_BASE_URL } = require('../config')

function uploadOne(file) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/v1/files/upload`,
      filePath: file.localPath || file.path,
      name: 'file',
      timeout: 60000,
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`upload failed: ${res.statusCode}`))
          return
        }
        try {
          const body = JSON.parse(res.data)
          resolve(body.file)
        } catch (error) {
          reject(error)
        }
      },
      fail: reject
    })
  })
}

function requestJson(path, method = 'GET', data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method,
      data,
      timeout: 120000,
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error((res.data && res.data.message) || `request failed: ${res.statusCode}`))
          return
        }
        resolve(res.data)
      },
      fail: reject
    })
  })
}

async function recognizeOnServer(localFiles) {
  const uploaded = []
  for (const file of localFiles) {
    uploaded.push(await uploadOne(file))
  }

  const result = await requestJson('/api/v1/recognitions', 'POST', {
    sourceFileIds: uploaded.map((file) => file.id)
  })

  return {
    shipment: result.shipment,
    uploaded
  }
}

module.exports = {
  recognizeOnServer,
  requestJson
}
