const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 1000;
const uri = `mongodb+srv://${process.env.MON_US}:${process.env.MON_PS}@amiciadopthub.nozb2mu.mongodb.net/?retryWrites=true&w=majority&appName=amiciAdoptHub`;

// middleware
app.use(cors());
// app.use({
//   origin: [],
//   credentials: true,
// });
app.use(express.json());
// app.use(cookieParser());

// new mongo client create
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// const verifyToken = (req, res, next) => {
//   const token = req.cookies?.token;
//   if (!token) {
//     return res
//       .status(401)
//       .send({ message: "unAuthorize access", token: "error" });
//   }
//   jwt.verify(token, process.env.SECRET_TOK, (error, decoded) => {
//     if (error) {
//       return res.status(401).send({ message: "unAuthorized access" });
//     }
//     req.user = decoded;
//     next();
//   });
// };
// const verifyAdmin = async (req, res, next) => {
//   const email = req.decoded?.email;
//   const filter = { email: email };
//   const result = await usersCollection.findOne(filter);
//   const isAdmin = result?.role === "admin";
//   if (!isAdmin) {
//     res.status(403).send({ message: "forbidden error", verify: false });
//   }
//   next();
// };
// const cookieOptions = {
//   httpOnly: true,
//   secure: process.env.EXP_ENV === "production" ? true : false,
//   sameSite: process.env.EXP_ENV === "production" ? "none" : "strict",
// };

const run = async () => {
  try {
    const usersCollection = client.db("petsHub").collection("users");
    const petsCollection = client.db("petsHub").collection("pets");
    const paymentCollection = client.db("petsHub").collection("payments");
    const adoptedCollection = client.db("petsHub").collection("adopts");
    const reviewCollection = client.db("petsHub").collection("reviews");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_TOK, {
        expiresIn: "1d",
      });
      res
        .cookie("token", token, cookieOptions)
        .send({ message: "success", success: true });
    });
    app.post("/logout", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ message: "logut by server", success: true });
    });
    // pet add by user api
    app.get("/user_pets", async (req, res) => {
      const email = req.query.email;
      const filter = { personEmail: email };
      const result = await petsCollection.find(filter).toArray();
      res.send(result);
    });
    app.post("/add_Pet", async (req, res) => {
      const pet = req.body;
      const result = await petsCollection.insertOne(pet);
      res.send(result);
    });
  } finally {
    //
    //
  }
};
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("The Pet Server is running now");
});
app.listen(port, () => {
  console.log(`The Server port is ${port}`);
});
