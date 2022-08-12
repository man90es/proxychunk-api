import { executeQuery } from "./index"
import type { QueryResult } from "pg"
import type { ShivaResult } from "../types/ShivaResult"

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

	static async getMany(
		n: number,
		page: number,
		goodOnly: boolean = true,
		orderByParam: string = "updatedAt",
		orderParam: string = "desc",
	): Promise<Proxy[]> {
		const orderBy = (new Map([
			["speed", "average_speed"],
			["updatedAt", "updated_at"],
			["uptime", "average_uptime"],
		])).get(orderByParam as string) || "updated_at"
		const order = (new Map([
			["asc", "asc"],
			["desc", "desc"],
		])).get(orderParam as string) || "desc"

		const query = (
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
			order by ${orderBy} ${order}
			offset ${n * page}
			limit ${n}`
		)

		return executeQuery(query)
			.then((result: QueryResult<Proxy>) => result.rows)
	}

	static async count(): Promise<number> {
		if (Proxy.#count > -1) {
			return Proxy.#count
		}

		return executeQuery(`select count(*) as n from proxies`)
			.then((result: QueryResult<{ n: number }>) => {
				Proxy.#count = result.rows[0].n
				return Proxy.#count
			})
	}

	static async findLRU(): Promise<Proxy> {
		const query = (
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
		)

		return executeQuery(query)
			.then((result: QueryResult<Proxy>) => {
				if (result.rows.length < 1) {
					throw "No rows in result"
				}

				return result.rows[0]
			})
	}

	async insert(): Promise<Proxy> {
		const timestamp = `to_timestamp(${Date.now()} / 1000.0)`
		const query = (
			`insert into proxies (scheme, address, port, created_at, updated_at)
			values ('${this.scheme}', '${this.address}', ${this.port}, ${timestamp}, ${timestamp})`
		)

		return executeQuery(query)
			.then(() => {
				if (Proxy.#count > -1) {
					++Proxy.#count
				}

				return this
			})
	}

	async update(): Promise<Proxy> {
		const query = (
			`select
				today_checks as \"todayChecks\",
				speed,
				uptime,
				updated_at as \"updatedAt\"
			from proxies
			where
				scheme = '${this.scheme}' and
				address = '${this.address}' and
				port = ${this.port}`
		)


		return executeQuery(query)
			.then((result: QueryResult<Proxy>) => result.rows[0])
			.then((prev) => {
				let todaySpeed = 0
				let todayUptime = 0

				// HERE BE DRAGONS
				//
				//  \\._,--._          _._
				//  `--,   _ `.    .-'' _ `-. Y/
				//  _,',\ \ `, |  |  ,-' `. `.`.\
				//   /7  | |J .' J  (     |  |/,'
				//   ,-.,'/ L  \.`-_ `-.   \  \_,(o._.-'\
				//  ((`--'  `-.  \  `.  ) /`_/._-, ,--'`'
				//   ,\        \  `-'  / ( |   //|-.`-._,
				//   \/         ``---''  '\\   '    `--,'

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

				const timestamp = `to_timestamp(${Date.now()} / 1000.0)`
				const query = (
					`update proxies
					set
						today_checks = ${prev.todayChecks},
						speed = ARRAY[${prev.speed!.slice(-7).join(", ")}]::real[],
						uptime = ARRAY[${prev.uptime!.slice(-7).join(", ")}]::real[],
						updated_at = ${timestamp}
					where
						scheme = '${this.scheme}' and
						address = '${this.address}' and
						port = ${this.port}`
				)

				return executeQuery(query)
			})
			.then(() => this)
	}
}
