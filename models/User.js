const mongoose = require('mongoose');
const { isEmail } = require('validator');
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: [true, 'Please enter an email'],
        unique: true,
        validate: [isEmail, 'Please enter a valid email'],
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    phone: {
        type: String,
        required: true,
    },
    familyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Family"
    },
    occupation: {
        type: String,
        required: true,
    },
    annualIncome: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        required: true,
    },
    country: {
        type: String,
        required: true,
    },
    dob: {
        type: Date,
        required: true,
    },
    accounts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
    }],

    // === NEW: Risk Profile & Net Worth Tracking ===
    riskProfile: { // Determined by a separate risk questionnaire
        type: String,
        enum: ['Conservative', 'Moderate', 'Aggressive'],
        default: 'Moderate'
    },
    netWorthHistory: [{
        date: { type: Date, default: Date.now },
        netWorth: { type: Number, default: 0 }
    }],
    // === END NEW ===

    financeHealthScore: { type: Number, default: 50 }, // Initial Score
    creditFitnessScore: Number,
    goals: [{
        name: { type: String, required: true },
        goalType: { type: String, required: true },
        targetAmount: { type: Number, required: true },
        dueDate: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now() }
    }],
    investments: [{
        investmentType: { type: String, required: true },
        amount: { type: Number, required: true },
        maturityDate: { type: Date },
        investedDate: { type: Date, required: true, default: Date.now() }
    }],
    coins: {
        type: Number,
        default: 0
    },
    expenseCategories: [{ type: String }],
    expenses: [{
        expenseType: { type: String, required: true },
        expenseAmount: { type: Number, required: true },
        vendor: { type: String, required: true },
        note: { type: String },
        category: { type: String },
        expenseDate: { type: Date, required: true },
        // === NEW: Tax Deduction Tag ===
        isTaxDeductible: { type: Boolean, default: false }
        // === END NEW ===
    }],
    liabilities: [{
        liabilitiesType: { type: String, required: true },
        bank: { type: String, required: true },
        outstandingAmount: { type: Number, required: true },
        emi: { type: Number, required: true },
        intrestRate: { type: Number, required: true },
        dueDate: { type: Date, required: true },
        // === NEW: Tax Deduction Tag for loans like education/mortgage ===
        isTaxDeductible: { type: Boolean, default: false }
        // === END NEW ===
    }],
    insurance: [{
        insuranceType: { type: String, required: true },
        provider: { type: String, required: true },
        sumAssured: { type: Number, required: true },
        premium: { type: Number, required: true },
        termYears: { type: Number, required: true },
    }],
    taxDetails: {
        panNumber: { type: String },
        lastFilingYear: { type: Number },
        totalTaxPaid: { type: Number },
    },
    courseSequence: [{
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
        }
    }],
    chatHistory: [{
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true })

userSchema.statics.login = async function (email, password) {
    const user = await this.findOne({ email });
    if (user) {
        const auth = await bcrypt.compare(password, user.password);
        if (auth) {
            return user;
        }
        return null
    }
    return null
};
const User = mongoose.model('User', userSchema);

module.exports = User;