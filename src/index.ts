import express from "express";
import dotenv from "dotenv";
import connection from "./database/db";
dotenv.config();
import redis from "./database/redis";
import "./workers/userImage.worker";

//local routes
import roleRoutes from "./routes/roles.routes";
import userRoutes from './routes/user.routes'

const app = express();
const PORT = process.env.PORT || 8080;


// Check required env variables early
if (!process.env.REDIS_HOST || !process.env.REDIS_PORT || !process.env.REDIS_PASSWORD) {
  console.error("❌ Missing Redis environment variables");
  process.exit(1); // Exit app if env variables are not set
}

redis.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

//global middlewares
app.use(express.json());
app.use(express.urlencoded())

app.get("/",(req,res)=>{
  res.send("Welcome to CRM API")
})

//routes middlewares
app.use('/roles',roleRoutes);
app.use('/users',userRoutes);

// Optional: check DB connection (once) at startup
(async () => {
  try {
    const conn = await connection.getConnection(); // ✅ get a connection from the pool
    console.log("✅ Connected to MySQL database");
    conn.release(); // release immediately
  } catch (err) {
    console.error("❌ Failed to connect to the database:", err);
    process.exit(1); // shut down app if DB is not ready
  }
})();


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
