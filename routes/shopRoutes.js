const express = require("express");
const router = express.Router();
const Product = require("../models/product");
const { jwtAuthMiddleWare } = require("../jwt");
const User = require("../models/user");
const Order = require("../models/order");
const multer = require("multer");
const { put } = require("@vercel/blob");
const Cart = require("../models/cart");
const Wishlist = require("../models/wishlist");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const checkAdminRole = async (userId) => {
  try {
    const user = await User.findById(userId);
    return user.role === "admin";
  } catch (error) {
    return false;
  }
};

router.get("/productlist", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const { sort, category } = req.query;
    const limit = 8;
    const skip = (page - 1) * limit;

    let filterQuery = {};
    if (category && category !== "all") {
      filterQuery.category = category;
    }

    let sortQuery = {};
    if (sort === "asc") {
      sortQuery.price = 1;
    } else if (sort === "desc") {
      sortQuery.price = -1;
    } else {
      sortQuery.createdAt = -1;
    }
    const totalProducts = await Product.countDocuments(filterQuery);
    const productList = await Product.find(filterQuery)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    if (!productList || productList.length === 0) {
      return res.status(404).json({
        message: "No products found for this criteria",
        success: false,
      });
    }

    return res.status(200).json({
      response: productList,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalItems: totalProducts,
      message: "Products fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
      success: false,
    });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const categories = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          categoryImage: { $first: { $arrayElemAt: ["$images", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          image: "$categoryImage",
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    res.status(200).json({ success: true, response: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/wishlist/remove/:id", jwtAuthMiddleWare, async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedWishlist = await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { products: productId } },
      { new: true },
    ).populate("products");

    res.status(200).json({
      success: true,
      response: updatedWishlist ? updatedWishlist.products : [],
      message: "Item removed from wishlist",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
//wishlist route
router.post("/wishlist/add", jwtAuthMiddleWare, async (req, res) => {
  try {
    const { productId } = req.body;
    const updatedWishlist = await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $addToSet: { products: productId } },
      { new: true, upsert: true },
    ).populate("products");

    res.status(200).json({
      success: true,
      response: updatedWishlist.products,
      message: "Item added to wishlist",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/wishlist", jwtAuthMiddleWare, async (req, res) => {
  try {
    const userWishList = await Wishlist.findOne({
      user: req.user._id,
    }).populate("products");

    if (!userWishList) {
      return res.status(200).json({
        response: { products: [] },
        message: "No wishlist found for this user",
        success: true,
      });
    }

    return res.status(200).json({
      response: userWishList,
      message: "Wishlist fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while fetching wishlist",
      success: false,
    });
  }
});
//cart routes
router.post("/cart/add", jwtAuthMiddleWare, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user._id;

    const cartExistsWithItem = await Cart.findOne({
      user: userId,
      "items.product": productId,
    });

    let finalCart;

    if (cartExistsWithItem) {
      finalCart = await Cart.findOneAndUpdate(
        { user: userId, "items.product": productId },
        { $inc: { "items.$.quantity": quantity } },
        { new: true },
      ).populate("items.product");
    } else {
      finalCart = await Cart.findOneAndUpdate(
        { user: userId },
        { $push: { items: { product: productId, quantity } } },
        { new: true, upsert: true },
      ).populate("items.product");
    }
    return res.status(200).json({
      response: finalCart.items,
      updatedAt: finalCart.updatedAt,
      success: true,
    });
  } catch (error) {
    console.error("Cart Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router.delete(
  "/cart/remove/:productId",
  jwtAuthMiddleWare,
  async (req, res) => {
    try {
      const cart = await Cart.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { items: { product: req.params.productId } } },
        { new: true },
      ).populate("items.product");

      res.status(200).json({ response: cart ? cart.items : [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.get("/cart", jwtAuthMiddleWare, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );
    if (!cart) {
      return res.status(200).json({ response: { items: [] } });
    }
    res.status(200).json({ response: cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/cart/update", jwtAuthMiddleWare, async (req, res) => {
  const { productId, quantity } = req.body;
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id, "items.product": productId },
      { $set: { "items.$.quantity": quantity } },
      { new: true },
    ).populate("items.product");

    res.status(200).json({ response: cart.items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/productdetail/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const productDetail = await Product.findById(productId);
    return res.status(200).json({
      response: productDetail,
      message: "productDetail fetched",
      success: true,
    });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Validation failed", error, success: false });
  }
});

router.post("/create-payment-intent", async (req, res) => {
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const { amount, email } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: "inr",
      receipt_email: email,
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/cart/clearCart", jwtAuthMiddleWare, async (req, res) => {
  try {
    const userId = req.user._id;

    await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      response: [],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  "/admin/addproduct",
  upload.array("images", 3),
  jwtAuthMiddleWare,
  async (req, res) => {
    try {
      const userId = req.user._id;
      const isAdmin = await checkAdminRole(userId);
      if (!isAdmin) {
        return res
          .status(403)
          .json({ message: "user does not has admin role" });
      }
      const { name, price, quantity, category } = req.body;
      if (!name || !price || !quantity || !category) {
        return res.status(400).json({ error: "All fields are required." });
      }

      if (!req.files || req.files.length == 0) {
        return res.status(400).json({ error: "atlest one image is required" });
      }

      const vercelBlobToken = process.env.BLOB_READ_WRITE_TOKEN;

      if (!vercelBlobToken) {
        return res
          .status(500)
          .json({ error: "Vercel Blob token is not configured." });
      }
      const uploadedPromises = req.files.map((file) => {
        return put(file.originalname, file.buffer, {
          access: "public",
          token: vercelBlobToken,
          allowOverwrite: true,
        });
      });
      //wait to upload a file
      const blob = await Promise.all(uploadedPromises);
      const imageUrl = blob.map((blob) => blob.url);
      const newProduct = new Product({
        name: name,
        price: price,
        image: imageUrl,
        quantity: quantity,
        category: category,
        user: userId,
      });
      const response = await newProduct.save();
      res.status(200).json({ response: response, message: "Product added" });
    } catch (error) {
      res.status(500).json({ error: "internal server error" });
    }
  },
);

module.exports = router;
