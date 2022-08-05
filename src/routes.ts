import { getProxies, addProxies, login } from "./controllers"
import { Router } from "express"

const router = Router()

router.get("/proxies", getProxies)
router.post("/proxies", addProxies)
router.post("/login", login)

export default router
