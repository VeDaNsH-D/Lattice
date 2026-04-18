const GOOGLE_CALENDAR_BASE_URL = "https://calendar.google.com/calendar/render?action=TEMPLATE";

const formatGoogleDate = (date) =>
    date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");

const normalizeDate = (value) => {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === "string" || typeof value === "number") {
        return new Date(value);
    }

    return null;
};

export const generateGoogleCalendarLink = ({ title, description, deadline }) => {
    const startDate = normalizeDate(deadline);

    if (!startDate || Number.isNaN(startDate.getTime())) {
        return null;
    }

    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const eventTitle = typeof title === "string" && title.trim() ? title.trim() : "Reminder";
    const eventDescription = typeof description === "string" ? description.trim() : "";

    const start = formatGoogleDate(startDate);
    const end = formatGoogleDate(endDate);

    const params = new URLSearchParams({
        text: eventTitle,
        dates: `${start}/${end}`,
        details: eventDescription
    });

    return `${GOOGLE_CALENDAR_BASE_URL}&${params.toString()}`;
};

export default generateGoogleCalendarLink;
