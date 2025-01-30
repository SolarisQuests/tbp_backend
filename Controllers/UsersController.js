import dotenv from 'dotenv';
import moment from 'moment-timezone'
dotenv.config(); // Initialize dotenv configuration
import { MongoClient, ObjectId } from 'mongodb'




//change
import bycrypt from "bcryptjs"
import mongoose from "mongoose";
import jwt from "jsonwebtoken"
const mongoUrl = process.env.MONGO_URI;

const dbName = 'tpb';
const client = new MongoClient(mongoUrl, { useUnifiedTopology: true });


export const RegisterUser=async (req, res) => {

    // Extract fields from the data object
    const {
      EmpID,
      firstname,
      username,
      DOJ,
      DOJProcess,
      Designation,
      Role,
      //Level,
      TypeofUser,
      Process,
      Subprocess,
      TL,
      AM,
      Manager,
      Shift,
      DataPopulation,
      password,
      status,
      SingleDual // Password is optional
    } = req.body;
  
    try {
      const db = client.db(dbName);
      const userCollection = db.collection('users');
  
      // Check if user already exists based on EmpID or another unique field
      let user = await userCollection.findOne({ EmpID });
      console.log(user)
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }
  
      // If no password is provided, assign a default password
      const defaultPassword = "demo@1234"; 
      const userPassword = password || defaultPassword; // Use the provided password or default
      const passwordstatus = password ? 1 : 0;
      // Hash the password
      const salt = await bycrypt.genSalt(10);
      const hashedPassword = await bycrypt.hash(userPassword, salt);


      const currentDate = moment();
      const dojProcessDate = moment(DOJProcess);
      
      const duration = moment.duration(currentDate.diff(dojProcessDate));
      const years = duration.years();
      const months = duration.months();
      const days = duration.days(); // Remaining days after the months
  
      // Save the duration in the format of 'x years, y months, z days' or 'y months, z days'
      let processTn;
      if (years > 0) {
        processTn = `${years} years ${months} months ${days} days`;
      } else {
        processTn = `${months} months ${days} days`;
      }
  
      // Create the new user object with all fields
      const newUser = {
        EmpID,
        firstname,
        username,
        DOJ,
        DOJProcess,
        Designation,
        Role,
        //Level,
        TypeofUser,
        Process,
        Subprocess,
        TL,
        AM,
        Manager,
        Shift,
        DataPopulation,
        password: hashedPassword,
        status,
        SingleDual,
        passwordstatus,
        processTn 
         // Store the hashed password
      };
  
      // Insert the new user into the users collection
      const result = await userCollection.insertOne(newUser);
  
      console.log('User saved:', result.insertedId); // Log the inserted user ID
  
      res.status(201).json({ message: 'User registered successfully', userId: result.insertedId });
    } catch (err) {
      console.error('Error:', err);
      res.status(500).send('Server error');
    }
  }


  export const LoginUser=async(req,res)=>{
    const { username, password } = req.body;

  try {
    const db = client.db(dbName);
    const userCollection = db.collection('users');
    const user = await userCollection.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bycrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({token:token,user:user});
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
  }

  export const UpdateUser=async (req, res) => {

    // Extract fields from the data object
    const {
      EmpID,
      firstname,
      username,
      DOJ,
      DOJProcess,
      Designation,
      Role,
      //Level,
      TypeofUser,
      Process,
      Subprocess,
      TL,
      AM,
      Manager,
      Shift,
      DataPopulation,
      password,
      status,
      SingleDual // Password is optional
    } = req.body;
  
    try {
      const db = client.db(dbName);
      const userCollection = db.collection('users');
  
      // Check if user already exists based on EmpID or another unique field
      let user = await userCollection.findOne({ EmpID });
      if (user) {
        // const passwordstatus = password ? 1 : 0;

      // Only hash the password if it has been provided
      if (password) {
        const salt = await bycrypt.genSalt(10);
        const hashedPassword = await bycrypt.hash(password, salt);
        user.password = hashedPassword; // Update the password if provided
      }

      const currentDate = moment();
      const dojProcessDate = moment(DOJProcess);
      
      const duration = moment.duration(currentDate.diff(dojProcessDate));
      const years = duration.years();
      const months = duration.months();
      const days = duration.days(); // Remaining days after the months
  
      // Save the duration in the format of 'x years, y months, z days' or 'y months, z days'
      let processTn;
      if (years > 0) {
        processTn = `${years} years ${months} months ${days} days`;
      } else {
        processTn = `${months} months ${days} days`;
      }

      // Update the user with new fields
      await userCollection.updateOne(
        { EmpID },
        {
          $set: {
            firstname,
            username,
            DOJ,
            DOJProcess,
            Designation,
            Role,
            //Level,
            TypeofUser,
            Process,
            Subprocess,
            TL,
            AM,
            Manager,
            Shift,
            DataPopulation,
            password: user.password, // Only update password if provided
            status,
            SingleDual,
            passwordstatus:user.passwordstatus,
            processTn
          }
        }
      );

      console.log('User updated:', EmpID); // Log the updated EmpID
      return res.status(200).json({ message: 'User updated successfully' });
      }else {
        console.log("hi")
        // If no password is provided, assign a default password
        const defaultPassword = "demo@1234"; // Change this to a more secure default
        const userPassword = password || defaultPassword; // Use the provided password or default
        const passwordstatus = password ? 1 : 0;
  
        // Hash the password
        const salt = await bycrypt.genSalt(10);
        const hashedPassword = await bycrypt.hash(userPassword, salt);

        const currentDate = moment();
      const dojProcessDate = moment(DOJProcess);
      
      const duration = moment.duration(currentDate.diff(dojProcessDate));
      const years = duration.years();
      const months = duration.months();
      const days = duration.days(); // Remaining days after the months
  
      // Save the duration in the format of 'x years, y months, z days' or 'y months, z days'
      let processTn;
      if (years > 0) {
        processTn = `${years} years ${months} months ${days} days`;
      } else {
        processTn = `${months} months ${days} days`;
      }
  
        // Create the new user object with all fields
        const newUser = {
          EmpID,
          firstname,
          username,
          DOJ,
          DOJProcess,
          Designation,
          Role,
          //Level,
          TypeofUser,
          Process,
          Subprocess,
          TL,
          AM,
          Manager,
          Shift,
          DataPopulation,
          password: hashedPassword,
          status,
          SingleDual,
          passwordstatus,
          processTn
        };
  
        // Insert the new user into the users collection
        const result = await userCollection.insertOne(newUser);
  
        console.log('User saved:', result.insertedId); // Log the inserted user ID
        return res.status(201).json({ message: 'User registered successfully', userId: result.insertedId });
      }
  
     
    } catch (err) {
      console.error('Error:', err);
      res.status(500).send('Server error');
    }
  }


export const getallusers=async(req,res)=>{
    try {
        const db = client.db(dbName);
        const collection = db.collection('users');
    
        const users = await collection.find({}).toArray();
    
    
    
        console.log(users?.length);
        res.status(200).json(users); 
    } catch (error) {
        console.log(error)
    }
}
export const getallusersnames=async(req,res)=>{
    try {
        const db = client.db(dbName);
        const collection = db.collection('users');
    
        const users = await collection.find({}, { projection: { username: 1, firstname: 1, _id: 0 } }).toArray();
    
    
    
        console.log(users?.length);
        res.status(200).json(users); 
    } catch (error) {
        console.log(error)
    }
}

export const getUserById = async (req, res) => {
  try {
      const { id } = req.params; // Extract user ID from request parameters
      const db = client.db(dbName);
      const collection = db.collection('users');

      // Query the database to find the user by ObjectId
      const user = await collection.findOne({ _id: new ObjectId(id) });

      if (user) {
          res.status(200).json(user); // Send the found user as response
      } else {
          res.status(404).json({ message: 'User not found' }); // Handle user not found
      }
  } catch (error) {
      console.error(error);
      if (error instanceof Error && error.name === 'BSONTypeError') {
          res.status(400).json({ message: 'Invalid user ID format' }); // Handle invalid ObjectId format
      } else {
          res.status(500).json({ message: 'An error occurred' }); // Handle other server errors
      }
  }
};


export const resetPassword = async (req, res) => {
    const { username, newPassword } = req.body; // Expecting username and new password in the request body
  
    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password are required.' });
    }
  
    try {
      // Connect to the database
    
      const db = client.db(dbName);
      const userCollection = db.collection('users');
  
      // Check if the user exists
      const user = await userCollection.findOne({ username });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      // Hash the new password
      const salt = await bycrypt.genSalt(10);
      const hashedPassword = await bycrypt.hash(newPassword, salt);
  
      // Update the user's password in the database
      await userCollection.updateOne({ username }, { $set: { password: hashedPassword, passwordstatus: 1 } });
  
      res.status(200).json({ message: 'Password reset successfully.' });
    } catch (err) {
      console.error('Error resetting password:', err);
      res.status(500).json({ message: 'Server error' });
    } 
  };
export const resetPassword2 = async (req, res) => {
    const { username, newPassword } = req.body; // Expecting username and new password in the request body
  
    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password are required.' });
    }
  
    try {
      // Connect to the database
    
      const db = client.db(dbName);
      const userCollection = db.collection('users');
  
      // Check if the user exists
      const user = await userCollection.findOne({ username });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      // Hash the new password
      const salt = await bycrypt.genSalt(10);
      const hashedPassword = await bycrypt.hash(newPassword, salt);
  
      // Update the user's password in the database
      await userCollection.updateOne({ username }, { $set: { password: hashedPassword, passwordstatus: 0 } });
  
      res.status(200).json({ message: 'Password reset successfully.' });
    } catch (err) {
      console.error('Error resetting password:', err);
      res.status(500).json({ message: 'Server error' });
    } 
  };










export const updatelevels= async (req, res) => {
  try {
    // Destructure incoming request data
    const { userId, levels } = req.body;

    if (!userId || !ObjectId.isValid(userId) || !Array.isArray(levels)) {
      return res.status(400).json({ message: 'Invalid request data.' });
    }

    // Convert userId to ObjectId
    const userObjectId = new ObjectId(userId);

    // Connect to MongoDB
    await client.connect();

    const db = client.db(dbName);
    const usersCollection = db.collection("users");

    // Find the user by _id (userId)
    const user = await usersCollection.findOne({ _id: userObjectId });

    if (!user) {
      // If the user does not exist, return an error message
      return res.status(404).json({ message: 'User not found' });
    }

    // If the user exists, check if the 'levels' field exists
    if (user.levels) {
      // Update the 'levels' field with the new array
      const result = await usersCollection.updateOne(
        { _id: userObjectId },
        { $set: { levels } }
      );
      return res.status(200).json({ message: 'Levels updated successfully' });
    } else {
      // If the 'levels' field doesn't exist, add it
      const result = await usersCollection.updateOne(
        { _id: userObjectId },
        { $set: { levels } },
        { upsert: true }
      );
      return res.status(200).json({ message: 'Levels added successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } 
}
