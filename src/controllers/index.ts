import { Response, Request } from "express"

import { Proxy } from "../models/proxy"
import { ip2Number, number2ip } from "../utils"

const proxiesPerPage = parseInt(process.env.PROXIES_PER_PAGE as string) || 10

function isLoggedIn(req: Request) {
	return (req.session as any).loggedIn === true
}

export const getProxies = async (req: Request, res: Response): Promise<void> => {
	try {
		const page = parseInt(req.query.page as string) || 0
		const goodOnly = req.query.goodOnly as string === "true"
		const totalPages = await Proxy.count()
			.then(n => Math.ceil(n / proxiesPerPage))

		if (page < totalPages) {
			Proxy.getMany(proxiesPerPage, page, goodOnly || !isLoggedIn(req))
				.then((proxies) => {
					res.status(200).json({ proxies, page, totalPages })
				})
		} else {
			res.status(404).json({ page, totalPages })
		}

	} catch (error) {
		console.error(error)
	}
}

export const addProxies = async (req: Request, res: Response): Promise<void> => {
	if ((req.session as any).loggedIn !== true || (req.session as any).user !== "admin") {
		res.status(401).end()
		return
	}

	try {
		req.body.schemes.forEach((scheme: string) => {
			for (let port = req.body.ports[0]; port <= req.body.ports[1]; ++port) {
				for (let address = ip2Number(req.body.addresses[0]); address <= ip2Number(req.body.addresses[1]); ++address) {
					let proxy = new Proxy({scheme, address: number2ip(address), port})

					proxy.insert()
						.catch(() => {
							// Throws an error if the proxy is already in the db
							// No need to do anything
						})
				}
			}
		})

		res.status(202).end()
	} catch (error) {
		console.error(error)
	}
}

export const login = async (req: Request, res: Response): Promise<void> => {
	if (isLoggedIn(req)) {
		res.status(200).json({ user: (req.session as any).user })
	} else {
		if (req.body.accessCode === process.env.ADMIN_ACCESS_CODE) {
			(req.session as any).loggedIn = true as boolean
			(req.session as any).user = "admin"

			res.status(200).json({ user: "admin" })
		} else {
			res.status(401).end()
		}
	}
}

