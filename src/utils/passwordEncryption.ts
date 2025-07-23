import crypto from "crypto";
import dotenv from 'dotenv';
dotenv.config()

const rawKey = process.env.AES_SECRET_KEY;
if (!rawKey || rawKey.length < 32) {
  throw new Error("AES_SECRET_KEY must be at least 32 characters long");
}

const ENCRYPTION_KEY = rawKey.slice(0, 32);  
const IV_LENGTH = 16;

export const encrypt = (text: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
};

export const decrypt = (text: string): string => {
    const parts = text.split(":");
    if (parts.length !== 2) throw new Error("Invalid encrypted text format");

    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

