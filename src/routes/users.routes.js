import { Router } from "express";
import {
    logoutUser,
    registerUser,
    loginUser,
    refreshAccessToken, 
    changeCurrentPassword, 
    getUserData, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage, 
    getUserChannelDetails, 
    getUserWatchHistory
    } from '../controllers/users.controller.js'
import {upload} from '../middlewares/multer.middlewares.js'
import {verifyJWT} from '../middlewares/auth.middleware.js'

const router=Router();

router.route('/register').post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser
)

router.route('/login').post(loginUser)

router.route('/logout').post(verifyJWT,logoutUser)
router.route('/refresh-token').post(refreshAccessToken)
router.route('/change-password').post(verifyJWT,changeCurrentPassword)
router.route('/get-user').get(verifyJWT,getUserData)
router.route('/update-account').patch(verifyJWT,updateAccountDetails)

router.route('/update-avatar').patch(verifyJWT,upload.single("avatar"),updateUserAvatar)
router.route('/update-coverImage').patch(verifyJWT,upload.single("coverImage"),updateUserCoverImage)

router.route('/c/:username').get(verifyJWT,getUserChannelDetails)
router.route('/history').get(verifyJWT,getUserWatchHistory)

export default router