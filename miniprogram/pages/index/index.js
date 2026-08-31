const { getShipments, summarizeShipments } = require('../../services/storage')

Page({
  data: {
    summary: { shipments: 0, cartons: 0, units: 0 },
    recentShipments: []
  },

  onShow() {
    const shipments = getShipments()
    this.setData({
      summary: summarizeShipments(shipments),
      recentShipments: shipments.slice(0, 5)
    })
  },

  openUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' })
  },

  openDetail(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  }
})
