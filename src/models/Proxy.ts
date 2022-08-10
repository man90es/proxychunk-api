import { executeQuery } from "./index"
import type { QueryResult } from "pg"
import type { ShivaResult } from "../types/ShivaResult"

const queries = {
	_ts: () => `to_timestamp(${Date.now()} / 1000.0)`,

	selectProxy: (scheme: string, address: string, port: number) => (
		`select
			today_checks as \"todayChecks\",
			today_speed as \"todaySpeed\",
			today_uptime as \"todayUptime\",
			speed,
			uptime,
			updated_at as \"updatedAt\"
		from proxies
		where
			scheme = '${scheme}' and
			address = '${address}' and
			port = ${port}`
	),

	selectManyProxies: (offset: number, limit: number, goodOnly: boolean) => (
		`select
			scheme,
			address,
			port,
			today_speed as \"todaySpeed\",
			today_uptime as \"todayUptime\",
			speed,
			uptime,
			created_at as \"createdAt\",
			updated_at as \"updatedAt\"
		from proxies
		${goodOnly ? "where today_uptime > 0" : ""}
		order by updated_at desc
		offset ${offset}
		limit ${limit}`
	),

	selectLRU: () => (
		`select
			scheme,
			address,
			port,
			updated_at as \"updatedAt\"
		from proxies
		where updated_at = (
			select MIN(updated_at)
			from proxies
		)
		limit 1`
	),

	insertProxy: (scheme: string, address: string, port: number) => (
		`insert into proxies (scheme, address, port, created_at, updated_at)
		values ('${scheme}', '${address}', ${port}, ${queries._ts()}, ${queries._ts()})`
	),

	updateProxy: (
		scheme: string,
		address: string,
		port: number,
		todayChecks: number,
		todaySpeed: number,
		todayUptime: number,
		speed: number[],
		uptime: number[],
	) => (
		`update proxies
		set
			today_checks = ${todayChecks},
			today_speed = ${todaySpeed},
			today_uptime = ${todayUptime},
			speed = ARRAY[${speed.join(", ")}]::integer[],
			uptime = ARRAY[${uptime.join(", ")}]::integer[],
			updated_at = ${queries._ts()}
		where
			scheme = '${scheme}' and
			address = '${address}' and
			port = ${port}`
	),

	countProxies: () => (
		`select count(*) as n
		from proxies`
	)
}

export class Proxy {
	address: string
	createdAt?: Date
	port: number
	scheme: string
	todayChecks?: number
	todaySpeed?: number
	todayUptime?: number
	speed?: number[]
	uptime?: number[]
	updatedAt?: Date

	_speed?: number

	static #count = -1

	constructor(scheme: string, address: string, port: number) {
		this.scheme = scheme
		this.address = address
		this.port = port
	}

	static fromShiva({ scheme, address, port, good, speed }: ShivaResult): Proxy {
		const result = new Proxy(scheme, address, port)
		result._speed = good ? speed : -1

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
		return executeQuery(queries.insertProxy(this.scheme, this.address, this.port))
			.then(() => {
				if (Proxy.#count > -1) {
					++Proxy.#count
				}

				return this
			})
	}

	async update(): Promise<Proxy> {
		return executeQuery(queries.selectProxy(this.scheme, this.address, this.port))
			.then((result: QueryResult<Proxy>) => result.rows[0])
			.then((prev) => {
				if (prev.todayChecks && prev.updatedAt?.getUTCDate() === (new Date()).getUTCDate()) {
					if (this._speed && 0 <= this._speed) {
						if (prev.todaySpeed! < 0) {
							prev.todaySpeed = this._speed
						} else {
							prev.todaySpeed = (prev.todaySpeed! * prev.todayChecks! + this._speed) / (prev.todayChecks! + 1)
						}
						prev.todayUptime = (prev.todayUptime! * prev.todayChecks! + 1) / (prev.todayChecks! + 1)
					} else {
						prev.todayUptime = (prev.todayUptime! * prev.todayChecks!) / (prev.todayChecks! + 1)
					}

					prev.todayChecks = prev.todayChecks! + 1
				} else {
					if (prev.todayChecks) {
						prev.speed = [...(prev.speed || []), prev.todaySpeed!].slice(-7)
						prev.uptime = [...(prev.uptime || []), prev.todayUptime!].slice(-7)
					} else {
						prev.speed = []
						prev.uptime = []
					}

					if (this._speed && 0 <= this._speed) {
						prev.todaySpeed = this._speed
						prev.todayUptime = 1
					} else {
						prev.todaySpeed = -1
						prev.todayUptime = 0
					}

					prev.todayChecks = 1
				}

				return executeQuery(queries.updateProxy(
					this.scheme,
					this.address,
					this.port,
					prev.todayChecks,
					prev.todaySpeed!,
					prev.todayUptime,
					prev.speed!,
					prev.uptime!,
				))
			})
			.then(() => this)
	}
}
