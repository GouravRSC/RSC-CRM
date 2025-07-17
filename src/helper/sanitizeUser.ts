export const sanitizeUser = (user: any) => {
    const { password, createdAt, updatedAt, ...safeUser } = user;
    return safeUser;
}