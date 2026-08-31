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

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

function recalculateShipment(shipment) {
  const items = (shipment.items || []).map((item) => {
    const cartons = numberOrNull(item.cartons)
    const unitsPerCarton = numberOrNull(item.unitsPerCarton)
    return {
      ...item,
      cartons,
      unitsPerCarton,
      totalUnits: cartons !== null && unitsPerCarton !== null ? cartons * unitsPerCarton : null
    }
  })

  const knownTotals = items.reduce(
    (acc, item) => {
      if (item.cartons !== null) acc.cartons += item.cartons
      if (item.totalUnits !== null) acc.units += item.totalUnits
      return acc
    },
    { cartons: 0, units: 0 }
  )

  const cartonsComplete = items.every((item) => item.cartons !== null)
  const unitsComplete = items.every((item) => item.totalUnits !== null)

  return {
    ...shipment,
    items,
    totalCartons: cartonsComplete ? knownTotals.cartons : null,
    totalUnits: unitsComplete ? knownTotals.units : null,
    knownCartons: knownTotals.cartons,
    knownUnits: knownTotals.units,
    quantityStatus: cartonsComplete && unitsComplete ? 'complete' : 'incomplete',
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

  const before = shipment[field]
  shipment[field] = value
  shipment.auditLogs = shipment.auditLogs || []
  shipment.auditLogs.push({
    entityType: 'shipment',
    entityId: id,
    field,
    before,
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
  item.needsReview = Object.values(item.fieldState).some((state) => state === 'needs_review')

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
      if (shipment.totalCartons !== null && shipment.totalCartons !== undefined) acc.cartons += Number(shipment.totalCartons) || 0
      if (shipment.totalUnits !== null && shipment.totalUnits !== undefined) acc.units += Number(shipment.totalUnits) || 0
      if (shipment.quantityStatus === 'incomplete') acc.incompleteShipments += 1
      return acc
    },
    { shipments: 0, cartons: 0, units: 0, incompleteShipments: 0 }
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
