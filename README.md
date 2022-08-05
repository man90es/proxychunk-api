# ProxyChunk
ProxyChunk is a web-based open proxy checker and aggregator app. This repository only contains server-side code, client-side code is available [in a separate repository](https://github.com/octoman90/proxychunk-web).

## Installation
### Prerequisites
- GNU/Linux
- NodeJS >=v14.0
- pnpm (or Yarn, npm, etc.)
- PostgreSQL

### Installation
1. Install [proxyshiva](https://github.com/octoman90/proxyshiva) and make sure it is in your [PATH](<https://en.wikipedia.org/wiki/PATH_(variable)>).
2. Create a user and a database in PostgreSQL for ProxyChunk to use.
3. Clone this repository and run `pnpm install` command in the root directory of your local copy.
4. Change configuration by editing the `.env` file.
5. Run `pnpm build` command.

## Running
1. Start PostgreSQL.
2. Run `pnpm start` command command in the root directory.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](LICENSE)
