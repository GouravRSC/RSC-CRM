import { Router } from "express";
import { changeUserPassword, logout, SignIn } from "../controller/auth";
import { refreshAccessTokenHandler } from "../helper/refreshTokenHandler";
import { isAuthenticated } from "../middleware/isAuthenticated";

const router = Router();

router.post("/signin", SignIn);
router.post("/refreshToken",refreshAccessTokenHandler);
router.post("/logout",isAuthenticated,logout);
router.put("/changePassword/:id",isAuthenticated,changeUserPassword)

export default router;
