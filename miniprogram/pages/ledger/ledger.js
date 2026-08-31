const { getShipments, summarizeShipments } = require('../../services/storage')
const { decorateShipment } = require('../../utils/ui')

Page({
  data: {
    allShipments: [],
    shipments: [],
    summary: { shipments: 0, cartons: 0, units: 0, incompleteShipments: 0 },
    keyword: '',
    month: '',
    statusFilter: 'all'
  },

  onShow() {
    const shipments = getShipments().map(decorateShipment)
    this.setData({ allShipments: shipments }, () => this.applyFilters())
  },

  onSearchInput(event) {
    this.setData({ keyword: event.detail.value || '' }, () => this.applyFilters())
  },

  onMonthChange(event) {
    this.setData({ month: event.detail.value || '' }, () => this.applyFilters())
  },

  clearMonth() {
    this.setData({ month: '' }, () => this.applyFilters())
  },

  setStatusFilter(event) {
    this.setData({ statusFilter: event.currentTarget.dataset.status || 'all' }, () => this.applyFilters())
  },

  applyFilters() {
    const keyword = (this.data.keyword || '').trim().toLowerCase()
    const month = this.data.month
    const status = this.data.statusFilter

    const shipments = this.data.allShipments.filter((shipment) => {
      if (month && String(shipment.shipmentDate || '').slice(0, 7) !== month) return false
      if (status === 'review' && shipment.statusKey !== 'review') return false
      if (status === 'done' && shipment.statusKey === 'review') return false

      if (!keyword) return true
      const itemText = (shipment.items || []).map((item) => [
        item.skuObserved,
        item.productNameNormalized,
        item.productNameObserved,
        item.specification,
        item.color,
        item.variant
      ].filter(Boolean).join(' ')).join(' ')

      const text = [
        shipment.factoryName,
        shipment.documentNo,
        shipment.shipmentDate,
        itemText
      ].filter(Boolean).join(' ').toLowerCase()

      return text.includes(keyword)
    })

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
