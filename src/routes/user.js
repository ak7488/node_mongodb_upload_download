const express = require("express");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { client } = require("../db.js");
const { auth } = require("../auth.js");

const router = express.Router();

const hashPassword = async (password) => {
  const salt = await bcrypt.genSaltSync(8);
  const hashed = await bcrypt.hashSync(password, salt);
  return hashed;
};

const createJWT = (id, sec = 864000) => {
  const time = new Date().getTime() + sec * 1000;
  const token = JWT.sign({ time, id }, process.env.JWT_SECRET);
  return token;
};

router.get("/auth", (req, res) => {
  res.send("ok");
});

router.post("/auth/signup", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const name = req.body.name;
    const age = req.body.age;

    if (!email || !password || !name || !age)
      return res.send({
        error: "name, age, email and password is required",
      });
    if (password.length < 6)
      return res.send({
        error: "Password must be bigger than 6 caracters",
      });
    if (!email.includes("@") || !email.includes("."))
      return res.send({ error: "envalid email" });

    const hashedPassword = await hashPassword(password);

    const user = await (await client)
      .db(process.env.DB_NAME)
      .collection("USER")
      .findOne({ email });

    if (user) return res.send({ error: "User with this email alreay exists." });

    const { insertedId: id } = await (
      await client
    )
      .db(process.env.DB_NAME)
      .collection("USER")
      .insertOne({
        password: hashedPassword,
        email,
        name,
        age: parseInt(age),
        tokens: [],
        temproryTokens: [],
      });

    const token = createJWT(id.toString());

    await (
      await client
    )
      .db(process.env.DB_NAME)
      .collection("USER")
      .updateOne(
        { _id: id },
        {
          $set: { tokens: [token] },
        }
      );

    res.send({ id, token, name, age, email });
  } catch (e) {
    res.status(500).send();
    console.log(e);
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password)
      return res.send({ error: "email and password is required" });
    if (password.length < 6)
      return res.send({
        error: "Password must be bigger than 6 caracters",
      });
    if (!email.includes("@") || !email.includes("."))
      return res.send({ error: "envalid email" });

    const user = await (await client)
      .db(process.env.DB_NAME)
      .collection("USER")
      .findOne({ email });

    if (!user) return res.send({ error: "No user with this email" });

    const isMath = bcrypt.compareSync(password, user.password);

    if (!isMath) return res.send({ error: "Wrong password" });

    const token = createJWT(user._id.toString());

    const userTokensSliced = user.tokens.reverse().slice(0, 2);

    await (
      await client
    )
      .db(process.env.DB_NAME)
      .collection("USER")
      .updateOne(
        { _id: user._id },
        {
          $set: { tokens: [...userTokensSliced, token] },
        }
      );

    res.send({
      token,
      id: user._id,
      name: user.name,
      age: user.age,
      email: user.email,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

router.post("/auth/get-tem-token", auth, async (req, res) => {
  try {
    const token = req.token;
    const id = req.user._id;

    const temToken = createJWT(Math.random().toString(), 3600);
    const userTokensSliced = req.user.temproryTokens.reverse().slice(0, 2);

    const e = await (
      await client
    )
      .db(process.env.DB_NAME)
      .collection("USER")
      .updateOne(
        { _id: id },
        {
          $set: { temproryTokens: [...userTokensSliced, [temToken, token]] },
        }
      );

    console.log(e);

    res.send({ temproryTokens: temToken });
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

router.post("/auth/get-user", auth, async (req, res) => {
  try {
    res.send({ ...req.user, tokens: [], temproryTokens: [], password: "" });
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

router.post("/auth/logout", auth, async (req, res) => {
  try {
    const filteredTokens = req.user.tokens.filter((e) => e !== req.token);
    const filteredTemTokens = req.user.temproryTokens.filter(
      (e) => e[1] !== req.token
    );
    await (
      await client
    )
      .db(process.env.DB_NAME)
      .collection("USER")
      .updateOne(
        { _id: req.user._id },
        {
          $set: { tokens: filteredTokens, temproryTokens: filteredTemTokens },
        }
      );
    res.send("ok");
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

module.exports = router;
