import { executeQuery } from "./index"
import type { QueryResult } from "pg"

const queries = {
	_ts: () => `to_timestamp(${Date.now()} / 1000.0)`,

	selectProxy: (scheme: string, address: string, port: number) => (
		`select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\"
		from proxies
		where scheme = '${scheme}' and address = '${address}' and port = ${port}`
	),

	selectAllProxies: (offset: number, limit: number) => (
		`select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\"
		from proxies
		order by updated_at desc
		offset ${offset}
		limit ${limit}`
	),

	selectGoodProxies: (offset: number, limit: number) => (
		`select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\"
		from proxies
		where speed > 0
		order by updated_at desc
		offset ${offset}
		limit ${limit}`
	),

	selectLRC: () => (
		`select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\"
		from proxies
		where updated_at = (
			select MIN(updated_at)
			from proxies
		)
		limit 1`
	),

	insertProxy: (scheme: string, address: string, port: number, good = false, speed = -1) => (
		`insert into proxies (scheme, address, port, good, speed, created_at, updated_at)
		values ('${scheme}', '${address}', ${port}, ${good}, ${speed}, ${queries._ts()}, ${queries._ts()})`
	),

	updateProxy: (scheme: string, address: string, port: number, good = false, speed = -1) => (
		`update proxies
		set good = ${good}, speed = ${speed}, updated_at = ${queries._ts()}
		where scheme = '${scheme}' and address = '${address}' and port = ${port}`
	),

	countProxies: () => (
		`select count(*) as n
		from proxies`
	)
}

export class Proxy {
	address: string
	createdAt?: Date
	good?: boolean
	port: number
	scheme: string
	speed?: number
	updatedAt?: Date

	static #count = -1

	constructor(data: { scheme: string, address: string, port: number, good?: boolean, speed?: number, createdAt?: string, updatedAt?: string }) {
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

	static async getMany(n: number, page: number, goodOnly: boolean = true): Promise<Proxy[]> {
		const query = goodOnly
			? queries.selectGoodProxies(n * page, n)
			: queries.selectAllProxies(n * page, n)

		return executeQuery(query)
			.then((result: QueryResult<Proxy>) => result.rows)
	}

	static async count(): Promise<number> {
		if (Proxy.#count > -1) {
			return Proxy.#count
		}

		return executeQuery(queries.countProxies())
			.then((result: QueryResult<{ n: number }>) => {
				Proxy.#count = result.rows[0].n
				return Proxy.#count
			})
	}

	static async findLRC(): Promise<Proxy> {
		return executeQuery(queries.selectLRC())
			.then((result: QueryResult<Proxy>) => {
				if (result.rows.length < 1) {
					throw "No rows in result"
				}

				return result.rows[0]
			})
	}

	async insert(): Promise<Proxy> {
		return executeQuery(queries.insertProxy(this.scheme, this.address, this.port, this.good as boolean, this.speed as number))
			.then(() => {
				if (Proxy.#count > -1) {
					++Proxy.#count
				}

				return this
			})
	}

	async update(): Promise<Proxy> {
		return executeQuery(queries.updateProxy(this.scheme, this.address, this.port, this.good as boolean, this.speed as number))
			.then(() => this)
	}

	async isInserted(): Promise<boolean> {
		return executeQuery(queries.selectProxy(this.scheme, this.address, this.port))
			.then((result: QueryResult<Proxy>) => (
				result.rows.length > 0
			))
	}

	async upsert(): Promise<Proxy> {
		return await this.isInserted() ? this.update() : this.insert()
	}
}
