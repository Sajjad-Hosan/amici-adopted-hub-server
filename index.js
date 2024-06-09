const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const stripe = require("stripe")(process.env.STR_SEC_KEY);
const port = process.env.PORT || 1000;
const uri = `mongodb+srv://${process.env.MON_US}:${process.env.MON_PS}@amiciadopthub.nozb2mu.mongodb.net/?retryWrites=true&w=majority&appName=amiciAdoptHub`;

// middleware
app.use(
  cors({
    origin: [
      // "http://localhost:5173",
      "amiciadopthub.web.app",
      "amiciadopthub.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// new mongo client create
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
//

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded?.email;
  const filter = { email: email };
  const result = await usersCollection.findOne(filter);
  const isAdmin = result?.role === "admin";
  if (!isAdmin) {
    res.status(403).send({ message: "forbidden error", verify: false });
  }
  next();
};
const cookieOptions = {
  httpOnly: true,
  secure: process.env.EXP_ENV === "production" ? true : false,
  sameSite: process.env.EXP_ENV === "production" ? "none" : "strict",
};

const run = async () => {
  try {
    const verifyToken = (req, res, next) => {
      const token = req.cookies?.token;
      if (!token) {
        return res
          .status(401)
          .send({ message: "unAuthorize access", token: "error" });
      }
      jwt.verify(token, process.env.SECRET_TOK, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "unAuthorized access" });
        }
        req.user = decoded;
        next();
      });
    };
    //

    const userPictures = client.db("petsHub").collection("pictures");
    const usersCollection = client.db("petsHub").collection("users");
    const petsCollection = client.db("petsHub").collection("pets");
    const donationCollection = client.db("petsHub").collection("donations");
    const campaignCollection = client.db("petsHub").collection("campaign");
    const adoptedCollection = client.db("petsHub").collection("adopts");
    const storeCollection = client.db("petsHub").collection("stores");

    // user block realted api
    app.get("/user_check", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const exist = await usersCollection.findOne(filter);
      if (exist?.block) {
        return res.send({ block: true, message: "you have block by user" });
      } else {
        return res.send({ block: false, message: "not block" });
      }
    });

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
        .send({ message: "logout by server", success: true });
    });
    // stripe related api
    app.post("/payment_intent", verifyToken, async (req, res) => {
      const { amount } = req.body;
      const total = amount * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
        success: true,
      });
    });
    // ---------------------------------------------------------------------------------
    // count api related
    app.get("/pets_count", async (req, res) => {
      const result = await petsCollection.estimatedDocumentCount();
      res.send({ count: result });
    });
    // isAdmin related api
    app.get("/user_status", verifyToken, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await usersCollection.findOne(filter);
      res.send({ isAdmin: result?.admin });
    });
    // user images related api
    app.get("/user_images", async (req, res) => {
      const result = await userPictures.find().toArray();
      res.send(result);
    });
    app.post("/add_user_picture", async (req, res) => {
      const info = req.body;
      const filter = { email: info.email };
      const exist = await usersCollection.findOne(filter);
      if (exist) {
        return res.send({ message: "The user is already exist in database" });
      }
      const result = await userPictures.insertOne(info);
      res.send(result);
    });
    app.patch("/make_admin/:id", verifyToken, async (req, res) => {
      const mode = req.query.mode;
      const id = req.params.id;
      const info = req.body;
      const filter = { _id: new ObjectId(id) };
      if (mode === "admin") {
        const update = {
          $set: {
            admin: info.admin,
          },
        };
        const result = await usersCollection.updateOne(filter, update);
        res.send(result);
      } else {
        const update = {
          $set: {
            block: info.block,
          },
        };
        const result = await usersCollection.updateOne(filter, update);
        res.send(result);
      }
    });
    // store user data related api
    app.get("/all_users", verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.post("/user", async (req, res) => {
      const info = req.body;
      const filter = { email: info.email };
      const filter2 = { name: info.name };
      const exits = await usersCollection.findOne(filter);
      const exits2 = await usersCollection.findOne(filter2);
      if (exits) {
        return res.send({
          message: "The email is already use !",
          isEmail: true,
        });
      } else if (exits2) {
        return res.send({
          message: "The username is already use !",
          isName: true,
        });
      }
      const result = await usersCollection.insertOne(info);
      res.send(result);
    });
    app.delete("/user_delete/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params?.id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });
    // all pets
    app.post("/pets", verifyToken, async (req, res) => {
      const page = parseInt(req.query.page);
      const sortType = req.query.sort;
      const sort = {};
      sort[sortType] = 1;
      const mode = req.query.mode;
      const result = await petsCollection
        .find()
        .sort(sort)
        .skip(page * 10)
        .limit(10)
        .toArray();
      if (mode === "admin") {
        return res.send(result);
      }
      const filter = result.filter((i) => i.adopted !== true);
      res.send(filter);
    });
    app.get("/pets_category", async (req, res) => {
      const category = req.query?.category;
      const capiCate = category?.charAt(0).toUpperCase() + category?.slice(1);
      const filter = { category: capiCate };
      const result = await petsCollection.find(filter).toArray();
      res.send(result);
    });
    // pet add by user api
    app.get("/user_pets", verifyToken, async (req, res) => {
      const email = req.query.email;
      const filter = { personEmail: email };
      const result = await petsCollection.find(filter).toArray();
      res.send(result);
    });
    app.get("/pet_info/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params?.id) };
      const result = await petsCollection.findOne(filter);
      res.send(result);
    });
    app.post("/add_Pet", async (req, res) => {
      const pet = req.body;
      const result = await petsCollection.insertOne(pet);
      res.send(result);
    });
    app.patch("/update_pet_status/:id", async (req, res) => {
      const info = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateInfo = {
        $set: {
          adopted: info.adopted,
        },
      };
      const result = await petsCollection.updateOne(filter, updateInfo);
      res.send(result);
    });
    app.patch("/pet_update/:id", async (req, res) => {
      const pet = req.body;
      const filter = { _id: new ObjectId(req.params.id) };
      const update = {
        $set: {
          image: pet.image,
          petName: pet.petName,
          petAge: pet.petAge,
          category: pet.category,
          petLocation: pet.petLocation,
          petGender: pet.petGender,
          petFee: pet.petFee,
          petWeight: pet.petWeight,
          shortDescription: pet.shortDescription,
          description: pet.description,
          adopted: pet.adopted,
          // petAddDate: pet.petAddDate,
          // petAddTime: pet.petAddTime,
        },
      };
      const result = await petsCollection.updateOne(filter, update);
      res.send(result);
    });
    app.delete("/pet_delete/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params?.id) };
      const result = await petsCollection.deleteOne(filter);
      res.send(result);
    });
    // user pet adopt me related api
    app.get("/adoption_pets", verifyToken, async (req, res) => {
      const email = req.query.email;
      const filter = { userEmail: email };
      const result = await adoptedCollection.find(filter).toArray();
      res.send(result);
    });
    app.post("/pet_adopt_me", async (req, res) => {
      const info = req.body;
      const filter = { petId: info.petId };
      const exist = await adoptedCollection.findOne(filter);
      if (exist) {
        return res.send({ warn: "Adopt is already exits!" });
      }
      const result = await adoptedCollection.insertOne(info);
      res.send(result);
    });
    app.patch("/adoption_status/:id", async (req, res) => {
      const info = req.body;
      console.log(typeof info.adoption);
      const filter = { _id: new ObjectId(req.params?.id) };
      const update = {
        $set: {
          adoption: info.adoption,
        },
      };
      const result = await adoptedCollection.updateOne(filter, update);
      res.send({ result, info });
    });
    // user campaign realted api
    app.get("/donations_count", async (req, res) => {
      const result = await campaignCollection.estimatedDocumentCount();
      res.send({ count: result });
    });
    app.post("/donation_campaign", async (req, res) => {
      const mode = req.query.mode;
      const sortType = req.query.sort;
      const sort = {};
      sort[sortType] = 1;
      const page = parseInt(req.query.page);
      const email = req.query.email;
      const filter = { userEmail: email };
      if (mode === "admin") {
        const result = await campaignCollection
          .find()
          .sort(sort)
          .skip(page * 10)
          .limit(10)
          .toArray();
        return res.send(result);
      }
      const result = await campaignCollection
        .find(filter)
        .skip(page * 10)
        .limit(10)
        .toArray();
      res.send(result);
    });
    // for donation page or show random donations
    app.post("/donations", async (req, res) => {
      const sortType = req.query.sort;
      const sort = {};
      sort[sortType] = 1;
      const page = parseInt(req.query.page);
      const email = req.query.email;
      const filter = { userEmail: email };
      const result = await campaignCollection
        .find()
        .sort(sort)
        .skip(page * 10)
        .limit(10)
        .toArray();
      return res.send(result);
    });
    app.get("/donation_info/:id", verifyToken, async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const result = await campaignCollection.findOne(filter);
      res.send(result);
    });
    app.post("/create_campaign", async (req, res) => {
      const campaign = req.body;
      const filter = { image: campaign.image };
      const exist = await campaignCollection.findOne(filter);
      if (exist) {
        return res.send({ warn: "The camping is exist here" });
      }
      const result = await campaignCollection.insertOne(campaign);
      res.send(result);
    });
    app.patch("/donation_update/:id", verifyToken, async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const i = req.body;
      const update = {
        $set: {
          petName: i.petName,
          image: i.image,
          currentDonation: i.currentDonation,
          maxDonationAmount: i.maxDonationAmount,
          highestDonationAmount: i.highestDonationAmount,
          shortDescription: i.shortDescription,
          description: i.description,
          lastDate: i.lastDate,
          pause: i.pause,
        },
      };
      const result = await campaignCollection.updateOne(filter, update);
      res.send(result);
    });
    app.patch("/donation_update_status/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const info = req.body;
      const update = {
        $set: {
          pause: info.pause,
        },
      };
      const result = await campaignCollection.updateOne(filter, update);
      res.send(result);
    });
    app.delete("/donation_delete/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const result = await campaignCollection.deleteOne(filter);
      res.send(result);
    });
    // who has donated related api
    app.get("/donations_count", async (req, res) => {
      const result = await donationCollection.estimatedDocumentCount();
      res.send({ count: result });
    });
    app.post("/donations", verifyToken, async (req, res) => {
      const page = parseInt(req.query?.page);
      const email = req.query?.email;
      const filter = { email: email };
      const result = await donationCollection
        .find(filter)
        .skip(page * 10)
        .limit(10)
        .toArray();
      res.send(result);
    });
    app.get("/donations", verifyToken, async (req, res) => {
      const name = req.query.name;
      const filter = { petName: name };
      const result = await donationCollection.find(filter).toArray();
      res.send(result);
    });
    app.post("/donation", verifyToken, async (req, res) => {
      const donation = req.body;
      const filter = { petName: donation.petName };
      const exist = await donationCollection.findOne(filter);
      if (exist) {
        const update = {
          $inc: {
            amount: donation.amount,
          },
        };
        const result = await donationCollection.updateOne(filter, update);
        return res.send(result);
      }
      const result = await donationCollection.insertOne(donation);
      res.send(result);
    });
    app.patch("/donation_amount/:id", verifyToken, async (req, res) => {
      const status = req.query.status;
      const info = req.body;
      const price = parseFloat(info?.currentAmount);
      console.log(req.params.id);
      // campaignCollection data increas
      const filter = { _id: new ObjectId(req.params.id) };
      // campaignCollection data dencreate
      const filter2 = { petId: req.params.id };
      if (status) {
        const update = {
          $inc: {
            currentDonation: -price,
          },
        };
        const result = await campaignCollection.updateOne(filter, update);
        const deleteRE = await donationCollection.deleteOne(filter2);
        res.send({ result, deleteRE });
        return;
      }
      const update = {
        $inc: {
          currentDonation: price,
        },
      };
      const result = await campaignCollection.updateOne(filter, update);
      res.send(result);
    });
    // success store related api
    app.get("/success_stores", async (req, res) => {
      const result = await storeCollection.find().toArray();
      res.send(result);
    });
    app.post("/success_store", async (req, res) => {
      const info = req.body;
      const result = await storeCollection.insertOne(info);
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
