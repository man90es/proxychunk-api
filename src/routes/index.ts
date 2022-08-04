import { Router } from "express"
import { getProxies, addProxies, login } from "../controllers"

const router = Router()

router.get("/proxies", getProxies)
router.post("/proxies", addProxies)
router.post("/login", login)

export default router
