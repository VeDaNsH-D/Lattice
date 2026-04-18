export const notFoundHandler = (req, res) => {
    return res.status(404).json({
        success: false,
        message: "Route not found"
    });
};

export const globalErrorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    console.error(error);

    return res.status(500).json({
        success: false,
        message: "Server error"
    });
};
