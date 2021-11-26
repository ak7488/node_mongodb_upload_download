const express = require("express");
const { auth } = require("../auth.js");
const multer = require("multer");
const { GridFSBucket } = require("mongodb");
const { Readable } = require("stream");
const { client } = require("../db.js");
const JWT = require("jsonwebtoken");
const { ObjectId } = require("bson");

const router = express.Router();
const upload = multer().single("file");

router.get("/file", (req, res) => {
  res.send("ok");
});

router.post("/file/upload", auth, upload, async (req, res) => {
  try {
    const allowedFile = ["video", "image", "audio"];
    if (!allowedFile.includes(req.file.mimetype.slice(0, 5))) {
      res.status(400).send();
      return;
    }
    const readable = new Readable();
    readable.push(req.file.buffer);
    readable.push(null);

    const bucket = new GridFSBucket((await client).db(process.env.DB_NAME), {
      bucketName: req.file.mimetype.slice(0, 5),
    });

    const fileName =
      Math.random().toString().replace(/\./g, "") +
      "-" +
      new Date().getTime().toString();
    const uploadStream = bucket.openUploadStream(fileName);
    const id = uploadStream.id;
    readable.pipe(uploadStream);

    readable.on("error", (e) => {
      res.status(500).send();
      return;
    });

    await (
      await client
    )
      .db(process.env.DB_NAME)
      .collection(`${req.file.mimetype.slice(0, 5)}_data`)
      .insertOne({
        fileName,
        file_id: id,
        title: req.body.title,
        description: req.body.description,
        user_id: req.user._id,
        createdOn: new Date().getTime(),
        updatedOn: new Date().getTime(),
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

    res.status(201).send(fileName);
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

router.get(
  "/file/get-all/:page/:quantity/:type/:sort/:from/:to",
  async (req, res) => {
    try {
      const allowedFile = ["video", "image", "audio"];
      const page = parseInt(req.params.page);
      const quantity = parseInt(req.params.quantity);
      const upperLimit = page * quantity;
      const lowerLimit = (page - 1) * quantity;
      if (!allowedFile.includes(req.params.type)) {
        return res.status(400).send();
      }
      let data = await (
        await client
      )
        .db(process.env.DB_NAME)
        .collection(`${req.params.type}_data`)
        .find({
          updatedOn: {
            $gt: parseInt(req.params.from),
            $lt: parseInt(req.params.to),
          },
        })
        .sort({ updatedOn: req.params.sort === "1" ? 1 : -1 })
        .limit(upperLimit);

      data = await data.toArray();
      data = data.slice(lowerLimit, upperLimit);
      res.send(data);
    } catch (e) {
      console.log(e);
      res.status(500).send();
    }
  }
);

router.get("/file/get-file-data/:type/:filename", async (req, res) => {
  try {
    const allowedFile = ["video", "image", "audio"];
    if (!allowedFile.includes(req.params.type) || !req.params.filename) {
      return res.status(400).send();
    }
    res.send("ok");
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

router.get(
  "/file/getfile/:filename/:type/:temprory_token",
  async (req, res) => {
    const token = req.params.temprory_token;

    const { id, time } = JWT.decode(token, process.env.JWT_SECRET);

    if (!id || !time) return res.status(401).send();

    const currentTime = new Date().getTime();
    if (currentTime > time) return res.status(401).send();
    const objectId = new ObjectId(id);

    const user = await (await client)
      .db(process.env.DB_NAME)
      .collection("USER")
      .findOne({ _id: objectId });
    if (!user || !user.name) return res.status(401).send();

    let isAuthorized = false;

    user.temproryTokens.forEach((e) => {
      if (e[0] === token) {
        isAuthorized = true;
      }
    });

    if (!isAuthorized) return res.status(401).send();

    const allowedFile = ["video", "image", "audio"];
    if (!allowedFile.includes(req.params.type) || !req.params.filename) {
      return res.status(400).send();
    }

    const range = req.headers.range;
    if (!range) return res.status(400).send("range is required");

    const video = await (await client)
      .db(process.env.DB_NAME)
      .collection(`${req.params.type}_data`)
      .findOne({ fileName: req.params.filename });
    if (!video) return res.send({ error: "No video with this fileName" });

    const videoSize = video.size;
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const contentLength = end - start + 1;
    const headers = {
      "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      "Accept-Range": "bytes",
      "Content-Length": contentLength,
      "Content-Type": video.mimetype,
    };

    res.writeHead(206, headers);

    const bucket = new GridFSBucket(
      await (await client).db(process.env.DB_NAME),
      {
        bucketName: req.params.type,
      }
    );
    const downloadStream = bucket.openDownloadStreamByName(
      req.params.filename,
      {
        start,
        end,
      }
    );
    downloadStream.pipe(res);
  }
);

module.exports = router;
