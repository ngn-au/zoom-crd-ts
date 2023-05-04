# Zoom Call Recording Webhook App

The Zoom Call Recording Webhook App is a Node.js application that allows you to automatically record your Zoom calls and store them in a designated folder. It also retrieves caller ID information and logs details of the call such as its duration and direction.

![zoomphone-logo-800x418](https://user-images.githubusercontent.com/107200645/236102060-8f61bcd0-6169-4421-b0d8-5ef2fafab6b9.jpg)

## Technical Details

The Zoom Call Recording Webhook App is built using Node.js and various libraries including `axios`, `fs`, `samba-client`, `sanitize-filename`, and `dns`. It is deployed on a server and listens for incoming requests from Zoom's webhook service. When it receives a webhook request, it retrieves the relevant call details and caller ID information, records the call, and stores it in a designated folder.

To ensure the security of your Zoom account, the application uses a combination of OAuth2 and the Zoom API to authenticate with the Zoom service. It also uses Samba to upload the recorded call to a designated network share, allowing you to access it remotely.

## Installation

To install and run the Zoom Call Recording Webhook App, follow these steps:

1. Clone the repository into `/opt/zoom-crd-ts/` (Important for `start.sh`)
2. Install the necessary dependencies by running `npm install`
3. Install [forever](https://www.npmjs.com/package/forever) `npm install -g forever`
4. Create a copy of the `.env.example` file and name it `.env`
5. Fill in the required environment variables in the `.env` file

## Usage

To start the service: `./start.sh` 
To stop the service `forever stopall`

Or you can do it your own way, eg `npm run start`

To use the Zoom Call Recording Webhook App, you'll need to configure your Zoom account to send webhook requests to your server. You can do this by following these steps:

1. Log in to your Zoom account
2. Navigate to the Zoom App Marketplace and create a new webhook-only app
3. Enter your server's URL as the endpoint URL
4. Configure the webhook to trigger on the desired event (e.g. Call Recording Completed)
5. Save the app and authorize it to access your Zoom account

Once you've configured your Zoom account, the Zoom Call Recording Webhook App will automatically listen for incoming webhook requests and record your calls at `/webhook` - but it will need to be over HTTPS, so you will need a proxy infront.

## .env Variables

The `.env` file contains several environment variables that are required for the application to run. These include:

- `ZOOM_APP_CLIENT_ID`: Your Zoom App Client ID
- `ZOOM_APP_CLIENT_SECRET`: Your Zoom App Client Secret
- `ZOOM_APP_ACCOUNT_ID`: Your Zoom Account ID
- `SAMBA_ADDRESS`: The IP address or hostname of the Samba share
- `SAMBA_USERNAME`: Your Samba username
- `SAMBA_PASSWORD`: Your Samba password
- `SAMBA_DOMAIN`: The Samba domain (if applicable)

You should copy the `.env.example` file and fill in the required values for your environment.

## Customisation 

Study the fetchAndDrop() function, Your logic will need to reside here, see example:

```typescript
    // determine initials based on email string, however boss@ is BOS
    user_list.users.forEach((user: any) => {
      if (user.email.startsWith('xyz+')) {
        user_dir[user.extension_number] = user.email.substr(3).replace('@example.com.au', '').toUpperCase()
  
      } else if (user.email == 'boss@example.com.au' ) {
        user_dir[user.extension_number] = 'BOS'
      }
    })
    
    ...
    
    // Determine filename and directory based on various conditions 
    if (body.payload.object.recordings[0].accepted_by !== undefined) {
      const ext = body.payload.object.recordings[0].accepted_by.extension_number
      directory = sanitize(user_dir[ext])
      filename = sanitize(caller_name+" to "+directory+" - "+timeAndDuration+'.mp3')
    } else if (body.payload.object.recordings[0].outgoing_by !== undefined ) {
      const ext = body.payload.object.recordings[0].outgoing_by.extension_number
      directory = sanitize(user_dir[ext])
      filename = sanitize(caller_name+" to "+callee_name+" - "+timeAndDuration+'.mp3')
    } else if (user_dir[extension_number] !== undefined) {
      directory = sanitize(user_dir[extension_number])
      filename = sanitize(caller_name+" to "+callee_name+" - "+timeAndDuration+'.mp3')
    } 
```

This will likely take time and thourough testing. 

## User Permissions

To use the `Zoom Call Recording Webhook App`, you'll need to ensure that the user running the application has the necessary permissions to write to the designated recording folder and upload files to the Samba share. You may also need to configure your server's firewall to allow incoming webhook requests from Zoom's servers.

In order for the application to function properly, it requires certain permissions to be granted. 

Firstly, the app requires permission to access Zoom's API. This is done by generating an access token using OAuth 2.0 authentication with the "account_credentials" grant type. The access token allows the app to fetch phone call recordings from the user's Zoom account. 

Secondly, the app requires access to the Samba share where the call recordings will be uploaded. This is done by providing the app with the necessary credentials (address, username, password, and domain) for the Samba share. 

Thirdly, the app requires the following Zoom scopes to be authorized:

- `phone:read` - Required to read the call logs and recordings of the user's Zoom account.
- `phone:write` - Required to delete call logs and recordings in the user's Zoom account.
- `account:read:admin` - Required to fetch user details such as extension number and email address.
- `recording:read` - Required to fetch recording details such as the recording file URL.

To grant these permissions, the Zoom Call Recording Webhook App application should be registered in the Zoom App Marketplace and installed for each user that will use the app. Additionally, the necessary permissions and scopes should be specified in the app's OAuth 2.0 configuration. 

To make it easier for others to configure the app with the necessary environment variables, an `.env.example` file is included in the repository that lists all the required environment variables with example values. Users should copy this file and rename it to `.env`, then update the values for their specific use case. 

It is important to ensure that the necessary permissions and scopes are granted to the app to prevent any issues with fetching and uploading call recordings.
