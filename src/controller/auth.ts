import { Request,Response } from "express"

export const SignIn = async (req:Request,res:Response) => {
    try{

        const {email,password} = req.body;

    }catch(error){
        console.log("Error in Auth Controller SignIn ",error);
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}