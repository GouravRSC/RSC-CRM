import { z } from 'zod';


export const nameSchema = z
    .string({ required_error: "Name is required" })
    .min(3, { message: "Name Must Be At Least 4 Characters Long" })
    .max(100, { message: "Name Must Be At Most 100 Characters Long" })
    .regex(/^[a-zA-Z\s]+$/, { message: "Name Must Contain Only Letters And Spaces" })
    .refine((val) => !/<[^>]*>/.test(val), {
        message: "HTML Tags Are Not Allowed In Name",
    })


export const emailSchema = z
    .string({ required_error: "Email is required" })
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

export const passwordSchema = z
    .string({ required_error: "Password is required" })
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



export const phoneNumberSchema = z
    .string()
    .regex(/^\d{10}$/, {
        message: "Phone Number Must Be Exactly 10 Digits Long And Contain Only Numbers",
    })
    .refine((val) => !/<[^>]*>/.test(val), {
        message: "HTML Tags Are Not Allowed In Phone Number",
    })
    .optional();    


// ✅ New: Register Date Schema (ISO format recommended)
export const registerDateSchema = z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid Register Date Format. Must Be a Valid ISO Date String",
    })
    .optional();

// ✅ New: Date of Birth Schema (Should be past date)
export const dateOfBirthSchema = z
    .string()
    .refine((val) => {
        const date = new Date(val);
        return !isNaN(date.getTime()) && date < new Date();
    }, {
        message: "Invalid Date of Birth. It Must Be a Valid Past Date",
    })
    .optional();    
    

export const userSchema = z.object({
    name : nameSchema,
    email : emailSchema,
    password : passwordSchema,
    phoneNumber : phoneNumberSchema,
    registerDate: registerDateSchema,
    dateOfBirth: dateOfBirthSchema,
})


export const updateUserSchema = z.object({
    name : nameSchema.optional(),
    email : emailSchema.optional(),
    password : passwordSchema.optional(),
    phoneNumber : phoneNumberSchema,
    registerDate: registerDateSchema,
    dateOfBirth: dateOfBirthSchema,
})
