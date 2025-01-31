const mongoose = require('mongoose');
const Habit = require('./models/Habit');

async function addSampleHistory() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/habit-tracker');
        console.log('Connected to MongoDB');

        // Get all habits
        const habits = await Habit.find();
        
        // Add history for the last 3 days
        for (const habit of habits) {
            const history = [];
            
            // Today (set to midnight IST)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            today.setMinutes(today.getMinutes() + today.getTimezoneOffset() + 330); // Add 5 hours 30 minutes to adjust for IST
            
            // Yesterday (set to midnight IST)
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            // Day before yesterday (set to midnight IST)
            const dayBeforeYesterday = new Date(today);
            dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
            
            // Add history entries
            const dates = [today, yesterday, dayBeforeYesterday];
            const statuses = {
                'coding': [true, true, false],
                'early sleep': [false, true, true],
                'brush twice a day': [true, true, true],
                'Assignment': [true, false, true],
                'book reading': [false, true, false]
            };
            
            dates.forEach((date, index) => {
                history.push({
                    date: date,
                    completed: statuses[habit.name] ? statuses[habit.name][index] : Math.random() > 0.3
                });
            });

            // Update the habit with history
            habit.history = history;
            await habit.save();
            console.log(`Added history for habit: ${habit.name}`);
        }

        console.log('Sample history added successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

addSampleHistory();
