const mongoose = require("mongoose");
const wishListSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
      },
    ],
  },
  { timestamps: true }
);

const Wishlist = mongoose.model("wishlist", wishListSchema);
module.exports = Wishlist;
