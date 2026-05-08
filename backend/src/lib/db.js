import mongoose from "mongoose"

export const connectDB = async () => {
  try{
    const conn = await mongoose.connect(process.env.MONGO_URI)
    console.log("MONGODB CONNECTED:", conn.connection.host)
  }catch (error) {
    console.log("Error connecting to MONGODB:",error)
    process.exit(1);// 1 status code meansfail,0 means sucess
  }
}