import { Router } from "express";
import { logout, SignIn } from "../controller/auth";
import { refreshAccessTokenHandler } from "../helper/refreshTokenHandler";

const router = Router();

router.post("/signin", SignIn);
router.post("/refreshToken",refreshAccessTokenHandler);
router.post("/logout",logout)

export default router;
