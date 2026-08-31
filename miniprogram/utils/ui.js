function normalizeStatus(value) {
  return String(value || '').toLowerCase()
}

function shipmentStatusView(shipment) {
  const status = normalizeStatus(shipment && shipment.recognitionStatus)
  const incomplete = shipment && shipment.quantityStatus === 'incomplete'

  if (incomplete || status.includes('human_review')) {
    return { text: '待人工复核', tone: 'warning', key: 'review' }
  }

  if (status.includes('ai_review')) {
    return { text: 'AI 复核中', tone: 'info', key: 'ai' }
  }

  if (status.includes('mock')) {
    return { text: '演示记录', tone: 'neutral', key: 'mock' }
  }

  return { text: '已记录', tone: 'success', key: 'done' }
}

function countReviewFields(shipment) {
  return (shipment && shipment.items || []).reduce((total, item) => {
    const states = Object.values(item.fieldState || {})
    return total + states.filter((state) => state === 'needs_review').length
  }, 0)
}

function decorateShipment(shipment) {
  const statusView = shipmentStatusView(shipment)
  return {
    ...shipment,
    statusText: statusView.text,
    statusTone: statusView.tone,
    statusKey: statusView.key,
    reviewFieldCount: countReviewFields(shipment),
    displayDate: shipment.shipmentDate || '日期待识别'
  }
}

module.exports = {
  shipmentStatusView,
  countReviewFields,
  decorateShipment
}
