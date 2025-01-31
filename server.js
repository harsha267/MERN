require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const { engine } = require('express-handlebars');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/habit-tracker')
.then(() => console.log("MongoDB connected successfully"))
.catch((error) => console.log("MongoDB connection error:", error));

// Import Models
const Habit = require("./models/Habit");

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  habits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Habit' }]
});

const User = mongoose.model('User', userSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files - fixing the configuration
app.use(express.static(path.join(__dirname, 'public')));

// Set up View Engine
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  helpers: {
    formatTime: function(date) {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
  }
}));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Setup Express Session
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy with Error Logging
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      console.log("Authenticating user:", username);
      const user = await User.findOne({ username });
      
      if (!user) {
        console.log("User not found:", username);
        return done(null, false, { message: "Username not found" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log("Invalid password for user:", username);
        return done(null, false, { message: "Incorrect password" });
      }

      console.log("Authentication successful for user:", username);
      return done(null, user);
    } catch (error) {
      console.error("Authentication error:", error);
      return done(error);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Middleware to check authentication
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
};

// Routes
app.get("/", ensureAuthenticated, async (req, res) => {
  try {
    console.log("Fetching habits for user:", req.user._id);
    const habits = await Habit.find({ user: req.user._id });
    console.log("Found habits:", habits);
    res.render("index", { 
      user: req.user,
      habits: habits 
    });
  } catch (error) {
    console.error("Error fetching habits:", error);
    res.status(500).send("Error fetching habits");
  }
});

app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  res.render("login");
});

app.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  res.render("register");
});

// Registration Route
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.error("Missing username or password");
      return res.status(400).render("register", { 
        error: "Username and password are required" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.error("Username already exists:", username);
      return res.status(400).render("register", { 
        error: "Username already exists" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      username,
      password: hashedPassword
    });

    console.log("Attempting to save new user:", username);
    await newUser.save();
    console.log("User saved successfully:", username);
    
    // Log in the user after registration
    req.login(newUser, (err) => {
      if (err) {
        console.error("Login error after registration:", err);
        return res.status(500).render("register", { 
          error: "Error during login" 
        });
      }
      res.redirect("/");
    });
  } catch (error) {
    console.error("Registration error details:", error);
    res.status(500).render("register", { 
      error: "Error registering user" 
    });
  }
});

// Login Route
app.post("/login", (req, res, next) => {
  console.log("Login attempt for username:", req.body.username);
  
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).render("login", { 
        error: "Internal server error" 
      });
    }
    if (!user) {
      console.error("Login failed:", info.message);
      return res.status(401).render("login", { 
        error: info.message || "Invalid credentials" 
      });
    }
    req.login(user, (err) => {
      if (err) {
        console.error("Session error:", err);
        return res.status(500).render("login", { 
          error: "Error during login" 
        });
      }
      console.log("Login successful for user:", user.username);
      return res.redirect("/");
    });
  })(req, res, next);
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.redirect("/login");
  });
});

// Habit Routes
app.post("/habits/add", ensureAuthenticated, async (req, res) => {
  try {
    console.log("Adding habit for user:", req.user._id);
    console.log("Habit details:", req.body);
    
    const newHabit = await Habit.create({ 
      name: req.body.name,
      time: req.body.time || "00:00",
      user: req.user._id,
      completed: false,
      history: []
    });
    
    console.log("Created new habit:", newHabit);
    res.redirect("/");
  } catch (error) {
    console.error("Error adding habit:", error);
    res.status(500).send("Error adding habit");
  }
});

app.post("/habits/toggle/:id", ensureAuthenticated, async (req, res) => {
  try {
    console.log("Toggling habit for user:", req.user._id);
    console.log("Habit ID:", req.params.id);
    
    const habit = await Habit.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    });
    if (!habit) {
      console.error("Habit not found for user:", req.user._id);
      return res.status(404).send("Habit not found");
    }
    
    // Update the completed status
    habit.completed = !habit.completed;
    
    // Add to history
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    today.setMinutes(today.getMinutes() + today.getTimezoneOffset() + 330); // Add 5:30 hours for IST
    
    const historyEntry = habit.history.find(entry => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });
    
    if (historyEntry) {
      historyEntry.completed = habit.completed;
      if (habit.completed) {
        historyEntry.completedAt = now;
      }
    } else {
      habit.history.push({
        date: today,
        completed: habit.completed,
        completedAt: habit.completed ? now : undefined
      });
    }
    
    await habit.save();
    console.log("Habit toggled successfully for user:", req.user._id);
    res.redirect("/");
  } catch (error) {
    console.error("Error toggling habit:", error);
    res.status(500).send("Error toggling habit");
  }
});

// Get previous day's history
app.get("/history/yesterday", ensureAuthenticated, async (req, res) => {
  try {
    console.log("Fetching yesterday's history for user:", req.user._id);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setMinutes(yesterday.getMinutes() + yesterday.getTimezoneOffset() + 330); // Add 5:30 hours for IST
    
    const habits = await Habit.find({ user: req.user._id });
    const yesterdayHabits = habits.map(habit => {
      const yesterdayHistory = habit.history.find(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === yesterday.getTime();
      });
      
      return {
        name: habit.name,
        time: habit.time,
        completed: yesterdayHistory ? yesterdayHistory.completed : false,
        completedAt: yesterdayHistory?.completedAt
      };
    });
    
    console.log("Found yesterday's habits:", yesterdayHabits);
    res.render("history", { 
      user: req.user,
      date: yesterday.toLocaleDateString(),
      habits: yesterdayHabits
    });
  } catch (error) {
    console.error('Error in /history/yesterday:', error);
    res.status(500).send("Error fetching history");
  }
});

// Get all past habits
app.get("/history/all", ensureAuthenticated, async (req, res) => {
  try {
    console.log("Fetching all history for user:", req.user._id);
    
    const habits = await Habit.find({ user: req.user._id });
    
    // Get all unique dates from history
    const allDates = new Set();
    habits.forEach(habit => {
      habit.history.forEach(entry => {
        const date = new Date(entry.date);
        date.setHours(0, 0, 0, 0);
        allDates.add(date.getTime());
      });
    });

    let historyByDate = [];
    
    // If there's no history yet, show current habits for today
    if (allDates.size === 0 && habits.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      today.setMinutes(today.getMinutes() + today.getTimezoneOffset() + 330); // Add 5:30 hours for IST
      
      historyByDate = [{
        date: today.toLocaleDateString(),
        habits: habits.map(habit => ({
          name: habit.name,
          time: habit.time,
          completed: habit.completed,
          noHistory: true
        }))
      }];
    } else {
      // Sort dates in descending order (newest first)
      const sortedDates = Array.from(allDates).sort((a, b) => b - a);
      
      // Create history data for each date
      historyByDate = sortedDates.map(timestamp => {
        const date = new Date(timestamp);
        const habitsForDate = habits.map(habit => {
          const historyEntry = habit.history.find(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === timestamp;
          });
          
          return {
            name: habit.name,
            time: habit.time,
            completed: historyEntry ? historyEntry.completed : false,
            completedAt: historyEntry?.completedAt
          };
        });
        
        return {
          date: date.toLocaleDateString(),
          habits: habitsForDate
        };
      });
    }
    
    console.log("Found all history:", historyByDate);
    res.render("all-history", { 
      user: req.user,
      historyByDate,
      hasHabits: habits.length > 0,
      hasHistory: allDates.size > 0
    });
  } catch (error) {
    console.error('Error in /history/all:', error);
    res.status(500).send("Error fetching history");
  }
});

app.post("/habits/delete/:id", ensureAuthenticated, async (req, res) => {
  try {
    console.log("Deleting habit for user:", req.user._id);
    console.log("Habit ID:", req.params.id);
    
    await Habit.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.user._id 
    });
    console.log("Habit deleted successfully for user:", req.user._id);
    res.redirect("/");
  } catch (error) {
    console.error("Error deleting habit:", error);
    res.status(500).send("Error deleting habit");
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
