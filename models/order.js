const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
      name: String,
      quantity: Number,
      price: Number,
    },
  ],
  totalAmount: Number,
  shippingAddress: String,
  status: { type: String, default: "Pending" },
  date: { type: Date, default: Date.now },
});

const Order = mongoose.model("order", OrderSchema);
module.exports = Order;
