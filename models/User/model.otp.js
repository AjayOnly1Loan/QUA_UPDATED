import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
    aadhar:{
        type : String,
    },
    mobile:{type:String,required:true},
    otp: { type: String},
    
},
{
    timestamps: true,
});


const OTP = mongoose.model('UserOTP', otpSchema);

export default OTP;

