export interface LowStock {
  productId: string
  productName: string
  onHand: number
  minStock: number
}

export interface ExpirySoon {
  productId: string
  lotId: string
  lotCode?: string
  daysToExpiry: number
}

export interface SlowMover {
  productId: string
  windowDays: number
  unitsSold: number
}

export interface AlertsAggregate {
  lowStock: LowStock[]
  expirySoon: ExpirySoon[]
  slowMovers: SlowMover[]
}
