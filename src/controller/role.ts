import { Request, Response } from 'express';
import connection from '../database/db';
import redis from '../database/redis';
import { roleSchema } from '../validation/roleShema.validation';


export const getRoles = async (req:Request,res:Response) =>  {
    const conn = await connection.getConnection();
    try{
        const cachedRoles = await redis.get('All-Roles')

        if(cachedRoles){
            return res.status(200).json({
                message : "Roles Are Coming From Redis Database",
                data : JSON.parse(cachedRoles)
            })
        }


        const [rows] : any = await conn.query(`
            SELECT * from role
        `)

        if(rows.length === 0){
            return res.status(200).json({
                message : 'Ask Admin To Create Roles'
            })
        }

        await redis.set('All-Roles',JSON.stringify(rows),"EX",60*60*24*30)

        return res.status(200).json({
            message : 'Roles Fetched Successfully',
            data : rows
        })
        
    }catch(error){
        return res.status(500).json({
            message : `Error Regarding Getting The Roles Inside Role Controller : ${error}`,
            success : false
        })
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
}


export const getRoleById = async (req: Request, res: Response) => {
    const conn = await connection.getConnection();
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Error: ID Is Required",
            });
        }

        const [rows]: any = await conn.query(`SELECT * FROM role WHERE id = ?`, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No Role Found With This ID",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Role fetched successfully",
            data: rows[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: `Error Regarding Getting The Role Via ID : ${error}`,
        });
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
};


export const addRoles = async (req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        const parsed = roleSchema.safeParse(req.body.roleType)

        if(parsed.error){
            return res.status(400).json({
                success: false,
                message: "Invalid Role Input",
                errors: parsed.error.errors[0].message,
            })
        }

        const roleType = parsed.data;

        await conn.query(
            `INSERT INTO role (roleType) VALUES (?) ON DUPLICATE KEY UPDATE roleType = VALUES(roleType)`,
            [roleType]
        )

        //delete the All-Roles from redis
        await redis.del('All-Roles')

        return res.status(200).json({
            message : 'Roles Added Successfully',
            success : true,
        })
    }catch(error){
        return res.status(500).json({
            message : `Error Regarding Adding Roles : ${error}`,
            success : false
        })
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
}


export const updateRole = async (req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        const {id} = req.params

        if(!id){
            return res.status(404).json({
                message : "Error: ID Is Required",
                success : false
            })
        }

        const parsed = roleSchema.safeParse(req.body.roleType)

        if(parsed.error){
            return res.status(400).json({
                success: false,
                message: "Invalid Role Input",
                errors: parsed.error.errors[0].message,
            }) 
        }

        const roleType = parsed.data

        const [result] = await conn.query(
            `UPDATE role SET roleType = ? WHERE id = ?`,
            [roleType, id]
        );


        // result.affectedRows will be 0 if id doesn't exist
        if ((result as any).affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Invalid ID: No Role Found With This ID",
            });
        }

        //delete the All-Roles from redis
        await redis.del('All-Roles')

        return res.status(200).json({
            message : 'Role Updated Successfully',
            success : true
        })

    }
    catch(error){
        return res.status(500).json({
            message : `Error Regarding Update Role : ${error}`,
            success : false
        })
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
}


export const deleteRole = async (req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        const {id} = req.params

        if(!id){
            return res.status(404).json({
                message : "Error: ID Is Required",
                success : false
            })
        }


        // Count how many users will be affected
        const [usersWithRole] = await conn.query(
            `SELECT COUNT(*) AS count FROM users WHERE roleId = ?`,
            [id]
        );

        const affectedUsers = (usersWithRole as any)[0].count;

        const [result] = await conn.query(
            `DELETE FROM role where id = ?`,
            [id]
        )

        // result.affectedRows will be 0 if id doesn't exist
        if((result as any).affectedRows === 0){
            return res.status(404).json({
                success: false,
                message: "Invalid ID: No Role Found With This ID",
            })
        }

        //delete the All-Roles from redis
        await redis.del('All-Roles')

        return res.status(200).json({
            success: true,
            message: `Role Deleted Successfully. ${affectedUsers} User(s) Now Have No Role.`,
        })


    }catch(error){
        return res.status(500).json({
            message : `Error Regarding Delete Role : ${error}`,
            success : false
        })
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
}
