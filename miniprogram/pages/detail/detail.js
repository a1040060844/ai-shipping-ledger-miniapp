const {
  getShipmentById,
  updateShipmentField,
  updateItemField
} = require('../../services/storage')
const { decorateShipment } = require('../../utils/ui')

function decorate(shipment) {
  if (!shipment) return null
  const decorated = decorateShipment(shipment)
  decorated.items = (decorated.items || []).map((item, index) => ({
    ...item,
    displayIndex: index + 1,
    needsReview: Object.values(item.fieldState || {}).some((state) => state === 'needs_review')
  }))
  return decorated
}

Page({
  data: {
    shipmentId: '',
    shipment: null
  },

  onLoad(options) {
    this.setData({ shipmentId: options.id || '' })
  },

  onShow() {
    this.loadShipment()
  },

  loadShipment() {
    const shipment = getShipmentById(this.data.shipmentId)
    if (!shipment) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
      return
    }
    this.setData({ shipment: decorate(shipment) })
  },

  onHeaderBlur(event) {
    const { field } = event.currentTarget.dataset
    const value = event.detail.value
    const shipment = updateShipmentField(this.data.shipmentId, field, value)
    this.setData({ shipment: decorate(shipment) })
  },

  onItemBlur(event) {
    const { itemId, field, numeric } = event.currentTarget.dataset
    let value = event.detail.value

    if (numeric === true || numeric === 'true') {
      if (value === '') {
        value = null
      } else {
        value = Number(value)
        if (!Number.isFinite(value) || value < 0) {
          wx.showToast({ title: '请输入有效数字', icon: 'none' })
          this.loadShipment()
          return
        }
      }
    }

    const shipment = updateItemField(this.data.shipmentId, itemId, field, value)
    this.setData({ shipment: decorate(shipment) })
  },

  previewSource() {
    const shipment = this.data.shipment
    const urls = (shipment.sourceFiles || [])
      .filter((file) => file.type === 'image')
      .map((file) => file.localPath || file.path)
      .filter(Boolean)

    if (!urls.length) {
      wx.showToast({ title: '当前没有可预览的图片原件', icon: 'none' })
      return
    }

    wx.previewImage({ current: urls[0], urls })
  }
})
