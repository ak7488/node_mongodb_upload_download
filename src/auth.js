const JWT = require("jsonwebtoken");
const { client } = require("./db.js");
const { ObjectId } = require("bson");

const auth = async (req, res, next) => {
  try {
    const token = req.body.token || req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).send();

    const a = JWT.decode(token, process.env.JWT_SECRET);
    const { id, time } = a;
    if (!id || !time) return res.status(401).send();

    const currentTime = new Date().getTime();
    if (currentTime > time) return res.status(401).send();
    const objectId = new ObjectId(id);

    const user = await (await client)
      .db(process.env.DB_NAME)
      .collection("USER")
      .findOne({ _id: objectId });
    if (!user || !user.name) return res.status(401).send();

    if (!user.tokens.includes(token)) return res.status(401).send();

    req.user = user;
    req.token = token;
    next();
  } catch (e) {
    console.log(e);
    res.status(401).send();
  }
};

module.exports = { auth };
