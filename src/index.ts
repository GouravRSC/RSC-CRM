import express from "express";
import dotenv from "dotenv";
import cors from "cors"
import connection from "./database/db";
import redis from "./database/redis";
import "./workers/userImage.worker";

//local routes
import roleRoutes from "./routes/roles.routes";
import userRoutes from './routes/user.routes'
import authRoutes from "./routes/auth.routes";

// Load environment variables
dotenv.config();

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

const corsOptions: cors.CorsOptions = {
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT','DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, 
  optionsSuccessStatus: 204,
};

//global middlewares
app.use(cors(corsOptions))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/",(req,res)=>{
  res.send("Welcome to CRM API")
})

//routes middlewares
app.use('/roles',roleRoutes);
app.use('/users',userRoutes);
app.use('/auth',authRoutes);


// Start server only if DB is reachable
(async () => {
  try {
    const conn = await connection.getConnection();
    conn.release();
    console.log("✅ Connected to MySQL database");

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to MySQL:", err);
    process.exit(1);
  }
})();

