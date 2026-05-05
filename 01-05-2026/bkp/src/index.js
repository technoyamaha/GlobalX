import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cronController from "./cron/dailyEarnings.js";
import initialiseRouting from "./routes/web.js";
import staticConfig from "./config/config.js";


const app = express();
dotenv.config();
staticConfig(app);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
initialiseRouting(app);

cronController.startDailyEarningsCron();


const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
