import { QueryResult } from "pg"
import { IProxy } from "./../types/proxy"
import { executeQuery } from "./index"

const queries = {
	_ts: () => {
		return `to_timestamp(${Date.now()} / 1000.0)`
	},

	selectProxy: (scheme: string, address: string, port: number) => {
		return `select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\" from proxies where scheme = '${scheme}' and address = '${address}' and port = ${port}`
	},

	selectAllProxies: (offset: number, limit: number) => {
		return `select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\" from proxies order by updated_at desc offset ${offset} limit ${limit}`
	},

	selectGoodProxies: (offset: number, limit: number) => {
		return `select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\" from proxies where speed > 0 order by updated_at desc offset ${offset} limit ${limit}`
	},

	selectLRC: () => {
		return "select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\" from proxies where updated_at = (select MIN(updated_at) from proxies) limit 1"
	},

	insertProxy: (scheme: string, address: string, port: number, good = false, speed = -1) => {
		return `insert into proxies (scheme, address, port, good, speed, created_at, updated_at) values ('${scheme}', '${address}', ${port}, ${good}, ${speed}, ${queries._ts()}, ${queries._ts()})`
	},

	updateProxy: (scheme: string, address: string, port: number, good = false, speed = -1) => {
		return `update proxies set good = ${good}, speed = ${speed}, updated_at = ${queries._ts()} where scheme = '${scheme}' and address = '${address}' and port = ${port}`
	},

	countProxies: () => {
		return `select count(*) as n from proxies`
	}
}

export class Proxy implements IProxy {
	scheme: string
	address: string
	port: number
	good?: boolean
	speed?: number
	createdAt?: Date
	updatedAt?: Date

	static _count: number = -1

	constructor(data: {scheme: string, address: string, port: number, good?: boolean, speed?: number, createdAt?: string, updatedAt?: string}) {
		this.scheme = data.scheme
		this.address = data.address
		this.port = data.port
		this.good = data.good
		this.speed = data.speed

		if (data.createdAt !== undefined) {
			this.createdAt = new Date(data.createdAt)
		}

		if (data.updatedAt !== undefined) {
			this.updatedAt = new Date(data.updatedAt)
		}
	}

	static async getMany(n: number, page: number, goodOnly: boolean = true): Promise<IProxy[]> {
		const offset = n * page
		return executeQuery(goodOnly ? queries.selectGoodProxies(offset, n) : queries.selectAllProxies(offset, n))
			.then((result: QueryResult<IProxy>) => {
				return result.rows
			})
	}

	static async count(): Promise<number> {
		if (Proxy._count > -1) {
			return Proxy._count
		}

		return executeQuery(queries.countProxies())
			.then((result: QueryResult<{n: number}>) => {
				Proxy._count = result.rows[0].n
				return Proxy._count
			})

	}

	static async findLRC(): Promise<IProxy> {
		return executeQuery(queries.selectLRC())
			.then((result: QueryResult<IProxy>) => {
				if (result.rows.length < 1) {
					throw "No rows in result"
				}

				return result.rows[0]
			})
	}

	async insert(): Promise<IProxy> {
		return executeQuery(queries.insertProxy(this.scheme, this.address, this.port, this.good as boolean, this.speed as number))
			.then(() => {
				if (Proxy._count > -1) {
					++Proxy._count
				}

				return this
			})
	}

	async update(): Promise<IProxy> {
		return executeQuery(queries.updateProxy(this.scheme, this.address, this.port, this.good as boolean, this.speed as number))
			.then(() => {
				return this
			})
	}

	async isInserted(): Promise<boolean> {
		return executeQuery(queries.selectProxy(this.scheme, this.address, this.port))
			.then((result: QueryResult<IProxy>) => {
				return result.rows.length > 0
			})
	}

	async upsert(): Promise<IProxy> {
		return await this.isInserted() ? this.update() : this.insert()
	}
}
