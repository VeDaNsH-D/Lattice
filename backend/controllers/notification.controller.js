import mongoose from "mongoose";
import Notification from "../models/notification.js";

const NOTIFICATION_LIMIT = 20;

export const listNotifications = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const notifications = await Notification.find({ userId })
            .select("message link type isRead createdAt")
            .sort({ createdAt: -1 })
            .limit(NOTIFICATION_LIMIT);

        return res.status(200).json({
            success: true,
            notifications
        });
    } catch (error) {
        return next(error);
    }
};

export const markNotificationAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid notification id is required"
            });
        }

        const updatedNotification = await Notification.findOneAndUpdate(
            { _id: id, userId },
            { $set: { isRead: true } },
            { new: true, runValidators: true }
        ).select("message link type isRead createdAt");

        if (!updatedNotification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        return res.status(200).json({
            success: true,
            notification: updatedNotification
        });
    } catch (error) {
        return next(error);
    }
};
