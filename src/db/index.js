import mongoose from "mongoose";
import { DB_NAME } from "../contants.js";

const mongoConnect=async ()=>{
    try {
        const connectionInstance=await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n mongoDB connected!! DB Host: ${connectionInstance.connection.host}`)
    } catch (error) {
        console.error("mongoDB connected failed!",error);
        process.exit(1)
    }
}

export default mongoConnect;