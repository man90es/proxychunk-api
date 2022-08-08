import { executeQuery } from "./index"
import type { QueryResult } from "pg"
import type { ShivaResult } from "../types/ShivaResult"

const queries = {
	_ts: () => `to_timestamp(${Date.now()} / 1000.0)`,

	selectManyProxies: (offset: number, limit: number, goodOnly: boolean) => (
		`select scheme, address, port, good, speed, created_at as \"createdAt\", updated_at as \"updatedAt\"
		from proxies
		${goodOnly ? "where speed > 0" : ""}
		order by updated_at desc
		offset ${offset}
		limit ${limit}`
	),

	selectLRU: () => (
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

	constructor(scheme: string, address: string, port: number) {
		this.scheme = scheme
		this.address = address
		this.port = port
	}

	static fromShiva({ scheme, address, port, good, speed }: ShivaResult): Proxy {
		const result = new Proxy(scheme, address, port)
		result.good = good
		result.speed = speed

		return result
	}

	static async getMany(n: number, page: number, goodOnly: boolean = true): Promise<Proxy[]> {
		const query = queries.selectManyProxies(n * page, n, goodOnly)

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

	static async findLRU(): Promise<Proxy> {
		return executeQuery(queries.selectLRU())
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
}
