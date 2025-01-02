import { app } from "./app.js";
import mongoConnect from "./db/index.js";
import dotenv from "dotenv";

dotenv.config({
    path:'./.env'
})

mongoConnect()
.then(()=>{
    app.listen(process.env.PORT||8000,()=>{
        console.log("server listing on port",process.env.PORT);
    })
})
.catch((error)=>{
    app.on("error",(error)=>{
        console.log("ERR: ",error);
    })
})