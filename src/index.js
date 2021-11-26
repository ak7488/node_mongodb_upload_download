const express = require("express");
const cors = require("cors");
const userRouter = require("./routes/user.js");
const fileRouter = require("./routes/file.js");

const app = express();
const port = process.env.PORT;
const corsOptions = {
  origin: function (origin, callback) {
    console.log(process.env.ALLOWED_ORIGIN.split(","), origin);
    if (process.env.ALLOWED_ORIGIN.split(",").indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (process.env.ALLOWED_ORIGIN.split(",").indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
app.use(express.json());
app.use(userRouter);
app.use(fileRouter);

app.listen(port, () => {
  console.log(`Server is up and running on port ${port}`);
});
