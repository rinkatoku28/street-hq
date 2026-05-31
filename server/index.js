require('dotenv').config(); // Load environment variables at the very top
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.post('/create-bill', async (req, res) => {
    try {
        const { amount, email, name, phone } = req.body;

        // Build the ToyyibPay payload
        const formData = new URLSearchParams();
        
        // FIX: Match these variable names to your .env file
        formData.append('userSecretKey', process.env.TOYYIB_SECRET_KEY);
        formData.append('categoryCode', process.env.TOYYIB_CATEGORY_CODE);
        
        formData.append('billName', 'Street Purchase');
        formData.append('billDescription', 'Order Payment');
        formData.append('billPriceSetting', '1');
        formData.append('billPayorInfo', '1');
        formData.append('billAmount', Math.round(amount * 100)); // Converts RM to cents
        formData.append('billReturnUrl', 'http://localhost:5173/success');
        formData.append('billCallbackUrl', 'http://localhost:5173/callback');
        formData.append('billExternalReferenceNo', `ORDER-${Date.now()}`);
        formData.append('billTo', name);
        formData.append('billEmail', email);
        formData.append('billPhone', phone);

        // Sending request to Sandbox (dev) environment
        const response = await axios.post('https://dev.toyyibpay.com/index.php/api/createBill', formData);

        // toyyibPay returns an array; check if the first element has the BillCode
        if (response.data && response.data[0] && response.data[0].BillCode) {
            const billCode = response.data[0].BillCode;
            const paymentUrl = `https://dev.toyyibpay.com/${billCode}`;
            return res.json({ url: paymentUrl });
        } else {
            // This will now show the detailed error if the key is still "Inactive"
            return res.status(400).json({ error: 'Failed to create bill', details: response.data });
        }
    } catch (error) {
        console.error('Payment initialization failed:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});