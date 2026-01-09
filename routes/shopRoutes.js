const express = require("express");
const router = express.Router();
const Product = require("../models/product");
const { jwtAuthMiddleWare } = require("../jwt");
const User = require("../models/user");
const Order = require("../models/order");
const multer = require("multer");
const { put } = require("@vercel/blob");
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
    const productList = await Product.find();
    console.log(productList);
    if (!productList || productList.length == 0) {
      return res.status(404).json({
        message: "product list is empty or not found",
        success: false,
      });
    } else {
      return res.status(200).json({
        response: productList,
        message: "product fetched",
        success: true,
      });
    }
  } catch (error) {
    return res
      .status(400)
      .json({ message: "productList fetch failed", error, success: false });
  }
});

router.get("/wishlist", jwtAuthMiddleWare, async (req, res) => {
  try {
    const wishList = await Product.find().populate("createdBy", "-password");
    return res.status(200).json({
      response: wishList,
      message: "wishList fetched",
      success: true,
    });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "wishlist fetch failed", error, success: false });
  }
});

router.get("/productdetail/:id", jwtAuthMiddleWare, async (req, res) => {
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

router.post("/checkout", jwtAuthMiddleWare, async (req, res) => {
  try {
    const { cartItems, totalAmount, shippingAddress } = req.body;
    if (!cartItems || !totalAmount || !shippingAddress) {
      return res.status(404).json({
        message: "item not found",
        success: false,
      });
    }
    const userId = req.user.id;
    if (!userId) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    const newOrder = new Order({
      user: userId,
      items: cartItems,
      totalAmount: totalAmount,
      shippingAddress: shippingAddress,
    });

    await newOrder.save();

    res.status(200).json({ success: true, message: "Order Saved!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
module.exports = router;

router.post(
  "/admin/addproduct",
  upload.array("images", 3),
  jwtAuthMiddleWare,
  async (req, res) => {
    try {
      const userId = req.user.user._id;
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
  }
);
