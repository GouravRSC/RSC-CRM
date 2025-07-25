import { Request, Response } from 'express';
import connection from '../database/db';
import redis from '../database/redis';
import { roleSchema } from '../validation/roleShema.validation';



export const getRoles = async (req:Request,res:Response) =>  {
    const conn = await connection.getConnection();
    try{
        // Query params
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || "";
        const keyword = search.toLowerCase();
        const offset = (page - 1) * limit;

        // Get the current version of roles
        const versionKey = "Roles:version";
        let version = await redis.get(versionKey);

        if(!version){
            version = "1";
            await redis.set(versionKey, version);
        }

        // Redis Key with query fingerprint
        const cacheKey = `Roles:v${version}:page=${page}:limit=${limit}:search=${keyword}`;

        const cachedData = await redis.get(cacheKey);

        if(cachedData){
            return res.status(200).json({
                message : "Roles Fetched Successfully",
                data : JSON.parse(cachedData)
            })
        }

        const [[roleRows], [countRows]]: any = await Promise.all([
            conn.query(
                `SELECT * FROM role WHERE LOWER(roleType) LIKE ? ORDER BY id ASC LIMIT ? OFFSET ?`,
                [`%${keyword}%`, limit, offset]
            ),
            conn.query(
                `SELECT COUNT(*) as total FROM role WHERE LOWER(roleType) LIKE ?`,
                [`%${keyword}%`]
            ),
        ]);


        const total = countRows[0]?.total || 0;
        const totalPages = Math.ceil(total / limit);

        const result = {
            page,
            limit,
            totalPages,
            total,
            roles : roleRows,
        };

        await redis.set(cacheKey,JSON.stringify(result), "EX" ,60 * 5)

        return res.status(200).json({
            message : roleRows.length === 0 ? "No Roles Found" : "Roles Fetched Successfully",
            data : result
        })      
    }catch(error){
        return res.status(500).json({
            message : `Error Regarding Getting The Roles : ${error}`,
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
                message: "No Role Found",
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
            message: `Error Regarding Getting The Role : ${error}`,
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

        // 🔁 Invalidate version-based cache
        await redis.incr("Roles:version");

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
                message: "No Role Found",
            });
        }

        // 🔁 Invalidate version-based cache
        await redis.incr("Roles:version");

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
                message: "No Role Found",
            })
        }

        // 🔁 Invalidate version-based cache
        await redis.incr("Roles:version");

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
