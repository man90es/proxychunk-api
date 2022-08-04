import { spawn } from "child_process"

import { Proxy } from "../models/proxy"

const shivaParams = ["-json", "-interactive"]

if (process.env.SKIP_RESERVED === undefined || process.env.SKIP_RESERVED === "true") {
	shivaParams.push("-skipres")
}

if (process.env.ANY_CERT === "true") {
	shivaParams.push("-skipcert")
}

if (process.env.TIMEOUT !== undefined) {
	shivaParams.push(`-timeout=${process.env.TIMEOUT}`)
}

const shiva = spawn("proxyshiva", shivaParams)

shiva.on("error", (err) => {
	if (err.message.includes("ENOENT")) {
		console.log(
			"Looks like you don't have proxyshiva installed in your system\n" +
			"Refer to the README file for installation instructions"
		)
	} else {
		console.log("Unknown critical error occured:", err.message)
	}

	process.exit(1)
})

shiva.stdin.setDefaultEncoding("utf-8")

shiva.stdout.on("data", (data) => {
	data.toString().split("\n").forEach((result: string) => {
		try {
			let proxy = new Proxy(JSON.parse(result))
			proxy.update()
		} catch {
			// Can be ignored
		}
	})
})

function recheckRoutine(): void {
	Proxy.findLRC()
		.then((leastRecentlyChecked) => {
			checker.checkOne(leastRecentlyChecked.scheme, leastRecentlyChecked.address, leastRecentlyChecked.port)
		})
		.catch(() => {
			// Can be ignored
		})
}

let recheckInterval

const checker = {
	checkOne(scheme: string, address: string, port: number): void {
		shiva.stdin.write(`${scheme}://${address}:${port}\n`)
	},

	checkMany(schemes: string[], addresses: string[], ports: number[]): void {
		shiva.stdin.write(`${schemes.join(",")}://${addresses.join("-")}:${ports.join("-")}\n`)
	},

	startRecheckRoutine(): void {
		recheckInterval = setInterval(recheckRoutine, 5e4)
	}
}

export default checker
