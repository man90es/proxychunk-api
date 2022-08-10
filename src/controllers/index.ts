import { ip2number, number2ip } from "../utils"
import { Proxy } from "../models/Proxy"
import type { Response, Request } from "express"

declare module "express-session" {
	interface SessionData {
		loggedIn: boolean,
		user: string,
	}
}

const proxiesPerPage = parseInt(process.env.PROXIES_PER_PAGE as string) || 10

export function getProxies(req: Request, res: Response) {
	try {
		const page = parseInt(req.query.page as string) || 0
		const goodOnly = req.query.goodOnly as string === "true"

		Proxy.count()
			.then(n => Math.ceil(n / proxiesPerPage))
			.then((totalPages) => {
				if (page >= totalPages) {
					res.status(0 === totalPages ? 200 : 404)
						.json({ proxies: [], page, totalPages })

					return
				}

				Proxy.getMany(proxiesPerPage, page, goodOnly || !req.session.loggedIn)
					.then((proxies) => {
						res.status(200)
							.json({
								proxies: proxies.map(p => {
									const speedArr = [...(p.speed || []), ...(undefined !== p.todaySpeed && p.todaySpeed >= 0 ? [p.todaySpeed] : [])]
									const uptimeArr = [...(p.uptime || []), p.todayUptime || 0]

									return {
										scheme: p.scheme,
										port: p.port,
										address: p.address,
										speed: (speedArr.reduce((a, b) => a + b, 0) / speedArr.length) || undefined,
										uptime: (uptimeArr.reduce((a, b) => a + b, 0) / uptimeArr.length) || undefined,
										updatedAt: p.updatedAt,
									}
								}),
								page,
								totalPages,
							})
					})
			})
	} catch (error) {
		console.error(error)
	}
}

export function addProxies(req: Request, res: Response) {
	if (req.session.loggedIn !== true || req.session.user !== "admin") {
		res.status(401)
			.end()

		return
	}

	try {
		req.body.schemes.forEach((scheme: string) => {
			for (let port = req.body.ports[0]; port <= req.body.ports[1]; ++port) {
				for (let address = ip2number(req.body.addresses[0]); address <= ip2number(req.body.addresses[1]); ++address) {
					(new Proxy(scheme, number2ip(address), port)).insert()
						.catch(() => {
							// Throws an error if the proxy is already in the db
							// No need to do anything
						})
				}
			}
		})

		res.status(202)
			.end()
	} catch (error) {
		console.error(error)
	}
}

export function login(req: Request, res: Response) {
	if (req.session.loggedIn) {
		res.status(200)
			.json({ user: req.session.user })
		return
	}

	if (req.body.accessCode !== process.env.ADMIN_ACCESS_CODE) {
		res.status(401)
			.end()
		return
	}

	req.session.loggedIn = true
	req.session.user = "admin"
	res.status(200)
		.json({ user: "admin" })
}
