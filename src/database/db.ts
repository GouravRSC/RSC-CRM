import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined, // Convert to number
  waitForConnections : true,
  connectionLimit : 40,
  queueLimit : 0, //unlimited queue requests
  connectTimeout : 10000 
});

export default connection;
