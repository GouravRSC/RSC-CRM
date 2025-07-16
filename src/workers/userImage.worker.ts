import { Worker } from "bullmq";
import { uploadToCloudinary } from "../services/cloudinary.service";
import redis from "../database/redis";
import connection from "../database/db";
import { UserImageRetryQueue } from "../queues/UserImage.Queue";

interface UserImageJobData {
    userId: number;
    buffer: Buffer;
}

export const userImageWorker = new Worker(
    "UserImageQueue",
    async (job) => {
        let { userId, buffer } = job.data as UserImageJobData;
        try {

            if(buffer && !Buffer.isBuffer(buffer)){
                buffer = Buffer.from(buffer);
            }

            const imageUrl = await uploadToCloudinary(buffer);

            if (imageUrl) {
                await connection.query(
                    `UPDATE users SET profileImage = ? WHERE id = ?`,
                    [imageUrl, userId]
                );
            } else {
                console.warn(`⚠️ Image URL empty. Skipping DB update for user ${userId}`);
            }
        } catch (err) {
            console.error("❌ Image Worker Error:", err);
            await UserImageRetryQueue.add("retry-user-image", 
                { userId, buffer },
                {
                    removeOnComplete: true, // ✅ auto delete job from Redis after success
                    removeOnFail: true  ,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000
                    } 
                }
            );
        }
    },
    {
        connection: redis,
        concurrency: 1,
    }
)


export const userImageRetryWorker = new Worker(
    "UserImageRetryQueue",
    async (job) => {
        let { userId, buffer } = job.data as UserImageJobData;

        try {
            if(buffer && !Buffer.isBuffer(buffer)){
                buffer = Buffer.from(buffer);
            }

            const imageUrl = await uploadToCloudinary(buffer);

            if (imageUrl) {
                await connection.query(
                    `UPDATE users SET profileImage = ? WHERE id = ?`,
                    [imageUrl, userId]
                );
            } else {
                console.warn(`⚠️ Image URL empty. Skipping DB update for user ${userId}`);
            }

        } catch (err) {
            console.error("❌ Retry Worker Failed Again:", err);
        }
    },
    {
        connection: redis,
        concurrency: 1,
    }
);