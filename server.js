import express from 'express';
import dotenv from 'dotenv';
import connectDB from './db/config.js';


import { errorHandler } from './middleware/errorMiddleware.js';
dotenv.config();




const port = process.env.PORT || 5000;
connectDB();    // Connect to MongoDB
// Create Express app
const app = express();  
// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(errorHandler);



// Routes
import userRoutes from './routes/userRoutes.js';
// import productRoutes from './routes/productRoutes.js';
// import categoryRoutes from './routes/categoryRoutes.js';
// import cartRoutes from './routes/cartRoutes.js';
// import orderRoutes from './routes/orderRoutes.js';
// import reviewRoutes from './routes/reviewRoutes.js';


app.listen(port, () => console.log(`Server started on port ${port}`));