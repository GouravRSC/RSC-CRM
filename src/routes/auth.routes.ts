import { Router } from "express";
import { changeUserPassword, logout, SignIn } from "../controller/auth";
import { refreshAccessTokenHandler } from "../helper/refreshTokenHandler";

const router = Router();

router.post("/signin", SignIn);
router.post("/refreshToken",refreshAccessTokenHandler);
router.post("/logout",logout);
router.put("/changePassword/:id",changeUserPassword)

export default router;
