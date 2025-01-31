require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/habit-tracker')
.then(() => console.log("MongoDB connected successfully"))
.catch((error) => console.log("MongoDB connection error:", error));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  habits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Habit' }]
});

const User = mongoose.model('User', userSchema);

async function resetPassword() {
  try {
    const newPassword = "password123"; // This will be the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await User.updateOne(
      { username: "Harshavarshini" },
      { $set: { password: hashedPassword } }
    );
    
    console.log("Password reset successful!");
    console.log("New password is: " + newPassword);
    process.exit(0);
  } catch (error) {
    console.error("Error resetting password:", error);
    process.exit(1);
  }
}

resetPassword();
