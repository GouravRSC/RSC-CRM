import { Request,Response } from "express"
import connection from "../database/db"
import redis from "../database/redis";
import { updateUserSchema, userSchema } from "../validation/userSchema.validation";
import { uploadToCloudinary } from "../services/cloudinary.service";
import { v2 as cloudinary } from "cloudinary";
import argon2 from 'argon2';
import { UserImageQueue } from "../queues/UserImage.Queue";

// PAGINATION PENDING ----> 1. getAllUsers  2. getUsers via pagination to display on frontend    3. getUserById
export const getAllUsers = async(req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        const cachedUsers = await redis.get("All-Users")

        if(cachedUsers){
            return res.status(200).json({
                message:"Users Are Coming From Redis Database",
                data : JSON.parse(cachedUsers)
            })
        }

        const [rows] : any = await conn.query(
            `SELECT id, name, email, phoneNumber, roleId, status, profileImage FROM users`
        )

        if(rows.length === 0){
            return res.status(200).json({
                message : 'Ask Admin To Create Users'
            })
        }

        await redis.set('All-Users',JSON.stringify(rows),'EX',30*60*60*24)

        return res.status(200).json({
            success: true,
            message:"Users Fetched Successfully",
            data : rows
        })
        
    }catch(error){
        return res.status(500).json({
            success: false,
            message:`Error While Getting Users : ${error}`
        })
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
}


export const getUserById = async (req: Request, res: Response) => {
    const conn = await connection.getConnection();
    try {
        const { id } = req.params;

        const [rows]: any = await conn.query(
            `SELECT id, name, email, phoneNumber, roleId, status, profileImage 
             FROM users WHERE id = ? LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User fetched successfully",
            data: rows[0],
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: `Error fetching user: ${error.message}`,
        });
    } finally {
        if (conn) conn.release();
    }
};



export const addUser = async (req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        const parsed = userSchema.safeParse(req.body) 

        if(parsed.error){
            return res.status(400).json({
                success:false,
                message:"Invalid User Input",
                errors:parsed.error.errors.map((e) => e.message)
            })
        }

        const {name,email,password,phoneNumber} = parsed.data;

        const {roleId,status} = req.body;

        const [existingUserResult, roleCheckResult] = await Promise.all([
            conn.query("SELECT 1 FROM users WHERE email = ? LIMIT 1", [email]),
            roleId 
                ? conn.query("SELECT 1 FROM role WHERE id = ? LIMIT 1", [roleId]) 
                : Promise.resolve([[]])
        ]);

        const [existingUser] : any = existingUserResult;
        const [roleCheck] : any = roleCheckResult;

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already exists. Please login.",
            });
        }        

        if (roleCheck.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid roleId: Role with id ${roleId} does not exist.`,
            });
        }
     
        // Validate status
        const validStatuses = ["active", "inactive"];
        const finalStatus = status || "active";

        if (!validStatuses.includes(finalStatus.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Allowed values are: active, inactive.",
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required",
            });
        }

        const hashedPassword = await argon2.hash(password);

        // Default Image Fallback
        let profileImageUrl = "";

        const [result] : any = await conn.query(
            `INSERT INTO users (name, email, password, phoneNumber, roleId, status, profileImage)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                email,
                hashedPassword,
                phoneNumber,
                roleId || null,
                finalStatus || "active",
                profileImageUrl,
            ]
        );

        const userId = result.insertId;

        // Queue image upload job if image provided
        if (req.file?.buffer && Buffer.isBuffer(req.file.buffer)) {
            await UserImageQueue.add("upload-profile", {
                userId,
                buffer: req.file.buffer,
            }, {
                removeOnComplete: true, // ✅ auto delete job from Redis after success
                removeOnFail: true,      // ✅ auto delete failed jobs
                attempts: 2,
                backoff: {
                    type: "exponential",
                    delay: 3000,
                }
            });
        }

        await redis.del('All-Users')

        return res.status(200).json({
            success: true,
            message: "User Created Successfully",
        });
    } catch(error : any){
        return res.status(500).json({
            success: false,
            message:`Error While Adding Users :  ${error.message || JSON.stringify(error)}`
        })
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
}


export const updateUser = async (req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        const {id} = req.params

        if(!id){
            return res.status(404).json({
                success : false,
                message : "Error: ID Is Required"
            })
        }

        const [userCountRows]: any = await conn.query(
            `SELECT COUNT(*) AS count FROM users WHERE id = ?`,
            [id]
        );

        if (userCountRows[0].count === 0) {
            return res.status(404).json({
                success: false,
                message: "User Not Found.",
            });
        }

        const parsed = updateUserSchema.safeParse(req.body)

        if(parsed.error){
            return res.status(400).json({
                success:false,
                message:"Invalid User Input",
                errors:parsed.error.errors.map((e) => e.message)
            })
        }

        const {name,email,password,phoneNumber} = parsed.data;

        const {roleId,status} = req.body;

        let profileImage : string | null = null;

        const [userRows] : any = await conn.query(
            `SELECT profileImage FROM users WHERE id = ?`,
            [id]
        )

        let oldImageUrl : string | null = null

        if(userRows){
            oldImageUrl = userRows[0].profileImage
        }

        if(req.file){
            profileImage = await uploadToCloudinary(req.file.buffer)

            if(oldImageUrl){
                const publicId = extractCloudinaryPublicId(oldImageUrl)
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                }
            }
        }else{
            profileImage = oldImageUrl;
        } 


        // Hash password only if provided
        let hashedPassword: string | undefined;
        if (password) {
            hashedPassword = await argon2.hash(password);
        }

        const updateFields: { [key: string]: any } = {};

        if(name) updateFields.name = name;
        if (email) updateFields.email = email;
        if (password) updateFields.password = hashedPassword;
        if (phoneNumber) updateFields.phoneNumber = phoneNumber;
        if (roleId !== undefined) updateFields.roleId = roleId || null;
        if (status) updateFields.status = status;
        if (profileImage) updateFields.profileImage = profileImage;

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No Fields Provided For Update",
            });
        }

        const updateSQL = `
            UPDATE users SET 
            ${Object.keys(updateFields)
                .map((key) => `${key} = ?`)
                .join(", ")}
            WHERE id = ?
        `;

        const values = [...Object.values(updateFields),id];

        const [result] = await conn.query(updateSQL,values);

        if ((result as any).affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "No Fields Provided For Update",
            });
        }

        await redis.del("All-Users");


        return res.status(200).json({
            success: true,
            message: "User Updated Successfully",
        });
    }catch(error){
        return res.status(500).json({
            success:false,
            message : `Error Regarding Update User: ${error}`
        })
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
}


export const deleteUser = async (req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        const {id} = req.params

        if(!id){
            return res.status(404).json({
                success : false,
                message : "Error: ID Is Required"
            })
        }

        const [userCountRows]: any = await conn.query(
            `SELECT COUNT(*) AS count FROM users WHERE id = ?`,
            [id]
        );

        if (userCountRows[0].count === 0) {
            return res.status(404).json({
                success: false,
                message: "User Not Found With The Given ID",
            });
        }

        const [result] = await conn.query(
            `DELETE FROM users where id = ?`,
            [id]
        )


        // result.affectedRows will be 0 if id doesn't exist
        if((result as any).affectedRows === 0){
            return res.status(404).json({
                success: false,
                message: "Invalid ID: No User Found With This ID",
            })
        }

        await redis.del("All-Users")

        return res.status(200).json({
            success: true,
            message: `User Deleted Successfully.`,
        })
    }catch(error){
        return res.status(500).json({
            success:false,
            message : `Error Regarding Delete User: ${error}`
        })
    }finally {
        if (conn) conn.release(); // ✅ always release connection
    }
}


const extractCloudinaryPublicId = (url: string): string | null => {
    try {
        const parts = url.split("/");
        const fileName = parts[parts.length - 1];
        const [publicId] = fileName.split(".");
        return `user-profiles/${publicId}`;
    } catch (err) {
        return null;
    }
};