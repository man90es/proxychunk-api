import express from "express"
import session from "express-session"
import bodyParser from "body-parser"
import cors from "cors"

import routes from "./routes"
import checker from "./core"
import { testDatabaseConnection } from "./models"

testDatabaseConnection()
	.then(() => {
		const app = express()
		const port: string | number = process.env.PORT || 4000
		const sess = {
			secret: process.env.COOKIE_SECRET || "keyboardcat",
			cookie: { secure: false }
		}

		if (app.get("env") === "production") {
			app.set("trust proxy", 1) // trust first proxy
			sess.cookie.secure = true // serve secure cookies
		}

		app.use(cors({
			origin: process.env.CORS_ORIGIN || "http://127.0.0.1:3000",
			credentials: true,
		}))
		app.use(bodyParser.json())
		app.use(bodyParser.urlencoded({ extended: false }))
		app.use(session(sess))
		app.use(routes)

		checker.startRecheckRoutine()

		app.listen(port, () => {
			console.log(`App running on port ${port}.`)
		})
	})
