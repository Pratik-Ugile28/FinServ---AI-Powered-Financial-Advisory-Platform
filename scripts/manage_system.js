const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Account = require('../models/Account');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbURI = process.env.MONGODB_CONNECTION_URI;

const connectDB = async () => {
    try {
        await mongoose.connect(dbURI);
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

const importUsers = async () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'user_data.csv'), 'utf-8');
        const lines = data.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(',');
            const userObj = {};

            headers.forEach((header, index) => {
                userObj[header] = values[index] ? values[index].trim() : null;
            });

            if (!userObj.email || !userObj.password) {
                console.log(`Skipping row ${i + 1}: Missing email or password`);
                continue;
            }

            const existingUser = await User.findOne({ email: userObj.email });
            if (existingUser) {
                console.log(`User ${userObj.email} already exists. Skipping.`);
                continue;
            }

            const hashedPassword = await bcrypt.hash(userObj.password, 10);
            userObj.password = hashedPassword;
            userObj.financeHealthScore = 50;
            userObj.riskProfile = 'Moderate';
            userObj.expenseCategories = ["Fixed", "Variable"];
            userObj.dob = new Date(userObj.dob);

            const newUser = new User(userObj);
            await newUser.save();
            console.log(`Imported user: ${userObj.name}`);
        }
        console.log('Import completed.');
    } catch (error) {
        console.error('Error importing data:', error);
    }
};

const verifyImport = async () => {
    try {
        const email = 'john@example.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User ${email} not found!`);
            return;
        }

        console.log('--- User Data in DB ---');
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('Role:', user.role);

        const expected = {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '1234567890',
            occupation: 'Engineer',
            annualIncome: 100000,
            currency: 'USD',
            country: 'USA'
        };

        let allMatch = true;
        if (user.name !== expected.name) { console.log(`MISMATCH: Name (Expected: ${expected.name}, Got: ${user.name})`); allMatch = false; }
        if (user.email !== expected.email) { console.log(`MISMATCH: Email (Expected: ${expected.email}, Got: ${user.email})`); allMatch = false; }

        if (allMatch) console.log('\nSUCCESS: Key fields match CSV data.');
        else console.log('\nWARNING: Some fields do not match.');
    } catch (error) {
        console.error('Error verifying data:', error);
    }
};

const verifyAllData = async () => {
    try {
        const email = 'john@example.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User ${email} not found! Please run import-users first.`);
            return;
        }

        console.log(`--- Verifying Data Persistence for ${user.name} ---`);

        // 1. Add Account
        const accountNumber = 'ACC-' + Math.floor(Math.random() * 1000000);
        const newAccount = new Account({
            userId: user._id,
            bankName: 'Test Bank',
            accountType: 'Savings',
            accountNumber: accountNumber,
            currentBalance: 5000
        });
        await newAccount.save();
        user.accounts.push(newAccount._id);
        console.log(`[+] Added Account: ${accountNumber}`);

        // 2. Add Investment
        const newInvestment = {
            investmentType: 'Stocks',
            amount: 10000,
            maturityDate: new Date('2030-01-01'),
            investedDate: new Date()
        };
        user.investments.push(newInvestment);
        console.log(`[+] Added Investment: ${newInvestment.investmentType}`);

        // 3. Add Expense
        const newExpense = {
            expenseType: 'Groceries',
            expenseAmount: 150,
            vendor: 'SuperMart',
            note: 'Weekly shopping',
            category: 'Variable',
            expenseDate: new Date(),
            isTaxDeductible: false
        };
        user.expenses.push(newExpense);
        console.log(`[+] Added Expense: ${newExpense.expenseType}`);

        // 4. Add Liability
        const newLiability = {
            liabilitiesType: 'Personal Loan',
            bank: 'Test Bank',
            outstandingAmount: 20000,
            emi: 500,
            intrestRate: 10,
            dueDate: new Date('2026-01-01'),
            isTaxDeductible: false
        };
        user.liabilities.push(newLiability);
        console.log(`[+] Added Liability: ${newLiability.liabilitiesType}`);

        // 5. Add Goal
        const newGoal = {
            name: 'Vacation',
            goalType: 'Savings',
            targetAmount: 5000,
            dueDate: new Date('2024-12-31')
        };
        user.goals.push(newGoal);
        console.log(`[+] Added Goal: ${newGoal.name}`);

        await user.save();
        console.log('--- Data Saved to Database ---');

        console.log('\n--- Verifying Persistence ---');
        const updatedUser = await User.findOne({ email }).populate('accounts');

        const savedAccount = updatedUser.accounts.find(acc => acc.accountNumber === accountNumber);
        if (savedAccount) console.log(`[SUCCESS] Account found: ${savedAccount.accountNumber}`);
        else console.log(`[FAILURE] Account NOT found`);

        const savedInvestment = updatedUser.investments.find(inv => inv.investmentType === 'Stocks' && inv.amount === 10000);
        if (savedInvestment) console.log(`[SUCCESS] Investment found: ${savedInvestment.investmentType}`);
        else console.log(`[FAILURE] Investment NOT found`);

        const savedExpense = updatedUser.expenses.find(exp => exp.expenseType === 'Groceries' && exp.vendor === 'SuperMart');
        if (savedExpense) console.log(`[SUCCESS] Expense found: ${savedExpense.expenseType}`);
        else console.log(`[FAILURE] Expense NOT found`);

        const savedLiability = updatedUser.liabilities.find(lia => lia.liabilitiesType === 'Personal Loan' && lia.outstandingAmount === 20000);
        if (savedLiability) console.log(`[SUCCESS] Liability found: ${savedLiability.liabilitiesType}`);
        else console.log(`[FAILURE] Liability NOT found`);

        const savedGoal = updatedUser.goals.find(g => g.name === 'Vacation');
        if (savedGoal) console.log(`[SUCCESS] Goal found: ${savedGoal.name}`);
        else console.log(`[FAILURE] Goal NOT found`);

    } catch (error) {
        console.error('Error verifying data:', error);
    }
};

const makeAdmin = async () => {
    try {
        const email = 'john@example.com';
        const user = await User.findOne({ email });
        if (!user) {
            console.log(`User ${email} not found!`);
            return;
        }
        user.role = 'admin';
        await user.save();
        console.log(`User ${user.name} (${user.email}) is now an ADMIN.`);
    } catch (error) {
        console.error('Error promoting user:', error);
    }
};

const createAdminUser = async () => {
    try {
        const email = 'admin@gmail.com';
        // Use a non-sensitive example password in scripts. Replace with real secret in your local .env/.secrets.
        const plainPassword = 'example_password';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);

        let user = await User.findOne({ email });

        if (user) {
            console.log(`User ${email} found. Updating credentials and role...`);
            user.password = hashedPassword;
            user.role = 'admin';
            await user.save();
            console.log('User updated successfully.');
        } else {
            console.log(`User ${email} not found. Creating new admin user...`);
            user = new User({
                name: 'Admin_User',
                email: email,
                password: hashedPassword,
                role: 'admin',
                phone: '0000000000',
                occupation: 'Administrator',
                annualIncome: 0,
                currency: 'USD',
                country: 'USA',
                dob: new Date(),
                financeHealthScore: 100,
                riskProfile: 'Moderate'
            });
            await user.save();
            console.log('New admin user created successfully.');
        }
    } catch (error) {
        console.error('Error creating/updating admin user:', error);
    }
};

const removeAdmin = async () => {
    try {
        const email = 'john@example.com';
        const user = await User.findOne({ email });
        if (!user) {
            console.log(`User ${email} not found!`);
            return;
        }
        user.role = 'user';
        await user.save();
        console.log(`User ${user.name} (${user.email}) is no longer an ADMIN. Role set to 'user'.`);
    } catch (error) {
        console.error('Error revoking admin privileges:', error);
    }
};

const debugLogin = async () => {
    try {
        const email = 'john@example.com';
        // Use example password for debug. Do NOT hardcode real passwords.
        const password = 'example_password';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User ${email} not found!`);
            return;
        }

        console.log('--- User Details ---');
        console.log('Email:', user.email);
        console.log('Role:', user.role);

        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`Password match: ${isMatch}`);

        if (user.role === 'admin' && isMatch) {
            console.log('SUCCESS: Credentials are correct and user is admin.');
        } else {
            console.log('Login might fail due to role or password mismatch.');
        }
    } catch (error) {
        console.error('Error debugging login:', error);
    }
};

const main = async () => {
    const command = process.argv[2];
    if (!command) {
        console.log('Usage: node scripts/manage_system.js <command>');
        console.log('Commands:');
        console.log('  import-users    - Import users from CSV');
        console.log('  verify-import   - Verify imported user data');
        console.log('  verify-all      - Verify data persistence (goals, accounts, etc.)');
        console.log('  make-admin      - Make john@example.com an admin');
        console.log('  create-admin    - Create/Update admin@gmail.com');
        console.log('  remove-admin    - Remove admin role from john@example.com');
        console.log('  debug-login     - Debug login for john@example.com');
        process.exit(1);
    }

    await connectDB();

    switch (command) {
        case 'import-users': await importUsers(); break;
        case 'verify-import': await verifyImport(); break;
        case 'verify-all': await verifyAllData(); break;
        case 'make-admin': await makeAdmin(); break;
        case 'create-admin': await createAdminUser(); break;
        case 'remove-admin': await removeAdmin(); break;
        case 'debug-login': await debugLogin(); break;
        default:
            console.log('Unknown command:', command);
    }
    process.exit();
};

main();
