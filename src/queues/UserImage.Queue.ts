import { Queue } from "bullmq";
import redis from "../database/redis";

export const UserImageQueue = new Queue(
    "UserImageQueue", 
    { connection: redis }
);


export const UserImageRetryQueue = new Queue("UserImageRetryQueue", {
  connection: redis,
});