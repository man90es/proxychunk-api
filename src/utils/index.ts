export function ip2Number(ip: string): number {
	return ip.split(".").reduce((ipInt, octet) => {
		return (ipInt<<8) + parseInt(octet, 10)
	}, 0) >>> 0
}

export function number2ip(ipInt: number): string {
    return [(ipInt>>>24), (ipInt>>16 & 255), (ipInt>>8 & 255), (ipInt & 255)].join(".")
}
