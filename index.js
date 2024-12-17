const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j5nrexn.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const foodCollection = client.db("foodBuzz").collection("foods");
    const requestFoodCollection = client
      .db("foodBuzz")
      .collection("requestFoods");

    // verify token
    const verifyToken = (req, res, next) => {
      const authHeaders = req.headers.authorization;

      if (!authHeaders) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = authHeaders.split(" ")[1];
      jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // create token
    app.post("/jwt", (req, res) => {
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.SECRET_ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    // FOOD RELATED API START
    app.get("/limitFoods", async (req, res) => {
      const result = await foodCollection
        .find()
        .limit(6)
        .sort({ quantity: -1 })
        .toArray();
      res.send(result);
    });
    // Get all foods with pagination
    app.get("/foods", async (req, res) => {
      let searchObj = {};
      let sortObj = {};
      const search = req.query.search;
      const sortOrder = req.query.sortOrder;
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      if (search) {
        searchObj = { food_name: { $regex: search, $options: "i" } };
      }

      if (sortOrder) {
        sortObj = { expired_date: sortOrder };
      }
      const foods = await foodCollection
        .find(searchObj)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      const totalFoods = await foodCollection.countDocuments(searchObj);
      res.send({
        foods,
        totalPages: Math.ceil(totalFoods / limit),
      });
    });

    app.get("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });
    // FOOD RELATED API END

    // CREATED FOOD RELATED API START
    // create food
    app.post("/createFood", verifyToken, async (req, res) => {
      const food = req.body;
      const result = await foodCollection.insertOne(food);
      res.send(result);
    });
    // get all food
    app.get("/createFood", verifyToken, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const query = { donator_email: email };
      const result = await foodCollection.find(query).toArray();
      res.send(result);
    });
    // get single food
    app.get("/createFood/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });
    // delete food
    app.delete("/createFood/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.deleteOne(query);
      res.send(result);
    });
    // update food
    app.put("/createFood/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateFood = req.body;
      const options = { upsert: true };
      const food = {
        $set: {
          food_name: updateFood.food_name,
          food_img: updateFood.food_img,
          quantity: updateFood.quantity,
          expired_date: updateFood.expired_date,
          location: updateFood.location,
          food_Des: updateFood.food_Des,
        },
      };
      const result = await foodCollection.updateOne(filter, food, options);
      res.send(result);
    });
    // CREATED FOOD RELATED API END

    // REQUEST FOOD RELATED API START
    // get all requested food
    app.get("/requestFood", verifyToken, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded?.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { requester_email: email };
      const result = await requestFoodCollection.find(query).toArray();
      res.send(result);
    });
    // get single requested food
    app.get("/requestFood/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { food_request_id: id };
      const result = await requestFoodCollection.find(query).toArray();
      res.send(result);
    });
    // get single requested food
    app.get("/reqFood/:id", async (req, res) => {
      const id = req.params.id;
      const query = { food_request_id: id };
      const result = await requestFoodCollection.findOne(query);
      res.send(result);
    });
    // create requested food
    app.post("/requestFood", verifyToken, async (req, res) => {
      const food = req.body;
      const result = await requestFoodCollection.insertOne(food);
      res.send(result);
    });
    // delete requested food
    app.delete("/requestFood/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestFoodCollection.deleteOne(query);
      res.send(result);
    });
    // update status of requested food
    app.patch("/requestFood/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updateBooking = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updateBooking.status,
        },
      };

      try {
        const requestUpdate = await requestFoodCollection.updateOne(
          filter,
          updateDoc
        );

        if (requestUpdate.modifiedCount > 0) {
          const request = await requestFoodCollection.findOne(filter);
          const foodId = request.food_request_id;
          const foodFilter = { _id: new ObjectId(foodId) };
          const foodUpdateDoc = {
            $set: {
              status: updateBooking.status,
            },
          };

          const foodUpdate = await foodCollection.updateOne(
            foodFilter,
            foodUpdateDoc
          );

          res.send({
            success: true,
            message: "Status updated in both collections",
            requestUpdate,
            foodUpdate,
          });
        } else {
          res
            .status(404)
            .send({ success: false, message: "Request not found" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update status" });
      }
    });

    // REQUEST FOOD RELATED API END
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("FoodBuzz server is running");
});

app.listen(port, (req, res) => {
  console.log(`FoodBuzz server is running on port ${port}`);
});
