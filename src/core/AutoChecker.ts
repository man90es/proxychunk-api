import { ChildProcessWithoutNullStreams } from "child_process"
import { Proxy } from "../models/Proxy"

export default class AutoChecker {
	#interval: NodeJS.Timeout
	#shiva: ChildProcessWithoutNullStreams

	constructor(shiva: ChildProcessWithoutNullStreams, autoCheckInterval: number) {
		this.#shiva = shiva
		this.#interval = setInterval(() => {
			Proxy.findLRC()
				.then(({ scheme, address, port }) => {
					this.#addToQueue(scheme, address, port)
				})
				.catch(() => {
					// Ignore errors
				})
		}, autoCheckInterval)
	}

	#addToQueue(scheme: string, address: string, port: number): void {
		this.#shiva.stdin.write(`${scheme}://${address}:${port}\n`)
	}

	destroy() {
		clearInterval(this.#interval)
	}
}
