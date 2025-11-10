export interface LowStock {
  productId: string
  onHand: number
  minStock: number
}

export interface ExpirySoon {
  productId: string
  lotId: string
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
