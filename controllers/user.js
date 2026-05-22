require("dotenv").config(); // Ensure environment variables are loaded here

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Account = require("../models/Account");
const Family = require("../models/Family");

// create json web token
const maxAge = 1000 * 365 * 24 * 60 * 60;
const createUserToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
    expiresIn: maxAge,
  });
};

// POST /api/register (Updated for FHS default and new fields)
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      repassword,
      phone,
      occupation,
      annualIncome,
      currency,
      country,
      dob,
    } = req.body;
    if (
      !name ||
      !email ||
      !password ||
      !phone ||
      !occupation ||
      !annualIncome ||
      !currency ||
      !country ||
      !dob
    ) {
      return res.render("register", { errMsg: "Invalid request!" });
    }
    if (password !== repassword) {
      return res.render("register", {
        errMsg: "Password & Confirm Password not match!",
      });
    }
    await User.init();

    const hashedPassword = await bcrypt.hash(password, 10);

    const new_user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      occupation,
      annualIncome: parseFloat(annualIncome),
      currency,
      country,
      dob: new Date(dob),
      expenseCategories: ["Fixed", "Variable"],
      financeHealthScore: 50, // Initial default score
      riskProfile: "Moderate" // Initial default risk profile
    });
    await new_user.save();

    const token = createUserToken(new_user._id);
    res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.render("register", { errMsg: err.message });
  }
};

// POST /api/login
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.login(email, password);
    const token = createUserToken(user._id);
    res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const logout = (req, res) => {
  res.cookie("jwt", "", { maxAge: 1 });
  res.redirect("/login");
};

const addAccount = async (req, res) => {
  const userId = req.userId;
  try {
    console.log('addAccount called. userId=', userId);
    console.log('req.body=', req.body);

    if (!userId) {
      console.warn('No userId found.');
      return res.redirect('/login'); // or render login
    }

    // Accept both names: bank (form) or bankName (older code)
    const bankName = req.body.bankName || req.body.bank;
    const { accountNumber, accountType } = req.body;

    if (!bankName || !accountNumber || !accountType) {
      console.warn('Validation failed - missing field(s)', { bankName, accountNumber, accountType });
      // Redirect back to dashboard or wherever the form is (with a query param if you want)
      return res.redirect('/?err=Please+fill+all+fields');
    }

    await Account.init();

    // optional: check duplicate account number
    const existing = await Account.findOne({ accountNumber });
    if (existing) {
      console.warn('Account with this accountNumber already exists:', accountNumber);
      return res.redirect('/?err=Account+number+already+exists');
    }

    const currentBalance = Math.floor(Math.random() * (3000000 - 100000 + 1)) + 100000;

    const user_account = new Account({
      userId,
      accountNumber,
      bankName,
      currentBalance,
      accountType,
    });

    const savedAccount = await user_account.save();
    console.log('savedAccount=', savedAccount);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { accounts: savedAccount._id } },
      { new: true }
    );

    console.log('updatedUser after push=', updatedUser);

    if (!updatedUser) {
      // rollback created account if attaching failed
      await Account.findByIdAndDelete(savedAccount._id);
      return res.redirect('/?err=Failed+to+attach+account');
    }

    return res.redirect('/');
  } catch (err) {
    console.error('addAccount error:', err);
    return res.redirect('/?err=Server+error');
  }
};

const addInvestment = async (req, res) => {
  const userId = req.userId;
  try {
    const { investmentType, amount, maturityDate, investedDate } = req.body;
    if (!investmentType || !amount || !investedDate || !maturityDate) {
      return res.redirect("/");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.render("login", { errMsg: "User not found" });
    }

    const newInvestment = {
      investmentType,
      amount: parseFloat(amount),
      maturityDate: maturityDate ? new Date(maturityDate) : null,
      investedDate: new Date(investedDate),
    };
    user.investments.push(newInvestment);

    await user.save();
    res.redirect("/investments");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const addGoal = async (req, res) => {
  const userId = req.userId;
  try {
    const { name, goalType, targetAmount, dueDate } = req.body;
    if (!name || !goalType || !targetAmount || !dueDate) {
      return res.redirect("/goals");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.render("login", { errMsg: "User not found" });
    }

    const newGoal = {
      name,
      goalType,
      targetAmount: parseFloat(targetAmount),
      dueDate: new Date(dueDate),
    };
    user.goals.push(newGoal);

    await user.save();
    res.redirect("/goals");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

// POST /api/expense (Updated for tax deductibility)
const addExpense = async (req, res) => {
  const userId = req.userId;
  try {
    const { expenseAmount, category, vendor, expenseType, expenseDate, note, isTaxDeductible } =
      req.body;

    if (
      !expenseAmount ||
      !category ||
      !vendor ||
      !expenseType ||
      !expenseDate ||
      !note
    ) {
      return res.redirect("/expenses");
    }

    const user = await User.findById(userId);
    const newExpense = {
      expenseAmount: parseFloat(expenseAmount),
      category,
      expenseType,
      expenseDate: new Date(expenseDate),
      note,
      vendor,
      isTaxDeductible: isTaxDeductible === 'on' ? true : false, // Checkbox handling
    };
    user.expenses.push(newExpense);

    await user.save();
    res.redirect("/expenses");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

// POST /api/liabilities (Updated for tax deductibility)
const addLiabilities = async (req, res) => {
  const userId = req.userId;
  try {
    const {
      liabilitiesType,
      bank,
      outstandingAmount,
      emi,
      intrestRate,
      dueDate,
      isTaxDeductible
    } = req.body;

    if (
      !liabilitiesType ||
      !bank ||
      !outstandingAmount ||
      !emi ||
      !intrestRate ||
      !dueDate
    ) {
      return res.redirect("/liabilities");
    }

    const user = await User.findById(userId);
    const newLiabilities = {
      liabilitiesType,
      bank,
      outstandingAmount: parseFloat(outstandingAmount),
      emi: parseFloat(emi),
      intrestRate: parseFloat(intrestRate),
      dueDate: new Date(dueDate),
      isTaxDeductible: isTaxDeductible === 'on' ? true : false, // Checkbox handling
    };
    user.liabilities.push(newLiabilities);

    await user.save();
    res.redirect("/liabilities");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};


// === New Utility Functions for Calculations ===

const calculateNetWorth = (user) => {
  let totalAssets = 0;
  let totalLiabilities = 0;

  // Assets: Accounts + Investments
  for (const account of user.accounts) {
    totalAssets += account.currentBalance;
  }
  for (const investment of user.investments) {
    totalAssets += investment.amount;
  }

  // Liabilities: Loans/Debts
  for (const liability of user.liabilities) {
    totalLiabilities += liability.outstandingAmount;
  }

  return totalAssets - totalLiabilities;
};

// Function to Calculate Financial Health Score (FHS)
const calculateFHS = (user, totalInvested, totalLiabilities) => {
  const annualIncome = user.annualIncome || 1;
  const totalEMI = user.liabilities.reduce((sum, l) => sum + l.emi, 0);
  const totalExpenses = user.expenses.reduce((sum, e) => sum + e.expenseAmount, 0);

  // 1. Debt-to-Income Ratio (40% Weight)
  const monthlyIncome = annualIncome / 12;
  const dtiRatio = monthlyIncome > 0 ? (totalEMI / monthlyIncome) : 1;
  const dtiScore = Math.max(0, 100 - (dtiRatio * 100));

  // 2. Savings Rate (30% Weight)
  const netCashFlow = totalInvested - totalExpenses;
  const savingsRate = annualIncome > 0 ? (netCashFlow / annualIncome) : 0;
  const savingsScore = Math.min(100, Math.max(0, savingsRate * 300));

  // 3. Investment Diversification (30% Weight)
  const uniqueTypes = new Set(user.investments.map(i => i.investmentType)).size;
  const diversificationScore = Math.min(100, (uniqueTypes / 5) * 100);

  const fhsScore = (dtiScore * 0.4) + (savingsScore * 0.3) + (diversificationScore * 0.3);

  // Structure breakdown for the view
  const breakdown = {
    dti: {
      score: Math.round(dtiScore * 0.4),
      detail: `DTI Ratio: ${(dtiRatio * 100).toFixed(1)}%`
    },
    savings: {
      score: Math.round(savingsScore * 0.3),
      detail: `Net Savings Rate: ${(savingsRate * 100).toFixed(1)}%`
    },
    diversification: {
      score: Math.round(diversificationScore * 0.3),
      detail: `Unique Investments: ${uniqueTypes}/5`
    }
  };

  return { score: Math.min(100, Math.round(fhsScore)), breakdown };
};


// === Dashboard Render (Updated) ===

const renderDashboard = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).populate("accounts").exec();

    let totalBalance = user.accounts.reduce((sum, a) => sum + a.currentBalance, 0);
    let totalInvested = user.investments.reduce((sum, i) => sum + i.amount, 0);
    let totalLiabilities = user.liabilities.reduce((sum, l) => sum + l.outstandingAmount, 0);


    // --- NET WORTH LOGIC ---
    const netWorth = calculateNetWorth(user);
    const lastEntry = user.netWorthHistory[user.netWorthHistory.length - 1];
    const today = new Date().toISOString().slice(0, 10);

    if (!lastEntry || new Date(lastEntry.date).toISOString().slice(0, 10) !== today) {
      user.netWorthHistory.push({ date: new Date(), netWorth });
      await user.save();
    }
    const netWorthHistoryData = user.netWorthHistory.map(h => ({ date: h.date, netWorth: h.netWorth }));


    // --- FINANCIAL HEALTH SCORE LOGIC ---
    const { score: newFHS, breakdown } = calculateFHS(user, totalInvested, totalLiabilities);
    if (user.financeHealthScore !== newFHS) {
      user.financeHealthScore = newFHS;
      await user.save();
    }

    if (user) {
      return res.render("dashboard", {
        user,
        totalBalance,
        totalInvested,
        totalLiabilities,
        netWorth,
        netWorthHistoryData,
        fhsBreakdown: breakdown
      });
    }
    return res.render("login", { errMsg: "Account not found!" });
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};


// ... (renderFamily, addFamily, joinFamily, addFamilyGoal, deleteFamilyGoal are mostly unchanged)


// === Expense Render (Updated for Budget Deviation) ===
const renderExpenses = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).populate({
      path: "familyId",
      populate: { path: "members" },
    });
    let totalPersonalExpense = 0;
    const expenseTypeMap = {};
    const monthlyExpenditure = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // --- BUDGET DEVIATION LOGIC SETUP ---
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const lastMonthExpenses = {};
    const currentMonthExpenses = {};
    const deviationAlerts = {};

    for (let i = 0; i < user.expenses.length; i++) {
      const expense = user.expenses[i];
      const date = new Date(expense.expenseDate);
      const month = date.getMonth();
      const year = date.getFullYear();
      const category = expense.category;

      totalPersonalExpense += expense.expenseAmount;
      monthlyExpenditure[month] += expense.expenseAmount;

      if (expenseTypeMap[expense.expenseType]) {
        expenseTypeMap[expense.expenseType] += expense.expenseAmount;
      } else {
        expenseTypeMap[expense.expenseType] = expense.expenseAmount;
      }

      // Track spending for soft budget calculation
      if (year === currentYear) {
        if (month === (currentMonth === 0 ? 11 : currentMonth - 1)) {
          lastMonthExpenses[category] = (lastMonthExpenses[category] || 0) + expense.expenseAmount;
        }
        else if (month === currentMonth) {
          currentMonthExpenses[category] = (currentMonthExpenses[category] || 0) + expense.expenseAmount;
        }
      }
    }

    // Calculate Deviation Alerts (80% of last month's spending)
    for (const category in currentMonthExpenses) {
      const lastMonthBudget = lastMonthExpenses[category] || 100;
      const spendingThreshold = lastMonthBudget * 0.8;

      if (currentMonthExpenses[category] > spendingThreshold) {
        deviationAlerts[category] = {
          current: currentMonthExpenses[category],
          threshold: spendingThreshold.toFixed(0),
          over: currentMonthExpenses[category] > lastMonthBudget
        };
      }
    }
    // --- END BUDGET DEVIATION LOGIC ---

    const expenseLabelArr = [];
    const expenseLabelAmountArr = [];
    for (const label in expenseTypeMap) {
      expenseLabelArr.push(label);
      expenseLabelAmountArr.push(expenseTypeMap[label]);
    }

    let totalFamilyExpense = 0;
    if (user.familyId) {
      for (let i = 0; i < user.familyId.members.length; i++) {
        for (let j = 0; j < user.familyId.members[i].expenses.length; j++) {
          totalFamilyExpense +=
            user.familyId.members[i].expenses[j].expenseAmount;
        }
      }
    } else {
      totalFamilyExpense = totalPersonalExpense;
    }

    return res.render("expenses", {
      user,
      totalPersonalExpense,
      totalFamilyExpense,
      expenseLabelArr,
      expenseLabelAmountArr,
      monthlyExpenditure,
      deviationAlerts // Passed to view
    });
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};


// === Liabilities Render (Updated) ===

const renderLiabilities = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).populate({
      path: "familyId",
      populate: { path: "members" },
    });
    let totalPersonalLiabilities = 0;
    let totalTaxDeductibleLiabilities = 0;
    const liabilitiesTypeMap = {};
    const monthlyLiabilities = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < user.liabilities.length; i++) {
      totalPersonalLiabilities += user.liabilities[i].outstandingAmount;

      if (user.liabilities[i].isTaxDeductible) {
        totalTaxDeductibleLiabilities += user.liabilities[i].outstandingAmount;
      }

      if (new Date(user.liabilities[i].dueDate) < new Date()) {
        user.liabilities[i].status = "Paid";
      } else {
        user.liabilities[i].status = "Pending";
      }
      monthlyLiabilities[new Date(user.liabilities[i].dueDate).getMonth()] +=
        user.liabilities[i].outstandingAmount;
      if (liabilitiesTypeMap[user.liabilities[i].liabilitiesType]) {
        liabilitiesTypeMap[user.liabilities[i].liabilitiesType] +=
          user.liabilities[i].outstandingAmount;
      } else {
        liabilitiesTypeMap[user.liabilities[i].liabilitiesType] =
          user.liabilities[i].outstandingAmount;
      }
    }

    const liabilitiesLabelArr = [];
    const liabilitiesLabelAmountArr = [];
    for (const label in liabilitiesTypeMap) {
      liabilitiesLabelArr.push(label);
      liabilitiesLabelAmountArr.push(liabilitiesTypeMap[label]);
    }

    let totalFamilyliabilities = 0;
    if (user.familyId) {
      for (let i = 0; i < user.familyId.members.length; i++) {
        for (let j = 0; j < user.familyId.members[i].liabilities.length; j++) {
          totalFamilyliabilities +=
            user.familyId.members[i].liabilities[j].outstandingAmount;
        }
      }
    } else {
      totalFamilyliabilities = totalPersonalLiabilities;
    }

    return res.render("liabilities", {
      user,
      totalPersonalLiabilities,
      totalFamilyliabilities,
      liabilitiesLabelArr,
      liabilitiesLabelAmountArr,
      monthlyLiabilities,
      totalTaxDeductibleLiabilities // Passed to view
    });
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};


// === NEW: Risk Profile Update Route ===
const updateRiskProfile = async (req, res) => {
  const userId = req.userId;
  const { riskProfile } = req.body;

  try {
    await User.findByIdAndUpdate(userId, { riskProfile });
    res.status(200).json({ success: true, message: "Risk profile updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update risk profile." });
  }
};


// === NEW: Tax Summary Calculation Route (API Only) ===
const getTaxSummary = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId);

    const totalDeductibleExpenses = user.expenses
      .filter(e => e.isTaxDeductible)
      .reduce((sum, e) => sum + e.expenseAmount, 0);

    const totalDeductibleLiabilities = user.liabilities
      .filter(l => l.isTaxDeductible)
      .reduce((sum, l) => sum + l.emi, 0);

    const totalDeductions = totalDeductibleExpenses + totalDeductibleLiabilities;

    const projectedTaxSaving = totalDeductions * 0.15; // Assuming 15% bracket for projection

    res.json({
      totalDeductions: totalDeductions.toFixed(2),
      projectedTaxSaving: projectedTaxSaving.toFixed(2),
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to generate tax summary." });
  }
};


// === NEW: Helper for Financial Health Score Breakdown (API only) ===
const getFHSBreakdown = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).populate("accounts").exec();

    let totalInvested = user.investments.reduce((sum, i) => sum + i.amount, 0);
    let totalLiabilities = user.liabilities.reduce((sum, l) => sum + l.outstandingAmount, 0);

    const { breakdown } = calculateFHS(user, totalInvested, totalLiabilities);

    res.json(breakdown);

  } catch (error) {
    res.status(500).json({ error: "Failed to generate FHS breakdown." });
  }
};


const renderInvestment = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).populate("accounts").exec();
    let totalInvested = 0;
    let nextMaturity = null;
    for (let i = 0; i < user.investments.length; i++) {
      if (new Date(user.investments[i].maturityDate) < new Date()) {
        user.investments[i].status = "Matured";
      } else {
        user.investments[i].status = "Active";
      }
    }
    user.investments.sort((a, b) => {
      if (a.status === "Matured" && b.status === "Active") {
        return 1;
      }
      if (a.status === "Active" && b.status === "Matured") {
        return -1;
      }
      return 0;
    });
    const monthWiseInvestment = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < user.investments.length; i++) {
      totalInvested += user.investments[i].amount;
      monthWiseInvestment[user.investments[i].investedDate.getMonth()] +=
        user.investments[i].amount;
      if (user.investments[i].status === "Active") {
        if (nextMaturity) {
          if (nextMaturity > new Date(user.investments[i].maturityDate)) {
            nextMaturity = new Date(user.investments[i].maturityDate);
          }
        } else {
          nextMaturity = new Date(user.investments[i].maturityDate);
        }
      }
    }

    const totalReturns = totalInvested * 0.2 + totalInvested;
    if (user) {
      return res.render("investment", {
        user,
        totalInvested,
        totalReturns,
        nextMaturity,
        monthWiseInvestment,
      });
    }
    return res.render("login", { errMsg: "Account not found!" });
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const renderGoals = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).populate("accounts").exec();
    for (let i = 0; i < user.goals.length; i++) {
      let currentAmount = 0;
      for (let j = 0; j < user.investments.length; j++) {
        if (user.goals[i].goalType === user.investments[j].investmentType) {
          currentAmount += user.investments[j].amount;
        }
      }
      user.goals[i].currentAmount =
        currentAmount < user.goals[i].targetAmount
          ? currentAmount
          : user.goals[i].targetAmount;
      user.goals[i].completedPercent =
        100 * (user.goals[i].currentAmount / user.goals[i].targetAmount);
    }
    if (user) {
      return res.render("goals", { user });
    }
    return res.render("login", { errMsg: "Account not found!" });
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const renderLearnings = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).populate("accounts").exec();
    if (user) {
      return res.render("learnings", { user });
    }
    return res.render("login", { errMsg: "Account not found!" });
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const deleteGoal = async (req, res) => {
  const userId = req.userId;
  const goalType = req.params.goalType;
  try {
    const user = await User.findById(userId);
    const goalIndex = user.goals.findIndex(
      (goal) => goal.goalType === goalType
    );
    if (goalIndex === -1) {
      return res.redirect("/goals");
    }
    user.goals.splice(goalIndex, 1);
    await user.save();
    res.redirect("/goals");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};
const renderLogin = async (req, res) => {
  res.render("login", { errMsg: null });
};
const renderRegister = async (req, res) => {
  res.render("register", { errMsg: null });
};
const renderChat = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId);
    if (user) {
      return res.render("chat_updated", { user });
    }
    return res.render("login", { errMsg: "Account not found!" });
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const renderFamily = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId)
      .populate(["accounts", "familyId"])
      .exec();
    if (user) {
      let family = undefined;
      if (user.familyId) {
        family = await Family.findById(user.familyId)
          .populate({
            path: "members",
            populate: {
              path: "accounts",
              model: "Account",
            },
          })
          .exec();
        for (let i = 0; i < family.goals.length; i++) {
          let currentAmount = 0;
          for (let j = 0; j < family.members.length; j++) {
            for (let k = 0; k < family.members[j].investments.length; k++) {
              if (
                family.goals[i].goalType ===
                family.members[j].investments[k].investmentType
              ) {
                currentAmount += family.members[j].investments[k].amount;
              }
            }
          }
          currentAmount =
            currentAmount > family.goals[i].targetAmount
              ? family.goals[i].targetAmount
              : currentAmount;
          family.goals[i].currentAmount = currentAmount;
          family.goals[i].completedPercent = (
            (currentAmount / family.goals[i].targetAmount) *
            100
          ).toFixed(2);
        }
      }
      return res.render("family", { user, family });
    }
    return res.render("login", { errMsg: "Account not found!" });
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const addFamily = async (req, res) => {
  const userId = req.userId;
  try {
    const { name } = req.body;
    if (!name) {
      return res.redirect("/family");
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.render("login", { errMsg: "User not found" });
    }
    if (user.familyId) {
      return res.render("login", {
        errMsg: "You already are part of a family",
      });
    }
    const newFamily = new Family({
      name,
      members: [userId],
    });
    const savedFamily = await newFamily.save();
    user.familyId = savedFamily._id;
    await user.save();
    res.redirect("/family");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const renderMyProfile = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.render('login', { errMsg: 'Please login' });

    const user = await User.findById(userId).populate('accounts').exec();
    if (!user) return res.render('login', { errMsg: 'Account not found!' });

    return res.render('myprofile', { user });
  } catch (err) {
    console.error('renderMyProfile error:', err);
    return res.render('login', { errMsg: err.message });
  }
};

const joinFamily = async (req, res) => {
  const userId = req.userId;
  const { familyId } = req.body;
  console.log(familyId);
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.render("login", { errMsg: "User not found" });
    }
    if (user.familyId) {
      return res.render("login", {
        errMsg: "User is already part of a family",
      });
    }
    const family = await Family.findById(familyId);
    if (!family) {
      return res.render("login", { errMsg: "Family not found" });
    }
    const isAlreadyMember = family.members.some((memberId) =>
      memberId.equals(userId)
    );
    if (isAlreadyMember) {
      return res.redirect("/family");
    }
    family.members.push(userId);
    await family.save();
    user.familyId = family._id;
    await user.save();
    res.redirect("/family");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const addFamilyGoal = async (req, res) => {
  const userId = req.userId;
  const { name, goalType, targetAmount, dueDate } = req.body;
  const { familyId } = req.params;
  try {
    if (!name || !goalType || !targetAmount || !dueDate) {
      return res.redirect("/family");
    }
    const family = await Family.findById(familyId);
    if (!family) {
      return res.render("login", { errMsg: "Family not found" });
    }
    const isMember = family.members.some((memberId) => memberId.equals(userId));
    if (!isMember) {
      return res.render("login", {
        errMsg: "You must be a member of the family to add a goal",
      });
    }
    const newGoal = {
      name,
      goalType,
      targetAmount,
      dueDate: new Date(dueDate),
    };
    family.goals.push(newGoal);
    await family.save();
    res.redirect("/family");
  } catch (err) {
    console.log(err);
    res.render("login", { errMsg: err.message });
  }
};

const deleteFamilyGoal = async (req, res) => {
  const userId = req.userId;
  const { familyId, goalId } = req.params;
  try {
    const family = await Family.findById(familyId);
    if (!family) {
      return res.redirect("/family");
    }
    const isMember = family.members.some(
      (member) => member.toString() === userId
    );
    if (!isMember) {
      return res.render("login", {
        errMsg: "You are not a member of this family",
      });
    }
    const goalIndex = family.goals.findIndex(
      (goal) => goal._id.toString() === goalId
    );
    if (goalIndex === -1) {
      return res.redirect("/family");
    }
    family.goals.splice(goalIndex, 1);
    await family.save();
    return res.redirect("/family");
  } catch (err) {
    console.log(err);
    return res.render("login", { errMsg: err.message });
  }
};


// ::::::::::::::::::::::;;;;
// Chat bot start;;;;;;;;::::::::::::
const { ChatGroq } = require("@langchain/groq");
const { Pinecone } = require("@pinecone-database/pinecone");
require("dotenv").config();
// Initialize Pinecone
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = "ai-agents";
const index = pc.index(indexName);
// Initialize ChatGroq
const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0,
  maxTokens: undefined,
  maxRetries: 2,
});
// Function to get embeddings from a prompt
async function getEmbeddings(prompt) {
  const model = "multilingual-e5-large";
  const embeddings = await pc.inference.embed(model, [prompt], {
    inputType: "query",
  });
  return embeddings[0].values;
}

// Function to query the Pinecone index
async function queryPinecone(embedding) {
  const queryResponse = await index.namespace("main-citi-site").query({
    topK: 3,
    vector: embedding,
    includeValues: false,
    includeMetadata: true,
  });
  return queryResponse.matches;
}

// Function to invoke the ChatGroq API with LLM
async function invokeChatGroq(messages) {
  const aiMsg = await llm.invoke(messages);
  return aiMsg;
}

// Chatbot class to manage conversation state
class FinancialChatbot {
  constructor() {
    this.turnLimit = 5;
  }

  // Add message to the conversation (Helper for formatting, not storage)
  formatHistory(chatHistory) {
    return chatHistory.slice(-this.turnLimit).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // Main function to handle user query
  async handleUserQuery(userData, userPrompt, chatHistory) {
    const embedding = await getEmbeddings(userPrompt);
    const references = await queryPinecone(embedding);
    const referenceContent = references.map((ref) => ref.metadata).join("\n");

    // === CONSOLIDATED ASSERTIVE SYSTEM CONTENT (Multilingual) ===
    const systemPersona = "You are a personal financial advisor. Your primary directive is to provide accurate, actionable, and personalized financial advice in a concise, simple manner. STRICT REQUIREMENT: Detect the user's input language and respond ONLY in that exact language. If a user's query lacks specific data necessary for personalization (e.g., interest rates, due dates, specific investment type, or comparison timeframe), YOU MUST ASK a single, direct follow-up question to gather that missing context. Only proceed with the financial advice once essential personalized data is available. Do not use conversational fillers or jargon.";

    const formattedHistory = this.formatHistory(chatHistory);

    const messages = [
      {
        role: "system",
        content: `
                ${systemPersona}
                ---
                YOUR FINANCIAL DATA (JSON): ${JSON.stringify(userData)}
                ---
                REFERENCES: ${referenceContent}
            `,
      },
      ...formattedHistory,
      { role: "user", content: userPrompt },
    ];
    // ===================================

    const llmResponse = await invokeChatGroq(messages);
    const ans = llmResponse.content;

    return {
      response: ans,
      references: references.map((ref) => ref.metadata),
    };
  }
}

const chatbot = new FinancialChatbot();

const getResponse = async (req, res) => {
  const userId = req.userId;
  const { userPrompt } = req.body;

  try {
    const user = await User.findById(userId)
      .populate([
        { path: "accounts" },
        {
          path: "familyId",
          populate: { path: "members" },
        },
      ])
      .exec();

    const response = await chatbot.handleUserQuery(
      user,
      userPrompt,
      user.chatHistory
    );
    console.log("Bot Response:", response["response"]);

    // Save chat history
    user.chatHistory.push({ role: 'user', content: userPrompt });
    user.chatHistory.push({ role: 'assistant', content: response["response"] });
    await user.save();

    res.json({ botResponse: response["response"] });
  } catch (error) {
    console.log("Error handling user query:", error);
    res.json({ err: error.message });
  }
};

// ::::::::::::::::::::::;;;;
// Chat bot End;;;;;;;;::::::::::::
const deleteAccount = async (req, res) => {
  const userId = req.userId;
  try {
    // Find and delete the user
    // Note: If there are other collections referencing the user (like Accounts, Family), 
    // you might want to delete those as well or rely on cascading deletes if configured.
    // For now, we focus on deleting the User document as requested.

    await User.findByIdAndDelete(userId);

    // Clear the cookie
    res.clearCookie("token");

    // Redirect to home page
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error deleting account");
  }
};

const renderAdminLogin = (req, res) => {
  res.render("admin_login", { errMsg: null });
};

const handleAdminLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.login(email, password);
    if (user && user.role === 'admin') {
      const token = createUserToken(user._id);
      res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });
      res.redirect("/admin/dashboard");
    } else {
      res.render("admin_login", { errMsg: "Invalid admin credentials" });
    }
  } catch (err) {
    console.log(err);
    res.render("admin_login", { errMsg: "Login failed" });
  }
};

const renderAdminDashboard = async (req, res) => {
  try {
    const users = await User.find();
    res.render("admin_dashboard", { users });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading admin dashboard");
  }
};

module.exports = {
  renderDashboard,
  getResponse,
  renderInvestment,
  renderFamily,
  addFamily,
  joinFamily,
  addFamilyGoal,
  deleteFamilyGoal,
  renderGoals,
  renderLearnings,
  renderLogin,
  renderRegister,
  register,
  login,
  addAccount,
  addInvestment,
  deleteAccount,
  renderAdminLogin,
  handleAdminLogin,
  renderAdminDashboard,
  addGoal,
  addExpense,
  deleteGoal,
  logout,
  renderChat,
  renderExpenses,
  renderLiabilities,
  addLiabilities,
  // === NEW ROUTES ===
  updateRiskProfile,
  getTaxSummary,
  getFHSBreakdown,
  // === END NEW ROUTES ===
  renderMyProfile,
};