const { getShipments } = require('../../services/storage')

function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function aggregate(shipments) {
  const summary = {
    shipments: shipments.length,
    cartons: 0,
    units: 0,
    pending: 0,
    factories: 0,
    products: 0
  }
  const factoryMap = new Map()
  const productMap = new Map()

  shipments.forEach((shipment) => {
    const shipmentCartons = shipment.totalCartons !== null && shipment.totalCartons !== undefined
      ? safeNumber(shipment.totalCartons)
      : safeNumber(shipment.knownCartons)
    const shipmentUnits = shipment.totalUnits !== null && shipment.totalUnits !== undefined
      ? safeNumber(shipment.totalUnits)
      : safeNumber(shipment.knownUnits)

    summary.cartons += shipmentCartons
    summary.units += shipmentUnits
    if (shipment.quantityStatus === 'incomplete') summary.pending += 1

    const factoryName = shipment.factoryName || '未识别工厂'
    const factory = factoryMap.get(factoryName) || { name: factoryName, shipments: 0, cartons: 0, units: 0 }
    factory.shipments += 1
    factory.cartons += shipmentCartons
    factory.units += shipmentUnits
    factoryMap.set(factoryName, factory)

    ;(shipment.items || []).forEach((item) => {
      const key = item.productId || item.skuObserved || [
        item.productNameNormalized || item.productNameObserved || '未命名商品',
        item.specification || '',
        item.color || '',
        item.variant || ''
      ].join('|')
      const product = productMap.get(key) || {
        key,
        name: item.productNameNormalized || item.productNameObserved || '未命名商品',
        sku: item.skuObserved || '',
        specification: item.specification || '',
        cartons: 0,
        units: 0,
        lines: 0
      }
      product.lines += 1
      product.cartons += item.cartons !== null && item.cartons !== undefined ? safeNumber(item.cartons) : 0
      product.units += item.totalUnits !== null && item.totalUnits !== undefined ? safeNumber(item.totalUnits) : 0
      productMap.set(key, product)
    })
  })

  const factories = Array.from(factoryMap.values()).sort((a, b) => b.units - a.units)
  const products = Array.from(productMap.values()).sort((a, b) => b.units - a.units)
  summary.factories = factories.length
  summary.products = products.length

  const maxFactoryUnits = factories.length ? Math.max(...factories.map((item) => item.units), 1) : 1
  const maxProductUnits = products.length ? Math.max(...products.map((item) => item.units), 1) : 1

  return {
    summary,
    factories: factories.slice(0, 10).map((item) => ({ ...item, barWidth: Math.max(6, Math.round(item.units / maxFactoryUnits * 100)) })),
    products: products.slice(0, 12).map((item) => ({ ...item, barWidth: Math.max(6, Math.round(item.units / maxProductUnits * 100)) }))
  }
}

Page({
  data: {
    month: currentMonth(),
    summary: { shipments: 0, cartons: 0, units: 0, pending: 0, factories: 0, products: 0 },
    factories: [],
    products: []
  },

  onShow() {
    this.refresh()
  },

  onMonthChange(event) {
    this.setData({ month: event.detail.value || '' }, () => this.refresh())
  },

  showAllTime() {
    this.setData({ month: '' }, () => this.refresh())
  },

  refresh() {
    const month = this.data.month
    const shipments = getShipments().filter((shipment) => {
      if (!month) return true
      return String(shipment.shipmentDate || '').slice(0, 7) === month
    })
    const result = aggregate(shipments)
    this.setData(result)
  }
})
