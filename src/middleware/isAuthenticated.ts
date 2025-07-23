import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import connection from "../database/db";
import dotenv from "dotenv";

dotenv.config();

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    try {
        // 1. Check if token is blacklisted
        const conn = await connection.getConnection();

        const [rows]: any = await conn.query(
            "SELECT * FROM blacklisted_tokens WHERE token = ? AND expiresAt > NOW()",
            [token]
        );

        conn.release();

        if (rows.length > 0) {
            return res.status(401).json({ success: false, message: "Unautherized Access.Please login again" });
        }

        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        (req as any).user = decoded;

        next();
    } catch (err:any) {

        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Access token expired. Please login again.",
            });
        }

        return res.status(401).json({ success: false, message: "Invalid token" });
    }
};

