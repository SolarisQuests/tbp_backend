import express from "express";
import {  getallusers, getallusersnames, getUserById, RegisterUser, resetPassword, resetPassword2,  updatelevels, UpdateUser} from "../Controllers/UsersController.js";
import { LoginUser } from "../Controllers/UsersController.js";


const userroute = express.Router();

userroute.post("/register-user",RegisterUser);
userroute.post("/login",LoginUser);
userroute.get("/getallusers",getallusers);
userroute.get("/getallusersnames",getallusersnames);
userroute.post("/reset-password",resetPassword);
userroute.post("/reset-password2",resetPassword2);

userroute.put("/updateusers",UpdateUser);

userroute.get('/:id', getUserById);
userroute.post('/update-levels', updatelevels);



export default userroute;