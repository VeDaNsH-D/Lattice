import jwt from "jsonwebtoken";

const readBearerToken = (authHeader) => {
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        return "";
    }

    return authHeader.split(" ")[1] || "";
};

export const authMiddleware = (req, res, next) => {
    try {
        const token = readBearerToken(req.headers.authorization);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: token missing"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = { userId: decoded.userId };
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: invalid token"
        });
    }
};

export const optionalAuthMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = readBearerToken(authHeader);

        if (!authHeader || !token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { userId: decoded.userId };
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: invalid token"
        });
    }
};
