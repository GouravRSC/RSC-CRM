import { z } from 'zod';


export const nameSchema = z
    .string()
    .min(4, { message: "Name Must Be At Least 4 Characters Long" })
    .max(100, { message: "Name Must Be At Most 100 Characters Long" })
    .regex(/^[a-zA-Z\s]+$/, { message: "Name Must Contain Only Letters And Spaces" })
    .refine((val) => !/<[^>]*>/.test(val), {
        message: "HTML Tags Are Not Allowed In Name",
    })
    .optional();


export const emailSchema = z
    .string()
    .min(6, { message: "Email Must Be At Least 6 Characters Long" })
    .max(100, { message: "Email Must Be At Most 6 Characters Long" })
    .email({ message: "Invalid Email Format" })
    .refine((val) => !/<[^>]*>/.test(val), {
        message: "HTML Tags Are Not Allowed In Email",
    })
    .refine( (val) => /^[a-zA-Z0-9._@+-]+$/.test(val),
        {
            message: "Email Contains Invalid Characters",
        }
    )
    .refine((val) => !val.includes("..") && !val.includes(" "), {
        message: "Email Cannot Contain Spaces Or Double Dots",
    })
    .optional();

export const passwordSchema = z
    .string()
    .min(8, { message: "Password Must Be At Least 8 Characters Long" })
    .max(30, { message: "Password Must Be At Most 30 Characters Long" })
    .regex(/[a-z]/, { message: "Password Must Contain At Least One Lowercase Letter" })
    .regex(/[A-Z]/, { message: "Password Must Contain At Least One Uppercase Letter" })
    .regex(/[0-9]/, { message: "Password Must Contain At Least One Number" })
    .regex(/[@$&]/, {
        message: "Password Must Contain At Least One Special Character (@, $, &)",
    })
    .refine((val) => !/<[^>]*>/.test(val), {
        message: "HTML Tags Are Not Allowed In Password",
    })
    .optional();



export const phoneNumberSchema = z
    .string()
    .regex(/^\d{10}$/, {
        message: "Phone Number Must Be Exactly 10 Digits Long And Contain Only Numbers",
    })
    .refine((val) => !/<[^>]*>/.test(val), {
        message: "HTML Tags Are Not Allowed In Phone Number",
    })
    .optional();    
    

export const userSchema = z.object({
    name : nameSchema,
    email : emailSchema,
    password : passwordSchema,
    phoneNumber : phoneNumberSchema
})


export const updateUserSchema = z.object({
    name : nameSchema,
    email : emailSchema,
    password : passwordSchema,
    phoneNumber : phoneNumberSchema
})
