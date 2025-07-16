import { Router } from "express";
import { upload } from "../middleware/multer";
import { addUser, deleteUser, getAllUsers, updateUser } from "../controller/users";

const router = Router();

router.get("/exportUser",getAllUsers)
router.post("/addUser", upload.single("profileImage"), addUser);
router.put("/updateUser/:id",upload.single("profileImage"),updateUser);
router.delete("/deleteUser/:id",deleteUser)

export default router