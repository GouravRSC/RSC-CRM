import { Request,Response } from "express"
import connection from "../database/db"
import redis from "../database/redis";
import { updateUserSchema, userSchema } from "../validation/userSchema.validation";
import { uploadToCloudinary } from "../services/cloudinary.service";
import { v2 as cloudinary } from "cloudinary";
import argon2 from 'argon2';
import { UserImageQueue } from "../queues/UserImage.Queue";
import { decrypt, encrypt } from "../utils/passwordEncryption";


export const getAllUsers = async(req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        // Query params
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || "";
        const keyword = `%${search.toLowerCase()}%`;
        const offset = (page - 1) * limit;

        // Get the current version of users
        const versionKey = "Users:version";
        let version = await redis.get(versionKey);

        if(!version){
            version = "1";
            await redis.set(versionKey, version);
        }

        // Redis Key with query fingerprint
        const cacheKey = `Users:v${version}:page=${page}:limit=${limit}:search=${search}`;

        const cachedUsers = await redis.get(cacheKey)

        if(cachedUsers){
            return res.status(200).json({
                message:"Users Fetched Successfully",
                data : JSON.parse(cachedUsers)
            })
        }

        const [users]: any = await conn.query(
            `SELECT 
                u.id, u.name, u.email, u.password, u.phoneNumber, 
                u.roleId, r.roleType, u.status, u.profileImage, 
                DATE_FORMAT(u.registerDate, '%Y-%m-%d') as registerDate,
                DATE_FORMAT(u.dateOfBirth, '%Y-%m-%d') as dateOfBirth
            FROM users u
            LEFT JOIN role r ON u.roleId = r.id
            WHERE 
                LOWER(u.name) LIKE ? OR
                LOWER(u.email) LIKE ? OR
                u.phoneNumber LIKE ? OR
                LOWER(u.status) LIKE ? OR
                LOWER(r.roleType) LIKE ? OR
                DATE_FORMAT(u.registerDate, '%Y-%m-%d') LIKE ? OR
                CAST(u.id AS CHAR) LIKE ? OR
                LOWER(u.password) LIKE ?
            ORDER BY u.id DESC
            LIMIT ? OFFSET ?`,
            [keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword, limit, offset]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No Users Found",
            });
        }

        const [countResult]: any = await conn.query(
            `SELECT COUNT(*) AS total
             FROM users u
             LEFT JOIN role r ON u.roleId = r.id
             WHERE 
                LOWER(u.name) LIKE ? OR
                LOWER(u.email) LIKE ? OR
                u.phoneNumber LIKE ? OR
                LOWER(u.status) LIKE ? OR
                LOWER(r.roleType) LIKE ? OR
                DATE_FORMAT(u.registerDate, '%Y-%m-%d') LIKE ? OR
                CAST(u.id AS CHAR) LIKE ? OR
                LOWER(u.password) LIKE ?`,
            [keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword]
        );

        // 🔓 Decrypt password before sending to frontend
        const decryptedUsers = users.map((user: any) => ({
            ...user,
            password: decrypt(user.password), // 🔓 custom decrypt function
        }));

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);
        
        const response = {
            success: true,
            message: "Users Fetched Successfully",
            data: decryptedUsers,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                limit,
            },
        };

        await redis.set(cacheKey,JSON.stringify(response),'EX',60 * 5)

        return res.status(200).json({
            success: true,
            message:"Users Fetched Successfully",
            data : response
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
            `SELECT 
                users.id, 
                users.name, 
                users.email, 
                users.phoneNumber, 
                role.roleType AS role, 
                users.status, 
                users.profileImage,
                users.password,
                DATE_FORMAT(users.registerDate, '%Y-%m-%d') AS registerDate,
                DATE_FORMAT(users.dateOfBirth, '%Y-%m-%d') AS dateOfBirth
            FROM users
            LEFT JOIN role ON users.roleId = role.id
            WHERE users.id = ? 
            LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User Not Found",
            });
        }

        const user = rows[0]

        // 🔐 Decrypt password (tumhara likha hua helper use karte hue)
        const decryptedPassword = decrypt(user.password);

        return res.status(200).json({
            success: true,
            message: "User fetched successfully",
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                status: user.status,
                profileImage: user.profileImage,
                password: decryptedPassword,
                registerDate: user.registerDate,
                dateOfBirth: user.dateOfBirth,
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: `Error Fetching User: ${error.message}`,
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

        const {name,email,password,phoneNumber,registerDate,dateOfBirth } = parsed.data;

        const {roleId,status} = req.body;

        if (!roleId || !status) {
            return res.status(400).json({
                success: false,
                message: "roleId and status are required fields.",
            });
        }

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
                message: "Email Already Exists. Please Login.",
            });
        }        

        if (roleCheck.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid Role.`,
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

        const encryptedPassword = encrypt(password);

        // Default Image Fallback
        let profileImageUrl = "";

        console.log("register Date: ",registerDate);
        console.log("date of birth: ",dateOfBirth)

        const [result]: any = await conn.query(
            `INSERT INTO users 
            (name, email, password, phoneNumber, roleId, status, profileImage, registerDate, dateOfBirth)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                email,
                encryptedPassword,
                phoneNumber,
                roleId || null,
                finalStatus,
                profileImageUrl,
                registerDate || new Date(), // Default: now
                dateOfBirth || null,
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

        // 🔁 Invalidate version-based cache
        await redis.incr("Users:version");

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

        const {name,email,password,phoneNumber,registerDate, dateOfBirth} = parsed.data;

        const {roleId,status} = req.body;

        const [userRows] : any = await conn.query(
            `SELECT profileImage FROM users WHERE id = ?`,
            [id]
        )

        let oldImageUrl : string | null = userRows?.[0]?.profileImage || null
        let profileImage : string | null = oldImageUrl

        if(req.file){
            profileImage = await uploadToCloudinary(req.file.buffer)

            if(oldImageUrl){
                const publicId = extractCloudinaryPublicId(oldImageUrl)
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                }
            }
        }


        // 🔐 Encrypt password if provided
        let encryptedPassword: string | undefined;
        if (password) {
            encryptedPassword = encrypt(password);
        }

        const updateFields: { [key: string]: any } = {};

        if(name) updateFields.name = name;
        if (email) updateFields.email = email;
        if (password) updateFields.password = encryptedPassword;
        if (phoneNumber) updateFields.phoneNumber = phoneNumber;
        if (roleId !== undefined) updateFields.roleId = roleId || null;
        if (status) updateFields.status = status;
        if (profileImage) updateFields.profileImage = profileImage;
        if (registerDate) updateFields.registerDate = registerDate;
        if (dateOfBirth) updateFields.dateOfBirth = dateOfBirth;

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
            return res.status(400).json({
                success: false,
                message: "User Not Updated",
            });
        }

        // 🔁 Invalidate version-based cache
        await redis.incr("Users:version");

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
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format",
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
                message: "User Not Found",
            })
        }

        // 🔁 Invalidate version-based cache
        await redis.incr("Users:version");

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