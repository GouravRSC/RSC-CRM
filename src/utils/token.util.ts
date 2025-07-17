import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();

const ACCESS_TOKEN_EXPIRY = "10m";
const REFRESH_TOKEN_EXPIRY = "7d";

export const generateAccessToken = (payload: any): string => {
    return jwt.sign(payload, process.env.JWT_SECRET as string, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    });
};

export const generateRefreshToken = (payload: any): string => {
    const refreshPayload = {
        ...payload,
        tokenId: uuidv4(),
    };

    return jwt.sign(refreshPayload, process.env.JWT_REFRESH_SECRET as string, {
        expiresIn: '7d',
    });
};


