import type { ShipmentOption } from '../types'
import * as db from './dynamodb'

const SHIPMENT_OPTIONS_TABLE =
  process.env.SHIPMENT_OPTIONS_TABLE || 'smultron-shipment-dev'

export const createShipmentOption = (
  data: Pick<ShipmentOption, 'name' | 'description' | 'cost'>,
): ShipmentOption => {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description,
    cost: data.cost,
    createdAt: now,
    updatedAt: now,
  }
}

export const saveShipmentOption = async (
  option: ShipmentOption,
): Promise<void> => {
  await db.putItem(SHIPMENT_OPTIONS_TABLE, option)
}

export const getAllShipmentOptions = async (): Promise<ShipmentOption[]> => {
  return await db.scanTable<ShipmentOption>(SHIPMENT_OPTIONS_TABLE)
}

export const getShipmentOption = async (
  id: string,
): Promise<ShipmentOption | null> => {
  return await db.getItem<ShipmentOption>(SHIPMENT_OPTIONS_TABLE, { id })
}

export const updateShipmentOption = async (
  id: string,
  updates: Partial<Pick<ShipmentOption, 'name' | 'description' | 'cost'>>,
): Promise<ShipmentOption> => {
  const now = new Date().toISOString()
  const allUpdates = { ...updates, updatedAt: now }

  const updateParts: string[] = []
  const attributeValues: Record<string, unknown> = {}
  const attributeNames: Record<string, string> = {}

  Object.entries(allUpdates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`
    const attrValue = `:val${index}`
    updateParts.push(`${attrName} = ${attrValue}`)
    attributeNames[attrName] = key
    attributeValues[attrValue] = value
  })

  return await db.updateItem<ShipmentOption>(
    SHIPMENT_OPTIONS_TABLE,
    { id },
    `SET ${updateParts.join(', ')}`,
    attributeValues,
    attributeNames,
  )
}

export const deleteShipmentOption = async (id: string): Promise<void> => {
  await db.deleteItem(SHIPMENT_OPTIONS_TABLE, { id })
}
