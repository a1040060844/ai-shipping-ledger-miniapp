const STORAGE_KEY = 'shippingLedger.shipments.v1'

function nowIso() {
  return new Date().toISOString()
}

function getShipments() {
  const data = wx.getStorageSync(STORAGE_KEY)
  return Array.isArray(data) ? data : []
}

function saveShipments(shipments) {
  wx.setStorageSync(STORAGE_KEY, shipments)
  return shipments
}

function recalculateShipment(shipment) {
  const items = (shipment.items || []).map((item) => {
    const cartons = Number(item.cartons) || 0
    const unitsPerCarton = Number(item.unitsPerCarton) || 0
    return {
      ...item,
      cartons,
      unitsPerCarton,
      totalUnits: cartons * unitsPerCarton
    }
  })

  const totals = items.reduce(
    (acc, item) => {
      acc.cartons += item.cartons
      acc.units += item.totalUnits
      return acc
    },
    { cartons: 0, units: 0 }
  )

  return {
    ...shipment,
    items,
    totalCartons: totals.cartons,
    totalUnits: totals.units,
    updatedAt: nowIso()
  }
}

function upsertShipment(input) {
  const shipment = recalculateShipment(input)
  const shipments = getShipments()
  const index = shipments.findIndex((item) => item.id === shipment.id)

  if (index >= 0) {
    shipments[index] = shipment
  } else {
    shipments.unshift(shipment)
  }

  saveShipments(shipments)
  return shipment
}

function getShipmentById(id) {
  return getShipments().find((item) => item.id === id) || null
}

function updateShipmentField(id, field, value) {
  const shipment = getShipmentById(id)
  if (!shipment) return null

  shipment[field] = value
  shipment.auditLogs = shipment.auditLogs || []
  shipment.auditLogs.push({
    field,
    after: value,
    actor: 'human',
    createdAt: nowIso()
  })
  return upsertShipment(shipment)
}

function updateItemField(shipmentId, itemId, field, value) {
  const shipment = getShipmentById(shipmentId)
  if (!shipment) return null

  const index = (shipment.items || []).findIndex((item) => item.id === itemId)
  if (index < 0) return null

  const item = shipment.items[index]
  const before = item[field]
  item[field] = value
  item.fieldState = item.fieldState || {}
  item.fieldState[field] = 'human_confirmed'

  shipment.auditLogs = shipment.auditLogs || []
  shipment.auditLogs.push({
    entityType: 'shipment_item',
    entityId: itemId,
    field,
    before,
    after: value,
    actor: 'human',
    createdAt: nowIso()
  })

  return upsertShipment(shipment)
}

function summarizeShipments(shipments) {
  return (shipments || []).reduce(
    (acc, shipment) => {
      acc.shipments += 1
      acc.cartons += Number(shipment.totalCartons) || 0
      acc.units += Number(shipment.totalUnits) || 0
      return acc
    },
    { shipments: 0, cartons: 0, units: 0 }
  )
}

module.exports = {
  getShipments,
  getShipmentById,
  upsertShipment,
  updateShipmentField,
  updateItemField,
  summarizeShipments,
  recalculateShipment
}
