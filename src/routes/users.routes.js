import { Router } from "express";
import {logoutUser, registerUser,loginUser,refreshAccessToken} from '../controllers/users.controller.js'
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

export default router