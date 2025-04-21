const express = require("express");
const router = express.Router();
const Food = require("../models/Food");
const { verifyToken } = require("../utils/jwt");

// Donor adds food
router.post("/add", verifyToken, async (req, res) => {
  if (req.user.role !== "donor")
    return res.status(403).json({ error: "Only donors can add food" });

  const { title, description, totalServings } = req.body;
  try {
    const food = new Food({
      title,
      description,
      totalServings,
      availableServings: totalServings,
      donorId: req.user.id,
    });
    await food.save();
    res.status(201).json(food);
  } catch (err) {
    res.status(500).json({ error: "Error posting food" });
  }
});

// Recipients/Volunteers view food
router.get("/available", verifyToken, async (req, res) => {
  const foodList = await Food.find({ availableServings: { $gt: 0 } });
  res.json(foodList);
});

router.post("/request", verifyToken, async (req, res) => {
  const { foodId, servings } = req.body;
  const { id: userId, role } = req.user;

  if (!["recipient", "volunteer"].includes(role))
    return res.status(403).json({ error: "Access denied" });

  try {
    const food = await Food.findById(foodId);
    if (!food) return res.status(404).json({ error: "Food not found" });

    if (servings > food.availableServings) {
      return res.status(400).json({ error: "Not enough servings available" });
    }

    food.availableServings -= servings;
    food.assignments.push({ userId, servings, role });
    await food.save();

    res.json({ message: "Assigned successfully", food });
  } catch (err) {
    res.status(500).json({ error: "Error assigning food" });
  }
});

module.exports = router;
