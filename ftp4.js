import dotenv from 'dotenv';
dotenv.config(); // Initialize dotenv configuration
import sharp from 'sharp';
import express from 'express';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import Client from 'ssh2-sftp-client';
import { MongoClient, ObjectId } from 'mongodb';
import { Storage } from '@google-cloud/storage';
import mime from 'mime';
import { fileURLToPath } from 'url';
import cors from "cors"
import cron from 'node-cron';
import axios from 'axios';
import multer from 'multer';

//change
import bycrypt from "bcryptjs"
import mongoose from "mongoose";
import jwt from "jsonwebtoken"



import { PDFDocument } from 'pdf-lib';

const app = express();
const port = 3010;
app.use(express.json());
app.use(cors())
dotenv.config();
const mongoUrl = process.env.MONGO_URI;
const dbName = 'tpb';
const dbName2 = 'Documenttask';
const client = new MongoClient(mongoUrl, { useUnifiedTopology: true });
app.use('/uploads', express.static('uploads'));





const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const LOCAL_DIR = path.join(__dirname, process.env.LOCAL_DIR);
const EXCEL_FILE = path.join(__dirname, process.env.EXCEL_FILE);

// Ensure LOCAL_DIR exists
if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
}

let bucket;
let bucketName;
async function fetchCredentialsFromMongo() {
  try {
      const db = client.db(dbName);
      const collection = db.collection('credentials2');
      const document = await collection.findOne();
      return document.credentials;
  } catch (err) {
      console.error('Error fetching credentials from MongoDB:', err);
      return null;
  }
}
async function connectToMongo() {
    try {
      await client.connect();
      console.log('Connected to MongoDB');
      const fetchedCredentials = await fetchCredentialsFromMongo();

      // Parse the fetched credentials back to JSON format
      const serviceCredentials = JSON.parse(fetchedCredentials);
      // console.log(serviceCredentials)
      const storage = new Storage({ credentials: serviceCredentials });
      // const storage = new Storage({ keyFilename: serviceCredentials.credentials });
       bucketName = "docanalyzerimagesupload";
      bucket = storage.bucket(bucketName); // Assign bucket here
      console.log("Storage connected with fetched credentials");
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }
  
  connectToMongo();

  async function setCors() {
    const corsConfiguration = [
      {
        origin: ['*'], // Allow all origins (you can specify specific origins if needed)
        responseHeader: ['Content-Type', 'Authorization'],
        method: ['GET', 'POST', 'PUT'], // Allowed methods
        maxAgeSeconds: 3600, // How long the CORS result should be cached
      },
    ];
    const fetchedCredentials = await fetchCredentialsFromMongo();

      // Parse the fetched credentials back to JSON format
      const serviceCredentials = JSON.parse(fetchedCredentials);
      // console.log(serviceCredentials)
      const storage = new Storage({ credentials: serviceCredentials });
  
    try {
      bucketName = "docanalyzerimagesupload";
      await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
      console.log(`CORS configuration has been set for ${bucketName}`);
    } catch (error) {
      console.error('Error setting CORS configuration:', error);
    }
  }
  
  setCors();





const uploadToGCS = async (buffer, filename) => {
  let filename2=filename.trimStart()
  if (filename.toLowerCase().endsWith('.tiff') || filename.toLowerCase().endsWith('.tif')) {
      
    console.log(`Converting multi-page TIFF to PDF for ${filename}...`);

    const pdfDoc = await PDFDocument.create();

    // Process the TIFF image buffer with sharp
    const image = Buffer.from(buffer);
    const metadata = await sharp(image).metadata();
    
    console.log(`TIFF metadata: ${JSON.stringify(metadata)}`);
    
    // Ensure we have the correct page count
    // if (metadata.pages < 2) {
    //   console.log('Only one page found in TIFF, not proceeding further.');
    //   return;
    // }

    // Loop through each page in the TIFF
    for (let i = 0; i < metadata.pages; i++) {
      console.log(`Processing page ${i + 1} of TIFF...`);

      // Extract each page from the TIFF as a PNG buffer
      const pageBuffer = await sharp(image, { page: i }).png().toBuffer();
      
      // Check the dimensions of the converted page
      const { width, height } = await sharp(pageBuffer).metadata();
      console.log(`Page ${i + 1} dimensions: ${width}x${height}`);

      // Embed the PNG image in the PDF
      const pngImage = await pdfDoc.embedPng(pageBuffer);

      // Add the page to the PDF with appropriate dimensions
      const page = pdfDoc.addPage([width, height]);

      // Draw the image on the page
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
      
      console.log(`Page ${i + 1} added to PDF`);
    }

    // Save the PDF to a buffer
    filename2 = filename2.trimStart();
    const pdfBytes = await pdfDoc.save();
    buffer = Buffer.from(pdfBytes); // Update buffer with the PDF data
    filename2 = filename2.replace(/\.tiff?$/i, '.pdf');
    // Change file extension to .pdf

    console.log(`PDF created successfully with ${pdfDoc.getPages().length} pages`);
  }
  
    const file = bucket?.file(filename2);
    const mimeType = mime.getType(filename2) || 'application/octet-stream';
  
    await file.save(buffer, {
      contentType: mimeType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });
  
    await file.makePublic();  // Make the file public
    return `https://storage.googleapis.com/${bucketName}/${filename2}`;
  };


 
  app.get('/fetchnewfile', async (req, res) => {
    const sftp = new Client();
    const pattern = /^\d{5}-\d{8}-\d{2}$/; // Define the regex pattern
  
    try {
      console.log('Fetching SFTP credentials from MongoDB...');
      const db = client.db(dbName);
      const db2 = client.db(dbName2);
  
      const collection1 = db.collection('credentials');
      const credentials = await collection1.findOne({}, { projection: { host: 1, port: 1, username: 1, password: 1, _id: 0 } });
      
      const config = {
        port: credentials["port"],
        host: credentials["host"],
        username: credentials["username"],
        password: credentials["password"],
      };
  
      console.log('Attempting to connect to SFTP server...');
      await sftp.connect(config); // Wait for SFTP connection to be established
      console.log('SFTP client ready');
      
      const collection = db.collection('new_batches');
      const files = await sftp.list('/var/www/html/tpb');//path of folder
      

      const collectionfips=db.collection('Fips')
      const fipsData = await collectionfips.find({}).toArray();
      const fipsMap = {};
      fipsData.forEach(item => {
          fipsMap[item.FIPS] = {
              state: item.State,
              countyName: item["County Name"],
              State_County:item.State_County

          };
      });


        // Fetch the highest uniqueid and set the starting point
    let lastBatch = await collection.findOne({}, { sort: { uniqueid: -1 }, projection: { uniqueid: 1 } });
    let nextUniqueId = lastBatch ? lastBatch.uniqueid + 1 : 1110;

    console.log("---",nextUniqueId)
  
    
      
      for (const file of files) {
        const { name } = file;
        console.log(name)
        const fipsCode = parseInt(name.split('-')[0]); // Adjust split if needed
        console.log(fipsCode)
        const locationData = fipsMap[fipsCode] || { state: 'Unknown', countyName: 'Unknown' };
        console.log("locat",locationData)

          const countyConfigCollection = db2.collection('Countyconfigurationlist');
        const countyConfig = await countyConfigCollection.findOne({ State_County: locationData.State_County });
        const fields = countyConfig ? countyConfig : {}; 
        
        if (!pattern.test(name)) {
          console.log(`Filename ${name} does not match pattern. Skipping...`);
          continue; // Skip files that do not match the pattern
        }
        
        // Check if the filename already exists in the collection
        const existingImage = await collection.findOne({ batchname: name });
        if (existingImage) {
          console.log(`Image with filename ${name} already exists. Skipping...`);
          continue; // Skip saving the duplicate image
        }
        const createdAt = new Date(); 
        // Insert the new document
       
        await collection.insertOne({
          batchname: name,
          status: "0",
          folderpath: "/var/www/html/tpb",
          createdAt: createdAt,
          uniqueid: nextUniqueId,
      
    
        });
        console.log(`Stored ${name} in MongoDB`);

        nextUniqueId++;
      }
  
      await sftp.end();
      res.send("Stored in MongoDB");
    } catch (error) {
      console.error(error.message);
      res.status(500).send('An error occurred');
    }
  });





async function processBatches() {
  const sftp = new Client();

  try {
    console.log('Fetching SFTP credentials from MongoDB...');
    const db = client.db(dbName);

    const collection1 = db.collection('credentials');
    const credentials = await collection1.findOne({}, { projection: { host: 1, port: 1, username: 1, password: 1, _id: 0 } });
    console.log(credentials["port"]);

    const config = {
      port: credentials["port"],
      host: credentials["host"],
      username: credentials["username"],
      password: credentials["password"],
    };
    console.log('Attempting to connect to SFTP server...');

    await sftp.connect(config); // Wait for SFTP connection to be established
    console.log('SFTP client ready');

    const collection = db.collection('imagescollection');
    const collectionNewBatches = db.collection('new_batches');

    // Find all batches with status 'processing' (status '1')
    const processingBatches = await collectionNewBatches.find({ status: '0' }).toArray();

    if (processingBatches.length === 0) {
      console.log("No batches in processing state found.");
      return;
    }

    for (const batch of processingBatches) {
      const batchname = batch.batchname;
      console.log(`Processing batch ${batchname} in cron`);

      const files = await sftp.list(`/var/www/html/tpb/${batchname}`);

     

      for (const file of files) {
        const lastImage = await collection.find().sort({ uniqueid: -1 }).limit(1).toArray();
        // let uniqueid = lastImage.length ? lastImage[0].uniqueid + 1 : 1110;
        const { name } = file;
        const namefinal = batchname + "/ " + name;
        console.log("n", namefinal);

        const existingImage = await collection.findOne({ filename: namefinal });
        console.log("hghghg",existingImage)
        if (existingImage) {
          console.log(`Image with filename ${name} already exists. Skipping...`);
       
        }else{
          let uniqueid = lastImage.length ? lastImage[0].uniqueid + 1 : 1110;
          const filePath = `/var/www/html/tpb/${batchname}` + "/" + name;
          const fileData = await sftp.get(filePath);
          console.log("fileData", fileData);
  
          const imageUrl = await uploadToGCS(fileData, namefinal);
          const createdAt = new Date();
  
          await collection.insertOne({
            filename: namefinal,
            image: imageUrl,
            status: "notprocessed",
            created_date: createdAt,
            batchname: batchname,
            stage: "--",
            uniqueid: uniqueid,
       
          });
  
          console.log(`Stored ${name} in MongoDB`);
        }
  
        await collectionNewBatches.updateOne(
          { batchname: batchname },
          { $set: { status: "1" } }
        );
  
        console.log(`Batch ${batchname} processed and updated to status 1`);
      }
        }

        

    await sftp.end();
    console.log("All processing batches have been updated.");
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}


//Schedule the function to run every 15 minutes
cron.schedule("*/1 * * * *", () => {
  console.log("Running batch process every 1 minute...");
  processBatches();
});


    cron.schedule('* * * * *', async () => {
    try {
      console.log('Running scheduled task: Fetch Images');

      await axios.get(`http://localhost:3010/fetchnewfile`);
    } catch (error) {
      console.error('Error running scheduled task:', error);
    }
  });




  
  




    
    
    
   



    
    
  
  


    // app.post('/checkRecordingDate', async (req, res) => {
    //   const { batchName, recordingDate } = req.body;
    
    //   if (!batchName || !recordingDate) {
    //     return res.status(400).json({ error: 'batchName and recordingDate are required' });
    //   }
    
    //   try {
    //     // Convert the recordingDate from the body to a Date object for comparison
    //     const newRecordingDate = new Date(recordingDate);
    
    //     // Connect to the database
    //     const db = client.db(dbName);
    //     const collection = db.collection('IDA_demo');
    
    //     // Query to get the highest recordingDate for the specified batchName
    //     const result = await collection.aggregate([
    //       { $match: { 'batchname': batchName } }, // Match the batchName
    //       { $group: { _id: null, maxRecordingDate: { $max: '$Indexing_fields.recordingDate' } } } // Find the max recordingDate
    //     ]).toArray();
    
    //     if (result.length === 0) {
    //       return res.status(404).json({ message: 'No documents found for the specified batchName' });
    //     }
    
    //     const maxRecordingDate = new Date(result[0].maxRecordingDate);
    
    //     // Compare the new recordingDate with the highest one in the batch
    //     if (newRecordingDate <= maxRecordingDate) {
    //       return res.status(400).json({
    //         status:"failed",
    //         message: `The new recordingDate should be higher than the highest`,
    //         maxRecordingDate: maxRecordingDate
    //       });
    //     }
    
    //     // If the new recordingDate is valid, proceed with the desired operation (e.g., inserting or updating the document)
    //     res.status(200).json({
    //       status:"success",
    //       // message: 'The recordingDate is valid and is higher than the highest recordingDate for the batch.',
    //       maxRecordingDate: maxRecordingDate
    //     });
    //   } catch (error) {
    //     console.error('Error checking recordingDate:', error);
    //     res.status(500).json({ error: 'An error occurred while checking the recordingDate' });
    //   }
    // });
    
    // app.post('/checkRecordingDate', async (req, res) => {
    //   const { batchName, recordingDate } = req.body;
    
    //   if (!batchName || !recordingDate) {
    //     return res.status(400).json({ error: 'batchName and recordingDate are required' });
    //   }
    
    //   try {
    //     // Parse the date in UTC (assume the frontend sends MM/DD/YYYY format)
    //     const [month, day, year] = recordingDate.split('/').map(Number); // Extract month, day, year
    //     const newRecordingDate = new Date(Date.UTC(year, month - 1, day)); // Create a UTC date
    //     console.log('Entered rec date:', recordingDate);
    //     console.log('Parsed recordingDate in UTC:', newRecordingDate);
    
    //     // Check if the parsed date is valid
    //     if (isNaN(newRecordingDate)) {
    //       return res.status(400).json({ error: 'Invalid recordingDate format. Use MM/DD/YYYY.' });
    //     }
    
    //     // Connect to the database
    //     const db = client.db(dbName);
    //     const collection = db.collection('IDA_demo');
    
    //     // Query to get the highest recordingDate for the specified batchName
    //     // const result = await collection.aggregate([
    //     //   { $match: { batchname: batchName } },
    //     //   { $group: { _id: null, maxRecordingDate: { $max: '$Indexing_fields.recordingDate' } } }
    //     // ]).toArray();
    //     const result = await collection.find({ batchname: batchName }).toArray();
    
    //     if (result.length === 0) {
    //       return res.status(404).json({ message: 'No documents found for the specified batchName' });
    //     }
    
    //     const maxRecordingDate = result.reduce((maxDate, doc) => {
    //       const recordingDate = doc.Indexing_fields?.recordingDate; // Safely access recordingDate
    //       if (!recordingDate) {
    //         return maxDate; // Skip null or undefined dates
    //       }
        
    //       const [month, day, year] = recordingDate.split('/').map(Number);
    //       const currentRecordingDate = new Date(Date.UTC(year, month - 1, day));
        
    //       return currentRecordingDate > maxDate ? currentRecordingDate : maxDate;
    //     }, new Date(0)); // Initialize with the earliest possible date
        
    //     if (maxRecordingDate.getTime() === new Date(0).getTime()) {
    //       return res.status(404).json({ message: 'No valid recordingDate found for the specified batchName' });
    //     }
        
    //     console.log('Max recordingDate in UTC:', maxRecordingDate);
        
    
    //     // Compare the dates
    //     if (newRecordingDate <= maxRecordingDate) {
    //       return res.status(400).json({
    //         message: `The new recordingDate should be higher than the highest recordingDate for batch ${batchName}`,
    //         maxRecordingDate: maxRecordingDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
    //       });
    //     }
    
    //     res.status(200).json({
    //       message: 'The recordingDate is valid and is higher than the highest recordingDate for the batch.',
    //       maxRecordingDate: maxRecordingDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
    //     });
    //   } catch (error) {
    //     console.error('Error checking recordingDate:', error);
    //     res.status(500).json({ error: 'An error occurred while checking the recordingDate' });
    //   }
    // });


  


 






  


app.listen(port, () => {
    console.log(`SFTP PDF Processor API listening at http://localhost:${port}`);
    console.log(`Using Excel file: ${EXCEL_FILE}`);
});
