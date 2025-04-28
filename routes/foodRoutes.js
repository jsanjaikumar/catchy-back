const express = require("express");
const router = express.Router();
const Food = require("../models/Food");
const { verifyToken } = require("../utils/jwt");
const nodemailer = require("nodemailer");

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "noreplycatchyfoods@gmail.com",
    pass: "bfpmouinjeghrhif",
    //before pass :acusnstouxtxdzep
  },
});

// Helper function to send email to the donor after successful donation
const sendDonorEmail = async (donorEmail, foodTitle) => {
  const mailOptions = {
    from: "noreplycatchyfoods@gmail.com",
    to: donorEmail,
    subject: "Food Donation Successful! Rider will Reach you soon",
    text: `Hello,\n\nThank you for your generous donation of the food item "${foodTitle}".\n\nWe appreciate your contribution! \n\nsuppot:noreplycatchyfoods@gmail.com,\nCatchy Foods Team`,
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send email to the recipient after requesting food
const sendRecipientEmail = async (recipientEmail, foodTitle, servings) => {
  const mailOptions = {
    from: "noreplycatchyfoods@gmail.com",
    to: recipientEmail,
    subject: "Food Request Successful! Rider will Reach you soon",
    text: `Hello,\n\nYour request for the food item "${foodTitle}" with ${servings} servings has been successfully processed.\n\nWe here for you! \n\nsupport:noreplycatchyfoods@gmail.com`,
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to send email to the recipient after successful delivery
const sendDeliveryEmail = async (recipientEmail, foodTitle) => {
  const mailOptions = {
    from: "noreplycatchyfoods@gmail.com",
    to: recipientEmail,
    subject: "Food Delivery Successful! You have saved meals & souls",
    text: `Hello,\n\nYour requested food item "${foodTitle}" has been successfully delivered.\n\nThank you for using our service!`,
  };

  await transporter.sendMail(mailOptions);
};

// Donor adds food
router.post("/add", verifyToken, async (req, res) => {
  if (req.user.role !== "donor") {
    return res.status(403).json({ error: "Only donors can add food" });
  }

  const {
    title,
    firstName,
    lastName,
    servings,
    foodType,
    expiryDate,
    zip,
    address,
    countryCode,
    phone,
    email,
    latitude,
    longitude,
  } = req.body;

  try {
    const food = new Food({
      title,
      firstName,
      lastName,
      servings,
      foodType,
      expiryDate,
      zip,
      address,
      countryCode,
      phone,
      email,
      latitude,
      longitude,
      donorId: req.user.id,
      availableServings: servings,
    });

    await food.save();

    // Send email to the donor after successful donation
    await sendDonorEmail(email, food.title);

    res.status(201).json(food);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error posting food" });
  }
});

// Get all food donations made by the logged-in donor
router.get("/my-donations", verifyToken, async (req, res) => {
  // if (req.user.role !== "donor") {
  //   return res
  //     .status(403)
  //     .json({ error: "Only donors can view their donations" });
  // }

  const { id: donorId } = req.user;

  try {
    const donations = await Food.find({ donorId });

    res.json(donations);
  } catch (err) {
    console.error("Error fetching donations:", err);
    res.status(500).json({ error: "Error fetching your donations" });
  }
});

// Recipients/Volunteers view food
router.get("/available", verifyToken, async (req, res) => {
  const foodList = await Food.find({ availableServings: { $gt: 0 } });
  res.json(foodList);
});

// Volunteers can view all food assignments
router.get("/assignments", verifyToken, async (req, res) => {
  if (req.user.role !== "volunteer") {
    return res
      .status(403)
      .json({ error: "Only volunteers can view assignments" });
  }

  try {
    const foods = await Food.find(
      {},
      {
        title: 1,
        foodType: 1,
        address: 1,
        assignments: 1,
        firstName: 1,
        phone: 1,
      }
    );

    const allAssignments = [];

    foods.forEach((food) => {
      food.assignments.forEach((assignment) => {
        allAssignments.push({
          foodId: food._id,
          foodTitle: food.title,
          foodAddress: food.address,
          foodType: food.foodType,
          donorName: food.firstName,
          donorContact: food.phone,
          assignmentId: assignment._id,
          servings: assignment.servings,
          email: assignment.email,
          name: assignment.name,
          contact: assignment.contact,
          address: assignment.address,
          assignedAt: assignment.assignedAt,
        });
      });
    });

    res.json(allAssignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching assignments" });
  }
});

// Deliver food and send email to donor and recipient
router.post("/deliver", verifyToken, async (req, res) => {
  const { foodId, assignmentId } = req.body;

  if (req.user.role == "donor") {
    return res.status(403).json({ error: "Only volunteers can mark delivery" });
  }

  try {
    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({ error: "Food not found" });
    }

    const assignment = food.assignments.find(
      (assignment) => assignment._id.toString() === assignmentId
    );

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Save assignment email before removing
    const recipientEmail = assignment.email;
    const foodTitle = food.title;
    const servings = assignment.servings;

    // Remove the assignment
    food.assignments = food.assignments.filter(
      (assignment) => assignment._id.toString() !== assignmentId
    );

    await food.save();

    // Send email to the recipient after delivery
    if (recipientEmail) {
      await sendDeliveryEmail(recipientEmail, foodTitle);
    }

    res.json({
      message:
        "Assignment marked as delivered, removed, and emails sent successfully",
    });
  } catch (err) {
    console.error("Error in delivery:", err);
    res.status(500).json({ error: "Error marking as delivered" });
  }
});

// Recipient requests food
router.post("/request", verifyToken, async (req, res) => {
  const { foodId, servings, email, name, contact, address } = req.body;
  const { id: userId, role } = req.user;

  try {
    if (req.user.role == "donor")
      return res
        .status(400)
        .json({ error: "Either Recipient or Volunteer can request food" });
    const food = await Food.findById(foodId);
    if (!food) return res.status(404).json({ error: "Food not found" });

    if (servings > food.availableServings) {
      return res.status(400).json({ error: "Not enough servings available" });
    }

    food.availableServings -= servings;
    food.assignments.push({
      recipientId: userId,
      servings,
      role,
      email,
      name,
      contact,
      address,
    });
    await food.save();

    // Send email to the recipient after successful request
    await sendRecipientEmail(email, food.title, servings);

    res.json({ message: "Assigned successfully", food });
  } catch (err) {
    console.error("Error assigning food:", err);
    res.status(500).json({ error: "Error assigning food", err });
  }
});

// Get all food requests made by the logged-in user
router.get("/my-requests", verifyToken, async (req, res) => {
  const { id: userId } = req.user;

  try {
    const foods = await Food.find({ "assignments.recipientId": userId });

    const userRequests = [];

    foods.forEach((food) => {
      food.assignments.forEach((assignment) => {
        if (assignment?.recipientId?.toString() === userId) {
          userRequests.push({
            foodId: food._id,
            foodTitle: food.title,
            foodAddress: food.address,
            foodType: food.foodType,
            assignmentId: assignment._id,
            servings: assignment.servings,
            email: assignment.email,
            name: assignment.name,
            contact: assignment.contact,
            address: assignment.address,
            assignedAt: assignment.assignedAt,
          });
        }
      });
    });

    res.json(userRequests);
  } catch (err) {
    console.error("Error fetching user requests:", err);
    res.status(500).json({ error: "Error fetching your requests" });
  }
});

module.exports = router;
