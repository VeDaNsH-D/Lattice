export const PERMISSIONS = [
    "full_access",
    "restricted_access",
    "view_only"
];

export const hasPermission = (rolePermission, requiredPermission) => {
    if (!rolePermission || !requiredPermission) {
        return false;
    }

    if (rolePermission === "full_access") {
        return true;
    }

    if (rolePermission === "restricted_access") {
        return requiredPermission !== "full_access";
    }

    if (rolePermission === "view_only") {
        return requiredPermission === "view_only";
    }

    return false;
};
