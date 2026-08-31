function today() {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function recognize(sourceFiles) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const id = `shipment_${Date.now()}`
      resolve({
        id,
        factoryId: 'factory_demo',
        factoryName: '演示工厂（待接真实 AI）',
        shipmentDate: today(),
        documentNo: '',
        status: 'active',
        recognitionStatus: 'mock_reviewed',
        sourceFiles,
        items: [
          {
            id: `${id}_item_1`,
            sourceText: '100克双色精油皂 T1 288/箱 数量10箱',
            skuObserved: '',
            productNameNormalized: '双色精油皂',
            specification: '100克',
            variant: 'T1',
            cartons: 10,
            unitsPerCarton: 288,
            totalUnits: 2880,
            fieldState: {
              productNameNormalized: 'auto',
              cartons: 'auto',
              unitsPerCarton: 'auto'
            }
          },
          {
            id: `${id}_item_2`,
            sourceText: '100克黑色精油皂 T2 288/箱 数量5箱',
            skuObserved: '',
            productNameNormalized: '黑色精油皂',
            specification: '100克',
            variant: 'T2',
            cartons: 5,
            unitsPerCarton: 288,
            totalUnits: 1440,
            fieldState: {
              productNameNormalized: 'auto',
              cartons: 'needs_review',
              unitsPerCarton: 'auto'
            }
          }
        ],
        auditLogs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }, 900)
  })
}

module.exports = {
  recognize
}
