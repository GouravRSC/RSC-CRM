import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream'
import sharp from 'sharp';
import 'dotenv/config'; 

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME!,
  api_key: process.env.CLOUD_API_KEY!,
  api_secret: process.env.CLOUD_API_SECRET!,
  secure: true,
});


export const uploadToCloudinary = async(buffer: Buffer): Promise<string> => {
  try{
    const optimizedBuffer = await sharp(buffer)
      .resize(512, 512, { fit: "inside" })
      .jpeg({ quality: 75 }) 
      .toBuffer();

    return await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "user-profiles" },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary upload error:", error);
            return reject(error);
          }

          if (!result?.secure_url) {
            return resolve(""); // ✅ safe fallback
          }

          resolve(result?.secure_url);
        }
      );

      Readable.from(optimizedBuffer).pipe(stream);
    })
  }catch(error){
    console.error("❌ Cloudinary upload error:", error);
    return Promise.reject(error);
  };
};