/** Tipos de las respuestas de la API Prestige Gold (subconjunto usado por la web). */
export interface Ref { id: string; code: string; name: string }

export interface Unit { id: string; code: string; name: string; kind: string; factorToGram: number; isBase: boolean; status: string }
export interface MaterialCategory { id: string; code: string; name: string; isPreciousMetal: boolean; status: string }
export interface Material {
  id: string; code: string; name: string; category: MaterialCategory; categoryId: string; purity: number | null; karat: number | null
  purityTolerance: number | null; baseUnit: Unit; baseUnitId: string; referenceCost: number; minStock: number
  isIntermediate: boolean; tracksLots: boolean; description: string | null; status: string
}
export interface Workshop {
  id: string; code: string; name: string; responsible: string | null; phone: string | null; email: string | null; address: string | null
  mainProduction: string | null; conditions: string | null; status: string; products?: { id: string; productId: string; enabled: boolean; product: Product }[]
}
export interface Location { id: string; code: string; name: string; type: string; workshopId: string | null; workshop: Workshop | null; status: string }
export interface ProductFamily { id: string; code: string; name: string; description: string | null; status: string }
export interface ProductVariant { id: string; productId: string; code: string; name: string; standardWeight: number | null; attributes: Record<string, unknown>; status: string }
export interface ConsumptionStandard {
  id: string; productId: string; variantId: string | null; variant: ProductVariant | null; material: Material; materialId: string
  basis: string; quantity: number; lotSizeGrams: number | null; tolerancePct: number; notes: string | null; active: boolean
}
export interface Product {
  id: string; code: string; name: string; family: ProductFamily; familyId: string; description: string | null
  targetPurity: number | null; purityTolerance: number | null; requiresPurityCheck: boolean; requiresQualityCheck: boolean
  lossTolerancePct: number; standardWeight: number | null; outputMaterial: Material | null; outputMaterialId: string | null
  currentSheetVersion: number; status: string; variants?: ProductVariant[]
  workshops?: { id: string; workshopId: string; enabled: boolean; workshop: Workshop }[]; standards?: ConsumptionStandard[]
}
export interface Customer {
  id: string; documentType: string; documentNumber: string; name: string; phone: string | null; email: string | null
  address: string | null; city: string | null; notes: string | null; status: string
}
export interface ProductionStage {
  id: string; code: string; name: string; description: string | null; sequence: number; mandatory: boolean; requiresPhoto: boolean
  requiresVideo: boolean; minPhotos: number; isFinal: boolean; active: boolean; families: ProductFamily[]
}
export interface TechnicalVariable {
  id: string; code: string; name: string; dataType: 'NUMBER' | 'TEXT' | 'BOOLEAN' | 'SELECT'; unit: string | null; options: string[]
  requiredOnFinish: boolean; active: boolean; families: ProductFamily[]
}
export interface TechnicalSheet {
  id: string; productId: string; versionNumber: number; standardWeight: number | null; weightTolerance: number | null
  diameterMm: number | null; lengthMm: number | null; widthMm: number | null; thicknessMm: number | null; measures: string | null
  targetPurity: number | null; purityTolerance: number | null; variables: Record<string, string | number | boolean>
  notes: string | null; changeReason: string | null; sourceOrderId: string | null; createdBy?: { fullName: string } | null; createdAt: string
}
export interface Weighing {
  id: string; number: string; purpose: string; source: 'SCALE' | 'MANUAL'; materialId: string | null; grossGrams: number; tareGrams: number
  netGrams: number; currentNetGrams: number; rawReading: string | null; deviceInfo: string | null; stable: boolean
  manualReason: string | null; usedByType: string | null; usedById: string | null; capturedAt: string; capturedBy?: { fullName: string }
}
export interface MaterialLot { id: string; code: string; purity: number | null; origin: string | null; customerId: string | null }
export interface InventoryMovement {
  id: string; number: string; type: string; status: string; material: Material; materialId: string; lot: MaterialLot | null; grams: number
  purity: number | null; fromLocation: Location | null; toLocation: Location | null; productionOrderId: string | null
  reference: string | null; origin: string | null; notes: string | null; sourceType: string | null; createdAt: string
  responsible?: { fullName: string }; overrideApplied: boolean
}
export interface InventoryBalance { id: string; location: Location; material: Material; lot: MaterialLot | null; grams: number; lastMovementAt: string | null }
export interface GlobalSummaryRow {
  material: Material; office: number; transit: number; workshops: number; other: number; total: number; committed: number
  available: number; minStock: number; belowMin: boolean; byWorkshop: { workshopId: string; code: string; name: string; grams: number }[]
}
export interface Requirement {
  id: string; materialId: string; material: Material; requiredGrams: number; tolerancePct: number; manual: boolean
  dispatchedGrams?: number; pendingGrams?: number; availableInOffice?: number; shortfallGrams?: number; consumedGrams?: number; custodyGrams?: number
}
export interface ProductionOrder {
  id: string; number: string; product: Product; productId: string; variant: ProductVariant | null; variantId: string | null
  workshop: Workshop; workshopId: string; targetUnits: number | null; targetGrams: number; commitmentDate: string; status: string
  priority: string; notes: string | null; technicalSheet: TechnicalSheet | null; createdAt: string; dispatchedAt: string | null
  acceptedAt: string | null; finishedByWorkshopAt: string | null; deliveredAt: string | null; closedAt: string | null
  rejectionReason: string | null; cancellationReason: string | null; parentOrderId: string | null; customerOperationId: string | null
  reconciliationSnapshot: Record<string, unknown> | null; requirements: Requirement[]
}
export interface DispatchLine { id: string; materialId: string; material: Material; lot: MaterialLot | null; grams: number; receivedGrams: number | null; weighing: Weighing | null; overrideApplied: boolean }
export interface DigitalAcceptance { id: string; decision: string; signerName: string; signatureImage: string | null; payloadHash: string; observations: string | null; signedAt: string; ip: string | null }
export interface MaterialDispatch {
  id: string; number: string; order: ProductionOrder | null; orderId: string | null; workshop: Workshop; workshopId: string; purpose: string
  status: string; lines: DispatchLine[]; responsible?: { fullName: string }; createdAt: string; respondedAt: string | null
  workshopObservations: string | null; acceptance: DigitalAcceptance | null; notes: string | null
}
export interface InsufficiencyLine {
  materialId: string; materialName: string; requiredGrams: number; previouslyDispatched: number; thisDispatch: number; totalAssigned: number
  shortfallGrams: number; availableInOffice: number; canCompleteFromInventory: boolean; fabricationProduct: { id: string; code: string; name: string } | null
}
export interface MediaFile {
  id: string; kind: 'PHOTO' | 'VIDEO' | 'DOCUMENT'; purpose: string; originalName: string; mimeType: string; sizeBytes: number
  capturedAt: string; caption: string | null; productionOrderId: string | null; stageId: string | null; hidden: boolean
  hiddenReason: string | null; publicVisible: boolean; width: number | null; height: number | null; uploadedBy?: { fullName: string }
  urls: { original: string; web: string; thumb: string | null }
}
export interface Story {
  order: { id: string; number: string; status: string; product: { id: string; code: string; name: string; family?: string }; variant: { name: string } | null; workshop?: { code: string; name: string }; createdAt: string; closedAt: string | null }
  timeline: MediaFile[]
  groups: { stage: { id: string; code: string; name: string; sequence: number; mandatory: boolean; requiresPhoto: boolean; requiresVideo: boolean; isFinal: boolean }; items: MediaFile[] }[]
  totals: { photos: number; videos: number }
  title?: string
}
export interface Discrepancy {
  id: string; number: string; orderId: string | null; workshopId: string | null; type: string; material: Material | null; grams: number
  percent: number | null; tolerancePct: number | null; withinTolerance: boolean; reason: string | null; justification: string | null
  responsibleParty: string | null; status: string; autoApproved: boolean; reviewNotes: string | null; createdAt: string; approvedAt: string | null
}
export interface LaborCost { id: string; orderId: string; workshopId: string; basis: string; rate: number; quantity: number; proposedValue: number; approvedValue: number | null; status: string; notes: string | null; reviewNotes: string | null; createdAt: string }
export interface ReceiptLine { id: string; lineType: string; material: Material | null; materialId: string | null; units: number | null; grams: number; weighing: Weighing | null; finishedGoodId: string | null }
export interface ProductionReceipt { id: string; number: string; orderId: string; type: 'PARTIAL' | 'FINAL'; notes: string | null; comparison: Record<string, number> | null; lines: ReceiptLine[]; createdAt: string }
export interface QualityCheck { id: string; receiptId: string; result: string; checklist: { item: string; ok: boolean; note?: string }[]; notes: string | null; checkedAt: string }
export interface PurityVerification { id: string; receiptId: string; method: string; supportReference: string | null; obtainedValue: number; targetValue: number; tolerance: number; conforming: boolean; notes: string | null; verifiedAt: string }
export interface ReconciliationLine {
  materialId: string; materialCode: string; materialName: string; deliveredGrams: number; returnedGrams: number; postedAdjustmentsGrams: number
  custodyGrams: number; consumedGrams: number; unexplainedGrams: number; approvedDifferenceGrams: number; pendingDifferenceGrams: number; balanced: boolean
}
export interface Reconciliation {
  orderId: string; orderNumber: string; status: string; lines: ReconciliationLine[]
  transformation: { totalConsumedGrams: number; finishedGrams: number; finishedUnits: number; processLossGrams: number; processLossPct: number; tolerancePct: number; withinTolerance: boolean; registered: boolean }
  discrepancies: Discrepancy[]; balanced: boolean; blockers: string[]
}
export interface OrderDetail extends ProductionOrder {
  statusLabel: string; overdue: boolean; onTime: boolean | null
  sufficiency: { lines: { materialId: string; materialCode: string; materialName: string; requiredGrams: number; dispatchedGrams: number; pendingGrams: number; availableInOffice: number; shortfallGrams: number; sufficient: boolean }[]; sufficient: boolean }
  custody: { materialId: string; material: Material; inGrams: number; outGrams: number; balance: number; since: string | null }[]
  stages: (ProductionStage & { completed: { completedAt: string; photoCount: number; videoCount: number } | null })[]
  dispatches: MaterialDispatch[]
  consumptions: { id: string; material: Material; materialId: string; grams: number; stageId: string | null; notes: string | null; voided: boolean; voidReason: string | null; createdAt: string }[]
  progress: { id: string; stage: ProductionStage | null; grams: number | null; units: number | null; percent: number | null; notes: string | null; completesStage: boolean; createdAt: string }[]
  requests: MaterialRequest[]
  declarations: { id: string; units: number | null; grams: number; technicalValues: Record<string, unknown>; diameterMm: number | null; lengthMm: number | null; measures: string | null; declaredLeftovers: { materialId: string; grams: number; type: string }[]; notes: string | null; current: boolean; createdAt: string }[]
  labor: LaborCost[]; receipts: ProductionReceipt[]; quality: QualityCheck[]; purity: PurityVerification[]; discrepancies: Discrepancy[]
  decisions: { id: string; action: string; materialId: string | null; requiredGrams: number | null; assignedGrams: number | null; shortfallGrams: number | null; justification: string; details: Record<string, unknown> | null; generatedOrderId: string | null; createdAt: string }[]
  history: { id: string; fromStatus: string | null; toStatus: string; reason: string | null; userName: string; createdAt: string }[]
}
export interface MaterialRequest {
  id: string; number: string; order: ProductionOrder | null; orderId: string | null; workshopId: string; material: Material; materialId: string
  grams: number; reason: string; status: string; expectedGrams: number | null; alreadyDeliveredGrams: number | null; deviationPct: number | null
  exceedsStandard: boolean; reviewNotes: string | null; createdAt: string
}
export interface FinishedGood {
  id: string; code: string; product: Product; productId: string; variant: ProductVariant | null; orderId: string; workshopId: string
  location: Location; units: number; grams: number; availableUnits: number; availableGrams: number; status: string
  qualityStatus: string; purityStatus: string; verifiedPurity: number | null; unitCostPerGram: number | null; totalCost: number | null; createdAt: string
}
export interface Alert {
  id: string; type: string; severity: string; status: string; title: string; message: string; entityType: string | null; entityId: string | null
  workshopId: string | null; createdAt: string; resolvedAt: string | null; resolutionNotes: string | null
}
export interface OperationBalances {
  money: { totalValue: number; dispatchedValue: number; paid: number; balance: number }
  material: { committedFineGrams: number; contributedGrossGrams: number; contributedFineGrams: number; balanceFineGrams: number; valuation: number }
}
export interface CustomerOperation {
  id: string; number: string; customer: Customer; customerId: string; type: string; status: string; description: string; totalValue: number
  committedMaterialFineGrams: number; productionOrderId: string | null; dueDate: string | null; notes: string | null; createdAt: string; balances?: OperationBalances
}
export interface PaymentMethod { id: string; code: string; name: string; active: boolean }
export interface FinanceCategory { id: string; code: string; name: string; type: 'INCOME' | 'EXPENSE'; isOperatingExpense: boolean; isSystem: boolean; active: boolean }
export interface CustomerPayment { id: string; number: string; customerId: string; operationId: string | null; amount: number; paymentMethod: PaymentMethod; paymentDate: string; reference: string | null; notes: string | null; status: string; createdAt: string }
export interface CustomerContribution {
  id: string; number: string; customerId: string; operationId: string; material: Material; grams: number; declaredPurity: number
  verifiedPurity: number | null; fineGrams: number; timing: string; origin: string; contributionDate: string; pricePerGram: number | null
  valuation: number | null; status: string; notes: string | null; createdAt: string
}
export interface SaleDispatch { id: string; number: string; operationId: string; customerId: string; dispatchDate: string; totalValue: number; notes: string | null; reversed: boolean; lines: { id: string; finishedGood: FinishedGood; units: number; grams: number; value: number; cost: number }[]; createdAt: string }
export interface FinancialTransaction {
  id: string; number: string; type: 'INCOME' | 'EXPENSE'; category: FinanceCategory; concept: string; amount: number; transactionDate: string
  thirdPartyName: string | null; workshopId: string | null; customerId: string | null; paymentMethod: PaymentMethod | null
  supportReference: string | null; source: string; status: string; notes: string | null; createdAt: string
}
export interface ReportColumn { key: string; label: string; type?: 'text' | 'grams' | 'money' | 'number' | 'percent' | 'date' | 'datetime' | 'boolean' }
export interface TabularReport { key: string; title: string; description?: string; filters?: Record<string, unknown>; columns: ReportColumn[]; rows: Record<string, unknown>[]; summary?: Record<string, number | string>; charts?: Record<string, unknown> }
export interface Role { id: string; code: string; name: string; description: string | null; permissions: string[]; isSystem: boolean; isWorkshopRole: boolean; active: boolean }
export interface AppUserRow { id: string; username: string; email: string; fullName: string; phone: string | null; role: Role; roleId: string; workshop: Workshop | null; workshopId: string | null; active: boolean; lastLoginAt: string | null; lockedUntil: string | null; mustChangePassword: boolean }
export interface SystemParameter { id: string; key: string; value: unknown; description: string; groupName: string }
export interface LaborRate { id: string; workshop: Workshop; workshopId: string; product: Product | null; productId: string | null; basis: string; rate: number; validFrom: string; validTo: string | null; active: boolean }
export interface AuditLog { id: string; action: string; entityType: string; entityId: string | null; userId: string | null; username: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; description: string | null; ip: string | null; path: string | null; createdAt: string }
