import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from 'jsonwebtoken'
import mongoose from "mongoose";

const generateAccessAndRefreshToken=async(userId)=>{
    try {
        const user=await User.findById(userId)

        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh tokens!")
    }
    
}  

const registerUser=asyncHandler(async (req,res)=>{
    const {fullname,username,email,password}=req.body

    if([fullname,username,email,password].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser=await User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    const avatarLocalPath=req.files?.avatar[0]?.path
    let coverImageLocalPath
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400,"Avatar file is required")
    }

    const user=await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        email,
        username:username.toLowerCase(),
        password
    })

    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }
    
    return res.status(200).json(
        new ApiResponse(201,createdUser,"User registered successfully")
    )
})

const loginUser=asyncHandler(async (req,res)=>{
    const {username,email,password}=req.body;

    if(!(username || email)){
        throw new ApiError(404,"username or email are required")
    }

    const user=await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(401,"User not found!")
    }

    const isPassword=await user.isPasswordCheck(password)

    if(!isPassword){
        throw new ApiError(404,"Invalid credentials")
    }
    
    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)

    const loggedInUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,
                accessToken,
                refreshToken
            },
            "User loggedIn successfully"
        )
    )

})

const logoutUser=asyncHandler(async (req,res)=>{
    const user=req.user
    await User.findByIdAndUpdate(
        user._id,
        {
            $set: {refreshToken:undefined}
        },
        {
            new:true
        }
    )

    const options={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,"","User logged out successfully"))
})

const refreshAccessToken=asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookie.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }

    const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

    const user=await User.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401,"Invalid refresh Token")
    }

    if(incomingRefreshToken!==user.refreshToken){
        throw new ApiError(401,"refresh token is expired or used")
    }

    const {accessToken,newRefreshToken}=generateAccessAndRefreshToken(user._id)

    const options={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
            accessToken,
            refreshToken:newRefreshToken
            },
            "Access token refreshed"
        )
    )

})

const changeCurrentPassword=asyncHandler(async (req,res)=>{
    const {oldPassword,newPassword}=req.body

    const user=await User.findById(req.user?._id)
    const isPasswordCorrect=user.isPasswordCheck(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    user.password=newPassword
    user.save({validateBeforeSave:false})

    return res.status(200)
    .json(
        200,
        {},
        "Password changed successfully"
    )
})

const getUserData=asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(
        new ApiResponse(
            200,
            {
                user:req.user
            },
            "User data fetched successfully"
        )
    )
})

const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullname,email}=req.body

    if(!fullname || !email){
        throw new ApiError(400,"Something went wrong while fetching user details")
    }

    const user=await User.findByIdAndDelete(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "user details updated successfully"
        )
    )
})

const updateUserAvatar=asyncHandler(async (req,res)=>{
    const localFilePath=req.file?.path

    if(!localFilePath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar=await uploadOnCloudinary(localFilePath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading avatar")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new:true
        }
    ).select("-password")
    
    return res.status(200)
    .json(
        new ApiResponse(
            200, user,"avatar updated successfully"
        )
    )
})

const updateUserCoverImage=asyncHandler(async (req,res)=>{
    const coverImageLocalFilePath=req.file?.path

    if(!coverImageLocalFilePath){
        throw new ApiError(400,"cover Image file is missing")
    }

    const coverImage=await uploadOnCloudinary(coverImageLocalFilePath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading cover image")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-paswword")

    return res.status(200)
    .json(
        new ApiResponse(
            200, user,"cover image updated successfully"
        )
    )
})

const getUserChannelDetails=asyncHandler(async(req,res)=>{
    const {username}=req.params

    if(!username?.trim()){
        throw new ApiError(400,"username is empty")
    }

    const channel=await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size: "$subscribers"
                },
                subscribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in: [req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }

        },
        {
            $project:{
                username:1,
                fullname:1,
                email:1,
                subscribedToCount:1,
                subscribersCount:1,
                avatar:1,
                coverImage:1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(400,"channel does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            channel[0],
            "User channel fetched successfully"
        )
    )
})

const getUserWatchHistory=asyncHandler(async (req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        } 
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getUserData,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelDetails,
    getUserWatchHistory
}