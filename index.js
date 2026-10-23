const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.get('/', (req, res) => {
	res.json({ message: 'Server is running' });
});

app.get('/health', (req, res) => {
	res.json({ status: 'ok' });
});

app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
