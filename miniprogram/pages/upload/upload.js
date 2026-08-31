const { persistFiles } = require('../../services/filePersistence')
const { recognize } = require('../../services/mockRecognition')
const { upsertShipment } = require('../../services/storage')

Page({
  data: {
    files: [],
    processing: false
  },

  chooseImages() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const next = (res.tempFiles || []).map((file, index) => ({
          id: `image_${Date.now()}_${index}`,
          name: `发货单图片${index + 1}`,
          type: 'image',
          path: file.tempFilePath,
          size: file.size || 0
        }))
        this.setData({ files: this.data.files.concat(next) })
      }
    })
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 9,
      type: 'file',
      extension: ['pdf', 'jpg', 'jpeg', 'png'],
      success: (res) => {
        const next = (res.tempFiles || []).map((file, index) => ({
          id: `file_${Date.now()}_${index}`,
          name: file.name || `文件${index + 1}`,
          type: /\.pdf$/i.test(file.name || '') ? 'pdf' : 'image',
          path: file.path,
          size: file.size || 0
        }))
        this.setData({ files: this.data.files.concat(next) })
      }
    })
  },

  removeFile(event) {
    const { id } = event.currentTarget.dataset
    this.setData({ files: this.data.files.filter((file) => file.id !== id) })
  },

  previewImage(event) {
    const { path } = event.currentTarget.dataset
    const urls = this.data.files.filter((file) => file.type === 'image').map((file) => file.path)
    if (!urls.length) return
    wx.previewImage({ current: path, urls })
  },

  async startRecognition() {
    if (!this.data.files.length || this.data.processing) return

    this.setData({ processing: true })
    wx.showLoading({ title: 'AI 识别中', mask: true })

    try {
      const persisted = await persistFiles(this.data.files)
      const shipment = await recognize(persisted)
      upsertShipment(shipment)
      wx.hideLoading()
      this.setData({ processing: false })
      wx.redirectTo({ url: `/pages/detail/detail?id=${shipment.id}` })
    } catch (error) {
      wx.hideLoading()
      this.setData({ processing: false })
      wx.showToast({ title: '识别失败，请重试', icon: 'none' })
    }
  }
})
