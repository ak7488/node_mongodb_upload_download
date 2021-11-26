const express = require("express");
const cors = require("cors");
const userRouter = require("./routes/user.js");
const fileRouter = require("./routes/file.js");

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(userRouter);
app.use(fileRouter);

app.listen(port, () => {
    console.log(`Server is up and running on port ${port}`);
});
