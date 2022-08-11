import { executeQuery } from "./index"
import type { QueryResult } from "pg"
import type { ShivaResult } from "../types/ShivaResult"

const queries = {
	_ts: () => `to_timestamp(${Date.now()} / 1000.0)`,

	selectProxy: (scheme: string, address: string, port: number) => (
		`select
			today_checks as \"todayChecks\",
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
			average_speed as \"avgSpeed\",
			average_uptime as \"avgUptime\",
			created_at as \"createdAt\",
			updated_at as \"updatedAt\"
		from proxies
		join lateral (
			select avg(s) average_speed
				from Unnest(proxies.speed) s
		) s on true
		join lateral (
			select avg(u) average_uptime
				from Unnest(proxies.uptime) u
		) u on true
		GROUP BY scheme, address, port, average_speed, average_uptime
		${goodOnly ? "having average_uptime > 0" : ""}
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
		speed: number[],
		uptime: number[],
	) => (
		`update proxies
		set
			today_checks = ${todayChecks},
			speed = ARRAY[${speed.join(", ")}]::real[],
			uptime = ARRAY[${uptime.join(", ")}]::real[],
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
	speed?: number[]
	uptime?: number[]
	updatedAt?: Date

	avgSpeed?: number
	avgUptime?: number

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
				let todaySpeed = 0
				let todayUptime = 0

				// If already checked today
				if (prev.todayChecks && prev.updatedAt?.getUTCDate() === (new Date()).getUTCDate()) {
					todaySpeed = prev.speed!.pop()!
					todayUptime = prev.uptime!.pop()!

					if (0 <= this._speed!) { // If current check result is positive
						if (todaySpeed! < 0) { // If previous checks were negative
							todaySpeed = this._speed!
						} else { // If previous checks were positive
							todaySpeed = (todaySpeed! * prev.todayChecks! + this._speed!) / (prev.todayChecks! + 1)
						}

						todayUptime = (todayUptime! * prev.todayChecks! + 1) / (prev.todayChecks! + 1)
					} else { // If current check result is negative
						todayUptime = (todayUptime! * prev.todayChecks!) / (prev.todayChecks! + 1)
					}

					prev.todayChecks = prev.todayChecks! + 1
				} else { // If it's the first check today
					if (!prev.todayChecks) { // If it's the first check ever
						prev.speed = []
						prev.uptime = []
					}

					if (0 <= this._speed!) { // If current check result is positive
						todaySpeed = this._speed!
						todayUptime = 1
					} else { // If current check result is negative
						todaySpeed = -100
					}

					prev.todayChecks = 1
				}

				prev.speed!.push(todaySpeed)
				prev.uptime!.push(todayUptime)

				return executeQuery(queries.updateProxy(
					this.scheme,
					this.address,
					this.port,
					prev.todayChecks,
					prev.speed!.slice(-7),
					prev.uptime!.slice(-7),
				))
			})
			.then(() => this)
	}
}
