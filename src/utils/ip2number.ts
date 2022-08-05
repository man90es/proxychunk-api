export default function ip2Number(ip: string): number {
	return ip.split(".").reduce((ipInt, octet) => (
		(ipInt << 8) + parseInt(octet, 10)
	), 0) >>> 0
}
