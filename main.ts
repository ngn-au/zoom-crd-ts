import dotenv from 'dotenv'; // Import dotenv for loading environment variables from .env file
const port: any = process.env.PORT ?? 4000 // Set the port to listen on, defaulting to 4000
import express, { NextFunction } from 'express'; // Import the express framework
import bodyParser from 'body-parser'; // Import bodyParser to parse the request body
const crypto = require('crypto') // Import crypto module for hashing functions
import async from 'async'; // Import async module for queueing webhook processing
import functions, { IZoomHeaders, IZoomWebhookBody } from "./functions" // Import custom functions module

// setup express app
const app = express() // Create express app
app.use(bodyParser.json()) // Use bodyParser middleware to parse request body
dotenv.config() // Load environment variables from .env file

// Create async queue for processing webhooks
const queue = async.queue(async (task: any, callback: any) => {
    try {
      await task(); // Wait for task to complete
    } catch (error) {
      console.error('Error while processing task:', error);
    }
    callback(); // Call callback function to mark task as complete
  }, 1);

// default response for root path
app.get('/', (req, res) => {
    res.status(200)
    res.send(`Unauthorized`)
})

// Handle webhook POST requests
app.post('/webhook', async (req: any, res: any, next: NextFunction) => {
        let body: IZoomWebhookBody = req.body // Get the request body
        let headers: IZoomHeaders = req.headers // Get the request headers

        // construct the message string
        const message = `v0:${headers['x-zm-request-timestamp']}:${JSON.stringify(body)}`

        const hashForVerify = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? '').update(message).digest('hex')

        // hash the message string with your Webhook Secret Token and prepend the version semantic
        const signature = `v0=${hashForVerify}`

        // Validate the request came from Zoom
        if (headers['x-zm-signature'] === signature) {

          // Validate you control the webhook endpoint
          if(body.event === 'endpoint.url_validation') {
            const hashForValidate = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? '').update(body.payload.plainToken).digest('hex')

            let response = {
              message: {
                plainToken: body.payload.plainToken,
                encryptedToken: hashForValidate
              },
              status: 200
            }
      
            console.log(response.message)
      
            res.status(response.status)
            res.json(response.message)
          } else {
            // This is an authenticated request from zoom, process the webhook...
            let response = { message: 'OK', status: 200 }
            let localDate = new Date()
            console.log(localDate.toLocaleString('en-AU', <object>functions.logLocaleOptions) + ' - WebHook recieved processing...')
      
            // Respond to zoom with 200 OK status
            res.status(response.status)
            res.json(response)
      
            // Queue webhook processing
            queue.push(async () => {
                await functions.fetchAndDrop(body, headers) // Call fetchAndDrop function from functions module to process the webhook
            });
        } 
    }
})

// Start listening on the specified port
app.listen(port, '0.0.0.0', () => console.log(`Listening on 0.0.0.0:${port}!`))