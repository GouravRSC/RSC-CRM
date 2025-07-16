
import { Router } from 'express';
import { addRoles, deleteRole, getRoleById, getRoles, updateRole } from '../controller/role';

const router = Router();

router.get('/getRoles', getRoles);
router.get('/getRole/:id',getRoleById)
router.post('/addRoles',addRoles);
router.put('/updateRole/:id',updateRole);
router.delete('/deleteRole/:id',deleteRole);

export default router
