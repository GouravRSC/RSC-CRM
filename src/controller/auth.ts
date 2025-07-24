import { Request,Response } from "express"
import connection from "../database/db";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/token.util";
import { sanitizeUser } from "../helper/sanitizeUser";
import redis from "../database/redis";
import { passwordSchema } from "../validation/userSchema.validation";
import { decrypt, encrypt } from "../utils/passwordEncryption";

export const SignIn = async (req:Request,res:Response) => {
    const conn = await connection.getConnection();
    try{
        const {email,password} = req.body;

        if(!email || !password){
            return res.status(400).json({
                message : "Email And Password Are Required"
            })
        }

        const [rows] : any = await conn.query(
            "SELECT * FROM users WHERE email = ? LIMIT 1",
            [email]
        );

        if(rows.length === 0){
            return res.status(404).json({
                message : "User Not Exist"
            })
        }

        const user = rows[0];

        // 👇 Decrypt stored password and compare
        const decryptedPassword = decrypt(user.password);
        if (decryptedPassword !== password) {
            return res.status(401).json({
                message: "Invalid Credentials"
            });
        }

        //check if user is active or not
        if(user.status !== "active"){
            return res.status(403).json({
                message : "Your Account Is Not Active."
            })
        }

        const accessToken = generateAccessToken({
            id : user.id,
            email : user.email,
            roleId : user.roleId
        })

        const refreshToken = generateRefreshToken({
            id : user.id,
            email : user.email,
            roleId : user.roleId
        })

        //save refresh Token in database
        await conn.query(
            `INSERT INTO refresh_tokens (token, userId, ipAddress, deviceInfo, expiresAt)
            VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
            [
                refreshToken,
                user.id,
                req.ip,
                req.headers['user-agent'] || "Unknown",
            ]
        )

        return res.status(200).json({
            success: true,
            user : sanitizeUser(user),
            accessToken,
            refreshToken,
        });
    }catch(error){
        console.log("Error in Auth Controller SignIn ",error);
        res.status(500).json({
            message: "Internal Server Error"
        })
    }finally{
        if (conn) conn.release();
    }
}


export const logout = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;

    if (!refreshToken) {
        return res.status(400).json({ success: false, message: "Refresh token is required" });
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(400).json({ success: false, message: "Access token is required in Authorization header" });
    }

    const accessToken = authHeader.split(" ")[1];

    const conn = await connection.getConnection();

    try {
        // 1. Invalidate refresh token in DB
        await conn.query("UPDATE refresh_tokens SET isValid = FALSE WHERE token = ?", [refreshToken]);

        // 2. Decode access token to get expiration time
        const decoded: any = jwt.decode(accessToken);
        if (!decoded || !decoded.exp) {
            return res.status(400).json({ success: false, message: "Invalid access token" });
        }

        const expiresAt = new Date(decoded.exp * 1000); // JWT exp is in seconds

        // 3. Insert access token into blacklist
        await conn.query("INSERT INTO blacklisted_tokens (token, expiresAt) VALUES (?, ?)", [
            accessToken,
            expiresAt,
        ]);

        return res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    } finally {
        if (conn) conn.release();
    }
};



export const changeUserPassword = async (req: Request, res: Response) => {
    const conn = await connection.getConnection();
    try {
        const { id } = req.params;

        // Parse the whole body as password
        const parseResult = passwordSchema.safeParse(req.body.newPassword);

        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                errors: parseResult.error.flatten().fieldErrors,
            });
        }

        const newPassword = parseResult.data!;
        const encryptedPassword = encrypt(newPassword);

        const [result]: any = await conn.query(
            `UPDATE users SET password = ? WHERE id = ?`,
            [encryptedPassword, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        await redis.del("All-Users");

        return res.status(200).json({
            success: true,
            message: "Password updated successfully.",
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: `Error updating password: ${error.message}`,
        });
    } finally {
        if (conn) conn.release();
    }
};