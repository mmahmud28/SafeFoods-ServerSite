require("dotenv").config();

const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
const cors = require('cors');
app.use(cors());

const client = new MongoClient(process.env.MONGODB_URI);


let db;
let userCollection;

// MongoDB Connection
async function connectToMongoDB() {
  await client.connect();
  await client.db("admin").command({ ping: 1 });

  db = client.db(process.env.DB_NAME);
  userCollection = db.collection("user");

  console.log("MongoDB Atlas connected successfully!");
}

// Home Route
app.get("/", (req, res) => {
  res.send("ULAMA SWEETS API is running!");
});

// Get All Users
app.get("/api/users", async (req, res) => {
  try {
    const users = await userCollection
      .find({}, {
        projection: {
          password: 0,
          passwordHash: 0,
          hashedPassword: 0
        }
      })
      .limit(100)
      .toArray();

    res.status(200).json({
      success: true,
      total: users.length,
      users
    });
  } catch (error) {
    console.error("Get Users Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get users"
    });
  }
});

// Check Phone Number
app.get("/api/users/check-phone/:phone", async (req, res) => {
  try {
    const { phone } = req.params;

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন"
      });
    }

    const user = await userCollection.findOne(
      { phone },
      { projection: { _id: 1 } }
    );

    res.status(200).json({
      success: true,
      exists: !!user,
      message: user
        ? "এই নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা হয়েছে।"
        : "নম্বরটি রেজিস্ট্রেশনের জন্য উপলব্ধ"
    });
  } catch (error) {
    console.error("Phone Check Error:", error);
    res.status(500).json({
      success: false,
      message: "সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।"
    });
  }
});

// Phone to email
app.get("/api/users/get-email/:phone", async (req, res) => {
  try {
    const { phone } = req.params;

    // Validate Bangladesh phone number
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    // Find user by phone number
    const user = await userCollection.findOne(
      { phone },
      { projection: { _id: 0, email: 1 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      email: user.email,
    });

  } catch (error) {
    console.error("Get Email Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// আপডেট ইউজার
// Express.js API Route Example

app.patch("/api/users/update-profile", async (req, res) => {
  try {
    const {
      userId,
      email,
      phone,
      name,
      altPhone,
      address,
    } = req.body;

    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const _id = new ObjectId(userId);

    const user = await userCollection.findOne({ _id });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateData = {
      email,
      phone,
      name,
      altPhone,
      updatedAt: new Date(),
    };

    const updateQuery = {
      $set: updateData,
    };

    // Address changed হলে পুরাতনটি history-তে রাখবে
    if (
      typeof address === "string" &&
      address !== user.address
    ) {
      updateData.address = address;

      if (user.address) {
        updateQuery.$push = {
          addressHistory: {
            address: user.address,
            changedAt: new Date(),
          },
        };
      }
    }

    await userCollection.updateOne(
      { _id },
      updateQuery
    );

    const updatedUser = await userCollection.findOne(
      { _id },
      {
        projection: {
          addressHistory: 0,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Profile update failed",
    });
  }
});



// GET - All Categories
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await categoryCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      total: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get Categories Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get categories",
    });
  }
});

// POST - Create Category
app.post("/api/categories", async (req, res) => {
  try {
    const name = req.body?.name;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const cleanName = name.trim();

    // Check duplicate category
    const existingCategory = await categoryCollection.findOne({
      name: {
        $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    const category = {
      name: cleanName,
      createdAt: new Date(),
    };

    const result = await categoryCollection.insertOne(category);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category: {
        ...category,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
});

// DELETE - Category
app.delete("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const result = await categoryCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
});



// Start Server
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});

startServer();
