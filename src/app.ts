import "./config"
import { createAutochecker } from "./core"
import { testDatabaseConnection } from "./models"
import bodyParser from "body-parser"
import cors from "cors"
import express from "express"
import routes from "./routes"
import session from "express-session"

testDatabaseConnection().then(() => {
	const interval = parseFloat(process.env.CHECK_INTERVAL || "60")
	createAutochecker(interval * 1e3)

	const app = express()
	const port: string | number = process.env.PORT || 4000
	const sess = {
		secret: process.env.COOKIE_SECRET || "keyboardcat",
		cookie: { secure: false },
	}

	if (app.get("env") === "production") {
		app.set("trust proxy", 1) // Trust first proxy
		sess.cookie.secure = true // Serve secure cookies
	}

	app.use(
		cors({
			credentials: true,
			origin: process.env.CORS_ORIGIN || "http://127.0.0.1:3000",
		})
	)
	app.use(bodyParser.json())
	app.use(bodyParser.urlencoded({ extended: false }))
	app.use(session(sess))
	app.use(routes)

	app.listen(port, () => console.log(`App running on port ${port}.`))
})
