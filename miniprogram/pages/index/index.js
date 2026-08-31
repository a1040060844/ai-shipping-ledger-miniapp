const { getShipments, summarizeShipments } = require('../../services/storage')
const { decorateShipment } = require('../../utils/ui')

Page({
  data: {
    summary: { shipments: 0, cartons: 0, units: 0, incompleteShipments: 0 },
    recentShipments: []
  },

  onShow() {
    const shipments = getShipments()
    this.setData({
      summary: summarizeShipments(shipments),
      recentShipments: shipments.slice(0, 5).map(decorateShipment)
    })
  },

  openUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' })
  },

  openLedger() {
    wx.switchTab({ url: '/pages/ledger/ledger' })
  },

  openDetail(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  }
})
