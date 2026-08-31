const { getShipments } = require('../../services/storage')

function buildProducts(shipments) {
  const map = new Map()

  shipments.forEach((shipment) => {
    ;(shipment.items || []).forEach((item) => {
      const name = item.productNameNormalized || item.productNameObserved || '未命名商品'
      const key = item.productId || item.skuObserved || [name, item.specification || '', item.color || '', item.variant || ''].join('|')
      const product = map.get(key) || {
        key,
        productId: item.productId || '',
        name,
        sku: item.skuObserved || '',
        specification: item.specification || '',
        color: item.color || '',
        variant: item.variant || '',
        shipmentIds: new Set(),
        cartons: 0,
        units: 0,
        packCounts: {}
      }

      product.shipmentIds.add(shipment.id)
      if (item.cartons !== null && item.cartons !== undefined) product.cartons += Number(item.cartons) || 0
      if (item.totalUnits !== null && item.totalUnits !== undefined) product.units += Number(item.totalUnits) || 0
      if (item.unitsPerCarton !== null && item.unitsPerCarton !== undefined) {
        const pack = String(item.unitsPerCarton)
        product.packCounts[pack] = (product.packCounts[pack] || 0) + 1
      }
      map.set(key, product)
    })
  })

  return Array.from(map.values()).map((product) => {
    const commonPack = Object.entries(product.packCounts)
      .sort((a, b) => b[1] - a[1])[0]
    return {
      key: product.key,
      productId: product.productId,
      name: product.name,
      sku: product.sku,
      specification: product.specification,
      color: product.color,
      variant: product.variant,
      shipments: product.shipmentIds.size,
      cartons: product.cartons,
      units: product.units,
      commonPack: commonPack ? Number(commonPack[0]) : null
    }
  }).sort((a, b) => b.units - a.units || a.name.localeCompare(b.name, 'zh-CN'))
}

Page({
  data: {
    allProducts: [],
    products: [],
    keyword: ''
  },

  onShow() {
    const products = buildProducts(getShipments())
    this.setData({ allProducts: products, products })
  },

  onSearchInput(event) {
    const keyword = (event.detail.value || '').trim().toLowerCase()
    const products = this.data.allProducts.filter((product) => {
      if (!keyword) return true
      const text = [
        product.name,
        product.sku,
        product.specification,
        product.color,
        product.variant
      ].filter(Boolean).join(' ').toLowerCase()
      return text.includes(keyword)
    })
    this.setData({ keyword: event.detail.value || '', products })
  }
})
