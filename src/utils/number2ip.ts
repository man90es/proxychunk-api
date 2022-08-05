export default function number2ip(ipInt: number): string {
	return [(ipInt >>> 24), (ipInt >> 16 & 255), (ipInt >> 8 & 255), (ipInt & 255)].join(".")
}
