export type RecognizedField<T> = {
  value: T | null
  confidence: number
  visualConfirmed: boolean
  historyMatched: boolean
  inferredFromHistory: boolean
}

export type RecognitionItem = {
  sourceText: string
  candidateProductId: string | null
  skuObserved: RecognizedField<string>
  productNameNormalized: RecognizedField<string>
  specification: RecognizedField<string>
  color: RecognizedField<string>
  variant: RecognizedField<string>
  cartons: RecognizedField<number>
  unitsPerCarton: RecognizedField<number>
}

export type RecognitionDraft = {
  factoryName: RecognizedField<string>
  shipmentDate: RecognizedField<string>
  documentNo: RecognizedField<string>
  items: RecognitionItem[]
}

const stringField = {
  type: 'object',
  additionalProperties: false,
  properties: {
    value: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    visualConfirmed: { type: 'boolean' },
    historyMatched: { type: 'boolean' },
    inferredFromHistory: { type: 'boolean' }
  },
  required: ['value', 'confidence', 'visualConfirmed', 'historyMatched', 'inferredFromHistory']
} as const

const numberField = {
  type: 'object',
  additionalProperties: false,
  properties: {
    value: { type: ['number', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    visualConfirmed: { type: 'boolean' },
    historyMatched: { type: 'boolean' },
    inferredFromHistory: { type: 'boolean' }
  },
  required: ['value', 'confidence', 'visualConfirmed', 'historyMatched', 'inferredFromHistory']
} as const

export const recognitionJsonSchema = {
  name: 'shipping_order_recognition',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      factoryName: stringField,
      shipmentDate: stringField,
      documentNo: stringField,
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sourceText: { type: 'string' },
            candidateProductId: { type: ['string', 'null'] },
            skuObserved: stringField,
            productNameNormalized: stringField,
            specification: stringField,
            color: stringField,
            variant: stringField,
            cartons: numberField,
            unitsPerCarton: numberField
          },
          required: [
            'sourceText',
            'candidateProductId',
            'skuObserved',
            'productNameNormalized',
            'specification',
            'color',
            'variant',
            'cartons',
            'unitsPerCarton'
          ]
        }
      }
    },
    required: ['factoryName', 'shipmentDate', 'documentNo', 'items']
  }
} as const
