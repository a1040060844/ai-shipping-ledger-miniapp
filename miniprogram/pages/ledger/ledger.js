const { getShipments, summarizeShipments } = require('../../services/storage')

Page({
  data: {
    shipments: [],
    summary: { shipments: 0, cartons: 0, units: 0 }
  },

  onShow() {
    const shipments = getShipments()
    this.setData({
      shipments,
      summary: summarizeShipments(shipments)
    })
  },

  openDetail(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  }
})
