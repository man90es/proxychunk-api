export interface IProxy {
	scheme: string
	address: string
	port: number
	good?: boolean
	speed?: number
	createdAt?: Date
	updatedAt?: Date

	isInserted: () => Promise<boolean>
	insert: () => Promise<IProxy>
	update: () => Promise<IProxy>
	upsert: () => Promise<IProxy>
}
