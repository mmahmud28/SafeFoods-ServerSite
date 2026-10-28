require("dotenv").config();
const crypto = require("crypto");

const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;


const cors = require('cors');
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());


const client = new MongoClient(process.env.MONGODB_URI);



// MongoDB Connection
async function connectToMongoDB() {
  await client.connect();
  await client.db("admin").command({ ping: 1 });

  const db = client.db(process.env.DB_NAME);

  const userCollection = db.collection("user");
  const categoryCollection = db.collection("categories");
  const productCollection = db.collection("products");
  const giftBoxCollection = db.collection("giftBoxes");
  const orderCollection = db.collection("orders");
  const cartCollection = db.collection("carts");





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
        district,
        thana,
      } = req.body;

      // User ID Validation
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const _id = new ObjectId(userId);

      // Existing User
      const user = await userCollection.findOne({ _id });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const now = new Date();

      const updateData = {
        updatedAt: now,
      };

      const historyData = {};

      // কোন কোন তথ্য আপডেট ও History হবে
      const fields = [
        "name",
        "email",
        "phone",
        "altPhone",
        "district",
        "thana",
        "address",
      ];

      const incomingData = {
        name,
        email,
        phone,
        altPhone,
        district,
        thana,
        address,
      };

      // প্রত্যেকটি Field পরীক্ষা
      for (const field of fields) {
        const newValue = incomingData[field];
        const oldValue = user[field];

        // শুধু String Field আপডেট
        if (typeof newValue !== "string") continue;

        const cleanedValue = newValue.trim();

        // আগের তথ্যের সঙ্গে তুলনা
        if (cleanedValue === (oldValue ?? "")) {
          continue;
        }

        // নতুন তথ্য Save
        updateData[field] = cleanedValue;

        // আগের তথ্য থাকলে History-তে রাখবে
        if (
          typeof oldValue === "string" &&
          oldValue.trim() !== ""
        ) {
          historyData[`${field}History`] = {
            value: oldValue,
            changedAt: now,
          };
        }
      }

      // MongoDB Update Query
      const updateQuery = {
        $set: updateData,
      };

      // History থাকলে $push করবে
      if (Object.keys(historyData).length > 0) {
        updateQuery.$push = {};

        for (const [historyField, historyValue] of Object.entries(historyData)) {
          updateQuery.$push[historyField] = historyValue;
        }
      }

      // Update User
      await userCollection.updateOne(
        { _id },
        updateQuery
      );

      // Updated User Data
      const updatedUser = await userCollection.findOne(
        { _id },
        {
          projection: {
            nameHistory: 0,
            emailHistory: 0,
            phoneHistory: 0,
            altPhoneHistory: 0,
            districtHistory: 0,
            thanaHistory: 0,
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
      console.error("Profile Update Error:", error);

      return res.status(500).json({
        success: false,
        message: "Profile update failed",
      });
    }
  });




  //রএড ক্যাটাগরি 
  app.post("/api/categories", async (req, res) => {
    try {
      const { name } = req.body;

      const result = await categoryCollection.insertOne({
        name,
        createdAt: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  //Get All Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await categoryCollection.find({}).toArray();

      res.status(200).json({
        success: true,
        categories,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });


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

      res.status(result.deletedCount ? 200 : 404).json({
        success: result.deletedCount > 0,
        message: result.deletedCount
          ? "Category deleted successfully"
          : "Category not found",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });






  app.post("/api/products", async (req, res) => {
    try {
      const product = req.body;

      const result = await productCollection.insertOne({
        ...product,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        insertedId: result.insertedId,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });


  app.get("/api/products", async (req, res) => {
    try {
      const products = await productCollection
        .find({ isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({
        success: true,
        total: products.length,
        products,
      });
    } catch (error) {
      console.error("Get Products Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to get products",
      });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID",
        });
      }

      const {
        _id,
        createdAt,
        updatedAt,
        ratings,
        isDeleted,
        ...updateData
      } = req.body || {};

      if (!Object.keys(updateData).length) {
        return res.status(400).json({
          success: false,
          message: "No update data provided",
        });
      }

      // Prevent MongoDB operator/dot-key injection
      if (
        Object.keys(updateData).some(
          (key) => key.startsWith("$") || key.includes(".")
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid field name",
        });
      }

      const result = await productCollection.updateOne(
        {
          _id: new ObjectId(id),
          isDeleted: { $ne: true },
        },
        {
          $set: {
            ...updateData,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Product updated successfully",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Update Product Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update product",
      });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID",
        });
      }

      const result = await productCollection.updateOne(
        {
          _id: new ObjectId(id),
          isDeleted: { $ne: true },
        },
        {
          $set: {
            isDeleted: true,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      console.error("Delete Product Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to delete product",
      });
    }
  });


  // GET - Single Product Details

  // GET - Product Details by Slug
  // GET - Single Product Details by Slug or Name
  app.get("/api/products/slug/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;

      if (!slug) {
        return res.status(400).json({
          success: false,
          message: "Product slug is required",
        });
      }

      // Find product by slug or name
      const product = await productCollection.findOne({
        $or: [
          { slug: slug },
          { name: slug },
          { nameEn: slug },
        ],
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
          searchedSlug: slug,
        });
      }

      // Product found
      return res.status(200).json({
        success: true,
        message: "Product details fetched successfully",
        product,
        productId: product._id,
      });

    } catch (error) {
      console.error("Get Product Details Error:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });


  ////

  /* =========================================
     GIFT BOX MANAGEMENT API
  ========================================= */

  // POST - Create Gift Box
  app.post("/api/gift-boxes", async (req, res) => {
    try {
      const giftBox = req.body;

      if (
        !giftBox ||
        typeof giftBox.name !== "string" ||
        !giftBox.name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Gift Box name is required",
        });
      }

      if (
        !Array.isArray(giftBox.products) ||
        giftBox.products.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Select at least one product",
        });
      }

      if (!Array.isArray(giftBox.boxOptions)) {
        return res.status(400).json({
          success: false,
          message: "Box options must be an array",
        });
      }

      // Prevent clients from setting MongoDB/system fields
      const {
        _id,
        createdAt,
        updatedAt,
        isDeleted,
        ...giftBoxData
      } = giftBox;

      const result = await giftBoxCollection.insertOne({
        ...giftBoxData,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Gift Box created successfully",
        insertedId: result.insertedId,
      });
    } catch (error) {
      console.error("Create Gift Box Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create Gift Box",
      });
    }
  });


  // GET - All Gift Boxes
  app.get("/api/gift-boxes", async (req, res) => {
    try {
      const giftBoxes = await giftBoxCollection
        .find({
          isDeleted: { $ne: true },
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({
        success: true,
        total: giftBoxes.length,
        giftBoxes,
      });
    } catch (error) {
      console.error("Get Gift Boxes Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to get Gift Boxes",
      });
    }
  });


  // PATCH - Update Gift Box
  app.patch("/api/gift-boxes/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Gift Box ID",
        });
      }

      const {
        _id,
        createdAt,
        updatedAt,
        isDeleted,
        ...updateData
      } = req.body || {};

      if (!Object.keys(updateData).length) {
        return res.status(400).json({
          success: false,
          message: "No update data provided",
        });
      }

      // Prevent MongoDB update operator injection
      if (
        Object.keys(updateData).some(
          (key) => key.startsWith("$") || key.includes(".")
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid field name",
        });
      }

      if (
        updateData.products !== undefined &&
        (!Array.isArray(updateData.products) ||
          updateData.products.length === 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Select at least one product",
        });
      }

      if (
        updateData.boxOptions !== undefined &&
        !Array.isArray(updateData.boxOptions)
      ) {
        return res.status(400).json({
          success: false,
          message: "Box options must be an array",
        });
      }

      const result = await giftBoxCollection.updateOne(
        {
          _id: new ObjectId(id),
          isDeleted: { $ne: true },
        },
        {
          $set: {
            ...updateData,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Gift Box not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Gift Box updated successfully",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Update Gift Box Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update Gift Box",
      });
    }
  });


  // DELETE - Soft Delete Gift Box
  app.delete("/api/gift-boxes/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Gift Box ID",
        });
      }

      const result = await giftBoxCollection.updateOne(
        {
          _id: new ObjectId(id),
          isDeleted: { $ne: true },
        },
        {
          $set: {
            isDeleted: true,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Gift Box not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Gift Box deleted successfully",
      });
    } catch (error) {
      console.error("Delete Gift Box Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to delete Gift Box",
      });
    }
  });





  // ==========================================




  // GET - Current logged-in user's checkout profile





  // Incomplete order lookup

  // Confirm order
  // app.post("/api/orders", async (req, res) => {
  //   try {
  //     const {
  //       draftId,
  //       customer,
  //       items,
  //       deliveryZone,
  //       deliveryMethod,
  //       paymentMethod
  //     } = req.body || {};

  //     if (
  //       !customer?.name?.trim() ||
  //       !customer?.phone?.trim() ||
  //       !customer?.district?.trim() ||
  //       !customer?.thana?.trim() ||
  //       !customer?.address?.trim() ||
  //       !Array.isArray(items) ||
  //       !items.length
  //     ) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "সব প্রয়োজনীয় তথ্য পূরণ করুন।"
  //       });
  //     }

  //     if (!/^01[3-9]\d{8}$/.test(customer.phone)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "সঠিক মোবাইল নম্বর দিন।"
  //       });
  //     }

  //     // Validate products against database
  //     const productIds = items.map(item =>
  //       String(item.productId || "")
  //     );

  //     if (
  //       items.length > 100 ||
  //       productIds.some(id => !ObjectId.isValid(id)) ||
  //       items.some(item =>
  //         !Number.isInteger(Number(item.quantity)) ||
  //         Number(item.quantity) < 1 ||
  //         Number(item.quantity) > 99
  //       )
  //     ) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "পণ্যের তথ্য সঠিক নয়।"
  //       });
  //     }

  //     const dbProducts = await productCollection.find({
  //       _id: {
  //         $in: productIds.map(id => new ObjectId(id))
  //       }
  //     }).toArray();

  //     const productMap = new Map(
  //       dbProducts.map(p => [String(p._id), p])
  //     );

  //     const now = new Date();
  //     const orderItems = [];

  //     for (const item of items) {
  //       const product = productMap.get(String(item.productId));
  //       const quantity = Number(item.quantity);

  //       if (
  //         !product ||
  //         product.isDeleted === true ||
  //         ["inactive", "deleted"].includes(product.status) ||
  //         product.inStock === false ||
  //         (product.stock != null &&
  //           Number(product.stock) < quantity)
  //       ) {
  //         return res.status(400).json({
  //           success: false,
  //           message: "একটি পণ্য অনুপলব্ধ বা পর্যাপ্ত স্টক নেই।"
  //         });
  //       }

  //       const regular = Number(product.pricing?.regularPrice);
  //       const sale = Number(product.pricing?.salePrice);
  //       const start = product.pricing?.discountStart;
  //       const end = product.pricing?.discountEnd;

  //       const saleActive =
  //         Number.isFinite(sale) &&
  //         sale > 0 &&
  //         sale < regular &&
  //         (!start || (Number.isFinite(Date.parse(start)) &&
  //           now >= new Date(start))) &&
  //         (!end || (Number.isFinite(Date.parse(end)) &&
  //           now <= new Date(end)));

  //       const price = saleActive ? sale : regular;

  //       if (!Number.isFinite(price) || price < 0) {
  //         return res.status(400).json({
  //           success: false,
  //           message: "পণ্যের মূল্য সঠিক নয়।"
  //         });
  //       }

  //       orderItems.push({
  //         productId: String(product._id),
  //         name: product.name,
  //         nameEn: product.nameEn || "",
  //         slug: product.slug || "",
  //         image: typeof product.thumbnail === "string"
  //           ? product.thumbnail
  //           : product.thumbnail?.url || "",
  //         quantity,
  //         price,
  //         totalPrice: price * quantity
  //       });
  //     }

  //     const shippingRates = {
  //       inside_faridpur: 50,
  //       outside_faridpur: 100
  //     };

  //     if (!Object.hasOwn(shippingRates, deliveryZone)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "সঠিক ডেলিভারি অপশন নির্বাচন করুন।"
  //       });
  //     }

  //     const subtotal = orderItems.reduce(
  //       (sum, item) => sum + item.totalPrice, 0
  //     );
  //     const totalQuantity = orderItems.reduce(
  //       (sum, item) => sum + item.quantity, 0
  //     );
  //     const deliveryCharge = shippingRates[deliveryZone];

  //     const orderNumber =
  //       `UL-${Date.now()}-${crypto.randomBytes(3)
  //         .toString("hex").toUpperCase()}`;

  //     const finalOrder = {
  //       orderNumber,
  //       customer: {
  //         name: customer.name.trim(),
  //         phone: customer.phone.trim(),
  //         altPhone: customer.altPhone || "",
  //         email: customer.email || "",
  //         image: customer.image || "",
  //         district: customer.district.trim(),
  //         thana: customer.thana.trim(),
  //         address: customer.address.trim(),
  //         note: customer.note || ""
  //       },
  //       items: orderItems,
  //       deliveryZone,
  //       deliveryMethod: deliveryMethod || "",
  //       deliveryCharge,
  //       subtotal,
  //       totalQuantity,
  //       grandTotal: subtotal + deliveryCharge,
  //       paymentMethod: paymentMethod || "Cash on Delivery",
  //       paymentStatus: "unpaid",
  //       orderStatus: "pending",
  //       updatedAt: now
  //     };

  //     let resultId;

  //     if (draftId && typeof draftId === "string") {
  //       // Convert the same incomplete order to pending
  //       const result = await orderCollection.findOneAndUpdate(
  //         { draftId, orderStatus: "incomplete" },
  //         {
  //           $set: finalOrder,
  //           $setOnInsert: { createdAt: now }
  //         },
  //         {
  //           upsert: false,
  //           returnDocument: "after"
  //         }
  //       );

  //       if (result) {
  //         // MongoDB driver versions may return document directly
  //         const updated = result.value || result;
  //         if (updated?._id) resultId = updated._id;
  //       }
  //     }

  //     if (!resultId) {
  //       const result = await orderCollection.insertOne({
  //         ...finalOrder,
  //         ...(draftId ? { draftId } : {}),
  //         createdAt: now
  //       });
  //       resultId = result.insertedId;
  //     }

  //     return res.status(201).json({
  //       success: true,
  //       message: "অর্ডার সফলভাবে সংরক্ষণ হয়েছে।",
  //       orderId: resultId,
  //       orderNumber,
  //       orderStatus: "pending",
  //       order: {
  //         _id: resultId,
  //         orderNumber,
  //         grandTotal: finalOrder.grandTotal,
  //         orderStatus: "pending"
  //       }
  //     });

  //   } catch (error) {
  //     console.error("CREATE ORDER ERROR:", error);
  //     return res.status(500).json({
  //       success: false,
  //       message: "অর্ডার সংরক্ষণ করা যায়নি।"
  //     });
  //   }
  // });




app.post("/api/orders", async (req, res) => {
  try {
    const {
      draftId,
      userId,
      customer,
      items,
      deliveryZone,
      deliveryMethod,
      paymentMethod
    } = req.body || {};

    // Customer Validation
    if (
      !customer?.name?.trim() ||
      !customer?.phone?.trim() ||
      !customer?.district?.trim() ||
      !customer?.thana?.trim() ||
      !customer?.address?.trim() ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return res.status(400).json({
        success: false,
        message: "সব প্রয়োজনীয় তথ্য পূরণ করুন।"
      });
    }

    // USER ID: Frontend first, Phone fallback
    const receivedUserId = String(userId || "").trim();
    const phone = String(customer.phone || "").replace(/\D/g, "");

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "সঠিক মোবাইল নম্বর দিন।"
      });
    }

    const resolvedUserId = receivedUserId || phone;

    console.log("[CONFIRM ORDER] Frontend User ID:", receivedUserId);
    console.log("[CONFIRM ORDER] Database User ID:", resolvedUserId);

    // Validate Products / Gift Boxes
    if (
      items.length > 100 ||
      items.some(item => {
        const id = item?.type === "giftBox"
          ? item.giftBoxId
          : item?.productId;

        const quantity = Number(item?.quantity);

        return (
          !ObjectId.isValid(String(id || "")) ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 99
        );
      })
    ) {
      return res.status(400).json({
        success: false,
        message: "পণ্যের তথ্য সঠিক নয়।"
      });
    }

    const productIds = items
      .filter(item => item.type !== "giftBox")
      .map(item => new ObjectId(String(item.productId)));

    const giftIds = items
      .filter(item => item.type === "giftBox")
      .map(item => new ObjectId(String(item.giftBoxId)));

    const [dbProducts, dbGifts] = await Promise.all([
      productCollection.find({
        _id: { $in: productIds }
      }).toArray(),

      giftIds.length
        ? giftBoxCollection.find({
            _id: { $in: giftIds }
          }).toArray()
        : []
    ]);

    const productMap = new Map(
      dbProducts.map(p => [String(p._id), p])
    );

    const giftMap = new Map(
      dbGifts.map(g => [String(g._id), g])
    );

    const now = new Date();
    const orderItems = [];

    const getPrice = pricing => {
      const regular = Number(pricing?.regularPrice);
      const sale = Number(pricing?.salePrice);
      const start = pricing?.discountStart;
      const end = pricing?.discountEnd;

      if (!Number.isFinite(regular) || regular < 0) {
        return NaN;
      }

      const saleActive =
        pricing?.salePrice != null &&
        Number.isFinite(sale) &&
        sale > 0 &&
        sale < regular &&
        (!start ||
          (Number.isFinite(Date.parse(start)) &&
            now >= new Date(start))) &&
        (!end ||
          (Number.isFinite(Date.parse(end)) &&
            now <= new Date(end)));

      return saleActive ? sale : regular;
    };

    for (const item of items) {
      const quantity = Number(item.quantity);

      // GIFT BOX
      if (item.type === "giftBox") {
        const gift = giftMap.get(String(item.giftBoxId));

        if (
          !gift ||
          gift.isDeleted === true ||
          gift.status !== "active"
        ) {
          return res.status(400).json({
            success: false,
            message: "গিফট বক্সটি বর্তমানে পাওয়া যাচ্ছে না।"
          });
        }

        const c = item.customization || {};

        if (
          !Array.isArray(c.selectedProductIds) ||
          c.selectedProductIds.length > 100
        ) {
          return res.status(400).json({
            success: false,
            message: "গিফট বক্সের মিষ্টি নির্বাচন সঠিক নয়।"
          });
        }

        const allowedIds = (gift.products || [])
          .map(p => String(p.productId));

        const selectedIds = [
          ...new Set(c.selectedProductIds.map(String))
        ];

        if (
          !selectedIds.length ||
          selectedIds.some(id => !allowedIds.includes(id))
        ) {
          return res.status(400).json({
            success: false,
            message: "গিফট বক্সের নির্বাচিত মিষ্টি সঠিক নয়।"
          });
        }

        const box = gift.boxOptions?.find(
          option => String(option.id) === String(c.boxOptionId)
        );

        if (gift.boxOptions?.length && !box) {
          return res.status(400).json({
            success: false,
            message: "গিফট বক্স ডিজাইন সঠিক নয়।"
          });
        }

        if (
          (c.greetingCard && !gift.greetingCard?.enabled) ||
          (c.giftWrapping && !gift.giftWrapping?.enabled)
        ) {
          return res.status(400).json({
            success: false,
            message: "নির্বাচিত গিফট কাস্টমাইজেশন উপলব্ধ নয়।"
          });
        }

        const basePrice = getPrice(gift.pricing);
        const boxPrice = Number(box?.additionalPrice || 0);

        const greetingPrice = c.greetingCard
          ? Number(gift.greetingCard?.additionalPrice || 0)
          : 0;

        const wrappingPrice = c.giftWrapping
          ? Number(gift.giftWrapping?.additionalPrice || 0)
          : 0;

        if (
          [basePrice, boxPrice, greetingPrice, wrappingPrice]
            .some(v => !Number.isFinite(v) || v < 0)
        ) {
          return res.status(400).json({
            success: false,
            message: "গিফট বক্সের মূল্য সঠিক নয়।"
          });
        }

        const unitPrice =
          basePrice + boxPrice + greetingPrice + wrappingPrice;

        orderItems.push({
          type: "giftBox",
          giftBoxId: String(gift._id),
          name: gift.name,
          nameEn: gift.nameEn || "",
          image: typeof gift.thumbnail === "string"
            ? gift.thumbnail
            : gift.thumbnail?.url || "",
          quantity,
          price: unitPrice,
          totalPrice: unitPrice * quantity,

          customization: {
            selectedProductIds: selectedIds,
            boxOptionId: String(c.boxOptionId || ""),
            greetingCard: !!c.greetingCard,
            giftMessage: c.greetingCard
              ? String(c.giftMessage || "").slice(
                  0,
                  Number(gift.greetingCard?.maxMessageLength) || 200
                )
              : "",
            recipientName: String(
              c.recipientName || ""
            ).slice(0, 100),
            giftWrapping: !!c.giftWrapping
          }
        });

        continue;
      }

      // NORMAL PRODUCT
      const product = productMap.get(String(item.productId));

      if (
        !product ||
        product.isDeleted === true ||
        ["inactive", "deleted"].includes(product.status) ||
        product.inStock === false ||
        (product.stock != null &&
          Number(product.stock) < quantity)
      ) {
        return res.status(400).json({
          success: false,
          message: "একটি পণ্য অনুপলব্ধ বা পর্যাপ্ত স্টক নেই।"
        });
      }

      const price = getPrice(product.pricing);

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: "পণ্যের মূল্য সঠিক নয়।"
        });
      }

      orderItems.push({
        productId: String(product._id),
        name: product.name,
        nameEn: product.nameEn || "",
        slug: product.slug || "",
        image: typeof product.thumbnail === "string"
          ? product.thumbnail
          : product.thumbnail?.url || "",
        quantity,
        price,
        totalPrice: price * quantity
      });
    }

    // Delivery Calculation
    const shippingRates = {
      inside_faridpur: 50,
      outside_faridpur: 100
    };

    if (!Object.hasOwn(shippingRates, deliveryZone)) {
      return res.status(400).json({
        success: false,
        message: "সঠিক ডেলিভারি অপশন নির্বাচন করুন।"
      });
    }

    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    const totalQuantity = orderItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const deliveryCharge = shippingRates[deliveryZone];

    const orderNumber =
      `UL-${Date.now()}-${crypto.randomBytes(3)
        .toString("hex").toUpperCase()}`;

    // Final Order - USER ID INCLUDED
    const finalOrder = {
      orderNumber,
      userId: resolvedUserId,

      customer: {
        name: customer.name.trim(),
        phone,
        altPhone: customer.altPhone || "",
        email: customer.email || "",
        image: customer.image || "",
        district: customer.district.trim(),
        thana: customer.thana.trim(),
        address: customer.address.trim(),
        note: customer.note || ""
      },

      items: orderItems,
      deliveryZone,
      deliveryMethod: deliveryMethod || "",
      deliveryCharge,
      subtotal,
      totalQuantity,
      grandTotal: subtotal + deliveryCharge,
      paymentMethod: paymentMethod || "Cash on Delivery",
      paymentStatus: "unpaid",
      orderStatus: "pending",
      updatedAt: now
    };

    let resultId;

    // Convert Draft to Confirmed Order
    if (draftId && typeof draftId === "string") {
      const result = await orderCollection.findOneAndUpdate(
        {
          draftId,
          orderStatus: "incomplete"
        },
        {
          $set: finalOrder
        },
        {
          returnDocument: "after"
        }
      );

      const updated = result?.value || result;

      if (updated?._id) {
        resultId = updated._id;
      }
    }

    // Insert New Order
    if (!resultId) {
      if (draftId) {
        const existing = await orderCollection.findOne({
          draftId
        });

        if (existing) {
          return res.status(409).json({
            success: false,
            message: "এই Draft ID দিয়ে অর্ডার ইতিমধ্যে নিশ্চিত হয়েছে।"
          });
        }
      }

      const result = await orderCollection.insertOne({
        ...finalOrder,
        ...(draftId ? { draftId } : {}),
        createdAt: now
      });

      resultId = result.insertedId;
    }

    console.log("[ORDER SAVED]", {
      orderId: String(resultId),
      orderNumber,
      userId: resolvedUserId
    });

    return res.status(201).json({
      success: true,
      message: "অর্ডার সফলভাবে সংরক্ষণ হয়েছে।",
      orderId: resultId,
      orderNumber,
      orderStatus: "pending",
      userId: resolvedUserId,

      order: {
        _id: resultId,
        userId: resolvedUserId,
        orderNumber,
        grandTotal: finalOrder.grandTotal,
        orderStatus: "pending"
      }
    });

  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    return res.status(
      error.code === 11000 ? 409 : 500
    ).json({
      success: false,
      message: error.code === 11000
        ? "অর্ডারটি ইতিমধ্যে সংরক্ষিত হয়েছে।"
        : "অর্ডার সংরক্ষণ করা যায়নি।"
    });
  }
});






  // Incomplete Order API
  // app.post("/api/orders/incomplete", async (req, res) => {
  //   try {
  //     const {
  //       draftId,
  //       customer = {},
  //       items = [],
  //       deliveryZone = "",
  //       deliveryMethod = "",
  //       paymentMethod = "Cash on Delivery"
  //     } = req.body || {};

  //     if (!draftId || typeof draftId !== "string") {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Draft ID required"
  //       });
  //     }

  //     if (!customer || typeof customer !== "object" || Array.isArray(customer) || !Array.isArray(items)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Invalid order data"
  //       });
  //     }

  //     const hasData =
  //       Object.values(customer).some(v => typeof v === "string" && v.trim()) ||
  //       items.length > 0;

  //     if (!hasData) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "No data to save"
  //       });
  //     }

  //     const existing = await orderCollection.findOne({ draftId });

  //     if (existing && existing.orderStatus !== "incomplete") {
  //       return res.status(409).json({
  //         success: false,
  //         message: "Order already confirmed"
  //       });
  //     }

  //     const result = await orderCollection.updateOne(
  //       { draftId, orderStatus: "incomplete" },
  //       {
  //         $set: {
  //           customer,
  //           items,
  //           deliveryZone,
  //           deliveryMethod,
  //           paymentMethod,
  //           paymentStatus: "unpaid",
  //           updatedAt: new Date()
  //         },
  //         $setOnInsert: {
  //           draftId,
  //           orderStatus: "incomplete",
  //           createdAt: new Date()
  //         }
  //       },
  //       { upsert: true }
  //     );

  //     res.status(result.upsertedCount ? 201 : 200).json({
  //       success: true,
  //       message: "Incomplete order saved",
  //       draftId,
  //       orderStatus: "incomplete"
  //     });

  //   } catch (error) {
  //     console.error("Incomplete Order Error:", error.message);

  //     res.status(error.code === 11000 ? 409 : 500).json({
  //       success: false,
  //       message: error.code === 11000
  //         ? "Draft already exists or is confirmed"
  //         : error.message
  //     });
  //   }
  // });

  //



 
app.post("/api/orders/incomplete", async (req, res) => {
  try {
    const {
      draftId,
      userId,
      customer = {},
      items = [],
      deliveryZone = "",
      deliveryMethod = "",
      paymentMethod = "Cash on Delivery"
    } = req.body || {};

    // Draft Validation
    if (!draftId || typeof draftId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Draft ID required"
      });
    }

    if (
      !customer ||
      typeof customer !== "object" ||
      Array.isArray(customer) ||
      !Array.isArray(items)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order data"
      });
    }

    if (items.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Too many items"
      });
    }

    const hasData =
      Object.values(customer).some(
        value =>
          typeof value === "string" &&
          value.trim()
      ) ||
      items.length > 0;

    if (!hasData) {
      return res.status(400).json({
        success: false,
        message: "No data to save"
      });
    }

    // USER ID: Frontend first, Phone fallback
    const receivedUserId = String(userId || "").trim();

    const phone = String(
      customer.phone || ""
    ).replace(/\D/g, "");

    const resolvedUserId =
      receivedUserId ||
      (/^01[3-9]\d{8}$/.test(phone) ? phone : null);

    console.log("[AUTO SAVE] Frontend User ID:", receivedUserId);
    console.log("[AUTO SAVE] Database User ID:", resolvedUserId);

    // Prevent modification of confirmed orders
    const existing = await orderCollection.findOne({
      draftId
    });

    if (
      existing &&
      existing.orderStatus !== "incomplete"
    ) {
      return res.status(409).json({
        success: false,
        message: "Order already confirmed"
      });
    }

    // Safe Product & Gift Box Items
    const safeItems = items.map(item => ({
      ...(item.type === "giftBox"
        ? {
            type: "giftBox",
            giftBoxId: String(item.giftBoxId || ""),
            customization: {
              selectedProductIds:
                Array.isArray(
                  item.customization?.selectedProductIds
                )
                  ? item.customization.selectedProductIds
                  : [],
              boxOptionId:
                item.customization?.boxOptionId || "",
              greetingCard:
                !!item.customization?.greetingCard,
              giftMessage: String(
                item.customization?.giftMessage || ""
              ).slice(0, 500),
              recipientName: String(
                item.customization?.recipientName || ""
              ).slice(0, 100),
              giftWrapping:
                !!item.customization?.giftWrapping
            }
          }
        : {
            productId: String(item.productId || "")
          }),

      name: String(item.name || ""),
      quantity: Math.max(
        1,
        Math.min(
          99,
          Math.floor(Number(item.quantity) || 1)
        )
      )
    }));

    const now = new Date();

    // Save Draft with User ID
    const result = await orderCollection.updateOne(
      {
        draftId,
        orderStatus: "incomplete"
      },
      {
        $set: {
          userId: resolvedUserId,
          customer,
          items: safeItems,
          deliveryZone,
          deliveryMethod,
          paymentMethod,
          paymentStatus: "unpaid",
          updatedAt: now
        },
        $setOnInsert: {
          draftId,
          orderStatus: "incomplete",
          createdAt: now
        }
      },
      {
        upsert: true
      }
    );

    console.log("[INCOMPLETE ORDER SAVED]", {
      draftId,
      userId: resolvedUserId,
      matchedCount: result.matchedCount,
      upsertedCount: result.upsertedCount
    });

    return res.status(
      result.upsertedCount ? 201 : 200
    ).json({
      success: true,
      message: "Incomplete order saved",
      draftId,
      userId: resolvedUserId,
      orderStatus: "incomplete"
    });

  } catch (error) {
    console.error("Incomplete Order Error:", error);

    return res.status(
      error.code === 11000 ? 409 : 500
    ).json({
      success: false,
      message: error.code === 11000
        ? "Draft already exists or is confirmed"
        : "Incomplete order save failed"
    });
  }
});






  ////////////////////////////////




  cartCollection.createIndex({ ownerKey: 1 }, { unique: true });

  const validId = (id) => ObjectId.isValid(id);

  const getOwner = (req) => {
    const userId = req.user?.id || req.user?._id;

    if (userId) return `user:${userId}`;

    const guestId = req.headers["x-guest-cart-id"];

    if (
      typeof guestId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(guestId)
    ) {
      return null;
    }

    return `guest:${guestId}`;
  };

  const productAvailable = (p) =>
    p &&
    p.status === "active" &&
    p.isDeleted !== true &&
    p.inStock !== false &&
    p.stock !== 0;

  const productPrice = (p) => {
    const regular = Number(p.pricing?.regularPrice) || 0;
    const sale = Number(p.pricing?.salePrice);

    return sale > 0 && sale < regular ? sale : regular;
  };

  // GET CART
  app.get("/api/cart", async (req, res) => {
    try {
      const ownerKey = getOwner(req);

      if (!ownerKey) {
        return res.status(400).json({
          success: false,
          message: "Cart owner missing",
        });
      }

      const cart = await cartCollection.findOne({ ownerKey });

      const items = await Promise.all(
        (cart?.items || []).map(async (item) => {
          const product = await productCollection.findOne({
            _id: new ObjectId(item.productId),
          });

          if (!product) return null;

          return {
            productId: item.productId,
            name: product.name,
            slug: product.slug,
            thumbnail: product.thumbnail,
            price: productPrice(product),
            quantity: item.quantity,
            available: productAvailable(product),
            stock: product.stock,
          };
        })
      );

      const products = items.filter(Boolean);

      const subtotal = products.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );

      res.json({
        success: true,
        cart: {
          items: products,
          totalItems: products.reduce(
            (total, item) => total + item.quantity, 0
          ),
          subtotal,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // ADD TO CART
  app.post("/api/cart/add", async (req, res) => {
    try {
      const ownerKey = getOwner(req);
      const { productId } = req.body;
      const quantity = Number(req.body.quantity ?? 1);

      if (!ownerKey) {
        return res.status(400).json({
          success: false,
          message: "Cart owner missing",
        });
      }

      if (
        !validId(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity",
        });
      }

      const product = await productCollection.findOne({
        _id: new ObjectId(productId),
      });

      if (!productAvailable(product)) {
        return res.status(400).json({
          success: false,
          message: "পণ্যটি বর্তমানে পাওয়া যাচ্ছে না",
        });
      }

      const cart = await cartCollection.findOne({ ownerKey });
      const items = cart?.items || [];

      const existing = items.find(
        (item) => item.productId === productId
      );

      const nextQuantity = (existing?.quantity || 0) + quantity;

      if (
        nextQuantity > 99 ||
        (Number.isFinite(Number(product.stock)) &&
          product.stock !== null &&
          product.stock !== undefined &&
          nextQuantity > Number(product.stock))
      ) {
        return res.status(400).json({
          success: false,
          message: "পর্যাপ্ত স্টক নেই অথবা সর্বোচ্চ quantity অতিক্রম করেছে",
        });
      }

      if (existing) {
        existing.quantity = nextQuantity;
      } else {
        items.push({
          productId,
          quantity,
          addedAt: new Date(),
        });
      }

      await cartCollection.updateOne(
        { ownerKey },
        {
          $set: {
            items,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      res.json({
        success: true,
        message: "পণ্য কার্টে যোগ হয়েছে",
        totalItems: items.reduce(
          (total, item) => total + item.quantity, 0
        ),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // UPDATE QUANTITY
  app.patch("/api/cart/:productId", async (req, res) => {
    try {
      const ownerKey = getOwner(req);
      const { productId } = req.params;
      const quantity = Number(req.body.quantity);

      if (
        !ownerKey ||
        !validId(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid request",
        });
      }

      const product = await productCollection.findOne({
        _id: new ObjectId(productId),
      });

      if (!productAvailable(product)) {
        return res.status(400).json({
          success: false,
          message: "পণ্যটি পাওয়া যাচ্ছে না",
        });
      }

      if (
        product.stock !== undefined &&
        product.stock !== null &&
        quantity > Number(product.stock)
      ) {
        return res.status(400).json({
          success: false,
          message: "পর্যাপ্ত স্টক নেই",
        });
      }

      const result = await cartCollection.updateOne(
        {
          ownerKey,
          "items.productId": productId,
        },
        {
          $set: {
            "items.$.quantity": quantity,
            updatedAt: new Date(),
          },
        }
      );

      if (!result.matchedCount) {
        return res.status(404).json({
          success: false,
          message: "কার্টে পণ্য পাওয়া যায়নি",
        });
      }

      res.json({
        success: true,
        message: "Quantity আপডেট হয়েছে",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // REMOVE PRODUCT
  app.delete("/api/cart/:productId", async (req, res) => {
    try {
      const ownerKey = getOwner(req);
      const { productId } = req.params;

      if (!ownerKey || !validId(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid request",
        });
      }

      await cartCollection.updateOne(
        { ownerKey },
        {
          $pull: { items: { productId } },
          $set: { updatedAt: new Date() },
        }
      );

      res.json({
        success: true,
        message: "পণ্য কার্ট থেকে সরানো হয়েছে",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // CLEAR CART
  app.delete("/api/cart", async (req, res) => {
    try {
      const ownerKey = getOwner(req);

      if (!ownerKey) {
        return res.status(400).json({
          success: false,
          message: "Cart owner missing",
        });
      }

      await cartCollection.updateOne(
        { ownerKey },
        {
          $set: {
            items: [],
            updatedAt: new Date(),
          },
        }
      );

      res.json({
        success: true,
        message: "কার্ট খালি করা হয়েছে",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });













}




// Home Route
app.get("/", (req, res) => {
  res.send("ULAMA SWEETS API is running!");
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
