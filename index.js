const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const cookieParser = require("cookie-parser"); // Import cookie-parser
const userRoute = require("./routes/User");
const adminRoute = require("./routes/Admin");

app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

dotenv.config();
mongoose
  .connect(process.env.MONO_URL)
  .then(() => console.log("DB connection established"))
  .catch((err) => console.log(err));

app.use(
  cors({
    origin: "http://localhost:5173", // Frontend origin
    credentials: true, // Allow cookies to be sent with requests
  })
);

app.use(express.json());
app.use(express.static("public"));

app.use("/api/auth", userRoute);
app.use("/api/admin", adminRoute);

app.listen(process.env.PORT || 1000, () => {
  console.log("bacend is runing");
});
