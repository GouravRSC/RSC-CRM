import { z } from 'zod';

export const roleSchema  = z
    .string()
    .min(2,{ message: "Role Name Must Be At Least 2 Characters Long" })
    .max(30,{ message: "Role Name Must Be At Max 30 Characters Long" })
    .regex(/^[a-zA-Z\s]+$/, { message: "Role Name Must Contain Only Letters And Spaces" })
    .refine((val) => !/<[^>]*>/.test(val), {
        message: "HTML Tags Are Not Allowed",
    })

    