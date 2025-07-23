
import { Router } from 'express';
import { addRoles, deleteRole, getRoleById, getRoles, updateRole } from '../controller/role';
import { isAuthenticated } from '../middleware/isAuthenticated';

const router = Router();

router.get('/getRoles',isAuthenticated, getRoles);
router.get('/getRole/:id',isAuthenticated,getRoleById)
router.post('/addRoles',isAuthenticated,addRoles);
router.put('/updateRole/:id',isAuthenticated,updateRole);
router.delete('/deleteRole/:id',isAuthenticated,deleteRole);

export default router
