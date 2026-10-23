
require("dotenv").config();

const express = require("express");
const { MongoClient } = require("mongodb");

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
    const { userId, email, phone, name, altPhone, address } = req.body;

    if (!email && !phone && !userId) {
      return res.status(400).json({ success: false, message: "ইউজারের পরিচয় নিশ্চিত করতে তথ্য প্রয়োজন।" });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (phone) updateData.phone = phone.trim();
    if (altPhone !== undefined) updateData.altPhone = altPhone.trim();
    if (address) updateData.address = address.trim();

    // আইডি, ইমেইল বা ফোন দিয়ে ইউজার খুঁজে আপডেট করা (যাতে 'ইউজার খুঁজে পাওয়া যায়নি' সমস্যা না হয়)
    let queryFilter = {};
    if (userId && userId !== "demo_user_id") {
      // যদি আপনার প্রজেক্টে ObjectId ব্যবহার করা হয়, তবে ObjectId conversion চেক করে নেবেন
      queryFilter.$or = [{ _id: userId }, { email: email }, { phone: phone }];
    } else {
      queryFilter.$or = [{ email: email }, { phone: phone }];
    }

    const result = await userCollection.updateOne(queryFilter, { $set: updateData });

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "ডাটাবেজে এই অ্যাকাউন্টটি খুঁজে পাওয়া যায়নি।" });
    }

    res.status(200).json({
      success: true,
      message: "প্রোফাইল তথ্য সফলভাবে আপডেট হয়েছে।",
      updatedData: updateData,
    });
  } catch (error) {
    console.error("Profile Update Error:", error);
    res.status(500).json({ success: false, message: "প্রোফাইল আপডেট করতে সার্ভারে সমস্যা হয়েছে।" });
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
