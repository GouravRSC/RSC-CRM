
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import connection from "../database/db";
import { generateAccessToken } from "../utils/token.util";
import { generateRefreshToken } from "../utils/token.util";

export const refreshAccessTokenHandler = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token required" });

    const conn = await connection.getConnection();

    try {

        // 1. Detect reuse first (security check)
        const [reuseCheck]: any = await conn.query(
            "SELECT * FROM refresh_tokens WHERE token = ? AND isValid = FALSE LIMIT 1",
            [refreshToken]
        );

        if (reuseCheck.length > 0) {
            return res.status(403).json({ success: false, message: "Token Reuse Detected. Please Login Again." });
        }

        const [rows]: any = await conn.query(
            "SELECT * FROM refresh_tokens WHERE token = ? AND isValid = TRUE LIMIT 1",
            [refreshToken]
        );

        if (rows.length === 0) return res.status(403).json({ success: false, message: "Token invalid or blacklisted" });

        // 3. Verify token signature & expiration
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;
        } catch (err) {
            return res.status(401).json({ success: false, message: "Invalid Or Expired Refresh Token" });
        }

        // Rotate: invalidate old refresh token
        await conn.query("UPDATE refresh_tokens SET isValid = FALSE WHERE token = ?", [refreshToken]);

        const userPayload = {
            id: decoded.id,
            email: decoded.email,
            roleId: decoded.roleId,
        };

        const newAccessToken = generateAccessToken(userPayload);
        const newRefreshToken = generateRefreshToken(userPayload);

        // Save new refresh token
        await conn.query(
            `INSERT INTO refresh_tokens (token, userId, ipAddress, deviceInfo, expiresAt)
             VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
            [
                newRefreshToken,
                decoded.id,
                req.ip,
                req.headers["user-agent"] || "unknown",
            ]
        );

        return res.status(200).json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });

    } catch (err: any) {
        return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
    } finally {
        if (conn) conn.release();
    }
};
