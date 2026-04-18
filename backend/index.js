require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const os = require("os");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

/* MongoDB connection */
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Mongo connected");
    })
    .catch((err) => {
        console.error("Mongo connection error:", err);
    });

/* Root route */
app.get("/", (req, res) => {
    res.send("Backend is running 🚀");
});

/* Start server */
app.listen(PORT, () => {

    const networkInterfaces = os.networkInterfaces();
    let networkIP = "localhost";

    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === "IPv4" && !net.internal) {
                networkIP = net.address;
            }
        }
    }

    console.log("🚀 Backend running on:");
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${networkIP}:${PORT}`);
});