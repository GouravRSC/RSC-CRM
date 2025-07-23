import { Router } from "express";
import { upload } from "../middleware/multer";
import { addUser, deleteUser, getAllUsers, getUserById, updateUser } from "../controller/users";
import { isAuthenticated } from "../middleware/isAuthenticated";

const router = Router();

router.get("/getAllUser",isAuthenticated,getAllUsers);
router.get("/getUser/:id",isAuthenticated,getUserById);
router.post("/addUser",isAuthenticated, upload.single("profileImage"), addUser);
router.put("/updateUser/:id",isAuthenticated,upload.single("profileImage"),updateUser);
router.delete("/deleteUser/:id",isAuthenticated,deleteUser)

export default router